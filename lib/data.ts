/**
 * All data reading lives in this file.
 *
 * Pages never talk to SQL or JSON themselves. This module loads the snapshot
 * from the database (Postgres when DATABASE_URL is set, local PGlite otherwise).
 */
import { connection } from "next/server";
import { dayBudget } from "@/lib/budget";
import {
  formatDateLabel,
  formatDatePill,
  formatShortDate,
  formatSport,
  formatWeekday,
  shiftIsoDate,
} from "@/lib/format";
import { loadSnapshot } from "@/lib/store";
import type {
  BodyView,
  DateNav,
  DayLog,
  FitnessSnapshot,
  FoodItem,
  MealGroup,
  MealName,
  ProgressMetric,
  RecoveryDay,
  SavedMealView,
  TodayView,
  WorkoutView,
} from "@/lib/types";

const MEAL_ORDER: MealName[] = [
  "Breakfast",
  "Morning Snacks",
  "Lunch",
  "Afternoon Snacks",
  "Dinner",
  "Evening Snacks",
];

/**
 * Single place that loads the fitness snapshot.
 */
export async function getFitnessData(): Promise<FitnessSnapshot> {
  await connection();
  return loadSnapshot();
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

function dataDateRange(data: FitnessSnapshot): { min: string; max: string } {
  const dates = [
    data.start_date,
    ...Object.keys(data.days),
    ...data.whoop.cycles.map((item) => item.waking_date),
    ...data.whoop.recovery.map((item) => item.waking_date),
    ...data.whoop.sleep.map((item) => item.waking_date),
    ...data.whoop.workouts.map((item) => item.date),
  ].sort();
  return { min: dates[0], max: dates[dates.length - 1] };
}

function latestLoggedDate(data: FitnessSnapshot): string {
  const dates = Object.keys(data.days).sort();
  return dates[dates.length - 1] ?? data.start_date;
}

function resolveDate(data: FitnessSnapshot, requested?: string): string {
  const { min, max } = dataDateRange(data);
  if (requested && requested >= min && requested <= max) return requested;
  return latestLoggedDate(data);
}

function dateNavFor(data: FitnessSnapshot, date: string): DateNav {
  const { min, max } = dataDateRange(data);
  const prev = shiftIsoDate(date, -1);
  const next = shiftIsoDate(date, 1);
  return {
    date,
    label: formatDatePill(date),
    prevDate: prev >= min ? prev : null,
    nextDate: next <= max ? next : null,
  };
}

function mealNameForTime(hhmm: string): MealName {
  const hour = Number(hhmm.slice(0, 2));
  if (hour < 10) return "Breakfast";
  if (hour < 12) return "Morning Snacks";
  if (hour < 15) return "Lunch";
  if (hour < 17) return "Afternoon Snacks";
  if (hour < 21) return "Dinner";
  return "Evening Snacks";
}

function groupMeals(foods: FoodItem[]): MealGroup[] {
  const buckets = new Map<MealName, FoodItem[]>();
  for (const name of MEAL_ORDER) buckets.set(name, []);
  for (const food of foods) {
    buckets.get(mealNameForTime(food.time))?.push(food);
  }
  return MEAL_ORDER.map((name) => {
    const items = buckets.get(name) ?? [];
    return {
      name,
      foods: items,
      kcal: items.reduce((sum, food) => sum + food.kcal, 0),
    };
  });
}

function exerciseKcalForDate(data: FitnessSnapshot, date: string): number {
  const whoop = data.whoop.workouts
    .filter((workout) => workout.date === date)
    .reduce((sum, workout) => sum + workout.kcal, 0);
  const logged = (data.days[date]?.exercise ?? []).reduce((sum, item) => sum + item.kcal, 0);
  return whoop + logged;
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

function recoveryForDate(data: FitnessSnapshot, date: string, day?: DayLog) {
  const logged = day?.whoop;
  const recovery = data.whoop.recovery.find((item) => item.waking_date === date);
  const sleep = data.whoop.sleep.find((item) => item.waking_date === date);
  const cycle = data.whoop.cycles.find((item) => item.waking_date === date);
  const score = recovery?.recovery_score ?? logged?.recovery_score;
  if (score == null && !logged) return null;
  return {
    score: score ?? 0,
    hrv: recovery?.hrv_rmssd_milli ?? logged?.hrv_rmssd_milli ?? 0,
    rhr: recovery?.resting_heart_rate ?? logged?.resting_heart_rate ?? 0,
    sleepHours: sleep?.asleep_hours ?? logged?.sleep_hours ?? 0,
    strain: cycle?.strain ?? logged?.strain ?? 0,
    steps: cycle?.step_count ?? logged?.step_count ?? 0,
    kcal: cycle?.kcal ?? logged?.kcal ?? 0,
  };
}

export async function getTodayView(date?: string): Promise<TodayView> {
  const data = await getFitnessData();
  const selected = resolveDate(data, date);
  const day = data.days[selected];
  const foods = day?.foods ?? [];
  const eaten = sumFoods(foods);
  const foodKcal = eaten.kcal || day?.calories_kcal || 0;
  const { exerciseKcal, remainingKcal, underBudget } = dayBudget(
    data.targets.calories_kcal,
    foodKcal,
    exerciseKcalForDate(data, selected),
  );
  const waterLitres =
    day?.water_l ??
    (day?.water_entries ?? []).reduce((sum, entry) => sum + entry.litres, 0);
  const { kgLost, kgToGoal, weightProgressPct } = weightProgress(
    data.start_weight_kg,
    day?.weight_kg ?? null,
    data.goal_weight_kg,
  );

  return {
    date: selected,
    dateLabel: formatDateLabel(selected),
    weekday: formatWeekday(selected),
    notes: day?.notes ?? null,
    weightKg: day?.weight_kg ?? null,
    goalWeightKg: data.goal_weight_kg,
    startWeightKg: data.start_weight_kg,
    kgLost,
    kgToGoal,
    weightProgressPct,
    calories: metric(foodKcal, data.targets.calories_kcal),
    protein: metric(eaten.protein_g, data.targets.protein_g),
    carbs: metric(eaten.carbs_g, data.targets.carbs_g),
    fat: metric(eaten.fat_g, data.targets.fat_g),
    water: metric(waterLitres, data.targets.water_l),
    fasting: data.targets.fasting,
    foods,
    waterEntries: day?.water_entries ?? [],
    meals: groupMeals(foods),
    dateNav: dateNavFor(data, selected),
    foodKcal,
    exerciseKcal,
    remainingKcal,
    underBudget,
    recovery: recoveryForDate(data, selected, day),
  };
}

export async function getLogView(date?: string): Promise<TodayView> {
  return getTodayView(date);
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

  const points = [
    {
      date: data.start_date,
      label: formatShortDate(data.start_date),
      kg: data.start_weight_kg,
    },
  ];
  for (const [day, log] of Object.entries(data.days).sort(([a], [b]) => a.localeCompare(b))) {
    if (log.weight_kg == null) continue;
    if (day === data.start_date && log.weight_kg === data.start_weight_kg) continue;
    points.push({
      date: day,
      label: formatShortDate(day),
      kg: log.weight_kg,
    });
  }

  return {
    startDate: data.start_date,
    startDateLabel: formatDateLabel(data.start_date),
    currentDate: date,
    currentDateLabel: formatDatePill(date),
    startWeightKg: data.start_weight_kg,
    currentWeightKg,
    goalWeightKg: data.goal_weight_kg,
    kgLost,
    kgToGoal,
    weightProgressPct,
    targets: data.targets,
    points,
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
