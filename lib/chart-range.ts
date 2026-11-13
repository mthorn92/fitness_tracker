import { fixedTdeeCumulativeForChartDays } from "@/lib/deficit";
import { formatNumber, parseIsoDate, shiftIsoDate } from "@/lib/format";

export const CHART_RANGES = [
  { id: "14d", label: "14d", name: "14 days" },
  { id: "1m", label: "1m", name: "1 month" },
  { id: "6m", label: "6m", name: "6 months" },
  { id: "all", label: "All", name: "All time" },
] as const;

export type ChartRangeId = (typeof CHART_RANGES)[number]["id"];

/** Daily bars, matching the dashboard before a range was chosen. */
export const DEFAULT_CHART_RANGE: ChartRangeId = "14d";

export function isChartRange(value: string | null | undefined): value is ChartRangeId {
  return value === "14d" || value === "1m" || value === "6m" || value === "all";
}

export function parseChartRange(value: string | string[] | undefined): ChartRangeId {
  const raw = Array.isArray(value) ? value[0] : value;
  return isChartRange(raw) ? raw : DEFAULT_CHART_RANGE;
}

/** 6 months and all time collapse daily bars into weeks. */
export function isWeeklyChartRange(range: ChartRangeId): boolean {
  return range === "6m" || range === "all";
}

/** Inclusive start, or null when the range is all history. */
export function chartRangeStart(range: ChartRangeId, endDate: string): string | null {
  if (range === "all") return null;
  if (range === "14d") return shiftIsoDate(endDate, -13);
  if (range === "1m") return addCalendarMonths(endDate, -1);
  return addCalendarMonths(endDate, -6);
}

export function addCalendarMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  cursor.setUTCDate(Math.min(day, last));
  return cursor.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `iso`. */
export function weekStartMonday(iso: string): string {
  const day = parseIsoDate(iso).getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return shiftIsoDate(iso, delta);
}

const WEEK_LABEL = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatWeekStartLabel(monday: string): string {
  return WEEK_LABEL.format(parseIsoDate(monday));
}

export type RangeDay = {
  date: string;
  label: string;
  weight_kg: number | null;
  kcal: number | null;
  protein_g: number;
  water_l: number;
  whoop_burn_kcal: number | null;
  deficit_kcal: number | null;
  cumulative_deficit_kcal: number | null;
};

export type DietChartTargets = {
  calories_kcal: number;
  protein_g: number;
  water_l: number;
};

export type DietChartModel = {
  weekly: boolean;
  labels: string[];
  goalWeightKg: number;
  weightKg: Array<number | null>;
  weightAvg7: Array<number | null>;
  deficitWhoop: Array<number | null>;
  deficitFixed: Array<number | null>;
  kcal: Array<number | null>;
  whoopKcal: Array<number | null>;
  proteinG: Array<number | null>;
  waterL: Array<number | null>;
  targets: DietChartTargets;
  averages: {
    kcalPerDay: number | null;
    proteinPerDay: number | null;
    waterPerDay: number | null;
    /** Y value of the average line. Weekly charts draw the daily average × 7. */
    kcalLine: number | null;
    proteinLine: number | null;
    waterLine: number | null;
  };
};

function finiteOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/** Food was logged. A zero-calorie entry still counts; a missing day does not. */
export function loggedKcal(day: Pick<RangeDay, "kcal">): number | null {
  return finiteOrNull(day.kcal);
}

/** Protein counts on days with logged food, including an explicit 0 g. */
export function loggedProtein(day: Pick<RangeDay, "kcal" | "protein_g">): number | null {
  if (loggedKcal(day) == null) return null;
  return finiteOrNull(day.protein_g);
}

/** Water counts only when some amount was logged. */
export function loggedWater(day: Pick<RangeDay, "water_l">): number | null {
  const value = finiteOrNull(day.water_l);
  if (value == null || value <= 0) return null;
  return value;
}

export function sumOfLogged(values: Array<number | null>): number | null {
  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    sum += value;
    count += 1;
  }
  return count === 0 ? null : sum;
}

export function meanOfLogged(values: Array<number | null>): number | null {
  const sum = sumOfLogged(values);
  if (sum == null) return null;
  let count = 0;
  for (const value of values) {
    if (value != null && Number.isFinite(value)) count += 1;
  }
  return count === 0 ? null : sum / count;
}

