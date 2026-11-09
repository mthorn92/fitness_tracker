import { timingSafeEqual } from "node:crypto";
import { getIdentity } from "../cursor/identity";

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "private, no-store",
};

export async function requireLogAccess(request: Request): Promise<true | Response> {
  const identity = await getIdentity(request);
  if (identity.verified) return true;

  const expected = process.env.LOG_API_TOKEN?.trim() ?? "";
  if (expected !== "") {
    const header = request.headers.get("authorization") ?? "";
    const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (provided !== "" && tokensMatch(provided, expected)) return true;
  }

  return Response.json({ error: "unauthorized" }, { status: 401, headers: JSON_HEADERS });
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
