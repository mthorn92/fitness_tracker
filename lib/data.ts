/**
 * All data reading lives in this file.
 *
 * The dashboard never imports JSON (or a future API) from page or component
 * files. When you are ready for a real backend, change getFitnessData() only.
 */
import sampleData from "@/data/fitness.json";
import {
  formatDateLabel,
  formatShortDate,
  formatSport,
  formatWeekday,
} from "@/lib/format";
import type {
  BodyView,
  DayLog,
  FitnessSnapshot,
  FoodItem,
  ProgressMetric,
  RecoveryDay,
  SavedMealView,
  TodayView,
  WorkoutView,
} from "@/lib/types";

function readSampleData(): FitnessSnapshot {
  return sampleData as FitnessSnapshot;
}

/**
 * Single place that loads the fitness snapshot.
 * Later this can become: return fetch("/api/fitness").then((r) => r.json())
 */
export async function getFitnessData(): Promise<FitnessSnapshot> {
  return readSampleData();
}

function metric(current: number, target: number): ProgressMetric {
  return {
    current,
    target,
    remaining: Math.max(0, target - current),
    percent: target <= 0 ? 0 : Math.max(0, Math.min(100, (current / target) * 100)),
  };
}

function sumFoods(foods: FoodItem[]) {
  return foods.reduce(
    (totals, food) => ({
      kcal: totals.kcal + food.kcal,
      protein_g: totals.protein_g + food.protein_g,
      carbs_g: totals.carbs_g + food.carbs_g,
      fat_g: totals.fat_g + food.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

function sortedDates(days: Record<string, DayLog>): string[] {
  return Object.keys(days).sort();
}

function latestLoggedDate(data: FitnessSnapshot): string {
  const dates = sortedDates(data.days);
  return dates[dates.length - 1] ?? data.start_date;
}

function weightProgress(start: number, current: number | null, goal: number) {
  if (current === null) {
    return { kgLost: null, kgToGoal: null, weightProgressPct: 0 };
  }
  const planned = start - goal;
  const kgLost = start - current;
  const kgToGoal = current - goal;
  const weightProgressPct =
    planned === 0 ? 0 : Math.max(0, Math.min(100, (kgLost / planned) * 100));
  return { kgLost, kgToGoal, weightProgressPct };
}

export async function getTodayView(): Promise<TodayView> {
  const data = await getFitnessData();
  const date = latestLoggedDate(data);
  const day = data.days[date];
  const foods = day?.foods ?? [];
  const eaten = sumFoods(foods);
  const waterLitres =
    day?.water_l ??
    (day?.water_entries ?? []).reduce((sum, entry) => sum + entry.litres, 0);
  const { kgLost, kgToGoal, weightProgressPct } = weightProgress(
    data.start_weight_kg,
    day?.weight_kg ?? null,
    data.goal_weight_kg,
  );

  return {
    date,
    dateLabel: formatDateLabel(date),
    weekday: formatWeekday(date),
    notes: day?.notes ?? null,
    weightKg: day?.weight_kg ?? null,
    goalWeightKg: data.goal_weight_kg,
    startWeightKg: data.start_weight_kg,
    kgLost,
    kgToGoal,
    weightProgressPct,
    calories: metric(eaten.kcal || day?.calories_kcal || 0, data.targets.calories_kcal),
    protein: metric(eaten.protein_g, data.targets.protein_g),
    carbs: metric(eaten.carbs_g, data.targets.carbs_g),
    fat: metric(eaten.fat_g, data.targets.fat_g),
    water: metric(waterLitres, data.targets.water_l),
    fasting: data.targets.fasting,
    foods,
    waterEntries: day?.water_entries ?? [],
    recovery: day?.whoop
      ? {
          score: day.whoop.recovery_score,
          hrv: day.whoop.hrv_rmssd_milli,
          rhr: day.whoop.resting_heart_rate,
          sleepHours: day.whoop.sleep_hours,
          strain: day.whoop.strain,
          steps: day.whoop.step_count,
          kcal: day.whoop.kcal,
        }
      : null,
  };
}

export async function getLogView(): Promise<TodayView> {
  return getTodayView();
}

export async function getSavedMeals(): Promise<SavedMealView[]> {
  const data = await getFitnessData();
  return Object.entries(data.saved_meals).map(([name, meal]) => ({
    name,
    serve: meal.serve,
    recipe: meal.recipe,
    kcal: meal.kcal,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
  }));
}

export async function getBodyView(): Promise<BodyView> {
  const data = await getFitnessData();
  const date = latestLoggedDate(data);
  const currentWeightKg = data.days[date]?.weight_kg ?? null;
  const { kgLost, kgToGoal, weightProgressPct } = weightProgress(
    data.start_weight_kg,
    currentWeightKg,
    data.goal_weight_kg,
  );

  return {
    startDate: data.start_date,
    startDateLabel: formatDateLabel(data.start_date),
    startWeightKg: data.start_weight_kg,
    currentWeightKg,
    goalWeightKg: data.goal_weight_kg,
    kgLost,
    kgToGoal,
    weightProgressPct,
    targets: data.targets,
  };
}

export async function getRecoveryDays(): Promise<RecoveryDay[]> {
  const data = await getFitnessData();
  const dates = new Set<string>();
  for (const cycle of data.whoop.cycles) dates.add(cycle.waking_date);
  for (const recovery of data.whoop.recovery) dates.add(recovery.waking_date);
  for (const sleep of data.whoop.sleep) dates.add(sleep.waking_date);

  return [...dates]
    .sort()
    .reverse()
    .map((date) => {
      const cycle = data.whoop.cycles.find((item) => item.waking_date === date);
      const recovery = data.whoop.recovery.find((item) => item.waking_date === date);
      const sleep = data.whoop.sleep.find((item) => item.waking_date === date);
      const logged = data.days[date]?.whoop;

      return {
        date,
        dateLabel: formatShortDate(date),
        recoveryScore: recovery?.recovery_score ?? logged?.recovery_score ?? null,
        hrv: recovery?.hrv_rmssd_milli ?? logged?.hrv_rmssd_milli ?? null,
        rhr: recovery?.resting_heart_rate ?? logged?.resting_heart_rate ?? null,
        spo2: recovery?.spo2_percentage ?? null,
        skinTemp: recovery?.skin_temp_celsius ?? null,
        sleepHours: sleep?.asleep_hours ?? logged?.sleep_hours ?? null,
        inBedHours: sleep?.in_bed_hours ?? null,
        sleepPerformance: sleep?.sleep_performance_percentage ?? null,
        sleepConsistency: sleep?.sleep_consistency_percentage ?? null,
        sleepEfficiency: sleep?.sleep_efficiency_percentage ?? null,
        strain: cycle?.strain ?? logged?.strain ?? null,
        steps: cycle?.step_count ?? logged?.step_count ?? null,
        kcal: cycle?.kcal ?? logged?.kcal ?? null,
        avgHr: cycle?.average_heart_rate ?? null,
        maxHr: cycle?.max_heart_rate ?? null,
      };
    });
}

export async function getWorkouts(): Promise<WorkoutView[]> {
  const data = await getFitnessData();
  return [...data.whoop.workouts]
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((workout) => ({
      id: workout.id,
      date: workout.date,
      dateLabel: formatShortDate(workout.date),
      sport: formatSport(workout.sport_name),
      durationMin: workout.duration_min,
      strain: workout.strain,
      kcal: workout.kcal,
      avgHr: workout.average_heart_rate,
      maxHr: workout.max_heart_rate,
    }));
}
