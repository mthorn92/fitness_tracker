import { sql } from "@/lib/db";
import { newId } from "@/lib/ids";
import { refreshPages } from "@/lib/refresh";
import { seedIfEmpty } from "@/lib/seed";
import { slugId } from "@/lib/ids";
import type {
  DayLog,
  DayWhoop,
  FitnessSnapshot,
  FoodItem,
  NutritionTargets,
  PlanWeekday,
  SavedMeal,
  SessionSet,
  TrainingSession,
  WaterEntry,
  WhoopCycle,
  WhoopRecovery,
  WhoopSleep,
  WhoopWorkout,
} from "@/lib/types";

const globalForStore = globalThis as typeof globalThis & {
  __fitnessSeeded?: Promise<void>;
};

async function ready(): Promise<void> {
  globalForStore.__fitnessSeeded ??= seedIfEmpty().catch((error: unknown) => {
    globalForStore.__fitnessSeeded = undefined;
    throw error;
  });
  await globalForStore.__fitnessSeeded;
}

export async function ensureStore(): Promise<void> {
  await ready();
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function optionalText(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  return String(value);
}

function bool(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

export type FoodInput = {
  id?: string;
  date: string;
  time: string;
  item: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal?: string | null;
  saved_meal?: string | null;
};

export type WaterInput = {
  id?: string;
  date: string;
  time: string;
  item: string;
  litres: number;
  estimated?: boolean;
};

export type WeightInput = {
  id?: string;
  date: string;
  kg: number;
};

export type ExerciseInput = {
  id?: string;
  date: string;
  time?: string | null;
  item: string;
  duration_min?: number | null;
  kcal?: number;
  whoop_id?: string | null;
  strain?: number | null;
  avg_hr?: number | null;
  source?: string | null;
};

export type SavedMealInput = {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serve?: string | null;
  recipe?: string | null;
};

export type DayWhoopInput = {
  cycle_id?: number | null;
  recovery_score: number;
  hrv_rmssd_milli: number;
  resting_heart_rate: number;
  sleep_hours: number;
  strain: number;
  kcal: number;
  step_count?: number | null;
};

export type SnapshotWindow = {
  /**
   * Inclusive start. Food and water before this day are summed per day so the
   * deficit and rings stay correct without loading every line item.
   */
  from?: string;
  /** Inclusive end. Days after this are left out of the line-item tables. */
  to?: string;
};

function whereClause(column: string, window?: SnapshotWindow): { clause: string; params: unknown[] } {
  const params: unknown[] = [];
  const parts: string[] = [];
  if (window?.from) {
    params.push(window.from);
    parts.push(`${column} >= $${params.length}`);
  }
  if (window?.to) {
    params.push(window.to);
    parts.push(`${column} <= $${params.length}`);
  }
  return { clause: parts.length ? ` where ${parts.join(" and ")}` : "", params };
}

/** Earliest profile date and the latest logged or WHOOP day. */
export async function dashboardDateBounds(): Promise<{ start: string; latest: string }> {
  await ready();
  const rows = await sql<{ start_date: string | null; latest: string | null }>(
    `select
       (select start_date from profile where id = 'default') as start_date,
       (select max(d) from (
          select date as d from foods
          union select date from water_entries
          union select date from weights
          union select date from day_notes
          union select date from day_flags
          union select date from day_whoop
          union select date from exercises
          union select waking_date from whoop_cycles
          union select waking_date from whoop_recovery
          union select waking_date from whoop_sleep
          union select date from whoop_workouts
        ) days) as latest`,
  );
  const start = rows[0]?.start_date;
  if (!start) throw new Error("Fitness profile is missing.");
  const latest = rows[0]?.latest;
  return { start, latest: latest && latest > start ? latest : start };
}

export async function loadSnapshot(window?: SnapshotWindow): Promise<FitnessSnapshot> {
  await ready();

  const foodsWhere = whereClause("date", window);
  const waterWhere = whereClause("date", window);
  const exerciseWhere = whereClause("date", window);
  const workoutWhere = whereClause("date", window);
  const recoveryWhere = whereClause("waking_date", window);
  const sleepWhere = whereClause("waking_date", window);
  const prefix = window?.from;
  const [profileRows, foods, foodTotals, water, waterTotals, weights, notes, flags, dayWhoop, meals, cycles, recovery, sleep, workouts, exercises] =
    await Promise.all([
      sql<Record<string, unknown>>("select * from profile where id = $1", ["default"]),
      sql<Record<string, unknown>>(
        `select * from foods${foodsWhere.clause} order by date, time, id`,
        foodsWhere.params,
      ),
      prefix
        ? sql<Record<string, unknown>>(
            `select date, sum(kcal) as kcal, sum(protein_g) as protein_g, sum(carbs_g) as carbs_g, sum(fat_g) as fat_g
             from foods where date < $1 group by date`,
            [prefix],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      sql<Record<string, unknown>>(
        `select * from water_entries${waterWhere.clause} order by date, time, id`,
        waterWhere.params,
      ),
      prefix
        ? sql<Record<string, unknown>>(
            "select date, sum(litres) as litres from water_entries where date < $1 group by date",
            [prefix],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      sql<Record<string, unknown>>("select * from weights order by date"),
      sql<Record<string, unknown>>("select * from day_notes"),
      sql<Record<string, unknown>>("select * from day_flags"),
      sql<Record<string, unknown>>("select * from day_whoop"),
      sql<Record<string, unknown>>("select * from saved_meals order by name"),
      sql<Record<string, unknown>>("select * from whoop_cycles order by waking_date"),
      sql<Record<string, unknown>>(
        `select * from whoop_recovery${recoveryWhere.clause} order by waking_date`,
        recoveryWhere.params,
      ),
      sql<Record<string, unknown>>(
        `select * from whoop_sleep${sleepWhere.clause} order by waking_date`,
        sleepWhere.params,
      ),
      sql<Record<string, unknown>>(
        `select * from whoop_workouts${workoutWhere.clause} order by start_at`,
        workoutWhere.params,
      ),
      sql<Record<string, unknown>>(
        `select * from exercises${exerciseWhere.clause} order by date, id`,
        exerciseWhere.params,
      ),
    ]);
  const profile = profileRows[0];
  if (!profile) {
    throw new Error("Fitness profile is missing.");
  }
  for (const row of foodTotals) {
    foods.push({
      id: `agg:${text(row.date)}`,
      date: row.date,
      time: "00:00",
      item: "",
      kcal: row.kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      meal: null,
      saved_meal: null,
    });
  }
  for (const row of waterTotals) {
    water.push({
      id: `agg-water:${text(row.date)}`,
      date: row.date,
      time: "00:00",
      item: "",
      litres: row.litres,
      estimated: false,
    });
  }

  const days: Record<string, DayLog> = {};
  const ensureDay = (date: string): DayLog => {
    days[date] ??= {
      weight_kg: null,
      foods: [],
      calories_kcal: 0,
      water_l: 0,
      drinks: null,
      exercise: [],
      notes: null,
      complete: false,
      water_entries: [],
      whoop: null,
      whoop_burn_kcal: null,
      cycle_closed: null,
      strain: null,
      recovery_pct: null,
    };
    return days[date];
  };

  for (const row of foods) {
    const date = text(row.date);
    const food: FoodItem = {
      id: text(row.id),
      time: text(row.time),
      item: text(row.item),
      kcal: num(row.kcal),
      protein_g: num(row.protein_g),
      carbs_g: num(row.carbs_g),
      fat_g: num(row.fat_g),
      meal: optionalText(row.meal),
      saved_meal: optionalText(row.saved_meal),
    };
    const day = ensureDay(date);
    day.foods.push(food);
    day.calories_kcal += food.kcal;
  }

  for (const row of water) {
    const date = text(row.date);
    const entry: WaterEntry = {
      id: text(row.id),
      time: text(row.time),
      item: text(row.item),
      litres: num(row.litres),
      estimated: bool(row.estimated),
    };
    const day = ensureDay(date);
    day.water_entries.push(entry);
    day.water_l += entry.litres;
  }

  for (const row of weights) {
    const day = ensureDay(text(row.date));
    day.weight_kg = num(row.kg);
  }

  for (const row of notes) {
    const day = ensureDay(text(row.date));
    day.notes = optionalText(row.notes) ?? null;
  }

  for (const row of flags) {
    const day = ensureDay(text(row.date));
    day.complete = bool(row.complete);
    if (row.cycle_closed != null) {
      day.cycle_closed = bool(row.cycle_closed);
    }
  }

  for (const row of dayWhoop) {
    const day = ensureDay(text(row.date));
    day.whoop = mapDayWhoop(row);
    day.whoop_burn_kcal = day.whoop.kcal;
    day.strain = day.whoop.strain;
    day.recovery_pct = day.whoop.recovery_score;
  }

  for (const row of exercises) {
    const day = ensureDay(text(row.date));
    day.exercise.push({
      id: text(row.id),
      item: text(row.item),
      kcal: num(row.kcal),
      duration_min: row.duration_min == null ? null : num(row.duration_min),
      time: optionalText(row.time) ?? null,
      strain: row.strain == null ? null : num(row.strain),
      avg_hr: row.avg_hr == null ? null : num(row.avg_hr),
      source: optionalText(row.source) ?? null,
    });
  }

  const saved_meals: Record<string, SavedMeal> = {};
  for (const row of meals) {
    saved_meals[text(row.name)] = {
      serve: text(row.serve),
      recipe: text(row.recipe),
      kcal: num(row.kcal),
      protein_g: num(row.protein_g),
      carbs_g: num(row.carbs_g),
      fat_g: num(row.fat_g),
    };
  }

  const mappedCycles = cycles.map(mapCycle);
  const mappedRecovery = recovery.map(mapRecovery);

  // Fill flat day aliases from synced WHOOP tables when day_whoop / flags omit them.
  for (const cycle of mappedCycles) {
    const day = ensureDay(cycle.waking_date);
    if (day.whoop_burn_kcal == null) day.whoop_burn_kcal = cycle.kcal;
    if (day.strain == null) day.strain = cycle.strain;
    if (day.cycle_closed == null) day.cycle_closed = cycle.end != null;
  }
  for (const row of mappedRecovery) {
    const day = ensureDay(row.waking_date);
    if (day.recovery_pct == null) day.recovery_pct = row.recovery_score;
  }

  return {
    goal_weight_kg: num(profile.goal_weight_kg),
    start_weight_kg: num(profile.start_weight_kg),
    start_date: text(profile.start_date),
    targets: {
      calories_kcal: num(profile.calories_kcal),
      water_l: num(profile.water_l),
      fasting: text(profile.fasting),
      protein_g: num(profile.protein_g),
      carbs_g: num(profile.carbs_g),
      fat_g: num(profile.fat_g),
    },
    days,
    saved_meals,
    whoop: {
      cycles: mappedCycles,
      recovery: mappedRecovery,
      sleep: sleep.map(mapSleep),
      workouts: workouts.map(mapWorkout),
      updated_at: new Date().toISOString(),
    },
  };
}

function mapDayWhoop(row: Record<string, unknown>): DayWhoop {
  return {
    cycle_id: row.cycle_id == null ? null : num(row.cycle_id),
    recovery_score: num(row.recovery_score),
    hrv_rmssd_milli: num(row.hrv_rmssd_milli),
    resting_heart_rate: num(row.resting_heart_rate),
    sleep_hours: num(row.sleep_hours),
    strain: num(row.strain),
    kcal: num(row.kcal),
    step_count: row.step_count == null ? null : num(row.step_count),
  };
}

function mapCycle(row: Record<string, unknown>): WhoopCycle {
  return {
    id: Number(row.id),
    waking_date: text(row.waking_date),
    start: text(row.start_at),
    end: row.end_at == null ? null : text(row.end_at),
    timezone_offset: text(row.timezone_offset),
    strain: num(row.strain),
    kilojoule: num(row.kilojoule),
    kcal: num(row.kcal),
    average_heart_rate: num(row.average_heart_rate),
    max_heart_rate: num(row.max_heart_rate),
    step_count: num(row.step_count),
    score_state: text(row.score_state),
    updated_at: text(row.updated_at),
    sleep_id: row.sleep_id == null ? null : text(row.sleep_id),
  };
}

function mapRecovery(row: Record<string, unknown>): WhoopRecovery {
  return {
    cycle_id: Number(row.cycle_id),
    sleep_id: row.sleep_id == null ? null : text(row.sleep_id),
    waking_date: text(row.waking_date),
    recovery_score: num(row.recovery_score),
    resting_heart_rate: num(row.resting_heart_rate),
    hrv_rmssd_milli: num(row.hrv_rmssd_milli),
    spo2_percentage: num(row.spo2_percentage),
    skin_temp_celsius: num(row.skin_temp_celsius),
    score_state: text(row.score_state),
    updated_at: text(row.updated_at),
  };
}

function mapSleep(row: Record<string, unknown>): WhoopSleep {
  return {
    id: text(row.id),
    cycle_id: Number(row.cycle_id),
    waking_date: text(row.waking_date),
    start: text(row.start_at),
    end: text(row.end_at),
    timezone_offset: text(row.timezone_offset),
    nap: bool(row.nap),
    asleep_hours: num(row.asleep_hours),
    in_bed_hours: num(row.in_bed_hours),
    sleep_performance_percentage: num(row.sleep_performance_percentage),
    sleep_consistency_percentage: num(row.sleep_consistency_percentage),
    sleep_efficiency_percentage: num(row.sleep_efficiency_percentage),
    respiratory_rate: num(row.respiratory_rate),
    score_state: text(row.score_state),
    updated_at: text(row.updated_at),
  };
}

function mapWorkout(row: Record<string, unknown>): WhoopWorkout {
  return {
    id: text(row.id),
    date: text(row.date),
    start: text(row.start_at),
    end: text(row.end_at),
    timezone_offset: text(row.timezone_offset),
    sport_name: text(row.sport_name),
    sport_id: num(row.sport_id),
    duration_min: num(row.duration_min),
    strain: num(row.strain),
    kilojoule: num(row.kilojoule),
    kcal: num(row.kcal),
    average_heart_rate: num(row.average_heart_rate),
    max_heart_rate: num(row.max_heart_rate),
    score_state: text(row.score_state),
    updated_at: text(row.updated_at),
  };
}

export async function upsertFood(input: FoodInput): Promise<{ id: string }> {
  await ready();
  const id = input.id?.trim() || newId("food");
  await sql(
    `insert into foods (id, date, time, item, kcal, protein_g, carbs_g, fat_g, meal, saved_meal, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     on conflict (id) do update set
       date = excluded.date,
       time = excluded.time,
       item = excluded.item,
       kcal = excluded.kcal,
       protein_g = excluded.protein_g,
       carbs_g = excluded.carbs_g,
       fat_g = excluded.fat_g,
       meal = excluded.meal,
       saved_meal = excluded.saved_meal,
       updated_at = now()`,
    [
      id,
      input.date,
      input.time,
      input.item,
      input.kcal,
      input.protein_g,
      input.carbs_g,
      input.fat_g,
      input.meal ?? null,
      input.saved_meal ?? null,
    ],
  );
  await refreshPages();
  return { id };
}

export async function deleteFood(id: string): Promise<boolean> {
  await ready();
  const rows = await sql<{ id: string }>("delete from foods where id = $1 returning id", [id]);
  if (rows.length > 0) await refreshPages();
  return rows.length > 0;
}

export async function upsertWater(input: WaterInput): Promise<{ id: string }> {
  await ready();
  const id = input.id?.trim() || newId("water");
  await sql(
    `insert into water_entries (id, date, time, item, litres, estimated, updated_at)
     values ($1,$2,$3,$4,$5,$6, now())
     on conflict (id) do update set
       date = excluded.date,
       time = excluded.time,
       item = excluded.item,
       litres = excluded.litres,
       estimated = excluded.estimated,
       updated_at = now()`,
    [id, input.date, input.time, input.item, input.litres, input.estimated ?? false],
  );
  await refreshPages();
  return { id };
}

export async function deleteWater(id: string): Promise<boolean> {
  await ready();
  const rows = await sql<{ id: string }>("delete from water_entries where id = $1 returning id", [id]);
  if (rows.length > 0) await refreshPages();
  return rows.length > 0;
}

export async function upsertWeight(input: WeightInput): Promise<{ id: string }> {
  await ready();
  if (input.id?.trim()) {
    await sql(
      `insert into weights (id, date, kg, updated_at)
       values ($1,$2,$3, now())
       on conflict (id) do update set date = excluded.date, kg = excluded.kg, updated_at = now()`,
      [input.id.trim(), input.date, input.kg],
    );
    await refreshPages();
    return { id: input.id.trim() };
  }
  const existing = await sql<{ id: string }>("select id from weights where date = $1", [input.date]);
  const id = existing[0]?.id ?? newId("weight");
  await sql(
    `insert into weights (id, date, kg, updated_at)
     values ($1,$2,$3, now())
     on conflict (date) do update set kg = excluded.kg, updated_at = now()`,
    [id, input.date, input.kg],
  );
  const saved = await sql<{ id: string }>("select id from weights where date = $1", [input.date]);
  await refreshPages();
  return { id: saved[0]?.id ?? id };
}

export async function upsertExercise(input: ExerciseInput): Promise<{ id: string }> {
  await ready();
  const id = input.id?.trim() || newId("ex");
  await sql(
    `insert into exercises (id, date, time, item, duration_min, kcal, whoop_id, strain, avg_hr, source, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     on conflict (id) do update set
       date = excluded.date,
       time = excluded.time,
       item = excluded.item,
       duration_min = excluded.duration_min,
       kcal = excluded.kcal,
       whoop_id = excluded.whoop_id,
       strain = excluded.strain,
       avg_hr = excluded.avg_hr,
       source = excluded.source,
       updated_at = now()`,
    [
      id,
      input.date,
      input.time ?? null,
      input.item,
      input.duration_min ?? null,
      input.kcal ?? 0,
      input.whoop_id ?? null,
      input.strain ?? null,
      input.avg_hr ?? null,
      input.source ?? null,
    ],
  );
  await refreshPages();
  return { id };
}

export async function upsertSavedMeal(input: SavedMealInput): Promise<{ name: string }> {
  await ready();
  const name = input.name.trim();
  const id = slugId("meal", name);
  await sql(
    `insert into saved_meals (id, name, serve, recipe, kcal, protein_g, carbs_g, fat_g, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now())
     on conflict (name) do update set
       serve = excluded.serve,
       recipe = excluded.recipe,
       kcal = excluded.kcal,
       protein_g = excluded.protein_g,
       carbs_g = excluded.carbs_g,
       fat_g = excluded.fat_g,
       updated_at = now()`,
    [
      id,
      name,
      input.serve ?? null,
      input.recipe ?? null,
      input.kcal,
      input.protein_g,
      input.carbs_g,
      input.fat_g,
    ],
  );
  await refreshPages();
  return { name };
}

export async function upsertDayComplete(date: string, complete: boolean): Promise<void> {
  await ready();
  await sql(
    `insert into day_flags (date, complete, updated_at)
     values ($1,$2, now())
     on conflict (date) do update set complete = excluded.complete, updated_at = now()`,
    [date, complete],
  );
  await refreshPages();
}

export async function upsertDayCycleClosed(date: string, cycleClosed: boolean): Promise<void> {
  await ready();
  await sql(
    `insert into day_flags (date, complete, cycle_closed, updated_at)
     values ($1, false, $2, now())
     on conflict (date) do update set cycle_closed = excluded.cycle_closed, updated_at = now()`,
    [date, cycleClosed],
  );
  await refreshPages();
}

export type DayWhoopPatch = {
  whoop_burn_kcal?: number;
  strain?: number;
  recovery_pct?: number;
};

/** Partial day_whoop upsert for flat optional fields (does not clear unset columns). */
export async function patchDayWhoopFields(date: string, patch: DayWhoopPatch): Promise<void> {
  await ready();
  await sql(
    `insert into day_whoop (
       date, recovery_score, hrv_rmssd_milli, resting_heart_rate,
       sleep_hours, strain, kcal, updated_at
     ) values (
       $1,
       coalesce($2::double precision, 0::double precision),
       0::double precision,
       0::double precision,
       0::double precision,
       coalesce($3::double precision, 0::double precision),
       coalesce($4::double precision, 0::double precision),
       now()
     )
     on conflict (date) do update set
       recovery_score = coalesce($2::double precision, day_whoop.recovery_score),
       strain = coalesce($3::double precision, day_whoop.strain),
       kcal = coalesce($4::double precision, day_whoop.kcal),
       updated_at = now()`,
    [
      date,
      patch.recovery_pct ?? null,
      patch.strain ?? null,
      patch.whoop_burn_kcal ?? null,
    ],
  );
  await refreshPages();
}

export async function upsertDayWhoop(date: string, whoop: DayWhoopInput): Promise<void> {
  await ready();
  await sql(
    `insert into day_whoop (
       date, cycle_id, recovery_score, hrv_rmssd_milli, resting_heart_rate,
       sleep_hours, strain, kcal, step_count, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     on conflict (date) do update set
       cycle_id = excluded.cycle_id,
       recovery_score = excluded.recovery_score,
       hrv_rmssd_milli = excluded.hrv_rmssd_milli,
       resting_heart_rate = excluded.resting_heart_rate,
       sleep_hours = excluded.sleep_hours,
       strain = excluded.strain,
       kcal = excluded.kcal,
       step_count = excluded.step_count,
       updated_at = now()`,
    [
      date,
      whoop.cycle_id ?? null,
      whoop.recovery_score,
      whoop.hrv_rmssd_milli,
      whoop.resting_heart_rate,
      whoop.sleep_hours,
      whoop.strain,
      whoop.kcal,
      whoop.step_count ?? null,
    ],
  );
  await refreshPages();
}

export async function deleteExercise(id: string): Promise<boolean> {
  await ready();
  const rows = await sql<{ id: string }>("delete from exercises where id = $1 returning id", [id]);
  if (rows.length > 0) await refreshPages();
  return rows.length > 0;
}

export async function updateTargets(targets: NutritionTargets & { goal_weight_kg?: number }): Promise<void> {
  await ready();
  await sql(
    `update profile set
       calories_kcal = $1,
       water_l = $2,
       fasting = $3,
       protein_g = $4,
       carbs_g = $5,
       fat_g = $6,
       goal_weight_kg = coalesce($7, goal_weight_kg),
       updated_at = now()
     where id = $8`,
    [
      targets.calories_kcal,
      targets.water_l,
      targets.fasting,
      targets.protein_g,
      targets.carbs_g,
      targets.fat_g,
      targets.goal_weight_kg ?? null,
      "default",
    ],
  );
  await refreshPages();
}

const SESSION_ID = /^session_(\d{4}-\d{2}-\d{2})_(\d{2})$/;
const PLAN_DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export async function nextSessionId(date: string): Promise<string> {
  await ready();
  const rows = await sql<{ id: string }>("select id from sessions where date = $1", [date]);
  let max = 0;
  for (const row of rows) {
    const match = SESSION_ID.exec(row.id);
    if (match && match[1] === date) max = Math.max(max, Number(match[2]));
  }
  return `session_${date}_${String(max + 1).padStart(2, "0")}`;
}

export async function listSessions(filter: {
  date?: string;
  from?: string;
  to?: string;
} = {}): Promise<TrainingSession[]> {
  await ready();
  if (filter.date) {
    const rows = await sql<Record<string, unknown>>(
      "select * from sessions where date = $1 order by id",
      [filter.date],
    );
    return rows.map(mapSession);
  }
  if (filter.from && filter.to) {
    const rows = await sql<Record<string, unknown>>(
      "select * from sessions where date >= $1 and date <= $2 order by date, id",
      [filter.from, filter.to],
    );
    return rows.map(mapSession);
  }
  const rows = await sql<Record<string, unknown>>("select * from sessions order by date, id");
  return rows.map(mapSession);
}

export async function upsertSession(
  input: TrainingSession,
): Promise<{ session: TrainingSession; created: boolean }> {
  await ready();
  const existing = await sql<{ id: string }>("select id from sessions where id = $1", [input.id]);
  await sql(
    `insert into sessions (
       id, date, plan_id, plan_day, completed, rpe, feedback, sets, duration_min, avg_hr, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10, now())
     on conflict (id) do update set
       date = excluded.date,
       plan_id = excluded.plan_id,
       plan_day = excluded.plan_day,
       completed = excluded.completed,
       rpe = excluded.rpe,
       feedback = excluded.feedback,
       sets = excluded.sets,
       duration_min = excluded.duration_min,
       avg_hr = excluded.avg_hr,
       updated_at = now()`,
    [
      input.id,
      input.date,
      input.plan_id,
      input.plan_day,
      input.completed,
      input.rpe,
      input.feedback,
      JSON.stringify(input.sets),
      input.duration_min,
      input.avg_hr,
    ],
  );
  await refreshPages();
  const session = (await listSessions({ date: input.date })).find((row) => row.id === input.id);
  if (!session) throw new Error("Session failed to save.");
  return { session, created: existing.length === 0 };
}

function mapSession(row: Record<string, unknown>): TrainingSession {
  const planDay = optionalText(row.plan_day);
  return {
    id: text(row.id),
    date: text(row.date),
    plan_id: optionalText(row.plan_id) ?? null,
    plan_day: planDay && PLAN_DAYS.has(planDay) ? (planDay as PlanWeekday) : null,
    completed: bool(row.completed),
    rpe: row.rpe == null || row.rpe === "" ? null : num(row.rpe),
    feedback: optionalText(row.feedback) ?? null,
    sets: parseSets(row.sets),
    duration_min: row.duration_min == null || row.duration_min === "" ? null : num(row.duration_min),
    avg_hr: row.avg_hr == null || row.avg_hr === "" ? null : num(row.avg_hr),
  };
}

function parseSets(value: unknown): SessionSet[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const sets: SessionSet[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const exercise_key = optionalText(row.exercise_key);
    if (!exercise_key) continue;
    sets.push({
      exercise_key,
      set: num(row.set),
      reps: row.reps == null ? null : num(row.reps),
      load_kg: row.load_kg == null ? null : num(row.load_kg),
      band: optionalText(row.band) ?? null,
      hold_s: row.hold_s == null ? null : num(row.hold_s),
      done: bool(row.done),
    });
  }
  return sets;
}
