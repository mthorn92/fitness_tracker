import { loadSnapshot } from "../lib/store";

async function main() {
  const day = (await loadSnapshot()).days["2026-11-09"];
  if (!day) {
    throw new Error("Missing 2026-11-09 after import");
  }

  const protein = day.foods.reduce((sum, food) => sum + food.protein_g, 0);
  const carbs = day.foods.reduce((sum, food) => sum + food.carbs_g, 0);
  const fat = day.foods.reduce((sum, food) => sum + food.fat_g, 0);
  const water = day.water_entries.reduce((sum, entry) => sum + entry.litres, 0);

  const checks = [
    ["calories", Math.round(day.calories_kcal), 499],
    ["water_l", Number(water.toFixed(1)), 1.3],
    ["protein_g", Number(protein.toFixed(1)), 41.6],
    ["carbs_g", Number(carbs.toFixed(1)), 55.5],
    ["fat_g", Number(fat.toFixed(1)), 11],
    ["weight_kg", day.weight_kg, 104.5],
  ] as const;

  for (const [label, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
  }

  console.log("import matches current tracker", {
    calories: day.calories_kcal,
    protein,
    carbs,
    fat,
    water,
    foods: day.foods.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
