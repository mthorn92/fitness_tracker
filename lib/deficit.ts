/** Rough energy density used to convert cumulative deficit → expected kg. */
export const KCAL_PER_KG = 7700;

/**
 * Assumed daily burn for the comparison deficit line on the diet chart.
 * Display only: it does not change the food budget or the WHOOP deficit.
 */
export const ASSUMED_TDEE_KCAL = 2700;

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
 * Whether burn − food should count for cumulative deficit and the monthly rings.
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
 * Label for the cumulative-deficit "in progress" note.
 * Only a row for calendar today can be in progress. If today has no row yet,
 * this returns null so yesterday is not described as in progress.
 */
export function deficitInProgressLabel(
  days: Array<{
    date: string;
    label: string;
    complete?: boolean;
    cycleClosed?: boolean | null;
  }>,
  today: string,
): string | null {
  const row = days.find((day) => day.date === today);
  if (!row) return null;
  if (
    isDeficitDayReady(
      { date: row.date, complete: row.complete ?? false, cycleClosed: row.cycleClosed },
      today,
    )
  ) {
    return null;
  }
  return row.label;
}

/**
 * One day's energy difference: WHOOP burn minus food eaten.
 * Positive means under (ate less than was burned). Negative is over.
 * Shared by the cumulative deficit chart and the monthly rings.
 */
export function dailyDeficitKcal(whoopKcal: number, foodKcal: number): number {
  return whoopKcal - foodKcal;
}

/** Legend/summary text for the fixed-TDEE comparison, e.g. "Fixed TDEE 2,700". */
export function fixedTdeeSeriesLabel(kcal = ASSUMED_TDEE_KCAL): string {
  return `Fixed TDEE ${kcal.toLocaleString("en-AU")}`;
}

/**
 * One day's deficit against the fixed TDEE: assumed burn minus food eaten.
 * Positive means under. WHOOP burn is not an input.
 */
export function fixedTdeeDailyDeficitKcal(foodKcal: number, assumedTdeeKcal = ASSUMED_TDEE_KCAL): number {
  return assumedTdeeKcal - foodKcal;
}

export type FixedTdeeChartDay = {
  /** True when the existing deficit chart draws this day. */
  plotted: boolean;
  /** Logged food kcal. Null when nothing was logged. */
  foodKcal: number | null;
  /**
   * WHOOP burn for this day. Required for the day to count: the existing
   * series only adds burn − food when both exist. A plotted weigh-in with
   * no burn keeps the fixed line flat.
   */
  whoopKcal: number | null;
};

export type FixedTdeeChartSeries = {
  /** Parallel to the input days. Null where the existing chart has a gap. */
  values: Array<number | null>;
  cumulativeDeficitKcal: number;
  expectedKgLost: number;
};

function finiteKcal(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Cumulative fixed-TDEE deficit aligned to the diet chart's days.
 *
 * A day adds ASSUMED_TDEE − food only when the existing series counts it:
 * the chart plots the day, food was logged, and WHOOP burn is present (so
 * today still open, and days with no food, do not invent a deficit). A
 * plotted day that does not count stays flat. Days the chart skips are null.
 */
export function fixedTdeeCumulativeForChartDays(days: FixedTdeeChartDay[]): FixedTdeeChartSeries {
  let cumulative = 0;
  let sawPlotted = false;
  const values = days.map((day) => {
    if (!day.plotted) return null;
    sawPlotted = true;
    const food = finiteKcal(day.foodKcal);
    const burn = finiteKcal(day.whoopKcal);
    if (food != null && burn != null) {
      cumulative += fixedTdeeDailyDeficitKcal(food);
    }
    return cumulative;
  });
  const total = sawPlotted ? cumulative : 0;
  return {
    values,
    cumulativeDeficitKcal: total,
    expectedKgLost: total / KCAL_PER_KG,
  };
}

export type FixedTdeeDeficitPoint = {
  date: string;
  foodKcal: number | null;
  /** Null when this plotted day did not add a fixed-TDEE deficit. */
  dailyDeficitKcal: number | null;
  cumulativeDeficitKcal: number;
  expectedKgLost: number;
};

export type FixedTdeeDeficitSummary = {
  /** Same dates, same order, as buildDeficitSeries points. */
  points: FixedTdeeDeficitPoint[];
  cumulativeDeficitKcal: number;
  expectedKgLost: number;
};

/**
 * Fixed-TDEE cumulative on the same days as buildDeficitSeries.
 *
 * Inclusion is taken from that series, so an open cycle excludes only
 * calendar today, past days still count, and a day with no logged food does
 * not add 2,700. This does not change the WHOOP deficit result.
 */
export function buildFixedTdeeDeficitSeries(
  days: DeficitDayInput[],
  options: BuildDeficitOptions = {},
): FixedTdeeDeficitSummary {
  const whoop = buildDeficitSeries(days, options);
  const inputByDate = new Map(days.map((day) => [day.date, day]));
  let cumulative = 0;
  const points = whoop.points.map((point) => {
    const input = inputByDate.get(point.date);
    const food = finiteKcal(input?.foodKcal);
    const burn = finiteKcal(input?.whoopKcal);
    const counted = food != null && burn != null;
    const daily = counted ? fixedTdeeDailyDeficitKcal(food) : null;
    if (daily != null) cumulative += daily;
    return {
      date: point.date,
      foodKcal: counted ? food : null,
      dailyDeficitKcal: daily,
      cumulativeDeficitKcal: cumulative,
      expectedKgLost: cumulative / KCAL_PER_KG,
    };
  });
  const latest = points[points.length - 1];
  return {
    points,
    cumulativeDeficitKcal: latest?.cumulativeDeficitKcal ?? 0,
    expectedKgLost: latest?.expectedKgLost ?? 0,
  };
}

/**
 * Build cumulative Whoop−food deficit vs scale loss.
 *
 * Starts at the first day with Whoop burn + food + weigh-in (that weight is baseline).
 * An open WHOOP cycle excludes only calendar today. Past days count once the calendar
 * day has passed. Later days accumulate only when both Whoop and food exist;
 * weigh-ins update actual kg without inventing burn.
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
    const deficit = dailyDeficitKcal(whoopKcal, foodKcal);
    cumulativeDeficitKcal += deficit;

    let weighInKgLost: number | null = null;
    if (hasWeighIn) {
      weighInKgLost = baselineKg - (day.weightKg as number);
      lastActualKgLost = weighInKgLost;
    }

    points.push({
      date: day.date,
      whoopKcal,
      foodKcal,
      dailyDeficitKcal: deficit,
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
