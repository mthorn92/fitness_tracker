import sampleData from "@/data/fitness.json";
import { sql } from "@/lib/db";
import { slugId } from "@/lib/ids";
import type { FitnessSnapshot } from "@/lib/types";

export async function seedIfEmpty(): Promise<void> {
  const existing = await sql<{ id: string }>("select id from profile limit 1");
  if (existing.length > 0) return;

  const data = sampleData as FitnessSnapshot;

  await sql(
    `insert into profile (
      id, goal_weight_kg, start_weight_kg, start_date,
      calories_kcal, water_l, fasting, protein_g, carbs_g, fat_g
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      "default",
      data.goal_weight_kg,
      data.start_weight_kg,
      data.start_date,
      data.targets.calories_kcal,
      data.targets.water_l,
      data.targets.fasting,
      data.targets.protein_g,
      data.targets.carbs_g,
      data.targets.fat_g,
    ],
  );

  for (const [name, meal] of Object.entries(data.saved_meals)) {
    await sql(
      `insert into saved_meals (id, name, serve, recipe, kcal, protein_g, carbs_g, fat_g)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [slugId("meal", name), name, meal.serve, meal.recipe, meal.kcal, meal.protein_g, meal.carbs_g, meal.fat_g],
    );
  }

  for (const [date, day] of Object.entries(data.days)) {
    if (day.weight_kg != null) {
      await sql(
        `insert into weights (id, date, kg) values ($1,$2,$3)`,
        [`weight_${date}`, date, day.weight_kg],
      );
    }
    if (day.notes) {
      await sql(`insert into day_notes (date, notes) values ($1,$2)`, [date, day.notes]);
    }
    for (const [index, food] of day.foods.entries()) {
      await sql(
        `insert into foods (id, date, time, item, kcal, protein_g, carbs_g, fat_g, saved_meal)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          `food_${date}_${String(index + 1).padStart(2, "0")}`,
          date,
          food.time,
          food.item,
          food.kcal,
          food.protein_g,
          food.carbs_g,
          food.fat_g,
          food.saved_meal ?? null,
        ],
      );
    }
    for (const [index, entry] of day.water_entries.entries()) {
      await sql(
        `insert into water_entries (id, date, time, item, litres, estimated)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          `water_${date}_${String(index + 1).padStart(2, "0")}`,
          date,
          entry.time,
          entry.item,
          entry.litres,
          entry.estimated ?? false,
        ],
      );
    }
  }

  for (const cycle of data.whoop.cycles) {
    await sql(
      `insert into whoop_cycles (
        id, waking_date, start_at, end_at, timezone_offset, strain, kilojoule, kcal,
        average_heart_rate, max_heart_rate, step_count, score_state, updated_at, sleep_id
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        String(cycle.id),
        cycle.waking_date,
        cycle.start,
        cycle.end,
        cycle.timezone_offset,
        cycle.strain,
        cycle.kilojoule,
        cycle.kcal,
        cycle.average_heart_rate,
        cycle.max_heart_rate,
        cycle.step_count,
        cycle.score_state,
        cycle.updated_at,
        cycle.sleep_id,
      ],
    );
  }

  for (const row of data.whoop.recovery) {
    await sql(
      `insert into whoop_recovery (
        cycle_id, sleep_id, waking_date, recovery_score, resting_heart_rate,
        hrv_rmssd_milli, spo2_percentage, skin_temp_celsius, score_state, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        String(row.cycle_id),
        row.sleep_id,
        row.waking_date,
        row.recovery_score,
        row.resting_heart_rate,
        row.hrv_rmssd_milli,
        row.spo2_percentage,
        row.skin_temp_celsius,
        row.score_state,
        row.updated_at,
      ],
    );
  }

  for (const row of data.whoop.sleep) {
    await sql(
      `insert into whoop_sleep (
        id, cycle_id, waking_date, start_at, end_at, timezone_offset, nap,
        asleep_hours, in_bed_hours, sleep_performance_percentage,
        sleep_consistency_percentage, sleep_efficiency_percentage,
        respiratory_rate, score_state, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        row.id,
        String(row.cycle_id),
        row.waking_date,
        row.start,
        row.end,
        row.timezone_offset,
        row.nap,
        row.asleep_hours,
        row.in_bed_hours,
        row.sleep_performance_percentage,
        row.sleep_consistency_percentage,
        row.sleep_efficiency_percentage,
        row.respiratory_rate,
        row.score_state,
        row.updated_at,
      ],
    );
  }

  for (const row of data.whoop.workouts) {
    await sql(
      `insert into whoop_workouts (
        id, date, start_at, end_at, timezone_offset, sport_name, sport_id,
        duration_min, strain, kilojoule, kcal, average_heart_rate,
        max_heart_rate, score_state, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        row.id,
        row.date,
        row.start,
        row.end,
        row.timezone_offset,
        row.sport_name,
        row.sport_id,
        row.duration_min,
        row.strain,
        row.kilojoule,
        row.kcal,
        row.average_heart_rate,
        row.max_heart_rate,
        row.score_state,
        row.updated_at,
      ],
    );
  }
}
