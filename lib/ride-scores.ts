import { sql } from "@/lib/db";
import { refreshPages } from "@/lib/refresh";
import { realCalendarDay } from "@/lib/run-scores";

export { realCalendarDay };
import {
  compareRidesNewestFirst,
  roundIndex,
  type RideScore,
} from "@/lib/ride-tile";

const MAX_BATCH = 200;
const STRAVA_ID = /^[A-Za-z0-9_-]{1,32}$/;
const START_TIME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export type RideScoreParseError = {
  error: "invalid_ride_scores";
  index?: number;
  field: string;
};

type ScoreRow = {
  row_key: string;
  strava_id: string | null;
  ride_date: string;
  start_time: string | null;
  name: string | null;
  duration_s: number | string | null;
  distance_m: number | string | null;
  avg_watts: number | string | null;
  avg_rpm: number | string | null;
  resistance_avg: number | string | null;
  resistance_max: number | string | null;
  incline_avg: number | string | null;
  incline_max: number | string | null;
  calories: number | string | null;
  avg_hr: number | string | null;
  max_hr: number | string | null;
  p97_hr: number | string | null;
  pct_under_145: number | string | null;
  drift_bpm: number | string | null;
  w_per_bpm: number | string | null;
  score_index: number | string | null;
  disc_pts: number | string | null;
  eff_pts: number | string | null;
  dur_pts: number | string | null;
};

/** One object or an array. A repeated key in one batch keeps the last copy. */
export function parseRideScores(body: unknown): RideScore[] | RideScoreParseError {
  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) return { error: "invalid_ride_scores", field: "body" };
    const rows: RideScore[] = [];
    for (let index = 0; index < body.length; index += 1) {
      const parsed = parseRideScore(body[index]);
      if ("field" in parsed) return { error: "invalid_ride_scores", index, field: parsed.field };
      rows.push(parsed);
    }
    return rows;
  }
  if (body && typeof body === "object") {
    const parsed = parseRideScore(body);
    if ("field" in parsed) return { error: "invalid_ride_scores", index: 0, field: parsed.field };
    return [parsed];
  }
  return { error: "invalid_ride_scores", field: "body" };
}

export function dedupeRideScores(rows: RideScore[]): RideScore[] {
  const byKey = new Map<string, RideScore>();
  for (const row of rows) byKey.set(row.row_key, row);
  return [...byKey.values()];
}

export function rideRowKey(stravaId: string | null, date: string, startTime: string | null): string {
  if (stravaId) return stravaId;
  return `${date}|${startTime ?? ""}`;
}

export async function upsertRideScores(rows: RideScore[]): Promise<RideScore[]> {
  const unique = dedupeRideScores(rows);
  if (unique.length === 0) return [];
  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const row of unique) {
    const base = params.length;
    const slots = Array.from({ length: 24 }, (_, i) => `$${base + i + 1}`);
    tuples.push(`(${slots.join(", ")}, now())`);
    params.push(
      row.row_key,
      row.strava_id,
      row.date,
      row.start_time,
      row.name,
      row.duration_s,
      row.distance_m,
      row.avg_watts,
      row.avg_rpm,
      row.resistance_avg,
      row.resistance_max,
      row.incline_avg,
      row.incline_max,
      row.calories,
      row.avg_hr,
      row.max_hr,
      row.p97_hr,
      row.pct_under_145,
      row.drift_bpm,
      row.w_per_bpm,
      row.index,
      row.disc_pts,
      row.eff_pts,
      row.dur_pts,
    );
  }
  const saved = await sql<ScoreRow>(
    `insert into ride_scores (
       row_key, strava_id, ride_date, start_time, name, duration_s, distance_m,
       avg_watts, avg_rpm, resistance_avg, resistance_max, incline_avg, incline_max,
       calories, avg_hr, max_hr, p97_hr, pct_under_145, drift_bpm, w_per_bpm,
       score_index, disc_pts, eff_pts, dur_pts, updated_at
     ) values ${tuples.join(", ")}
     on conflict (row_key) do update set
       strava_id = excluded.strava_id,
       ride_date = excluded.ride_date,
       start_time = excluded.start_time,
       name = excluded.name,
       duration_s = excluded.duration_s,
       distance_m = excluded.distance_m,
       avg_watts = excluded.avg_watts,
       avg_rpm = excluded.avg_rpm,
       resistance_avg = excluded.resistance_avg,
       resistance_max = excluded.resistance_max,
       incline_avg = excluded.incline_avg,
       incline_max = excluded.incline_max,
       calories = excluded.calories,
       avg_hr = excluded.avg_hr,
       max_hr = excluded.max_hr,
       p97_hr = excluded.p97_hr,
       pct_under_145 = excluded.pct_under_145,
       drift_bpm = excluded.drift_bpm,
       w_per_bpm = excluded.w_per_bpm,
       score_index = excluded.score_index,
       disc_pts = excluded.disc_pts,
       eff_pts = excluded.eff_pts,
       dur_pts = excluded.dur_pts,
       updated_at = now()
     returning row_key, strava_id, ride_date, start_time, name, duration_s, distance_m,
       avg_watts, avg_rpm, resistance_avg, resistance_max, incline_avg, incline_max,
       calories, avg_hr, max_hr, p97_hr, pct_under_145, drift_bpm, w_per_bpm,
       score_index, disc_pts, eff_pts, dur_pts`,
    params,
  );
  await refreshPages();
  return saved.map(mapScore).sort(compareRidesNewestFirst);
}

