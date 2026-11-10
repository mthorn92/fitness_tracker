/**
 * All data reading lives in this file.
 *
 * Pages never talk to SQL or JSON themselves. This module loads the snapshot
 * from the database (Postgres when DATABASE_URL is set, local PGlite otherwise).
 */
import { connection } from "next/server";
import { dayBudget } from "@/lib/budget";
import { withSevenDayAverage } from "@/lib/charts";
import { buildDeficitSeries, isChartDayIncluded, isDeficitDayReady, KCAL_PER_KG } from "@/lib/deficit";
import { dietChartStartDate, enumerateIsoDates } from "@/lib/diet-window";
import {
  formatDateLabel,
  formatDatePill,
  formatShortDate,
  formatSport,
  formatUpdatedLabel,
  formatWeekday,
  shiftIsoDate,
  todayIsoDate,
} from "@/lib/format";
import { loadSnapshot } from "@/lib/store";
import type {
  BodyView,
  ChartsView,
  DateNav,
  DayLog,
  DietDashboardDay,
  DietDashboardView,
  FitnessSnapshot,
  FoodItem,
  MealGroup,
  MealName,
  ProgressMetric,
  RecoveryDay,
  SavedMealView,
  TodayView,
  TrendPoint,
  WorkoutView,
} from "@/lib/types";

const DEFAULT_TARGETS = {
  calories_kcal: 2000,
  protein_g: 170,
  carbs_g: 185,
  fat_g: 65,
  water_l: 3,
} as const;
const PERSONAL_NEEDED_DAYS = 14;

