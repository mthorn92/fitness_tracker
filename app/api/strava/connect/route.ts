import { randomBytes } from "node:crypto";
import { json, requireLogAccess } from "@/lib/auth";
import { htmlPage, requestOrigin, stateCookie, stravaAuthorizeUrl, stravaCallbackUrl } from "@/lib/strava-oauth";

/**
 * Starts the one-time Strava consent screen.
 * The client secret never leaves the server and is not written to the redirect.
 */
export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const clientId = process.env.STRAVA_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim() ?? "";
  if (clientId === "" || clientSecret === "") {
    return htmlPage(
      "Strava is not set up yet",
      "Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET on the server, then open this page again.",
      400,
    );
  }

  const origin = requestOrigin(request);
  const state = randomBytes(16).toString("hex");
  const secure = origin.startsWith("https://");
  const destination = stravaAuthorizeUrl({
    clientId,
    redirectUri: stravaCallbackUrl(origin),
    state,
  });
  if (destination.includes("client_secret")) {
    return json({ error: "invalid_authorize_url" }, 500);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: destination,
      "set-cookie": stateCookie(state, secure),
      "cache-control": "private, no-store",
    },
  });
}