/** Newest first. `from` is an inclusive Melbourne date. */
export async function listRideScores(range?: { from: string }): Promise<RideScore[]> {
  const rows = range
    ? await sql<ScoreRow>(
        `select row_key, strava_id, ride_date, start_time, name, duration_s, distance_m,
                avg_watts, avg_rpm, resistance_avg, resistance_max, incline_avg, incline_max,
                calories, avg_hr, max_hr, p97_hr, pct_under_145, drift_bpm, w_per_bpm,
                score_index, disc_pts, eff_pts, dur_pts
         from ride_scores
         where ride_date >= $1
         order by ride_date desc, start_time desc nulls last, row_key desc`,
        [range.from],
      )
    : await sql<ScoreRow>(
        `select row_key, strava_id, ride_date, start_time, name, duration_s, distance_m,
                avg_watts, avg_rpm, resistance_avg, resistance_max, incline_avg, incline_max,
                calories, avg_hr, max_hr, p97_hr, pct_under_145, drift_bpm, w_per_bpm,
                score_index, disc_pts, eff_pts, dur_pts
         from ride_scores
         order by ride_date desc, start_time desc nulls last, row_key desc`,
      );
  return rows.map(mapScore);
}

function parseRideScore(value: unknown): RideScore | { field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { field: "ride" };
  const row = value as Record<string, unknown>;
  const stravaId = optionalId(row.strava_id);
  if (stravaId === "invalid") return { field: "strava_id" };
  const date = requiredDate(row.date);
  if (!date) return { field: "date" };
  const start = optionalString(row, "start_time", 40);
  if (start === "invalid") return { field: "start_time" };
  if (start && (!START_TIME.test(start) || !Number.isFinite(Date.parse(start)) || !realCalendarDay(start.slice(0, 10)))) {
    return { field: "start_time" };
  }
  if (!stravaId && !start) return { field: "start_time" };
  const name = optionalString(row, "name", 240);
  if (name === "invalid") return { field: "name" };

  const duration = optionalNumber(row, "duration_s", 0, 86_400);
  if (duration === "invalid") return { field: "duration_s" };
  const distance = optionalNumber(row, "distance_m", 0, 1_000_000);
  if (distance === "invalid") return { field: "distance_m" };
  const watts = optionalNumber(row, "avg_watts", 0, 5_000);
  if (watts === "invalid") return { field: "avg_watts" };
  const rpm = optionalNumber(row, "avg_rpm", 0, 300);
  if (rpm === "invalid") return { field: "avg_rpm" };
  const resAvg = optionalNumber(row, "resistance_avg", 0, 100);
  if (resAvg === "invalid") return { field: "resistance_avg" };
  const resMax = optionalNumber(row, "resistance_max", 0, 100);
  if (resMax === "invalid") return { field: "resistance_max" };
  const incAvg = optionalNumber(row, "incline_avg", 0, 100);
  if (incAvg === "invalid") return { field: "incline_avg" };
  const incMax = optionalNumber(row, "incline_max", 0, 100);
  if (incMax === "invalid") return { field: "incline_max" };
  const kcal = optionalNumber(row, "calories", 0, 20_000);
  if (kcal === "invalid") return { field: "calories" };
  const avgHr = optionalNumber(row, "avg_hr", 1, 250);
  if (avgHr === "invalid") return { field: "avg_hr" };
  const maxHr = optionalNumber(row, "max_hr", 1, 250);
  if (maxHr === "invalid") return { field: "max_hr" };
  const p97 = optionalNumber(row, "p97_hr", 1, 250);
  if (p97 === "invalid") return { field: "p97_hr" };
  const under = optionalNumber(row, "pct_under_145", 0, 100);
  if (under === "invalid") return { field: "pct_under_145" };
  const drift = optionalNumber(row, "drift_bpm", -100, 100, true);
  if (drift === "invalid") return { field: "drift_bpm" };
  const wpb = optionalNumber(row, "w_per_bpm", 0, 20);
  if (wpb === "invalid") return { field: "w_per_bpm" };
  const index = optionalNumber(row, "index", -1000, 1000);
  if (index === "invalid") return { field: "index" };
  const discPts = optionalNumber(row, "disc_pts", 0, 100);
  if (discPts === "invalid") return { field: "disc_pts" };
  const effPts = optionalNumber(row, "eff_pts", 0, 100);
  if (effPts === "invalid") return { field: "eff_pts" };
  const durPts = optionalNumber(row, "dur_pts", 0, 100);
  if (durPts === "invalid") return { field: "dur_pts" };

  const rowKey = rideRowKey(stravaId, date, start);
  return {
    row_key: rowKey,
    strava_id: stravaId,
    date,
    start_time: start,
    name,
    duration_s: duration,
    distance_m: distance,
    avg_watts: watts,
    avg_rpm: rpm,
    resistance_avg: resAvg,
    resistance_max: resMax,
    incline_avg: incAvg,
    incline_max: incMax,
    calories: kcal,
    avg_hr: avgHr,
    max_hr: maxHr,
    p97_hr: p97,
    pct_under_145: under,
    drift_bpm: drift,
    w_per_bpm: wpb,
    index: index == null ? null : roundIndex(index),
    disc_pts: discPts,
    eff_pts: effPts,
    dur_pts: durPts,
  };
}

