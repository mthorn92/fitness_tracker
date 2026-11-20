import { formatRunClock } from "@/lib/strava-summary";

/** Shape posted by Fitness Coach and shown on the Runs tile. */
export type RunScore = {
  strava_id: string;
  /** YYYY-MM-DD in Australia/Melbourne. */
  date: string;
  start_time: string | null;
  name: string | null;
  distance_m: number | null;
  elev_gain_m: number | null;
  elev_loss_m: number | null;
  avg_hr: number | null;
  p97_hr: number | null;
  /** 0–100. Time under 145 bpm. */
  pct_under_145: number | null;
  ef_gap: number | null;
  /** Grade-adjusted pace in seconds per km (posted). Not derived from ef_gap. */
  gap_pace_s: number | null;
  disc: number | null;
  eff: number | null;
  dist: number | null;
  elev: number | null;
  /** Posted index at 1 decimal place. The site does not recompute it. */
  index: number | null;
};

/** Tile shows this date forward. Older posted rows stay in the API. */
export const RUNS_TILE_FROM = "2026-11-01";

export type IndexTone = "above" | "below" | "even" | "none";
export type IndexArrow = "up" | "down" | null;

export type IndexMark = {
  text: string;
  tone: IndexTone;
  arrow: IndexArrow;
};

/** Half-up to one decimal, so the stored index matches the figure on the tile. */
export function roundIndex(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 10 + 1e-9)) / 10;
}

export function formatRunDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
  return `${weekday} ${day}/${month}`;
}

export function formatKm(distanceM: number | null): string {
  if (distanceM == null) return "—";
  return (distanceM / 1000).toFixed(2);
}

/** Moving time from matched workouts; m:ss below one hour, else h:mm:ss. */
export function formatRunTime(movingTimeS: number | null | undefined): string {
  if (movingTimeS == null || !Number.isFinite(movingTimeS) || movingTimeS <= 0) return "—";
  return formatRunClock(movingTimeS);
}

/** Pace clock m:ss (no unit suffix; header carries /km). */
export function formatMmSsPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/** Pace from moving time and run distance (m:ss). */
export function formatRunPace(movingTimeS: number | null | undefined, distanceM: number | null): string {
  if (
    movingTimeS == null ||
    distanceM == null ||
    !Number.isFinite(movingTimeS) ||
    movingTimeS <= 0 ||
    distanceM <= 0
  ) {
    return "—";
  }
  return formatMmSsPace(movingTimeS / (distanceM / 1000));
}

/** GAP from posted gap_pace_s only (m:ss). */
export function formatGapPace(gapPaceS: number | null): string {
  return formatMmSsPace(gapPaceS);
}

/** One weighted index part at 1 decimal (e.g. 0.3 * disc for /30). */
export function formatScorePart(component: number | null, weight: number): string {
  if (component == null) return "—";
  return (weight * component).toFixed(1);
}

/** Latest moving_time_s per Strava id (run score ids are strings). */
export function movingTimeByStravaId(
  activities: readonly { strava_id: number; moving_time_s: number }[],
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const activity of activities) {
    if (activity.moving_time_s > 0) map.set(String(activity.strava_id), activity.moving_time_s);
  }
  return map;
}

export function formatHr(value: number | null): string {
  if (value == null) return "—";
  return String(Math.round(value));
}

export function formatPctUnder(value: number | null): { text: string; full: boolean } {
  if (value == null) return { text: "—", full: false };
  const rounded = Math.round(value);
  return { text: `${rounded}%`, full: rounded === 100 };
}

export function formatEf(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

export function formatElevParts(
  gain: number | null,
  loss: number | null,
): { gain: string | null; loss: string | null } {
  return {
    gain: gain == null ? null : `↑${Math.round(gain)}`,
    loss: loss == null ? null : `↓${Math.round(loss)}`,
  };
}

/**
 * Colour is against 100. The arrow is against the previous (older) run.
 * The oldest row has no arrow. Equal indexes have no arrow.
 */
export function indexMark(index: number | null, older: number | null | undefined): IndexMark {
  if (index == null) return { text: "—", tone: "none", arrow: null };
  const shown = roundIndex(index);
  const tone: IndexTone = shown > 100 ? "above" : shown < 100 ? "below" : "even";
  let arrow: IndexArrow = null;
  if (older != null) {
    const previous = roundIndex(older);
    if (shown > previous) arrow = "up";
    else if (shown < previous) arrow = "down";
  }
  return { text: shown.toFixed(1), tone, arrow };
}

/** Newest first. Dates are YYYY-MM-DD, so string order matches calendar order. */
export function compareRunsNewestFirst(a: RunScore, b: RunScore): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const aTime = a.start_time ?? "";
  const bTime = b.start_time ?? "";
  if (aTime !== bTime) return aTime < bTime ? 1 : -1;
  if (a.strava_id === b.strava_id) return 0;
  return a.strava_id < b.strava_id ? 1 : -1;
}

export function runsForTile(rows: readonly RunScore[], from = RUNS_TILE_FROM): RunScore[] {
  return rows.filter((row) => row.date >= from).slice().sort(compareRunsNewestFirst);
}
