import { sql } from "@/lib/db";
import { refreshPages } from "@/lib/refresh";
import { mondayOnOrBefore, modelFromRuns, type StravaTileModel } from "@/lib/strava-summary";
import {
  activitiesToRuns,
  modelFromActivities,
  workoutWindowStart,
  type CachedActivity,
  type StravaWorkoutsModel,
} from "@/lib/strava-workouts";
import { shiftIsoDate } from "@/lib/format";

/** One activity, in the shape the Fitness Coach bot sends and reads back. */
export type WorkoutActivity = {
  strava_id: number;
  /** ISO-8601 with a timezone offset, exactly as ingested. */
  start_time: string;
  type: string;
  sport_type: string;
  name: string;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number;
  avg_hr: number | null;
  max_hr: number | null;
  kcal: number | null;
  elevation_m: number | null;
  updated_at: string;
};

export type WorkoutInput = Omit<WorkoutActivity, "updated_at">;

const MAX_BATCH = 200;
const START_TIME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export type ActivityParseError = { error: "invalid_activities"; index?: number; field: string };

export function parseActivities(body: unknown): WorkoutInput[] | ActivityParseError {
  if (!Array.isArray(body)) return { error: "invalid_activities", field: "body" };
  if (body.length > MAX_BATCH) return { error: "invalid_activities", field: "body" };
  const activities: WorkoutInput[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const parsed = parseActivity(body[index]);
    if ("field" in parsed) return { error: "invalid_activities", index, field: parsed.field };
    activities.push(parsed);
  }
  return activities;
}

/** Last write wins when one batch repeats a strava_id. */
export function dedupeActivities(activities: WorkoutInput[]): WorkoutInput[] {
  const byId = new Map<number, WorkoutInput>();
  for (const activity of activities) byId.set(activity.strava_id, activity);
  return [...byId.values()];
}

export async function upsertWorkouts(activities: WorkoutInput[]): Promise<WorkoutActivity[]> {
  const rows = dedupeActivities(activities);
  if (rows.length === 0) return [];
  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const activity of rows) {
    const base = params.length;
    tuples.push(
      `($${base + 1}, $${base + 2}::timestamptz, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, now())`,
    );
    params.push(
      activity.strava_id,
      activity.start_time,
      activity.start_time,
      localDate(activity.start_time),
      activity.type,
      activity.sport_type,
      activity.name,
      activity.distance_m,
      activity.moving_time_s,
      activity.elapsed_time_s,
      activity.avg_hr,
      activity.max_hr,
      activity.kcal,
      activity.elevation_m,
    );
  }
  const saved = await sql<WorkoutRow>(
    `insert into workouts (
       strava_id, start_time, start_time_iso, local_date, type, sport_type, name,
       distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, kcal, elevation_m, updated_at
     ) values ${tuples.join(", ")}
     on conflict (strava_id) do update set
       start_time = excluded.start_time,
       start_time_iso = excluded.start_time_iso,
       local_date = excluded.local_date,
       type = excluded.type,
       sport_type = excluded.sport_type,
       name = excluded.name,
       distance_m = excluded.distance_m,
       moving_time_s = excluded.moving_time_s,
       elapsed_time_s = excluded.elapsed_time_s,
       avg_hr = excluded.avg_hr,
       max_hr = excluded.max_hr,
       kcal = excluded.kcal,
       elevation_m = excluded.elevation_m,
       updated_at = now()
     returning strava_id, start_time_iso, local_date, type, sport_type, name,
       distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, kcal, elevation_m, updated_at`,
    params,
  );
  await refreshPages();
  return saved.map(mapWorkout);
}

export async function listWorkouts(range?: { from: string; to: string }): Promise<WorkoutActivity[]> {
  const rows = range
    ? await sql<WorkoutRow>(
        `select strava_id, start_time_iso, local_date, type, sport_type, name,
                distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, kcal, elevation_m, updated_at
         from workouts
         where local_date >= $1 and local_date <= $2
         order by local_date desc, start_time desc, strava_id desc`,
        [range.from, range.to],
      )
    : await sql<WorkoutRow>(
        `select strava_id, start_time_iso, local_date, type, sport_type, name,
                distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, kcal, elevation_m, updated_at
         from workouts
         order by local_date desc, start_time desc, strava_id desc`,
      );
  return rows.map(mapWorkout);
}

/** When the bot last upserted any activity. Null when the table is empty. */
export async function lastSyncedAt(): Promise<string | null> {
  const rows = await sql<{ last_synced_at: Date | string | null }>(
    "select max(updated_at) as last_synced_at from workouts",
  );
  return timeIso(rows[0]?.last_synced_at);
}

/**
 * Exercise tiles 3 and 6. One ranged read, no Strava call.
 * The run tile needs about four weeks; the workout tile needs seven days.
 */
