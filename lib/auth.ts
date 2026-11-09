import { timingSafeEqual } from "node:crypto";
import { getIdentity } from "../cursor/identity";

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "private, no-store",
};

/**
 * Website pages stay behind Cursor's private-app gate (browser sign-in).
 * /api routes also sit behind that gate, so a Grok Bot must send
 * `x-cursor-app-token` with a Cursor API key or the host returns the
 * "Open this app" HTML and this function never runs.
 *
 * Once a request reaches the app:
 * - a signed-in person (the website) may call /api
 * - otherwise only `Authorization: Bearer LOG_API_TOKEN` is accepted
 * Preview-host identities are refused so they cannot touch production data.
 */
export async function requireLogAccess(request: Request): Promise<true | Response> {
  if (bearerMatches(request)) return true;

  const identity = await getIdentity(request);
  if (identity.verified && identity.kind === "person" && identity.stage === "production") {
    return true;
  }

  return json({ error: "unauthorized" }, 401);
}

function bearerMatches(request: Request): boolean {
  const expected = process.env.LOG_API_TOKEN?.trim() ?? "";
  if (expected === "") return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (provided === "") return false;
  return tokensMatch(provided, expected);
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}