function lastLogged(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value != null && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * Horizontal line for a per-day average.
 * Weekly bars are sums, so the same daily average is drawn at ×7.
 */
export function averageLineValue(perDay: number | null, weekly: boolean): number | null {
  if (perDay == null || !Number.isFinite(perDay)) return null;
  return weekly ? perDay * 7 : perDay;
}

export function formatKcalPerDay(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `Avg ${formatNumber(Math.round(value))} kcal/day`;
}

export function formatProteinPerDay(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `Avg ${formatNumber(Math.round(value))} g/day`;
}

export function formatWaterPerDay(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `Avg ${formatNumber(value, 1)} L/day`;
}

type ChartPoint = {
  date: string;
  label: string;
  weightKg: number | null;
  weightAvg7: number | null;
  kcal: number | null;
  proteinG: number | null;
  waterL: number | null;
  whoopKcal: number | null;
  deficitCumulative: number | null;
  fixedCumulative: number | null;
};

function weekLabel(monday: string): string {
  return formatWeekStartLabel(monday);
}

function bucketWeek(days: ChartPoint[]): ChartPoint {
  const start = weekStartMonday(days[0]?.date ?? "");
  return {
    date: start,
    label: weekLabel(start),
    weightKg: meanOfLogged(days.map((day) => day.weightKg)),
    weightAvg7: lastLogged(days.map((day) => day.weightAvg7)),
    kcal: sumOfLogged(days.map((day) => day.kcal)),
    proteinG: sumOfLogged(days.map((day) => day.proteinG)),
    waterL: sumOfLogged(days.map((day) => day.waterL)),
    whoopKcal: sumOfLogged(days.map((day) => day.whoopKcal)),
    deficitCumulative: lastLogged(days.map((day) => day.deficitCumulative)),
    fixedCumulative: lastLogged(days.map((day) => day.fixedCumulative)),
  };
}

function groupWeeks(days: ChartPoint[]): ChartPoint[] {
  const groups = new Map<string, ChartPoint[]>();
  for (const day of days) {
    const start = weekStartMonday(day.date);
    const group = groups.get(start);
    if (group) group.push(day);
    else groups.set(start, [day]);
  }
  return [...groups.keys()].sort().map((start) => bucketWeek(groups.get(start) ?? []));
}

function emptyModel(weekly: boolean, goalWeightKg: number, targets: DietChartTargets): DietChartModel {
  const factor = weekly ? 7 : 1;
  return {
    weekly,
    labels: [],
    goalWeightKg,
    weightKg: [],
    weightAvg7: [],
    deficitWhoop: [],
    deficitFixed: [],
    kcal: [],
    whoopKcal: [],
    proteinG: [],
    waterL: [],
    targets: {
      calories_kcal: targets.calories_kcal * factor,
      protein_g: targets.protein_g * factor,
      water_l: targets.water_l * factor,
    },
    averages: {
      kcalPerDay: null,
      proteinPerDay: null,
      waterPerDay: null,
      kcalLine: null,
      proteinLine: null,
      waterLine: null,
    },
  };
}

function toSeries(points: ChartPoint[], weekly: boolean, goalWeightKg: number, targets: DietChartTargets, days: ChartPoint[]): DietChartModel {
  const factor = weekly ? 7 : 1;
  const kcalPerDay = meanOfLogged(days.map((day) => day.kcal));
  const proteinPerDay = meanOfLogged(days.map((day) => day.proteinG));
  const waterPerDay = meanOfLogged(days.map((day) => day.waterL));
  return {
    weekly,
    labels: points.map((point) => point.label),
    goalWeightKg,
    weightKg: points.map((point) => point.weightKg),
    weightAvg7: points.map((point) => point.weightAvg7),
    deficitWhoop: points.map((point) => point.deficitCumulative),
    deficitFixed: points.map((point) => point.fixedCumulative),
    kcal: points.map((point) => point.kcal),
    whoopKcal: points.map((point) => point.whoopKcal),
    proteinG: points.map((point) => point.proteinG),
    waterL: points.map((point) => point.waterL),
    targets: {
      calories_kcal: targets.calories_kcal * factor,
      protein_g: targets.protein_g * factor,
      water_l: targets.water_l * factor,
    },
    averages: {
      kcalPerDay,
      proteinPerDay,
      waterPerDay,
      kcalLine: averageLineValue(kcalPerDay, weekly),
      proteinLine: averageLineValue(proteinPerDay, weekly),
      waterLine: averageLineValue(waterPerDay, weekly),
    },
  };
}

/**
 * Window and, for 6 months and all time, weekly buckets for the diet charts.
 *
 * Averages use every logged day in the window, not the weekly bar heights.
 * Cumulative deficit lines keep their running total from before the window.
 * `weightRolling7` is parallel to `days` and already includes the 7-day window.
 */
export function buildDietChartModel(input: {
  days: RangeDay[];
  weightRolling7: Array<number | null>;
  range: ChartRangeId;
  targets: DietChartTargets;
  goalWeightKg: number;
}): DietChartModel {
  const weekly = isWeeklyChartRange(input.range);
  const end = input.days.reduce<string | null>((latest, day) => {
    if (latest == null || day.date > latest) return day.date;
    return latest;
  }, null);
  if (end == null) return emptyModel(weekly, input.goalWeightKg, input.targets);

  const fixed = fixedTdeeCumulativeForChartDays(
    input.days.map((day) => ({
      plotted: day.deficit_kcal != null,
      foodKcal: day.kcal,
      whoopKcal: day.whoop_burn_kcal,
    })),
  );
  const start = chartRangeStart(input.range, end);
  const visible: ChartPoint[] = [];
  input.days.forEach((day, index) => {
    if (day.date > end || (start != null && day.date < start)) return;
    visible.push({
      date: day.date,
      label: day.label,
      weightKg: finiteOrNull(day.weight_kg),
      weightAvg7: finiteOrNull(input.weightRolling7[index]),
      kcal: loggedKcal(day),
      proteinG: loggedProtein(day),
      waterL: loggedWater(day),
      whoopKcal: finiteOrNull(day.whoop_burn_kcal),
      deficitCumulative: day.deficit_kcal == null ? null : finiteOrNull(day.cumulative_deficit_kcal),
      fixedCumulative: finiteOrNull(fixed.values[index]),
    });
  });
  visible.sort((a, b) => a.date.localeCompare(b.date));
  const points = weekly ? groupWeeks(visible) : visible;
  return toSeries(points, weekly, input.goalWeightKg, input.targets, visible);
}
