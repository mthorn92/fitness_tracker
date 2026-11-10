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
  /** Day marked complete in the store. */
  complete?: boolean;
  /** WHOOP cycle closed for this waking date (preferred over complete when set). */
  cycleClosed?: boolean | null;
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

export type BuildDeficitOptions = {
  /**
   * ISO calendar day for "today". When set, that date is omitted unless the day
   * is marked complete.
   */
  today?: string | null;
};

function emptySummary(): DeficitSummary {
  return {
    baselineKg: 0,
    baselineDate: "",
    points: [],
    expectedKgLost: 0,
    actualKgLost: null,
    kcalPerKgLost: null,
    cumulativeDeficitKcal: 0,
  };
}

/** Overlay can start when Whoop burn, food, and weight are all present. */
export function hasDeficitAnchor(day: DeficitDayInput): boolean {
  return day.whoopKcal != null && day.foodKcal != null && day.weightKg != null;
}

export function isChartDayIncluded(
  day: Pick<DeficitDayInput, "date" | "complete" | "cycleClosed">,
  today?: string | null,
): boolean {
  if (!today) return true;
  if (day.date !== today) return true;
  if (day.cycleClosed === true || day.complete === true) return true;
  if (day.cycleClosed === false) return false;
  return false;
}

/**
 * Whether burn − food should count for cumulative deficit.
 * Past calendar days count even when WHOOP still reports an open cycle; only the
 * current calendar day waits for cycle_closed / complete.
 */
export function isDeficitDayReady(
  day: Pick<DeficitDayInput, "date" | "complete" | "cycleClosed">,
  today?: string | null,
): boolean {
  if (day.cycleClosed === true || day.complete === true) return true;
  if (today && day.date < today) return true;
  if (day.cycleClosed === false) return false;
  return !today || day.date !== today;
}

/**
 * Build cumulative Whoop−food deficit vs scale loss.
 *
 * Starts at the first day with Whoop burn + food + weigh-in (that weight is baseline).
 * Incomplete "today" is excluded when `today` is set. Later days accumulate only when
 * both Whoop and food exist; weigh-ins update actual kg without inventing burn.
 */
export function buildDeficitSeries(
  days: DeficitDayInput[],
  options: BuildDeficitOptions = {},
): DeficitSummary {
  const { today = null } = options;
  const eligible = [...days]
    .filter((day) => isChartDayIncluded(day, today))
    .sort((a, b) => a.date.localeCompare(b.date));

  const anchor = eligible.find(hasDeficitAnchor);
  if (!anchor || anchor.weightKg == null || anchor.whoopKcal == null || anchor.foodKcal == null) {
    return emptySummary();
  }

  const baselineKg = anchor.weightKg;
  const baselineDate = anchor.date;
  let cumulativeDeficitKcal = 0;
  let lastActualKgLost = 0;
  const points: DeficitPoint[] = [];

  for (const day of eligible) {
    if (day.date < baselineDate) continue;
    if (!isDeficitDayReady(day, today)) continue;

    const hasDeficitInputs = day.whoopKcal != null && day.foodKcal != null;
    const hasWeighIn = day.weightKg != null;

    if (!hasDeficitInputs && !hasWeighIn) continue;
    // Before we have both deficit inputs on a post-anchor day, skip weigh-in-only
    // rows that would invent expected progress from nothing — except the anchor.
    if (!hasDeficitInputs && day.date !== baselineDate) {
      const weighInKgLost = baselineKg - (day.weightKg as number);
      lastActualKgLost = weighInKgLost;
      points.push({
        date: day.date,
        whoopKcal: 0,
        foodKcal: 0,
        dailyDeficitKcal: 0,
        cumulativeDeficitKcal,
        expectedKgLost: cumulativeDeficitKcal / KCAL_PER_KG,
        actualKgLost: lastActualKgLost,
        weighInKgLost,
      });
      continue;
    }

    if (!hasDeficitInputs) continue;

    const whoopKcal = day.whoopKcal as number;
    const foodKcal = day.foodKcal as number;
    const dailyDeficitKcal = whoopKcal - foodKcal;
    cumulativeDeficitKcal += dailyDeficitKcal;

    let weighInKgLost: number | null = null;
    if (hasWeighIn) {
      weighInKgLost = baselineKg - (day.weightKg as number);
      lastActualKgLost = weighInKgLost;
    }

    points.push({
      date: day.date,
      whoopKcal,
      foodKcal,
      dailyDeficitKcal,
      cumulativeDeficitKcal,
      expectedKgLost: cumulativeDeficitKcal / KCAL_PER_KG,
      actualKgLost: lastActualKgLost,
      weighInKgLost,
    });
  }

  const latest = points[points.length - 1];
  const actualKgLost = latest?.actualKgLost ?? null;
  const cumulative = latest?.cumulativeDeficitKcal ?? 0;
  const kcalPerKgLost =
    actualKgLost != null && actualKgLost > 0 ? cumulative / actualKgLost : null;

  return {
    baselineKg,
    baselineDate,
    points,
    expectedKgLost: latest?.expectedKgLost ?? 0,
    actualKgLost,
    kcalPerKgLost,
    cumulativeDeficitKcal: cumulative,
  };
}
