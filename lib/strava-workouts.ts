import { formatNumber, formatShortDate, shiftIsoDate } from "@/lib/format";
import { formatDuration, isRunActivity, type RawRun } from "@/lib/strava-summary";

/** Seven calendar days ending on the Exercise tab's date, including that day. */
export const STRAVA_WORKOUT_DAYS = 7;

/** Strava's ride work is kilojoules. One kilocalorie is 4.184 kJ. */
const KJ_PER_KCAL = 4.184;

const SPORT_LABELS: Record<string, string> = {
  Run: "Run",
  TrailRun: "Trail run",
  VirtualRun: "Virtual run",
  Ride: "Ride",
  VirtualRide: "Virtual ride",
  MountainBikeRide: "Mountain bike",
  GravelRide: "Gravel ride",
  EBikeRide: "E-bike",
  EMountainBikeRide: "E-mountain bike",
  Swim: "Swim",
  WeightTraining: "Weight training",
  Workout: "Workout",
  Walk: "Walk",
  Hike: "Hike",
  Yoga: "Yoga",
  HighIntensityIntervalTraining: "HIIT",
  Crossfit: "CrossFit",
  RockClimbing: "Climbing",
};

/**
 * One Strava activity, every sport. Stored in the existing cache row
 * so a later read does not ask Strava again.
 */
export type CachedActivity = {
  id: number;
  name: string;
  type: string;
  sportType: string;
  date: string;
  /** Local start time from Strava, used only to order the same day. */
  startLocal: string;
  movingTimeS: number;
  distanceM: number;
  avgHr: number | null;
  /** Strava `calories` when the list payload includes it. */
  calories: number | null;
  /** Strava `kilojoules` (rides). Converted to kcal for display. */
  kilojoules: number | null;
  /** Strava suffer score, shown in their app as Relative Effort. */
  sufferScore: number | null;
};

export type StravaWorkoutRow = {
  id: number;
  name: string;
  detail: string;
};

export type StravaWorkoutsModel =
  | { status: "disconnected"; canConnect: boolean }
  | { status: "error"; message: string; canConnect: boolean }
  | {
      status: "ready";
      stale: boolean;
      rows: StravaWorkoutRow[];
      /** Null when the week has no activities. */
      summary: string | null;
      /** ISO time of the last ingest. Null when nothing has been synced. Omitted for in-memory fixtures. */
      syncedAt?: string | null;
    };

export function workoutWindowStart(endDate: string): string {
  return shiftIsoDate(endDate, -(STRAVA_WORKOUT_DAYS - 1));
}

export function sportLabel(type: string, sportType: string): string {
  const raw = sportType.trim() || type.trim() || "Workout";
  const known = SPORT_LABELS[raw];
  if (known) return known;
  const spaced = raw.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Every activity in a Strava list payload. Runs are not filtered here. */
export function parseAllActivities(body: unknown): CachedActivity[] {
  if (!Array.isArray(body)) return [];
  const activities: CachedActivity[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(id)) continue;
    const local = typeof row.start_date_local === "string" ? row.start_date_local : "";
    const date = /^\d{4}-\d{2}-\d{2}/.test(local) ? local.slice(0, 10) : "";
    if (!date) continue;
    const type = typeof row.type === "string" ? row.type : "";
    const sportType = typeof row.sport_type === "string" ? row.sport_type : "";
    const run = isRunActivity(row);
    const trimmed = typeof row.name === "string" ? row.name.trim() : "";
    const name = trimmed !== "" ? trimmed : run ? "Run" : "Activity";
    const distance = finite(row.distance);
    const moving = finite(row.moving_time);
    const hr = finite(row.average_heartrate);
    const calories = finite(row.calories);
    const kilojoules = finite(row.kilojoules);
    const suffer = finite(row.suffer_score);
    activities.push({
      id,
      name,
      type,
      sportType,
      date,
      startLocal: local,
      movingTimeS: moving != null && moving > 0 ? moving : 0,
      distanceM: distance != null && distance > 0 ? distance : 0,
      avgHr: hr != null && hr > 0 ? hr : null,
      calories: calories != null && calories >= 0 ? calories : null,
      kilojoules: kilojoules != null && kilojoules >= 0 ? kilojoules : null,
      sufferScore: suffer != null && suffer >= 0 ? Math.round(suffer) : null,
    });
  }
  return activities;
}

/** Runs for the existing runs tile, taken from the full activity list. */
export function activitiesToRuns(activities: CachedActivity[]): RawRun[] {
  return activities
    .filter((activity) => isRunActivity({ type: activity.type, sport_type: activity.sportType }))
    .map((activity) => ({
      id: activity.id,
      name: activity.name,
      date: activity.date,
      distanceM: activity.distanceM,
      movingTimeS: activity.movingTimeS,
    }));
}

/**
 * Kilocalories for one activity.
 * Strava's own `calories` win. A ride that only has `kilojoules` is converted.
 * Null when the list payload has neither — we do not fetch each activity.
 */
