import { formatRunClock } from "@/lib/strava-summary";
import {
  formatKm,
  formatHr,
  formatPctUnder,
  formatRunDate,
  indexMark,
  roundIndex,
  type IndexMark,
} from "@/lib/run-tile";

export type { IndexMark };

/** Shape posted by Fitness Coach and shown on the Rides tile. */
export type RideScore = {
  row_key: string;
  strava_id: string | null;
  /** YYYY-MM-DD in Australia/Melbourne. */
  date: string;
  start_time: string | null;
  name: string | null;
  duration_s: number | null;
  distance_m: number | null;
  avg_watts: number | null;
  avg_rpm: number | null;
  resistance_avg: number | null;
  resistance_max: number | null;
  incline_avg: number | null;
  incline_max: number | null;
  calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  p97_hr: number | null;
  pct_under_145: number | null;
  drift_bpm: number | null;
  w_per_bpm: number | null;
  index: number | null;
  disc_pts: number | null;
  eff_pts: number | null;
  dur_pts: number | null;
};

/** Tile shows this date forward. Older posted rows stay in the API. */
export const RIDES_TILE_FROM = "2026-11-01";

export function formatRideDate(isoDate: string): string {
  return formatRunDate(isoDate);
}

/** Ride duration from posted duration_s; m:ss below one hour, else h:mm:ss. */
export function formatRideTime(durationS: number | null): string {
  if (durationS == null || !Number.isFinite(durationS) || durationS <= 0) return "—";
  return formatRunClock(durationS);
}

export function formatWatts(value: number | null): string {
  if (value == null) return "—";
  return String(Math.round(value));
}

export function formatRpm(value: number | null): string {
  if (value == null) return "—";
  return String(Math.round(value));
}

export function formatWPerBpm(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

export function formatResistance(avg: number | null, max: number | null): string {
  if (avg == null && max == null) return "—";
  const a = avg == null ? "—" : String(Math.round(avg));
  const m = max == null ? "—" : String(Math.round(max));
  return `${a}/${m}`;
}

export function formatInclinePair(avg: number | null, max: number | null): string {
  if (avg == null && max == null) return "—";
  const a = avg == null ? "—" : avg.toFixed(1);
  const m = max == null ? "—" : max.toFixed(1);
  return `${a}/${m}`;
}

export function formatKcal(value: number | null): string {
  if (value == null) return "—";
  return String(Math.round(value));
}

export function formatDriftBpm(value: number | null): string {
  if (value == null) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${text}`;
  if (rounded < 0) return `-${text}`;
  return "0.0";
}

export function formatPts(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

export { formatKm, formatHr, formatPctUnder, indexMark, roundIndex };

export function rideHasScoreColumns(rows: readonly RideScore[]): boolean {
  return rows.some(
    (row) =>
      row.index != null ||
      row.disc_pts != null ||
      row.eff_pts != null ||
      row.dur_pts != null,
  );
}

/** Newest first by date, start_time, row_key — same ordering as runs. */
export function compareRidesNewestFirst(a: RideScore, b: RideScore): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const aTime = a.start_time ?? "";
  const bTime = b.start_time ?? "";
  if (aTime !== bTime) return aTime < bTime ? 1 : -1;
  if (a.row_key === b.row_key) return 0;
  return a.row_key < b.row_key ? 1 : -1;
}

export function ridesForTile(rows: readonly RideScore[], from = RIDES_TILE_FROM): RideScore[] {
  return rows.filter((row) => row.date >= from).slice().sort(compareRidesNewestFirst);
}