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
  SavedMeal,
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

export async function loadSnapshot(): Promise<FitnessSnapshot> {
  await ready();

  const [profile] = await sql<Record<string, unknown>>("select * from profile where id = $1", ["default"]);
  if (!profile) {
    throw new Error("Fitness profile is missing.");
  }

  const foods = await sql<Record<string, unknown>>("select * from foods order by date, time, id");
  const water = await sql<Record<string, unknown>>("select * from water_entries order by date, time, id");
  const weights = await sql<Record<string, unknown>>("select * from weights order by date");
  const notes = await sql<Record<string, unknown>>("select * from day_notes");
  const flags = await sql<Record<string, unknown>>("select * from day_flags");
  const dayWhoop = await sql<Record<string, unknown>>("select * from day_whoop");
  const meals = await sql<Record<string, unknown>>("select * from saved_meals order by name");
  const cycles = await sql<Record<string, unknown>>("select * from whoop_cycles order by waking_date");
  const recovery = await sql<Record<string, unknown>>("select * from whoop_recovery order by waking_date");
  const sleep = await sql<Record<string, unknown>>("select * from whoop_sleep order by waking_date");
  const workouts = await sql<Record<string, unknown>>("select * from whoop_workouts order by start_at");
  const exercises = await sql<Record<string, unknown>>("select * from exercises order by date, id");

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