export function activityKcal(activity: Pick<CachedActivity, "calories" | "kilojoules">): number | null {
  if (activity.calories != null && activity.calories > 0) return Math.round(activity.calories);
  if (activity.kilojoules != null && activity.kilojoules > 0) return Math.round(activity.kilojoules / KJ_PER_KCAL);
  if (activity.calories === 0) return 0;
  return null;
}

export function modelFromActivities(
  activities: CachedActivity[],
  endDate: string,
  stale = false,
): StravaWorkoutsModel {
  const start = workoutWindowStart(endDate);
  const picked = activities
    .filter((activity) => activity.date >= start && activity.date <= endDate)
    .sort(newestFirst);
  if (picked.length === 0) {
    return { status: "ready", stale, rows: [], summary: null };
  }
  return {
    status: "ready",
    stale,
    rows: picked.map(toRow),
    summary: summarize(picked),
  };
}

/** Sample activities relative to `today`, for local screenshots only. */
export function fixtureActivities(today: string): CachedActivity[] {
  const yesterday = shiftIsoDate(today, -1);
  const runDay = shiftIsoDate(today, -2);
  const walkDay = shiftIsoDate(today, -4);
  const oldDay = shiftIsoDate(today, -8);
  return [
    activity({
      id: 11,
      name: "Evening swim",
      type: "Swim",
      sportType: "Swim",
      date: today,
      startLocal: `${today}T18:40:00`,
      movingTimeS: 43 * 60,
      avgHr: 148,
      calories: 520,
      sufferScore: 64,
    }),
    activity({
      id: 10,
      name: "Lunchtime weights",
      type: "WeightTraining",
      sportType: "WeightTraining",
      date: today,
      startLocal: `${today}T12:15:00`,
      movingTimeS: 48 * 60,
      avgHr: 112,
      sufferScore: 41,
    }),
    activity({
      id: 9,
      name: "Park loop",
      type: "Ride",
      sportType: "Ride",
      date: yesterday,
      startLocal: `${yesterday}T07:05:00`,
      movingTimeS: 55 * 60,
      distanceM: 22000,
      avgHr: 136,
      kilojoules: 430 * KJ_PER_KCAL,
      sufferScore: 58,
    }),
    activity({
      id: 8,
      name: "Easy run",
      type: "Run",
      sportType: "Run",
      date: runDay,
      startLocal: `${runDay}T06:30:00`,
      movingTimeS: 32 * 60,
      distanceM: 6100,
      avgHr: 151,
      calories: 310,
      sufferScore: 37,
    }),
    activity({
      id: 7,
      name: "Evening walk",
      type: "Walk",
      sportType: "Walk",
      date: walkDay,
      startLocal: `${walkDay}T19:10:00`,
      movingTimeS: 35 * 60,
      distanceM: 2800,
    }),
    activity({
      id: 6,
      name: "Old ride",
      type: "Ride",
      sportType: "Ride",
      date: oldDay,
      startLocal: `${oldDay}T08:00:00`,
      movingTimeS: 40 * 60,
      distanceM: 18000,
      calories: 400,
    }),
  ];
}

function toRow(activity: CachedActivity): StravaWorkoutRow {
  const kcal = activityKcal(activity);
  const parts = [
    formatShortDate(activity.date),
    sportLabel(activity.type, activity.sportType),
    formatDuration(activity.movingTimeS),
  ];
  if (activity.avgHr != null) parts.push(`${Math.round(activity.avgHr)} bpm`);
  if (kcal != null) parts.push(`${formatNumber(Math.round(kcal))} kcal`);
  if (activity.sufferScore != null) parts.push(`effort ${activity.sufferScore}`);
  return { id: activity.id, name: activity.name, detail: parts.join(" · ") };
}

function summarize(activities: CachedActivity[]): string {
  const count = activities.length;
  const workouts = count === 1 ? "1 workout" : `${count} workouts`;
  const seconds = activities.reduce((sum, activity) => sum + activity.movingTimeS, 0);
  const kcals = activities.map(activityKcal).filter((value): value is number => value != null && value > 0);
  const kcalLabel = kcals.length === 0 ? "— kcal" : `${formatNumber(Math.round(kcals.reduce((sum, value) => sum + value, 0)))} kcal`;
  return `${workouts} · ${formatDuration(seconds)} · ${kcalLabel}`;
}

function newestFirst(a: CachedActivity, b: CachedActivity): number {
  if (a.startLocal !== b.startLocal) return a.startLocal < b.startLocal ? 1 : -1;
  return b.id - a.id;
}

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function activity(partial: Partial<CachedActivity> & Pick<CachedActivity, "id" | "name" | "type" | "sportType" | "date" | "startLocal">): CachedActivity {
  return {
    movingTimeS: 0,
    distanceM: 0,
    avgHr: null,
    calories: null,
    kilojoules: null,
    sufferScore: null,
    ...partial,
  };
}
