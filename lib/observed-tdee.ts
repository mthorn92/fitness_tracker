import { formatNumber, shiftIsoDate } from "@/lib/format";
import { PERSONAL_KCAL_REFERENCE } from "@/lib/personal-kcal";

/** Trailing window for eaten, weight, and WHOOP averages. */
export const TDEE_WINDOW_DAYS = 7;

export const OBSERVED_TDEE_FOOTNOTE =
  "Formula: eaten + (7-day avg weight drop × 7,700) ÷ 7. Early weeks read high from water weight.";

export type ObservedTdeeDay = {
  date: string;
  /** Food kcal that count. Null when the day has no eaten food (plans stay out). */
  kcal: number | null;
  weight_kg?: number | null;
  whoop_burn_kcal: number | null;
  cycle_closed?: boolean | null;
  complete?: boolean;
};

export type ObservedTdeeWeight = {
  date: string;
  kg: number;
};

export type ObservedTdeePoint = {
  date: string;
  /** Day of month, for the x-axis. */
  label: string;
  /** Eaten average + smoothed 7-day weight change × 7,700 ÷ 7. */
  rolling: number | null;
  /** That day's eaten plus one day of rolling-weight change × 7,700. */
  daily: number | null;
  eatenAvg: number | null;
  /** 7-day average weight at D−7 minus the 7-day average weight at D. */
  kgLost: number | null;
  /** Mean whoop_burn_kcal of cycle_closed days in the 7 days ending D. */
  whoopAvg: number | null;
  /** whoop_burn_kcal on D when that cycle is closed. */
  whoopDaily: number | null;
};

export type ObservedTdeeLatest = {
  date: string;
  tdee: number;
  eatenAvg: number;
  kgLost: number;
  whoopAvg: number | null;
};

export type ObservedTdeeModel = {
  latest: ObservedTdeeLatest | null;
  points: ObservedTdeePoint[];
  /** Food budget drawn on the chart. WHOOP burn does not change this. */
  budgetKcal: number;
};

type Sample = { date: string; value: number };

/**
 * A Melbourne calendar day that has finished.
 * Future dates are out. Today counts only once it is marked complete or its WHOOP cycle has closed.
 * `today` is that Melbourne date (YYYY-MM-DD), already resolved by the dashboard.
 */
export function isCompletedPastDay(
  date: string,
  today: string,
  flags?: { complete?: boolean; cycle_closed?: boolean | null },
): boolean {
  if (date > today) return false;
  if (date < today) return true;
  return flags?.cycle_closed === true || flags?.complete === true;
}

