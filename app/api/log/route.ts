import {
  asArray,
  asBoolean,
  asDate,
  asId,
  asNumber,
  asObject,
  asString,
  asTime,
  parseIdList,
} from "@/lib/api-body";
import { applyDayLog, type DayWrite } from "@/lib/apply-log";
import type { DayWhoopInput, ExerciseInput, FoodInput, SavedMealInput, WaterInput } from "@/lib/store";
import { json, requireLogAccess } from "@/lib/auth";
import { loadSnapshot } from "@/lib/store";

export async function GET(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const snapshot = await loadSnapshot();
  const date = asDate(new URL(request.url).searchParams.get("date") ?? undefined);
  if (!date) {
    return json({ snapshot });
  }
  return json({
    date,
    targets: snapshot.targets,
    day: snapshot.days[date] ?? null,
    saved_meals: snapshot.saved_meals,
  });
}

export async function POST(request: Request) {
  const access = await requireLogAccess(request);
  if (access instanceof Response) return access;

  const body = asObject(await request.json().catch(() => null));
  if (!body) return json({ error: "invalid_json" }, 400);

  const date = asDate(body.date);
  if (!date) return json({ error: "invalid_date" }, 400);

  const foods = parseFoods(body.foods, date);
  if (foods === "invalid") return json({ error: "invalid_foods" }, 400);
  const water = parseWater(body.water, date);
  if (water === "invalid") return json({ error: "invalid_water" }, 400);
  const exercises = parseExercises(body.exercises, date);
  if (exercises === "invalid") return json({ error: "invalid_exercises" }, 400);
  const savedMeals = parseSavedMeals(body.saved_meals);
  if (savedMeals === "invalid") return json({ error: "invalid_saved_meals" }, 400);
  const whoop = parseWhoop(body.whoop);
  if (whoop === "invalid") return json({ error: "invalid_whoop" }, 400);

  const deletes = asObject(body.delete) ?? {};
  const deleteFoods = parseIdList(deletes.foods);
  const deleteWater = parseIdList(deletes.water);
  const deleteExercises = parseIdList(deletes.exercises);
  if (!deleteFoods || !deleteWater || !deleteExercises) {
    return json({ error: "invalid_delete" }, 400);
  }

  const write: DayWrite = { date, foods, water, exercises, saved_meals: savedMeals };
  if (whoop) write.whoop = whoop;
  if ("complete" in body) {
    const complete = asBoolean(body.complete);
    if (complete == null) return json({ error: "invalid_complete" }, 400);
    write.complete = complete;
  }
  if ("cycle_closed" in body) {
    const cycleClosed = asBoolean(body.cycle_closed);
    if (cycleClosed == null) return json({ error: "invalid_cycle_closed" }, 400);
    write.cycle_closed = cycleClosed;
  }
  if ("whoop_burn_kcal" in body) {
    const burn = asNumber(body.whoop_burn_kcal);
    if (burn == null) return json({ error: "invalid_whoop_burn_kcal" }, 400);
    write.whoop_burn_kcal = burn;
  }
  if ("strain" in body) {
    const strain = asNumber(body.strain);
    if (strain == null) return json({ error: "invalid_strain" }, 400);
    write.strain = strain;
  }
  if ("recovery_pct" in body) {
    const recovery = asNumber(body.recovery_pct);
    if (recovery == null) return json({ error: "invalid_recovery_pct" }, 400);
    write.recovery_pct = recovery;
  }
  if ("weight_kg" in body) {
    const kg = asNumber(body.weight_kg);
    if (kg == null) return json({ error: "invalid_weight" }, 400);
    write.weight_kg = kg;
  }
  if ("notes" in body) {
    if (body.notes == null || body.notes === "") write.notes = null;
    else {
      const notes = asString(body.notes, 500);
      if (!notes) return json({ error: "invalid_notes" }, 400);
      write.notes = notes;
    }
  }
  if (deleteFoods.length || deleteWater.length || deleteExercises.length) {
    write.delete = { foods: deleteFoods, water: deleteWater, exercises: deleteExercises };
  }

  const saved = await applyDayLog(write);
  const created =
    foods.length ||
    water.length ||
    exercises.length ||
    savedMeals.length ||
    whoop != null ||
    write.whoop_burn_kcal != null ||
    write.strain != null ||
    write.recovery_pct != null;
  return json(saved, created ? 201 : 200);
}

