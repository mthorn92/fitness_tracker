import {
  asArray,
  asDate,
  asId,
  asNumber,
  asObject,
  asString,
  asTime,
  parseIdList,
} from "@/lib/api-body";
import { applyDayLog, type DayWrite } from "@/lib/apply-log";
import type { ExerciseInput, FoodInput, WaterInput } from "@/lib/store";
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

  const deletes = asObject(body.delete) ?? {};
  const deleteFoods = parseIdList(deletes.foods);
  const deleteWater = parseIdList(deletes.water);
  const deleteExercises = parseIdList(deletes.exercises);
  if (!deleteFoods || !deleteWater || !deleteExercises) {
    return json({ error: "invalid_delete" }, 400);
  }

  const write: DayWrite = { date, foods, water, exercises };
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
  return json(saved, foods.length || water.length || exercises.length ? 201 : 200);
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
    });
  }
  return exercises;
}
