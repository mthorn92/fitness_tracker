import { sql } from "@/lib/db";
import {
  deleteExercise,
  deleteFood,
  deleteWater,
  ensureStore,
  upsertExercise,
  upsertFood,
  upsertWater,
  upsertWeight,
  type ExerciseInput,
  type FoodInput,
  type WaterInput,
} from "@/lib/store";
import { withBatchedRefresh } from "@/lib/refresh";

export type DayWrite = {
  date: string;
  notes?: string | null;
  weight_kg?: number;
  foods?: FoodInput[];
  water?: WaterInput[];
  exercises?: ExerciseInput[];
  delete?: {
    foods?: string[];
    water?: string[];
    exercises?: string[];
  };
};

export type DayWriteResult = {
  date: string;
  foods: { id: string }[];
  water: { id: string }[];
  exercises: { id: string }[];
  weight: { id: string } | null;
  deleted: { foods: string[]; water: string[]; exercises: string[] };
};

type SavedMealRow = {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export async function upsertDayNote(date: string, notes: string | null): Promise<void> {
  await ensureStore();
  if (notes == null || notes === "") {
    await sql("delete from day_notes where date = $1", [date]);
    return;
  }
  await sql(
    `insert into day_notes (date, notes, updated_at)
     values ($1,$2, now())
     on conflict (date) do update set notes = excluded.notes, updated_at = now()`,
    [date, notes],
  );
}

export async function applyDayLog(write: DayWrite): Promise<DayWriteResult> {
  await ensureStore();
  return withBatchedRefresh(async () => {
    const meals = await loadSavedMeals();
    const result: DayWriteResult = {
      date: write.date,
      foods: [],
      water: [],
      exercises: [],
      weight: null,
      deleted: { foods: [], water: [], exercises: [] },
    };

    for (const id of write.delete?.foods ?? []) {
      if (await deleteFood(id)) result.deleted.foods.push(id);
    }
    for (const id of write.delete?.water ?? []) {
      if (await deleteWater(id)) result.deleted.water.push(id);
    }
    for (const id of write.delete?.exercises ?? []) {
      if (await deleteExercise(id)) result.deleted.exercises.push(id);
    }

    for (const food of write.foods ?? []) {
      result.foods.push(await upsertFood(fillSavedMeal(food, meals)));
    }
    for (const entry of write.water ?? []) {
      result.water.push(await upsertWater(entry));
    }
    for (const exercise of write.exercises ?? []) {
      result.exercises.push(await upsertExercise(exercise));
    }
    if (write.weight_kg != null) {
      result.weight = await upsertWeight({ date: write.date, kg: write.weight_kg });
    }
    if (write.notes !== undefined) {
      await upsertDayNote(write.date, write.notes);
    }
    return result;
  });
}

async function loadSavedMeals(): Promise<Map<string, SavedMealRow>> {
  const rows = await sql<SavedMealRow>(
    "select name, kcal, protein_g, carbs_g, fat_g from saved_meals",
  );
  const meals = new Map<string, SavedMealRow>();
  for (const row of rows) meals.set(row.name.toLowerCase(), row);
  return meals;
}

function fillSavedMeal(food: FoodInput, meals: Map<string, SavedMealRow>): FoodInput {
  const lookup = food.saved_meal?.trim() || (food.kcal ? "" : food.item);
  const meal = lookup ? meals.get(lookup.toLowerCase()) : undefined;
  if (!meal) return food;
  return {
    ...food,
    saved_meal: food.saved_meal ?? meal.name,
    kcal: food.kcal || meal.kcal,
    protein_g: food.protein_g || meal.protein_g,
    carbs_g: food.carbs_g || meal.carbs_g,
    fat_g: food.fat_g || meal.fat_g,
  };
}
