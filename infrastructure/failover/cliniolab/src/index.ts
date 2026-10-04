export interface Env {
  PRIMARY_ORIGIN: string;
  BACKUP_ORIGIN: string;
  HEALTH_PATH?: string;
  FAILOVER_STATUS_CODES?: string;
}

const DEFAULT_HEALTH_PATH = "/api/health";
const DEFAULT_FAILOVER_CODES = [502, 503, 504];

function originUrl(origin: string, request: Request): URL {
  const base = new URL(origin.endsWith("/") ? origin : `${origin}/`);
  const incoming = new URL(request.url);
  base.pathname = `${base.pathname.replace(/\/$/, "")}${incoming.pathname}` || "/";
  base.search = incoming.search;
  return base;
}

function shouldFailOver(request: Request, response?: Response, error?: unknown, env?: Env): boolean {
  // Never replay mutations against a second origin. This protects payments,
  // wallet changes, purchases, and other non-idempotent operations.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  if (error) return true;
  if (!response) return false;

  const configured = (env?.FAILOVER_STATUS_CODES ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter(Number.isFinite);
  const codes = configured.length ? configured : DEFAULT_FAILOVER_CODES;
  return codes.includes(response.status);
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const healthPath = env.HEALTH_PATH || DEFAULT_HEALTH_PATH;

    if (url.pathname === "/_failover/health") {
      return new Response(JSON.stringify({ service: "cliniolab-failover", status: "ok" }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const primary = originUrl(env.PRIMARY_ORIGIN, request);

    // Lightweight health probe. It is intentionally independent of the app's
    // business routes and is safe to call from Cloudflare monitoring.
    if (url.pathname === healthPath) {
      try {
        const response = await fetchWithTimeout(primary, { method: "GET", headers: { accept: "application/json" } }, 5000);
        if (response.ok) return response;
      } catch {
        // Fall through to the backup health endpoint.
      }
      const backup = originUrl(env.BACKUP_ORIGIN, request);
      try {
        return await fetchWithTimeout(backup, { method: "GET", headers: { accept: "application/json" } }, 5000);
      } catch {
        return new Response(JSON.stringify({ status: "unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }

    let primaryResponse: Response | undefined;
    let primaryError: unknown;

    try {
      primaryResponse = await fetchWithTimeout(new Request(primary, request), {}, 10000);
    } catch (error) {
      primaryError = error;
    }

    if (primaryResponse && !shouldFailOver(request, primaryResponse, undefined, env)) {
      return primaryResponse;
    }

    if (!shouldFailOver(request, primaryResponse, primaryError, env)) {
      return primaryResponse ?? new Response("Primary origin unavailable", { status: 503 });
    }

    const backup = originUrl(env.BACKUP_ORIGIN, request);
    try {
      const backupResponse = await fetchWithTimeout(new Request(backup, request), {}, 10000);
      const headers = new Headers(backupResponse.headers);
      headers.set("x-cliniolab-failover", "backup");
      return new Response(backupResponse.body, { status: backupResponse.status, statusText: backupResponse.statusText, headers });
    } catch {
      return new Response("Service temporarily unavailable", {
        status: 503,
        headers: { "cache-control": "no-store", "x-cliniolab-failover": "exhausted" },
      });
    }
  },
};