function mapScore(row: ScoreRow): RideScore {
  return {
    row_key: row.row_key,
    strava_id: row.strava_id,
    date: row.ride_date,
    start_time: row.start_time,
    name: row.name,
    duration_s: asFloat(row.duration_s),
    distance_m: asFloat(row.distance_m),
    avg_watts: asFloat(row.avg_watts),
    avg_rpm: asFloat(row.avg_rpm),
    resistance_avg: asFloat(row.resistance_avg),
    resistance_max: asFloat(row.resistance_max),
    incline_avg: asFloat(row.incline_avg),
    incline_max: asFloat(row.incline_max),
    calories: asFloat(row.calories),
    avg_hr: asFloat(row.avg_hr),
    max_hr: asFloat(row.max_hr),
    p97_hr: asFloat(row.p97_hr),
    pct_under_145: asFloat(row.pct_under_145),
    drift_bpm: asFloat(row.drift_bpm),
    w_per_bpm: asFloat(row.w_per_bpm),
    index: row.score_index == null ? null : roundIndex(asFloat(row.score_index) ?? 0),
    disc_pts: asFloat(row.disc_pts),
    eff_pts: asFloat(row.eff_pts),
    dur_pts: asFloat(row.dur_pts),
  };
}

function asFloat(value: number | string | null): number | null {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalId(value: unknown): string | null | "invalid" {
  if (value == null) return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return STRAVA_ID.test(trimmed) ? trimmed : "invalid";
}

function requiredDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return realCalendarDay(value) ? value : null;
}

function optionalString(
  row: Record<string, unknown>,
  key: string,
  max: number,
): string | null | "invalid" {
  if (!(key in row) || row[key] == null) return null;
  if (typeof row[key] !== "string") return "invalid";
  const trimmed = (row[key] as string).trim();
  if (trimmed.length < 1 || trimmed.length > max) return "invalid";
  return trimmed;
}

function optionalNumber(
  row: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  allowNegative = false,
): number | null | "invalid" {
  if (!(key in row) || row[key] == null) return null;
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return "invalid";
  if (!allowNegative && value < min) return "invalid";
  if (allowNegative && value < min) return "invalid";
  if (value > max) return "invalid";
  return value;
}