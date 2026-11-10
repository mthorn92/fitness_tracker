import { applyDayLog } from "../lib/apply-log";
import { loadSnapshot } from "../lib/store";

async function main() {
  const date = "2026-11-10";
  await applyDayLog({
    date,
    complete: true,
    saved_meals: [
      {
        name: "test omelette",
        kcal: 420,
        protein_g: 32,
        carbs_g: 4,
        fat_g: 30,
        serve: "1 plate",
        recipe: "eggs and cheese",
      },
    ],
    foods: [
      {
        id: "food_2026-11-10_omelette",
        date,
        time: "08:00",
        item: "Test omelette",
        meal: "Breakfast",
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        saved_meal: "test omelette",
      },
      {
        id: "food_2026-11-10_cookie",
        date,
        time: "20:30",
        item: "Cookie",
        meal: "Dessert",
        kcal: 120,
        protein_g: 2,
        carbs_g: 18,
        fat_g: 5,
      },
    ],
    exercises: [
      {
        id: "ex_2026-11-10_ride",
        date,
        time: "18:00",
        item: "Zone 2 ride",
        duration_min: 45,
        kcal: 410,
        strain: 9.2,
        avg_hr: 138,
        source: "whoop",
      },
    ],
    whoop: {
      recovery_score: 64,
      hrv_rmssd_milli: 71,
      resting_heart_rate: 58,
      sleep_hours: 7.2,
      strain: 10.1,
      kcal: 2800,
      step_count: 9000,
    },
  });

  // Upsert same saved meal + food ids again with corrections
  await applyDayLog({
    date,
    saved_meals: [
      {
        name: "test omelette",
        kcal: 430,
        protein_g: 33,
        carbs_g: 4,
        fat_g: 31,
        serve: "1 plate",
        recipe: "eggs and cheese updated",
      },
    ],
    foods: [
      {
        id: "food_2026-11-10_omelette",
        date,
        time: "08:05",
        item: "Test omelette",
        meal: "Breakfast",
        kcal: 430,
        protein_g: 33,
        carbs_g: 4,
        fat_g: 31,
        saved_meal: "test omelette",
      },
    ],
  });

  const snapshot = await loadSnapshot();
  const day = snapshot.days[date];
  if (!day) throw new Error("missing day");
  if (!day.complete) throw new Error("complete not saved");
  if (!day.whoop || day.whoop.recovery_score !== 64) throw new Error("whoop not saved");
  if (day.foods.length !== 2) throw new Error(`expected 2 foods, got ${day.foods.length}`);
  if (day.foods.some((food) => food.meal !== "Breakfast" && food.meal !== "Dessert")) {
    throw new Error("meal labels missing");
  }
  const omelette = day.foods.find((food) => food.id === "food_2026-11-10_omelette");
  if (!omelette || omelette.kcal !== 430) throw new Error("food id upsert failed");
  const ride = day.exercise.find((item) => item.id === "ex_2026-11-10_ride");
  if (!ride || ride.strain !== 9.2 || ride.avg_hr !== 138 || ride.source !== "whoop" || ride.time !== "18:00") {
    throw new Error("exercise extras missing");
  }
  const saved = snapshot.saved_meals["test omelette"];
  if (!saved || saved.kcal !== 430 || saved.recipe !== "eggs and cheese updated") {
    throw new Error("saved meal upsert by name failed");
  }

  await applyDayLog({
    date,
    whoop_burn_kcal: 2910,
    cycle_closed: true,
    strain: 11.2,
    recovery_pct: 71,
  });
  const refreshed = (await loadSnapshot()).days[date];
  if (!refreshed) throw new Error("missing day after flat whoop fields");
  if (refreshed.whoop_burn_kcal !== 2910) throw new Error("whoop_burn_kcal not saved");
  if (refreshed.cycle_closed !== true) throw new Error("cycle_closed not saved");
  if (refreshed.strain !== 11.2) throw new Error("strain not saved");
  if (refreshed.recovery_pct !== 71) throw new Error("recovery_pct not saved");

  console.log("log extensions ok", {
    complete: day.complete,
    whoop: day.whoop.recovery_score,
    meals: day.foods.map((food) => food.meal),
    exercise: ride,
    savedMealKcal: saved.kcal,
    flat: {
      whoop_burn_kcal: refreshed.whoop_burn_kcal,
      cycle_closed: refreshed.cycle_closed,
      strain: refreshed.strain,
      recovery_pct: refreshed.recovery_pct,
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