function parseFoods(value: unknown, date: string): FoodInput[] | "invalid" {
  if (value == null) return [];
  const items = asArray(value);
  if (!items) return "invalid";
  const foods: FoodInput[] = [];
  for (const item of items) {
    const row = asObject(item);
    if (!row) return "invalid";
    const time = asTime(row.time);
    const name = asString(row.item, 240);
    if (!time || !name) return "invalid";
    const savedMeal = asString(row.saved_meal, 120);
    const kcal = asNumber(row.kcal);
    if (kcal == null && !savedMeal) return "invalid";
    foods.push({
      id: asId(row.id) ?? undefined,
      date,
      time,
      item: name,
      kcal: kcal ?? 0,
      protein_g: asNumber(row.protein_g) ?? 0,
      carbs_g: asNumber(row.carbs_g) ?? 0,
      fat_g: asNumber(row.fat_g) ?? 0,
      meal: asString(row.meal, 40),
      saved_meal: savedMeal,
    });
  }
  return foods;
}

function parseWater(value: unknown, date: string): WaterInput[] | "invalid" {
  if (value == null) return [];
  const items = asArray(value);
  if (!items) return "invalid";
  const water: WaterInput[] = [];
  for (const item of items) {
    const row = asObject(item);
    if (!row) return "invalid";
    const time = asTime(row.time);
    const name = asString(row.item, 240);
    const litres = asNumber(row.litres);
    if (!time || !name || litres == null) return "invalid";
    water.push({
      id: asId(row.id) ?? undefined,
      date,
      time,
      item: name,
      litres,
      estimated: row.estimated === true,
    });
  }
  return water;
}

function parseExercises(value: unknown, date: string): ExerciseInput[] | "invalid" {
  if (value == null) return [];
  const items = asArray(value);
  if (!items) return "invalid";
  const exercises: ExerciseInput[] = [];
  for (const item of items) {
    const row = asObject(item);
    if (!row) return "invalid";
    const name = asString(row.item, 240);
    if (!name) return "invalid";
    exercises.push({
      id: asId(row.id) ?? undefined,
      date,
      time: asTime(row.time),
      item: name,
      duration_min: asNumber(row.duration_min),
      kcal: asNumber(row.kcal) ?? 0,
      whoop_id: asString(row.whoop_id, 80),
      strain: asNumber(row.strain),
      avg_hr: asNumber(row.avg_hr),
      source: asString(row.source, 80),
    });
  }
  return exercises;
}

function parseSavedMeals(value: unknown): SavedMealInput[] | "invalid" {
  if (value == null) return [];
  const items = asArray(value);
  if (!items) return "invalid";
  const meals: SavedMealInput[] = [];
  for (const item of items) {
    const row = asObject(item);
    if (!row) return "invalid";
    const name = asString(row.name, 120);
    const kcal = asNumber(row.kcal);
    if (!name || kcal == null) return "invalid";
    meals.push({
      name,
      kcal,
      protein_g: asNumber(row.protein_g) ?? 0,
      carbs_g: asNumber(row.carbs_g) ?? 0,
      fat_g: asNumber(row.fat_g) ?? 0,
      serve: asString(row.serve, 120),
      recipe: asString(row.recipe, 2000),
    });
  }
  return meals;
}

function parseWhoop(value: unknown): DayWhoopInput | null | "invalid" {
  if (value == null) return null;
  const row = asObject(value);
  if (!row) return "invalid";
  const recovery_score = asNumber(row.recovery_score);
  const hrv_rmssd_milli = asNumber(row.hrv_rmssd_milli);
  const resting_heart_rate = asNumber(row.resting_heart_rate);
  const sleep_hours = asNumber(row.sleep_hours);
  const strain = asNumber(row.strain);
  const kcal = asNumber(row.kcal);
  if (
    recovery_score == null ||
    hrv_rmssd_milli == null ||
    resting_heart_rate == null ||
    sleep_hours == null ||
    strain == null ||
    kcal == null
  ) {
    return "invalid";
  }
  return {
    cycle_id: asNumber(row.cycle_id),
    recovery_score,
    hrv_rmssd_milli,
    resting_heart_rate,
    sleep_hours,
    strain,
    kcal,
    step_count: asNumber(row.step_count),
  };
}