const MEAL_ORDER: string[] = [
  "Breakfast",
  "Morning Snacks",
  "Lunch",
  "Afternoon Snacks",
  "Dinner",
  "Evening Snacks",
  "Snacks",
  "Dessert",
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

function mealBucketFor(food: FoodItem): string {
  const explicit = food.meal?.trim();
  if (explicit) return explicit;
  return mealNameForTime(food.time);
}

function groupMeals(foods: FoodItem[]): MealGroup[] {
  const buckets = new Map<string, FoodItem[]>();
  for (const food of foods) {
    const name = mealBucketFor(food);
    const list = buckets.get(name) ?? [];
    list.push(food);
    buckets.set(name, list);
  }
  const ordered = [
    ...MEAL_ORDER.filter((name) => buckets.has(name)),
    ...[...buckets.keys()].filter((name) => !MEAL_ORDER.includes(name)).sort(),
  ];
  return ordered.map((name) => {
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
    complete: day?.complete ?? false,
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

/** Food calories for a day — same source as the dashboard budget ring. */
function dayFoodKcal(day: DayLog | undefined): number | null {
  if (!day) return null;
  const fromFoods = sumFoods(day.foods).kcal;
  const kcal = fromFoods || day.calories_kcal || 0;
  if (fromFoods <= 0 && day.calories_kcal <= 0 && day.foods.length === 0) return null;
  return kcal;
}

function toTrendPoints(series: Array<{ date: string; value: number }>): TrendPoint[] {
  return withSevenDayAverage(series).map((point) => ({
    date: point.date,
    label: formatShortDate(point.date),
    value: point.value,
    avg7d: point.avg7d,
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

function whoopBurnForDate(data: FitnessSnapshot, date: string): number | null {
  const day = data.days[date];
  // Flat bot override wins; otherwise prefer synced WHOOP cycle burn (updates live)
  // over a possibly stale day_whoop snapshot.
  if (day?.whoop_burn_kcal != null) return day.whoop_burn_kcal;
  const cycle = data.whoop.cycles.find((item) => item.waking_date === date);
  if (cycle?.kcal != null) return cycle.kcal;
  return day?.whoop?.kcal ?? null;
}

function cycleClosedForDate(data: FitnessSnapshot, date: string): boolean | null {
  const day = data.days[date];
  if (day?.cycle_closed != null) return day.cycle_closed;
  const cycle = data.whoop.cycles.find((item) => item.waking_date === date);
  if (!cycle) return null;
  return cycle.end != null;
}

function dayMacros(day: DayLog | undefined) {
  if (!day) return { kcal: null as number | null, protein_g: 0, carbs_g: 0, fat_g: 0, water_l: 0 };
  const eaten = sumFoods(day.foods);
  const kcal = dayFoodKcal(day);
  const water_l =
    day.water_l || day.water_entries.reduce((sum, entry) => sum + entry.litres, 0);
  return {
    kcal,
    protein_g: eaten.protein_g,
    carbs_g: eaten.carbs_g,
    fat_g: eaten.fat_g,
    water_l,
  };
}

export async function getDietDashboardView(date?: string): Promise<DietDashboardView> {
  const data = await getFitnessData();
  const today = todayIsoDate();
  const selected = resolveDate(data, date);
  const targets = {
    calories_kcal: data.targets.calories_kcal || DEFAULT_TARGETS.calories_kcal,
    protein_g: data.targets.protein_g || DEFAULT_TARGETS.protein_g,
    carbs_g: data.targets.carbs_g || DEFAULT_TARGETS.carbs_g,
    fat_g: data.targets.fat_g || DEFAULT_TARGETS.fat_g,
    water_l: data.targets.water_l || DEFAULT_TARGETS.water_l,
  };

  const candidateDates = [
    ...new Set([
      data.start_date,
      ...Object.keys(data.days),
      ...data.whoop.cycles.map((cycle) => cycle.waking_date),
    ]),
  ].sort();
  const windowMeta = candidateDates.map((iso) => ({
    date: iso,
    foodKcal: dayFoodKcal(data.days[iso]),
    whoopKcal: whoopBurnForDate(data, iso),
  }));
  // Drop WHOOP-only prelude (e.g. Fri–Sun before food logging). Start at first
  // food+WHOOP day — which is "yesterday" once logging has just begun.
  const chartStart = dietChartStartDate(windowMeta, today);
  const chartEnd = selected >= chartStart ? selected : chartStart;
  const dates = enumerateIsoDates(chartStart, chartEnd);

  const deficitInputs = dates.map((iso) => ({
    date: iso,
    whoopKcal: whoopBurnForDate(data, iso),
    foodKcal: dayFoodKcal(data.days[iso]),
    weightKg: data.days[iso]?.weight_kg ?? (iso === data.start_date ? data.start_weight_kg : null),
    complete: data.days[iso]?.complete ?? false,
    cycleClosed: cycleClosedForDate(data, iso),
  }));
  const deficit = buildDeficitSeries(deficitInputs, { today });
  const deficitByDate = new Map(deficit.points.map((point) => [point.date, point]));

  let runningCumulative = 0;
  const days: DietDashboardDay[] = dates.map((iso) => {
    const day = data.days[iso];
    const macros = dayMacros(day);
    const closed = cycleClosedForDate(data, iso);
    const point = deficitByDate.get(iso);
    const ready = isDeficitDayReady(
      { date: iso, complete: day?.complete ?? false, cycleClosed: closed },
      today,
    );
    let deficitKcal: number | null = null;
    if (point) {
      deficitKcal = point.dailyDeficitKcal;
      runningCumulative = point.cumulativeDeficitKcal;
    } else if (ready && macros.kcal != null) {
      const burn = whoopBurnForDate(data, iso);
      if (burn != null) {
        deficitKcal = burn - macros.kcal;
        runningCumulative += deficitKcal;
      }
    }
    return {
      date: iso,
      label: formatShortDate(iso),
      weight_kg: day?.weight_kg ?? (iso === data.start_date ? data.start_weight_kg : null),
      kcal: macros.kcal,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
      water_l: macros.water_l,
      whoop_burn_kcal: whoopBurnForDate(data, iso),
      cycle_closed: closed,
      complete: day?.complete ?? false,
      deficit_kcal: ready ? deficitKcal : null,
      cumulative_deficit_kcal: runningCumulative,
      strain: day?.strain ?? day?.whoop?.strain ?? null,
      recovery_pct: day?.recovery_pct ?? day?.whoop?.recovery_score ?? null,
    };
  });

  const weightPoints = days
    .filter((day) => day.weight_kg != null)
    .map((day) => ({ date: day.date, value: day.weight_kg as number }));
  const rolling = withSevenDayAverage(weightPoints);
  const rollingByDate = new Map(rolling.map((point) => [point.date, point.avg7d]));
  const weight_rolling7 = days.map((day) => rollingByDate.get(day.date) ?? null);

  const closedDays = days.filter((day) => day.cycle_closed === true || day.complete);
  const completed_days = closedDays.length;
  const firstWeight = days.find((day) => day.weight_kg != null)?.weight_kg ?? null;
  const lastWeight =
    [...days].reverse().find((day) => day.weight_kg != null)?.weight_kg ?? null;
  const rolling_change_kg =
    firstWeight != null && lastWeight != null ? firstWeight - lastWeight : null;
  const personalReady = completed_days >= PERSONAL_NEEDED_DAYS && (rolling_change_kg ?? 0) > 0;
  const personalKcalPerKg =
    personalReady && rolling_change_kg
      ? deficit.cumulativeDeficitKcal / rolling_change_kg
      : null;

  const todayRow = days.find((day) => day.date === selected) ?? days[days.length - 1];
  const now = new Date();

  return {
    generated_at: now.toISOString(),
    generated_label: formatUpdatedLabel(now),
    targets,
    start_weight_kg: data.start_weight_kg,
    goal_weight_kg: data.goal_weight_kg || 95,
    kcal_per_kg: KCAL_PER_KG,
    today: todayRow,
    days,
    weight_rolling7,
    cumulative_deficit_kcal: deficit.cumulativeDeficitKcal || runningCumulative,
    expected_kg_lost: (deficit.cumulativeDeficitKcal || runningCumulative) / KCAL_PER_KG,
    personal: {
      ready: personalReady,
      completed_days,
      needed_days: PERSONAL_NEEDED_DAYS,
      rolling_change_kg,
      kcal_per_kg: personalKcalPerKg,
    },
  };
}

export async function getChartsView(): Promise<ChartsView> {
  const data = await getFitnessData();
  const today = todayIsoDate();
  const currentDate = latestLoggedDate(data);
  const currentDay = data.days[currentDate];

  const weightSeries: Array<{ date: string; value: number }> = [];
  const calorieSeries: Array<{ date: string; value: number }> = [];

  for (const [day, log] of Object.entries(data.days).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isChartDayIncluded({ date: day, complete: log.complete }, today)) continue;

    if (log.weight_kg != null) {
      weightSeries.push({ date: day, value: log.weight_kg });
    }
    const kcal = dayFoodKcal(log);
    if (kcal != null) {
      calorieSeries.push({ date: day, value: kcal });
    }
  }

  // Seed start weight only when that calendar day is chart-eligible.
  if (
    data.start_weight_kg != null &&
    isChartDayIncluded(
      { date: data.start_date, complete: data.days[data.start_date]?.complete },
      today,
    ) &&
    !weightSeries.some((point) => point.date === data.start_date)
  ) {
    weightSeries.unshift({ date: data.start_date, value: data.start_weight_kg });
  }

  const deficitDates = new Set<string>([
    data.start_date,
    ...Object.keys(data.days),
    ...data.whoop.cycles.map((cycle) => cycle.waking_date),
  ]);
  const deficitDays = [...deficitDates].sort().map((date) => ({
    date,
    whoopKcal: whoopBurnForDate(data, date),
    foodKcal: dayFoodKcal(data.days[date]),
    weightKg: data.days[date]?.weight_kg ?? (date === data.start_date ? data.start_weight_kg : null),
    complete: data.days[date]?.complete ?? false,
    cycleClosed: cycleClosedForDate(data, date),
  }));
  const deficit = buildDeficitSeries(deficitDays, { today });

  const latestCaloriesKcal = dayFoodKcal(currentDay);

  return {
    currentDate,
    currentWeightKg: currentDay?.weight_kg ?? null,
    goalWeightKg: data.goal_weight_kg,
    latestCaloriesKcal,
    calorieTargetKcal: data.targets.calories_kcal,
    weight: toTrendPoints(weightSeries),
    calories: toTrendPoints(calorieSeries),
    deficit: {
      baselineKg: deficit.baselineKg,
      baselineDate: deficit.baselineDate,
      baselineDateLabel: deficit.baselineDate ? formatShortDate(deficit.baselineDate) : "",
      points: deficit.points.map((point) => ({
        date: point.date,
        label: formatShortDate(point.date),
        expectedKgLost: point.expectedKgLost,
        actualKgLost: point.actualKgLost,
        weighInKgLost: point.weighInKgLost,
        cumulativeDeficitKcal: point.cumulativeDeficitKcal,
      })),
      expectedKgLost: deficit.expectedKgLost,
      actualKgLost: deficit.actualKgLost,
      kcalPerKgLost: deficit.kcalPerKgLost,
      cumulativeDeficitKcal: deficit.cumulativeDeficitKcal,
    },
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