function finite(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function meanBetween(samples: readonly Sample[], start: string, end: string): number | null {
  let sum = 0;
  let count = 0;
  for (const sample of samples) {
    if (sample.date < start) continue;
    if (sample.date > end) break;
    sum += sample.value;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

function dayMonthLabel(iso: string): string {
  const [, , day] = iso.split("-");
  return String(Number(day));
}

function hasPlot(point: ObservedTdeePoint): boolean {
  return point.rolling != null || point.daily != null || point.whoopAvg != null || point.whoopDaily != null;
}

/**
 * Observed TDEE for day D:
 * (mean kcal eaten over the 7 days ending D)
 * + ((7-day average weight ending 7 days before D) − (7-day average weight ending D)) × 7,700 ÷ 7.
 *
 * Averages use only completed past days. WHOOP's 7-day line uses closed cycles only.
 * The food budget is passed through unchanged.
 */
export function buildObservedTdeeModel(input: {
  days: readonly ObservedTdeeDay[];
  weights?: readonly ObservedTdeeWeight[];
  today: string;
  budgetKcal: number;
}): ObservedTdeeModel {
  const budgetKcal = Number.isFinite(input.budgetKcal) ? input.budgetKcal : 0;
  const todayRow = input.days.find((day) => day.date === input.today);
  const todayDone =
    todayRow?.cycle_closed === true || todayRow?.complete === true;

  const eligibleDate = (date: string) => {
    if (date > input.today) return false;
    if (date < input.today) return true;
    return todayDone;
  };

  const weights = new Map<string, number>();
  for (const point of input.weights ?? []) {
    const kg = finite(point.kg);
    if (kg == null || !eligibleDate(point.date)) continue;
    weights.set(point.date, kg);
  }
  for (const day of input.days) {
    const kg = finite(day.weight_kg);
    if (kg == null || !eligibleDate(day.date)) continue;
    weights.set(day.date, kg);
  }
  const weightSamples: Sample[] = [...weights.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const eatenSamples: Sample[] = [];
  const whoopSamples: Sample[] = [];
  const chartDates: string[] = [];
  const eatenOn = new Map<string, number>();
  const whoopOn = new Map<string, number>();

  const seen = new Set<string>();
  const sortedDays = [...input.days].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of sortedDays) {
    if (!eligibleDate(day.date) || seen.has(day.date)) continue;
    seen.add(day.date);
    chartDates.push(day.date);
    const eaten = finite(day.kcal);
    if (eaten != null) {
      eatenSamples.push({ date: day.date, value: eaten });
      eatenOn.set(day.date, eaten);
    }
    const burn = finite(day.whoop_burn_kcal);
    if (burn != null && day.cycle_closed === true) {
      whoopSamples.push({ date: day.date, value: burn });
      whoopOn.set(day.date, burn);
    }
  }

  const points: ObservedTdeePoint[] = chartDates.map((date) => {
    const start = shiftIsoDate(date, -(TDEE_WINDOW_DAYS - 1));
    const priorEnd = shiftIsoDate(date, -TDEE_WINDOW_DAYS);
    const priorStart = shiftIsoDate(priorEnd, -(TDEE_WINDOW_DAYS - 1));
    const eatenAvg = meanBetween(eatenSamples, start, date);
    const weightNow = meanBetween(weightSamples, start, date);
    const weightThen = meanBetween(weightSamples, priorStart, priorEnd);
    const kgLost = weightNow != null && weightThen != null ? weightThen - weightNow : null;
    const rolling =
      eatenAvg != null && kgLost != null
        ? eatenAvg + (kgLost * PERSONAL_KCAL_REFERENCE) / TDEE_WINDOW_DAYS
        : null;

    const previous = shiftIsoDate(date, -1);
    const previousStart = shiftIsoDate(previous, -(TDEE_WINDOW_DAYS - 1));
    const weightPrevious = meanBetween(weightSamples, previousStart, previous);
    const eatenToday = eatenOn.get(date) ?? null;
    const daily =
      eatenToday != null && weightNow != null && weightPrevious != null
        ? eatenToday + (weightPrevious - weightNow) * PERSONAL_KCAL_REFERENCE
        : null;

    return {
      date,
      label: dayMonthLabel(date),
      rolling,
      daily,
      eatenAvg,
      kgLost,
      whoopAvg: meanBetween(whoopSamples, start, date),
      whoopDaily: whoopOn.get(date) ?? null,
    };
  });

  const first = points.findIndex(hasPlot);
  let last = -1;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (hasPlot(points[index])) {
      last = index;
      break;
    }
  }
  const visible = first < 0 || last < first ? [] : points.slice(first, last + 1);
  let latest: ObservedTdeeLatest | null = null;
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const point = visible[index];
    if (point?.rolling == null || point.eatenAvg == null || point.kgLost == null) continue;
    latest = {
      date: point.date,
      tdee: point.rolling,
      eatenAvg: point.eatenAvg,
      kgLost: point.kgLost,
      whoopAvg: point.whoopAvg,
    };
    break;
  }

  return { latest, points: visible, budgetKcal };
}

/** "WHOOP avg 2,910 · reads +270 high". Y is the rounded WHOOP average minus the rounded TDEE. */
export function formatWhoopComparison(whoopAvg: number, tdee: number): string {
  const whoop = Math.round(whoopAvg);
  const observed = Math.round(tdee);
  const gap = whoop - observed;
  const signed = gap > 0 ? `+${formatNumber(gap)}` : gap < 0 ? formatNumber(gap) : "+0";
  const direction = gap > 0 ? " high" : gap < 0 ? " low" : "";
  return `WHOOP avg ${formatNumber(whoop)} · reads ${signed}${direction}`;
}

/** "7-day avg eaten 1,960 + 0.62 kg lost × 7,700 ÷ 7". */
export function formatTdeeCaption(eatenAvg: number, kgLost: number): string {
  return `7-day avg eaten ${formatNumber(Math.round(eatenAvg))} + ${formatNumber(kgLost, 2)} kg lost × ${formatNumber(PERSONAL_KCAL_REFERENCE)} ÷ 7`;
}
