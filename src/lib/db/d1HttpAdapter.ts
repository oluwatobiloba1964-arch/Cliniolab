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
// stuck waiting. 10s is generous for this endpoint but still well under
// Hobby's function timeout.
const D1_HTTP_TIMEOUT_MS = 10_000;

async function runQuery(sql: string, params: unknown[]): Promise<D1ApiQueryResult> {
  const { accountId, databaseId, apiToken } = getConfig();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), D1_HTTP_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`D1 HTTP API request timed out after ${D1_HTTP_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const body = await res.json();
  if (!res.ok || !body.success) {
    const message = body.errors?.[0]?.message || `D1 HTTP API request failed (${res.status})`;
    throw new Error(message);
  }

  // The API returns `result` as an array (one entry per statement); a
  // single query via this endpoint always returns exactly one entry.
  return body.result[0] as D1ApiQueryResult;
}

class D1HttpPreparedStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(private readonly query: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
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
      // statement in the batch concurrently with Promise.all for speed.
      // That's wrong for the call sites that actually use batch(): e.g.
      // quizCrudService.createQuiz sends [insert quiz row, ...insert
      // question rows] as one batch, where every question row has a
      // foreign key on the quiz row that's supposed to be inserted first.
      // Firing them all at once as independent HTTP requests races the
      // quiz-row insert against its own question-row inserts with no
      // guaranteed order and no shared transaction, so some question
      // inserts can land before the quiz row exists (FK failure) while
      // others succeed — producing exactly the "quiz exists with 0
      // questions" / "SQL logic error: SQLITE_ERROR" corruption seen in
      // production. The D1 Workers binding's real db.batch() runs
      // statements in order inside one transaction; this now matches that
      // behavior (sequential, in order, stop on first failure) instead of
      // silently assuming callers don't care about ordering or atomicity.
      // Slower than the old concurrent version, but correct — every
      // call site in this codebase was written assuming batch() behaves
      // like a transaction, because on the D1 binding path it does.
      const out: D1Result<T>[] = [];
      for (const stmt of statements) {
        out.push(await stmt.all<T>());
      }
      return out;
    },
  };
}
