import { requireLogAccess } from "@/lib/auth";
import {
  clearStateCookie,
  htmlPage,
  readStateCookie,
  requestOrigin,
  statesMatch,
} from "@/lib/strava-oauth";
import { exchangeStravaCode } from "@/lib/strava";

/**
 * Strava sends the browser back here with a one-time code.
 * The code is exchanged on the server and only the refresh token is stored.
 * The page never shows the code or the token.
 */
export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const origin = requestOrigin(request);
  const secure = origin.startsWith("https://");
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const denied = oauthError === "access_denied";
    return htmlPage(
      denied ? "Strava was not connected" : "Strava could not connect",
      denied
        ? "Access was not granted. You can try again from the exercise tab."
        : "Strava did not finish the connection. You can try again from the exercise tab.",
      400,
    );
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const expected = readStateCookie(request.headers.get("cookie"));
  if (code === "" || expected == null || !statesMatch(state, expected)) {
    return htmlPage(
      "That connection link expired",
      "Start again from the exercise tab. The code from Strava is only valid once.",
      400,
    );
  }

  const result = await exchangeStravaCode(code);
  if (result !== "saved") {
    const message =
      result === "busy"
        ? "Strava is busy. Wait a few minutes and try again."
        : result === "unconfigured"
          ? "Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET on the server, then try again."
          : "Strava did not accept the connection. Start again from the exercise tab.";
    return htmlPage("Strava was not connected", message, result === "busy" ? 429 : 400);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: new URL("/?tab=exercise", origin).toString(),
      "set-cookie": clearStateCookie(secure),
      "cache-control": "private, no-store",
    },
  });
}
