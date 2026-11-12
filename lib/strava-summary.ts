import { parseIsoDate, shiftIsoDate } from "@/lib/format";

/** How long a saved run list is reused before asking Strava again. */
export const STRAVA_CACHE_MS = 15 * 60 * 1000;

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export type RawRun = {
  id: number;
  name: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  distanceM: number;
  movingTimeS: number;
};

export type RunTotals = {
  count: number;
  distanceM: number;
  movingTimeS: number;
  /** Moving time divided by distance. Null when there is no distance. */
  paceSecPerKm: number | null;
};

export type StravaWindow = {
  thisWeek: RunTotals;
  last4Weeks: RunTotals;
  recent: RawRun[];
};

export type StravaTileModel =
  | { status: "disconnected"; canConnect: boolean }
  | { status: "error"; message: string; canConnect: boolean }
  | ({ status: "ready"; stale: boolean } & StravaWindow);

export function mondayOnOrBefore(iso: string): string {
  const day = parseIsoDate(iso).getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return shiftIsoDate(iso, delta);
}

export function isRunActivity(row: { type?: unknown; sport_type?: unknown }): boolean {
  const type = typeof row.type === "string" ? row.type : "";
  const sport = typeof row.sport_type === "string" ? row.sport_type : "";
  return type === "Run" || type === "VirtualRun" || RUN_TYPES.has(sport);
}

export function parseActivities(body: unknown): RawRun[] {
  if (!Array.isArray(body)) return [];
  const runs: RawRun[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (!isRunActivity(row)) continue;
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(id)) continue;
    const local = typeof row.start_date_local === "string" ? row.start_date_local : "";
    const date = /^\d{4}-\d{2}-\d{2}/.test(local) ? local.slice(0, 10) : "";
    if (!date) continue;
    const name = typeof row.name === "string" && row.name.trim() !== "" ? row.name.trim() : "Run";
    const distanceM = typeof row.distance === "number" && Number.isFinite(row.distance) ? row.distance : 0;
    const movingTimeS =
      typeof row.moving_time === "number" && Number.isFinite(row.moving_time) ? row.moving_time : 0;
    runs.push({ id, name, date, distanceM: Math.max(0, distanceM), movingTimeS: Math.max(0, movingTimeS) });
  }
  return runs;
}

export function parseTokenResponse(body: unknown): {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
} | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const accessToken = typeof row.access_token === "string" ? row.access_token.trim() : "";
  const refreshToken = typeof row.refresh_token === "string" ? row.refresh_token.trim() : "";
  const expiresAt = typeof row.expires_at === "number" ? row.expires_at : Number(row.expires_at);
  if (accessToken === "" || refreshToken === "" || !Number.isFinite(expiresAt)) return null;
  return { accessToken, refreshToken, expiresAtMs: expiresAt * 1000 };
}

export function summarizeRuns(runs: RawRun[], today: string): StravaWindow {
  const thisWeekStart = mondayOnOrBefore(today);
  const thisWeekEnd = shiftIsoDate(thisWeekStart, 6);
  const last4Start = shiftIsoDate(thisWeekStart, -21);
  const recent = [...runs].sort((a, b) => {
    if (a.date === b.date) return b.id - a.id;
    return a.date < b.date ? 1 : -1;
  });
  return {
    thisWeek: totals(runs.filter((run) => run.date >= thisWeekStart && run.date <= thisWeekEnd)),
    last4Weeks: totals(runs.filter((run) => run.date >= last4Start && run.date <= thisWeekEnd)),
    recent: recent.slice(0, 6),
  };
}

export function modelFromRuns(runs: RawRun[], today: string, stale = false): StravaTileModel {
  return { status: "ready", stale, ...summarizeRuns(runs, today) };
}

/** Sample runs relative to `today`, for local screenshots only. */
export function fixtureRuns(today: string): RawRun[] {
  const monday = mondayOnOrBefore(today);
  return [
    { id: 5, name: "Easy run", date: shiftIsoDate(monday, 1), distanceM: 5200, movingTimeS: 28 * 60 + 40 },
    { id: 4, name: "Park run", date: shiftIsoDate(monday, -2), distanceM: 10400, movingTimeS: 62 * 60 + 10 },
    { id: 3, name: "Easy run", date: shiftIsoDate(monday, -6), distanceM: 5000, movingTimeS: 27 * 60 + 55 },
    { id: 2, name: "Easy run", date: shiftIsoDate(monday, -10), distanceM: 4800, movingTimeS: 26 * 60 + 40 },
    { id: 1, name: "Long run", date: shiftIsoDate(monday, -14), distanceM: 12100, movingTimeS: 74 * 60 + 5 },
  ];
}

export function cacheIsFresh(fetchedAtMs: number, nowMs: number, ttlMs = STRAVA_CACHE_MS): boolean {
  return nowMs - fetchedAtMs >= 0 && nowMs - fetchedAtMs < ttlMs;
}

function totals(runs: RawRun[]): RunTotals {
  let distanceM = 0;
  let movingTimeS = 0;
  for (const run of runs) {
    distanceM += run.distanceM;
    movingTimeS += run.movingTimeS;
  }
  const paceSecPerKm = distanceM > 0 ? movingTimeS / (distanceM / 1000) : null;
  return { count: runs.length, distanceM, movingTimeS, paceSecPerKm };
}

export function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes} min`;
  return `${total}s`;
}

export function formatRunClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")} /km`;
}

export function runPaceSecPerKm(run: RawRun): number | null {
  if (run.distanceM <= 0) return null;
  return run.movingTimeS / (run.distanceM / 1000);
}
