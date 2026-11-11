export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type FoodItem = MacroTotals & {
  id?: string;
  time: string;
  item: string;
  meal?: string;
  saved_meal?: string;
};

export type WaterEntry = {
  id?: string;
  time: string;
  item: string;
  litres: number;
  estimated?: boolean;
};

export type ExerciseEntry = {
  id?: string;
  item: string;
  kcal: number;
  duration_min?: number | null;
  time?: string | null;
  strain?: number | null;
  avg_hr?: number | null;
  source?: string | null;
};

export type DayWhoop = {
  cycle_id?: number | null;
  recovery_score: number;
  hrv_rmssd_milli: number;
  resting_heart_rate: number;
  sleep_hours: number;
  strain: number;
  kcal: number;
  step_count?: number | null;
};

export type DayLog = {
  weight_kg: number | null;
  foods: FoodItem[];
  calories_kcal: number;
  water_l: number;
  drinks: unknown;
  exercise: ExerciseEntry[];
  notes: string | null;
  complete?: boolean;
  water_entries: WaterEntry[];
  whoop: DayWhoop | null;
  /** Optional flat aliases for bot/UI (derived from day_whoop / cycles when unset). */
  whoop_burn_kcal?: number | null;
  cycle_closed?: boolean | null;
  strain?: number | null;
  recovery_pct?: number | null;
};

