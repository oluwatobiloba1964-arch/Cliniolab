/**
 * Cloudflare D1 HTTP API adapter, implementing the D1Database interface.
 *
 * Used on Vercel (DB_DRIVER=http, or inferred when D1_API_TOKEN is set
 * without DB_DRIVER=binding) so the same service-layer code that runs
 * against the D1 Workers binding in Cloudflare production also runs on
 * Vercel, querying the SAME database over Cloudflare's REST API. No
 * separate Postgres database, no data drift between environments.
 *
 * Docs: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
 *
 * Note: this REST API sits on the Cloudflare account-wide API rate limit
 * (control plane), not D1's query-plane limits, so it's intended for
 * testing/preview traffic, not production-scale load — which is exactly
 * the Vercel-testing / Cloudflare-production split described.
 */

import type { D1Database, D1PreparedStatement, D1Result } from '@/lib/db/client';

function getConfig() {
  const accountId = process.env.D1_ACCOUNT_ID;
  const databaseId = process.env.D1_DATABASE_ID;
  const apiToken = process.env.D1_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      'D1_ACCOUNT_ID, D1_DATABASE_ID, and D1_API_TOKEN are required when DB_DRIVER=http.'
    );
  }
  return { accountId, databaseId, apiToken };
}

interface D1ApiQueryResult {
  results: Record<string, unknown>[];
  success: boolean;
  meta: {
    duration: number;
    changes?: number;
    last_row_id?: number;
  };
}

// FIX (Vercel Hobby duration budget): bound every outbound call to the
// Cloudflare control-plane API so a slow/hung response can't pin a Vercel
// serverless function for its full max duration, burning GB-hours while
// stuck waiting. 10s is generous for a single statement but a multi-
// statement batch call (see runBatchQuery) needs headroom proportional to
// how many statements are packed into it, so callers that batch pass a
// larger budget explicitly.
const D1_HTTP_TIMEOUT_MS = 10_000;

async function postToD1(
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ success: boolean; result: D1ApiQueryResult[]; errors?: { message: string }[] }> {
  const { accountId, databaseId, apiToken } = getConfig();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`D1 HTTP API request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const responseBody = await res.json();
  if (!res.ok || !responseBody.success) {
    const message = responseBody.errors?.[0]?.message || `D1 HTTP API request failed (${res.status})`;
    throw new Error(message);
  }
  return responseBody;
}

async function runQuery(sql: string, params: unknown[]): Promise<D1ApiQueryResult> {
  const body = await postToD1({ sql, params }, D1_HTTP_TIMEOUT_MS);
  // The API returns `result` as an array (one entry per statement); a
  // single query via this endpoint always returns exactly one entry.
  return body.result[0];
}

// FIX (bulk quiz/flashcard uploads timing out) — batch() used to issue one
// HTTP round trip per statement (see the comment below on why it can't just
// fire them concurrently), so a 100-question quiz meant 101 sequential
// requests to Cloudflare's control-plane API. Each one individually stays
// under D1_HTTP_TIMEOUT_MS, but 101 of them back-to-back routinely blew
// past Vercel's total function duration budget, so the whole upload died
// mid-batch with a generic 500 and nothing saved.
//
// D1's REST /query endpoint also accepts a `batch` body - an array of
// {sql, params} - executed server-side as ONE HTTP call, in the order
// given (https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
// That turns a 50-statement chunk into a single request instead of 50,
// cutting this exact upload from 101 round trips to 3 (one per
// D1_BATCH_CHUNK_SIZE-sized chunk in quizCrudService/flashcardBulkService).
//
// The REST API docs don't explicitly state the batch is all-or-nothing the
// way the Workers binding's db.batch() is documented to be (see
// https://github.com/cloudflare/developer-platform/issues/79, unresolved).
// We don't rely on that guarantee: callers of batch() (createQuiz,
// bulkCreateQuizzes, etc.) already delete whatever they can find for a
// given id if anything in the batch throws, so a partially-applied batch
// is still cleaned up correctly either way - this change only reduces
// round trips, it doesn't change the atomicity contract callers were
// already written against.
const D1_BATCH_TIMEOUT_PER_STATEMENT_MS = 3_000;
const D1_BATCH_TIMEOUT_FLOOR_MS = 10_000;
const D1_BATCH_TIMEOUT_CEILING_MS = 55_000; // stay under Vercel's hard cap even on longer plans

async function runBatchQuery(
  statements: { sql: string; params: unknown[] }[]
): Promise<D1ApiQueryResult[]> {
  if (statements.length === 0) return [];
  if (statements.length === 1) return [await runQuery(statements[0].sql, statements[0].params)];

  const timeoutMs = Math.min(
    D1_BATCH_TIMEOUT_CEILING_MS,
    Math.max(D1_BATCH_TIMEOUT_FLOOR_MS, statements.length * D1_BATCH_TIMEOUT_PER_STATEMENT_MS)
  );
  const body = await postToD1({ batch: statements }, timeoutMs);
  // One result entry per statement, in the same order they were sent.
  return body.result;
}

class D1HttpPreparedStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(private readonly query: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  /** Exposes {sql, params} for runBatchQuery without a new HTTP call. */
  toBatchEntry(): { sql: string; params: unknown[] } {
    return { sql: this.query, params: this.values };
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const res = await runQuery(this.query, this.values);
    const row = res.results[0];
    if (!row) return null;
    if (colName) return row[colName] as T;
    return row as T;
  }

  async run(): Promise<D1Result> {
    const res = await runQuery(this.query, this.values);
    return {
      results: res.results,
      success: res.success,
      meta: res.meta,
    };
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const res = await runQuery(this.query, this.values);
    return {
      results: res.results as T[],
      success: res.success,
      meta: res.meta,
    };
  }
}

export function createD1HttpAdapter(): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      return new D1HttpPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      // FIX (data corruption on Vercel/HTTP path) — this used to run every
      // statement in the batch concurrently with independent HTTP
      // requests. That's wrong for the call sites that actually use
      // batch(): e.g. quizCrudService.createQuiz sends [insert quiz row,
      // ...insert question rows] as one batch, where every question row
      // has a foreign key on the quiz row that's supposed to be inserted
      // first. Firing them all at once with no guaranteed order and no
      // shared transaction let some question inserts land before the quiz
      // row existed (FK failure) while others succeeded — producing
      // exactly the "quiz exists with 0 questions" / "SQL logic error:
      // SQLITE_ERROR" corruption seen in production.
      //
      // FIX (bulk upload timeouts) — then fixed to run sequentially one
      // HTTP request per statement, which is correct but turns a
      // 100-question quiz into 101 round trips and blows Vercel's function
      // duration budget (see runBatchQuery above). Now sent as a single
      // `batch` request so order is preserved server-side in one call -
      // matches the D1 Workers binding's db.batch() semantics (in order,
      // one logical call) without the one-request-per-statement cost.
      const entries = statements.map((stmt) => (stmt as D1HttpPreparedStatement).toBatchEntry());
      const results = await runBatchQuery(entries);
      return results.map((r) => ({
        results: r.results as T[],
        success: r.success,
        meta: r.meta,
      }));
    },
  };
}
