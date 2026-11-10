import { sql } from "@/lib/db";
import {
  deleteExercise,
  deleteFood,
  deleteWater,
  ensureStore,
  patchDayWhoopFields,
  upsertDayComplete,
  upsertDayCycleClosed,
  upsertDayWhoop,
  upsertExercise,
  upsertFood,
  upsertSavedMeal,
  upsertWater,
  upsertWeight,
  type DayWhoopInput,
  type ExerciseInput,
  type FoodInput,
  type SavedMealInput,
  type WaterInput,
} from "@/lib/store";
import { withBatchedRefresh } from "@/lib/refresh";

export type DayWrite = {
  date: string;
  notes?: string | null;
  complete?: boolean;
  whoop?: DayWhoopInput;
  /** Optional flat day fields (additive; map into day_whoop / day_flags). */
  whoop_burn_kcal?: number;
  cycle_closed?: boolean;
  strain?: number;
  recovery_pct?: number;
  weight_kg?: number;
  foods?: FoodInput[];
  water?: WaterInput[];
  exercises?: ExerciseInput[];
  saved_meals?: SavedMealInput[];
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
  saved_meals: { name: string }[];
  complete: boolean | null;
  whoop: boolean;
  cycle_closed: boolean | null;
  whoop_burn_kcal: number | null;
  strain: number | null;
  recovery_pct: number | null;
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
    const result: DayWriteResult = {
      date: write.date,
      foods: [],
      water: [],
      exercises: [],
      weight: null,
      saved_meals: [],
      complete: null,
      whoop: false,
      cycle_closed: null,
      whoop_burn_kcal: null,
      strain: null,
      recovery_pct: null,
      deleted: { foods: [], water: [], exercises: [] },
    };

    for (const meal of write.saved_meals ?? []) {
      result.saved_meals.push(await upsertSavedMeal(meal));
    }

    const meals = await loadSavedMeals();

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
    if (write.complete !== undefined) {
      await upsertDayComplete(write.date, write.complete);
      result.complete = write.complete;
    }
    if (write.whoop) {
      await upsertDayWhoop(write.date, write.whoop);
      result.whoop = true;
    }
    const whoopPatch = {
      whoop_burn_kcal: write.whoop_burn_kcal,
      strain: write.strain,
      recovery_pct: write.recovery_pct,
    };
    const hasWhoopPatch =
      whoopPatch.whoop_burn_kcal != null ||
      whoopPatch.strain != null ||
      whoopPatch.recovery_pct != null;
    if (hasWhoopPatch) {
      await patchDayWhoopFields(write.date, whoopPatch);
      result.whoop = true;
      if (whoopPatch.whoop_burn_kcal != null) result.whoop_burn_kcal = whoopPatch.whoop_burn_kcal;
      if (whoopPatch.strain != null) result.strain = whoopPatch.strain;
      if (whoopPatch.recovery_pct != null) result.recovery_pct = whoopPatch.recovery_pct;
    }
    if (write.cycle_closed !== undefined) {
      await upsertDayCycleClosed(write.date, write.cycle_closed);
      result.cycle_closed = write.cycle_closed;
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