export type NutritionTargets = {
  calories_kcal: number;
  water_l: number;
  fasting: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type SavedMeal = MacroTotals & {
  serve: string;
  recipe: string;
};

export type WhoopCycle = {
  id: number;
  waking_date: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  strain: number;
  kilojoule: number;
  kcal: number;
  average_heart_rate: number;
  max_heart_rate: number;
  step_count: number;
  score_state: string;
  updated_at: string;
  sleep_id: string | null;
};

export type WhoopRecovery = {
  cycle_id: number;
  sleep_id: string | null;
  waking_date: string;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage: number;
  skin_temp_celsius: number;
  score_state: string;
  updated_at: string;
};

export type WhoopSleep = {
  id: string;
  cycle_id: number;
  waking_date: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  asleep_hours: number;
  in_bed_hours: number;
  sleep_performance_percentage: number;
  sleep_consistency_percentage: number;
  sleep_efficiency_percentage: number;
  respiratory_rate: number;
  score_state: string;
  updated_at: string;
};

export type WhoopWorkout = {
  id: string;
  date: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name: string;
  sport_id: number;
  duration_min: number;
  strain: number;
  kilojoule: number;
  kcal: number;
  average_heart_rate: number;
  max_heart_rate: number;
  score_state: string;
  updated_at: string;
};

export type FitnessSnapshot = {
  goal_weight_kg: number;
  start_weight_kg: number;
  start_date: string;
  targets: NutritionTargets;
  days: Record<string, DayLog>;
  saved_meals: Record<string, SavedMeal>;
  whoop: {
    cycles: WhoopCycle[];
    recovery: WhoopRecovery[];
    sleep: WhoopSleep[];
    workouts: WhoopWorkout[];
    updated_at: string;
  };
};

export type ProgressMetric = {
  current: number;
  target: number;
  remaining: number;
  percent: number;
};

export type MealName =
  | "Breakfast"
  | "Morning Snacks"
  | "Lunch"
  | "Afternoon Snacks"
  | "Dinner"
  | "Evening Snacks"
  | "Snacks"
  | "Dessert";

export type MealGroup = {
  name: string;
  foods: FoodItem[];
  kcal: number;
};

export type DateNav = {
  date: string;
  label: string;
  prevDate: string | null;
  nextDate: string | null;
};

export type WeightPoint = {
  date: string;
  label: string;
  kg: number;
};

export type TrendPoint = {
  date: string;
  label: string;
  value: number;
  avg7d: number;
};

export type TodayView = {
  date: string;
  dateLabel: string;
  weekday: string;
  notes: string | null;
  complete: boolean;
  weightKg: number | null;
  goalWeightKg: number;
  startWeightKg: number;
  kgLost: number | null;
  kgToGoal: number | null;
  weightProgressPct: number;
  calories: ProgressMetric;
  protein: ProgressMetric;
  carbs: ProgressMetric;
  fat: ProgressMetric;
  water: ProgressMetric;
  fasting: string;
  foods: FoodItem[];
  waterEntries: WaterEntry[];
  meals: MealGroup[];
  dateNav: DateNav;
  foodKcal: number;
  exerciseKcal: number;
  remainingKcal: number;
  underBudget: boolean;
  recovery: {
    score: number;
    hrv: number;
    rhr: number;
    sleepHours: number;
    strain: number;
    steps: number;
    kcal: number;
  } | null;
};

export type RecoveryDay = {
  date: string;
  dateLabel: string;
  recoveryScore: number | null;
  hrv: number | null;
  rhr: number | null;
  spo2: number | null;
  skinTemp: number | null;
  sleepHours: number | null;
  inBedHours: number | null;
  sleepPerformance: number | null;
  sleepConsistency: number | null;
  sleepEfficiency: number | null;
  strain: number | null;
  steps: number | null;
  kcal: number | null;
  avgHr: number | null;
  maxHr: number | null;
};

export type WorkoutView = {
  id: string;
  date: string;
  dateLabel: string;
  sport: string;
  durationMin: number;
  strain: number;
  kcal: number;
  avgHr: number;
  maxHr: number;
};

export type SavedMealView = {
  name: string;
  serve: string;
  recipe: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type BodyView = {
  startDate: string;
  startDateLabel: string;
  currentDate: string;
  currentDateLabel: string;
  startWeightKg: number;
  currentWeightKg: number | null;
  goalWeightKg: number;
  kgLost: number | null;
  kgToGoal: number | null;
  weightProgressPct: number;
  targets: NutritionTargets;
  points: WeightPoint[];
};

export type DeficitOverlayPoint = {
  date: string;
  label: string;
  expectedKgLost: number;
  actualKgLost: number | null;
  weighInKgLost: number | null;
  cumulativeDeficitKcal: number;
};

/** Charts tab: deficit-vs-scale hero + weight/calorie 7dma series. */
export type ChartsView = {
  currentDate: string;
  currentWeightKg: number | null;
  goalWeightKg: number;
  latestCaloriesKcal: number | null;
  calorieTargetKcal: number;
  weight: TrendPoint[];
  calories: TrendPoint[];
  deficit: {
    baselineKg: number;
    baselineDate: string;
    baselineDateLabel: string;
    points: DeficitOverlayPoint[];
    expectedKgLost: number;
    actualKgLost: number | null;
    kcalPerKgLost: number | null;
    cumulativeDeficitKcal: number;
  };
};

/** Live diet dashboard payload (matches docs/diet-dashboard.html shape). */
export type DietDashboardDay = {
  date: string;
  label: string;
  weight_kg: number | null;
  kcal: number | null;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_l: number;
  whoop_burn_kcal: number | null;
  cycle_closed: boolean | null;
  complete: boolean;
  deficit_kcal: number | null;
  cumulative_deficit_kcal: number | null;
  strain: number | null;
  recovery_pct: number | null;
};

export type DietDashboardView = {
  generated_at: string;
  generated_label: string;
  targets: {
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    water_l: number;
  };
  start_weight_kg: number;
  goal_weight_kg: number;
  kcal_per_kg: number;
  today: DietDashboardDay;
  days: DietDashboardDay[];
  weight_rolling7: Array<number | null>;
  cumulative_deficit_kcal: number;
  expected_kg_lost: number;
  /**
   * Short date label when calendar today is on the chart and not counted yet.
   * Null when today has no row, so a previous open day is not called in progress.
   */
  in_progress_label: string | null;
  personal: {
    ready: boolean;
    completed_days: number;
    needed_days: number;
    rolling_change_kg: number | null;
    kcal_per_kg: number | null;
  };
};

export type PlanWeekType = "build" | "deload";

export type PlanWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type PlanProgression = "compound" | "accessory" | "pullup" | "none";

export type PlanDayKind = "lift" | "cardio" | "rest";

export type PlanItem = {
  key: string;
  name: string;
  sets: number;
  reps: number;
  load_kg?: number;
  band?: string;
  hold_s?: number;
  /** Superset slot, such as A1 or A2. */
  group?: string;
  progression: PlanProgression;
  /** Kilograms added when a rep ladder finishes. Compounds use this. */
  load_step_kg?: number;
  extra?: string;
};

export type PlanLiftDay = {
  label: string;
  kind: "lift";
  items: PlanItem[];
};

export type PlanCardioDay = {
  label: string;
  kind: "cardio";
  duration_min_min: number;
  duration_min_max: number;
  hr_cap_bpm: number;
  note?: string;
};

export type PlanRestDay = {
  label: string;
  kind: "rest";
  note?: string;
};

export type PlanDay = PlanLiftDay | PlanCardioDay | PlanRestDay;

/** 8-week block loaded from data/plans. */
export type TrainingPlan = {
  id: string;
  name: string;
  start_date: string;
  daily_walk: string;
  weeks: Array<{ week: number; type: PlanWeekType }>;
  deload_rule: {
    sets: "halve_round_up";
    load: "keep";
    rir_note: string;
  };
  progression: {
    compound: { reps: number[]; then: "add_load_and_reset" };
    accessory: { reps: number[]; then: "add_load_and_reset" };
    pullup: {
      add_reps_per_build_week: 1;
      cap_reps: number;
      then: "lighter_band_and_reset";
    };
  };
  progression_rules: string[];
  days: Record<PlanWeekday, PlanDay>;
};

export type PrescribedExercise = {
  key: string;
  name: string;
  sets: number;
  reps: number;
  load_kg: number | null;
  band: string | null;
  hold_s: number | null;
  group: string | null;
  extra: string | null;
  progression: PlanProgression;
};

/**
 * What the plan prescribes on one calendar date.
 * Logged sessions do not change this.
 */
export type PrescribedDay = {
  date: string;
  plan_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  in_block: boolean;
  week: number | null;
  weeks_in_block: number;
  week_type: PlanWeekType | null;
  plan_day: PlanWeekday | null;
  label: string | null;
  kind: PlanDayKind | null;
  deload_note: string | null;
  daily_walk: string;
  items: PrescribedExercise[];
  cardio: {
    duration_min_min: number;
    duration_min_max: number;
    hr_cap_bpm: number;
  } | null;
  note: string | null;
};

export type SessionSet = {
  exercise_key: string;
  set: number;
  reps: number | null;
  load_kg: number | null;
  band: string | null;
  hold_s: number | null;
  done: boolean;
};

/** One logged training session. Ids are session_YYYY-MM-DD_NN. */
export type TrainingSession = {
  id: string;
  date: string;
  plan_id: string | null;
  plan_day: PlanWeekday | null;
  completed: boolean;
  rpe: number | null;
  feedback: string | null;
  sets: SessionSet[];
  duration_min: number | null;
  avg_hr: number | null;
};
