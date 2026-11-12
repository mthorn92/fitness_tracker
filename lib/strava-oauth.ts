import { timingSafeEqual } from "node:crypto";

const STATE_COOKIE = "strava_oauth_state";

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = firstHeader(request.headers.get("x-forwarded-host")) ?? url.host;
  const proto = firstHeader(request.headers.get("x-forwarded-proto")) ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function stravaAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "force");
  url.searchParams.set("scope", "activity:read_all");
  url.searchParams.set("state", options.state);
  return url.toString();
}

export function stravaCallbackUrl(origin: string): string {
  return new URL("/api/strava/callback", origin).toString();
}

export function stateCookie(state: string, secure: boolean): string {
  return cookie(STATE_COOKIE, state, { maxAge: 600, secure });
}

export function clearStateCookie(secure: boolean): string {
  return cookie(STATE_COOKIE, "", { maxAge: 0, secure });
}

export function readStateCookie(header: string | null): string | null {
  return readCookie(header, STATE_COOKIE);
}

export function statesMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function cookie(name: string, value: string, options: { maxAge: number; secure: boolean }): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/strava",
    `Max-Age=${options.maxAge}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function firstHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim() ?? "";
  return first === "" ? null : first;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function htmlPage(title: string, message: string, status: number): Response {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      font: 16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: #f6f4f0;
      color: #1c1b19;
    }
    main {
      max-width: 28rem;
      margin: 1.5rem;
      padding: 1.25rem 1.3rem;
      background: #fff;
      border: 1px solid #e4e0d8;
      border-radius: 12px;
    }
    h1 { font-size: 1.15rem; margin: 0 0 0.5rem; }
    p { margin: 0.4rem 0 0; }
    a { color: #2c6e5a; }
    @media (prefers-color-scheme: dark) {
      body { background: #121314; color: #eeeae4; }
      main { background: #1b1c1e; border-color: #2c2d30; }
      a { color: #7dbaa6; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <p><a href="/?tab=exercise">Back to the dashboard</a></p>
  </main>
</body>
</html>`;
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
