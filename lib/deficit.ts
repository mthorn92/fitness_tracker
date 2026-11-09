/** Rough energy density used to convert cumulative deficit → expected kg. */
export const KCAL_PER_KG = 7700;

export type DeficitDayInput = {
  date: string;
  /** Whoop day burn (cycle or day_whoop kcal). */
  whoopKcal: number | null;
  /** Food calories logged that day; null when nothing was logged. */
  foodKcal: number | null;
  /** Scale weight that day, if logged. */
  weightKg: number | null;
};

export type DeficitPoint = {
  date: string;
  whoopKcal: number;
  foodKcal: number;
  dailyDeficitKcal: number;
  cumulativeDeficitKcal: number;
  /** Expected kg lost from baseline (cumulativeDeficit / 7700). */
  expectedKgLost: number;
  /**
   * Actual kg lost from baseline at this date.
   * Forward-filled from the latest weigh-in on or before this date.
   */
  actualKgLost: number | null;
  /** Raw weigh-in delta that day (no forward-fill); null if no weigh-in. */
  weighInKgLost: number | null;
};

export type DeficitSummary = {
  baselineKg: number;
  baselineDate: string;
  points: DeficitPoint[];
  expectedKgLost: number;
  actualKgLost: number | null;
  /** Cumulative deficit ÷ actual kg lost; null when no positive scale loss. */
  kcalPerKgLost: number | null;
  cumulativeDeficitKcal: number;
};

/**
 * Stable baseline: explicit start weight on startDate, else first logged weigh-in.
 */
export function resolveBaseline(
  startDate: string,
  startWeightKg: number,
  days: DeficitDayInput[],
): { date: string; kg: number } {
  if (startWeightKg != null && Number.isFinite(startWeightKg)) {
    return { date: startDate, kg: startWeightKg };
  }
  const firstWeighIn = [...days]
    .filter((day) => day.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!firstWeighIn || firstWeighIn.weightKg == null) {
    return { date: startDate, kg: startWeightKg };
  }
  return { date: firstWeighIn.date, kg: firstWeighIn.weightKg };
}

/**
 * Build cumulative Whoop−food deficit vs scale loss from a baseline weigh-in.
 * Days without Whoop burn are skipped for deficit accumulation but still receive
 * forward-filled actual kg when a later weigh-in lands on them via the date union.
 */
export function buildDeficitSeries(
  startDate: string,
  startWeightKg: number,
  days: DeficitDayInput[],
): DeficitSummary {
  const baseline = resolveBaseline(startDate, startWeightKg, days);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const dates = [
    ...new Set([
      baseline.date,
      ...days.filter((day) => day.whoopKcal != null || day.weightKg != null).map((day) => day.date),
    ]),
  ].sort();

  let cumulativeDeficitKcal = 0;
  let lastActualKgLost: number | null = dates[0] === baseline.date ? 0 : null;
  const points: DeficitPoint[] = [];

  for (const date of dates) {
    if (date < baseline.date) continue;
    const day = byDate.get(date);
    const whoopKcal = day?.whoopKcal ?? null;
    const foodKcal = day?.foodKcal ?? null;

    if (whoopKcal != null) {
      const food = foodKcal ?? 0;
      const dailyDeficitKcal = whoopKcal - food;
      cumulativeDeficitKcal += dailyDeficitKcal;

      let weighInKgLost: number | null = null;
      if (day?.weightKg != null) {
        weighInKgLost = baseline.kg - day.weightKg;
        lastActualKgLost = weighInKgLost;
      } else if (date === baseline.date) {
        weighInKgLost = 0;
        lastActualKgLost = 0;
      }

      points.push({
        date,
        whoopKcal,
        foodKcal: food,
        dailyDeficitKcal,
        cumulativeDeficitKcal,
        expectedKgLost: cumulativeDeficitKcal / KCAL_PER_KG,
        actualKgLost: lastActualKgLost,
        weighInKgLost,
      });
      continue;
    }

    // Weigh-in-only day: keep the scale series moving without inventing burn.
    if (day?.weightKg != null) {
      const weighInKgLost = baseline.kg - day.weightKg;
      lastActualKgLost = weighInKgLost;
      points.push({
        date,
        whoopKcal: 0,
        foodKcal: foodKcal ?? 0,
        dailyDeficitKcal: 0,
        cumulativeDeficitKcal,
        expectedKgLost: cumulativeDeficitKcal / KCAL_PER_KG,
        actualKgLost: lastActualKgLost,
        weighInKgLost,
      });
    } else if (date === baseline.date) {
      lastActualKgLost = 0;
      points.push({
        date,
        whoopKcal: 0,
        foodKcal: 0,
        dailyDeficitKcal: 0,
        cumulativeDeficitKcal: 0,
        expectedKgLost: 0,
        actualKgLost: 0,
        weighInKgLost: 0,
      });
    }
  }

  const latest = points[points.length - 1];
  const actualKgLost = latest?.actualKgLost ?? null;
  const cumulative = latest?.cumulativeDeficitKcal ?? 0;
  const kcalPerKgLost =
    actualKgLost != null && actualKgLost > 0 ? cumulative / actualKgLost : null;

  return {
    baselineKg: baseline.kg,
    baselineDate: baseline.date,
    points,
    expectedKgLost: latest?.expectedKgLost ?? 0,
    actualKgLost,
    kcalPerKgLost,
    cumulativeDeficitKcal: cumulative,
  };
}