export async function loadExerciseActivities(today: string): Promise<{
  workouts: StravaWorkoutsModel;
  runs: StravaTileModel;
}> {
  const monday = mondayOnOrBefore(today);
  const runFrom = shiftIsoDate(monday, -23);
  const workoutFrom = workoutWindowStart(today);
  const from = runFrom < workoutFrom ? runFrom : workoutFrom;
  const weekEnd = shiftIsoDate(monday, 6);
  const to = today > weekEnd ? today : weekEnd;
  const [activities, syncedAt] = await Promise.all([
    listWorkouts({ from, to }),
    lastSyncedAt(),
  ]);
  const cached = activities.map(toCachedActivity);
  const workouts = modelFromActivities(cached, today, false);
  const runs = modelFromRuns(activitiesToRuns(cached), today, false);
  if (workouts.status === "ready") workouts.syncedAt = syncedAt;
  if (runs.status === "ready") runs.syncedAt = syncedAt;
  return { workouts, runs };
}

function parseActivity(value: unknown): WorkoutInput | { field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { field: "activity" };
  const row = value as Record<string, unknown>;
  const stravaId = requiredInt(row.strava_id, 1, Number.MAX_SAFE_INTEGER);
  if (stravaId == null) return { field: "strava_id" };
  const start = requiredString(row.start_time, 40);
  if (!start || !START_TIME.test(start) || !Number.isFinite(Date.parse(start)) || !realCalendarDay(start.slice(0, 10))) {
    return { field: "start_time" };
  }
  const type = requiredString(row.type, 64);
  if (!type) return { field: "type" };
  const sport = requiredString(row.sport_type, 64);
  if (!sport) return { field: "sport_type" };
  const name = requiredString(row.name, 240);
  if (!name) return { field: "name" };
  const distance = requiredNumber(row.distance_m, 0, 1_000_000);
  if (distance == null) return { field: "distance_m" };
  const moving = requiredInt(row.moving_time_s, 0, 172_800);
  if (moving == null) return { field: "moving_time_s" };
  const elapsed = requiredInt(row.elapsed_time_s, 0, 172_800);
  if (elapsed == null) return { field: "elapsed_time_s" };
  const avgHr = optionalNumber(row, "avg_hr", 1, 250);
  if (avgHr === "invalid") return { field: "avg_hr" };
  const maxHr = optionalNumber(row, "max_hr", 1, 250);
  if (maxHr === "invalid") return { field: "max_hr" };
  const kcal = optionalNumber(row, "kcal", 0, 20_000);
  if (kcal === "invalid") return { field: "kcal" };
  const elevation = optionalNumber(row, "elevation_m", -2_000, 20_000);
  if (elevation === "invalid") return { field: "elevation_m" };
  return {
    strava_id: stravaId,
    start_time: start,
    type,
    sport_type: sport,
    name,
    distance_m: distance,
    moving_time_s: moving,
    elapsed_time_s: elapsed,
    avg_hr: avgHr,
    max_hr: maxHr,
    kcal,
    elevation_m: elevation,
  };
}

function localDate(startTime: string): string {
  return startTime.slice(0, 10);
}

function realCalendarDay(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function requiredString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) return null;
  return trimmed;
}

function requiredNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function requiredInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

function optionalNumber(
  row: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number | null | "invalid" {
  if (!(key in row) || row[key] == null) return null;
  const value = requiredNumber(row[key], min, max);
  return value == null ? "invalid" : value;
}

type WorkoutRow = {
  strava_id: number | string;
  start_time_iso: string;
  local_date: string;
  type: string;
  sport_type: string;
  name: string;
  distance_m: number | string;
  moving_time_s: number | string;
  elapsed_time_s: number | string;
  avg_hr: number | string | null;
  max_hr: number | string | null;
  kcal: number | string | null;
  elevation_m: number | string | null;
  updated_at: Date | string | null;
};

function mapWorkout(row: WorkoutRow): WorkoutActivity {
  return {
    strava_id: asInt(row.strava_id),
    start_time: row.start_time_iso,
    type: row.type,
    sport_type: row.sport_type,
    name: row.name,
    distance_m: asFloat(row.distance_m),
    moving_time_s: asInt(row.moving_time_s),
    elapsed_time_s: asInt(row.elapsed_time_s),
    avg_hr: row.avg_hr == null ? null : asFloat(row.avg_hr),
    max_hr: row.max_hr == null ? null : asFloat(row.max_hr),
    kcal: row.kcal == null ? null : asFloat(row.kcal),
    elevation_m: row.elevation_m == null ? null : asFloat(row.elevation_m),
    updated_at: timeIso(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function toCachedActivity(activity: WorkoutActivity): CachedActivity {
  return {
    id: activity.strava_id,
    name: activity.name,
    type: activity.type,
    sportType: activity.sport_type,
    date: activity.start_time.slice(0, 10),
    startLocal: activity.start_time,
    movingTimeS: activity.moving_time_s,
    distanceM: activity.distance_m,
    avgHr: activity.avg_hr,
    calories: activity.kcal,
    kilojoules: null,
    sufferScore: null,
  };
}

function asInt(value: number | string): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asFloat(value: number | string): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function timeIso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value !== "") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}
