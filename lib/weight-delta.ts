import { formatNumber, parseIsoDate, shiftIsoDate } from "@/lib/format";

export type WeighIn = {
  date: string;
  kg: number;
};

export type WeightDeltaMethod = "rolling" | "weigh-in" | "since-start" | "none";

export type WeightDelta = {
  windowDays: number;
  /** Latest minus earlier. Negative means the weight went down. */
  deltaKg: number | null;
  method: WeightDeltaMethod;
  /** Chip label: "Last 7 days", or "since 9 Nov" when history is shorter. */
  label: string;
  /** Tooltip: which comparison was used. */
  detail: string;
  earlierDate: string | null;
  currentDate: string | null;
};

const ROLLING_DAYS = 7;

function finitePoints(points: readonly WeighIn[], asOf: string): WeighIn[] {
  const byDate = new Map<string, WeighIn>();
  for (const point of points) {
    if (point.date > asOf || !Number.isFinite(point.kg)) continue;
    byDate.set(point.date, { date: point.date, kg: point.kg });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function meanBetween(points: readonly WeighIn[], start: string, end: string): number | null {
  let sum = 0;
  let count = 0;
  for (const point of points) {
    if (point.date < start || point.date > end) continue;
    sum += point.kg;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

function closestOnOrBefore(points: readonly WeighIn[], date: string): WeighIn | null {
  let best: WeighIn | null = null;
  for (const point of points) {
    if (point.date > date) continue;
    if (!best || point.date > best.date) best = point;
  }
  return best;
}

/** "9 Nov", using the calendar date rather than the viewer's timezone. */
export function formatWeightDate(iso: string): string {
  const date = parseIsoDate(iso);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: "UTC" }).format(date);
  return `${day} ${month}`;
}

function emptyDelta(windowDays: number, detail: string): WeightDelta {
  return {
    windowDays,
    deltaKg: null,
    method: "none",
    label: `Last ${windowDays} days`,
    detail,
    earlierDate: null,
    currentDate: null,
  };
}

/**
 * Change over `windowDays`, preferring the 7-day rolling average now versus
 * the 7-day average ending that many days ago.
 *
 * That needs a weigh-in in both calendar windows and history that reaches the
 * start of the earlier window. Otherwise use the latest weigh-in versus the
 * closest weigh-in on or before the comparison date. If nothing exists that
 * far back, use the first weigh-in and label it "since <date>". One weigh-in
 * has no delta.
 */
export function weightWindowDelta(
  points: readonly WeighIn[],
  asOf: string,
  windowDays: number,
): WeightDelta {
  if (windowDays < 1) return emptyDelta(windowDays, "Not enough weigh-ins yet");
  const unique = finitePoints(points, asOf);
  if (unique.length === 0) return emptyDelta(windowDays, "Not enough weigh-ins yet");

  const latest = unique[unique.length - 1];
  const first = unique[0];
  const compareDate = shiftIsoDate(asOf, -windowDays);
  const currentStart = shiftIsoDate(asOf, -(ROLLING_DAYS - 1));
  const pastStart = shiftIsoDate(compareDate, -(ROLLING_DAYS - 1));
  const currentAvg = meanBetween(unique, currentStart, asOf);
  const pastAvg = meanBetween(unique, pastStart, compareDate);

  if (currentAvg != null && pastAvg != null && first.date <= pastStart) {
    return {
      windowDays,
      deltaKg: currentAvg - pastAvg,
      method: "rolling",
      label: `Last ${windowDays} days`,
      detail: `7-day average ending ${formatWeightDate(asOf)} versus 7-day average ending ${formatWeightDate(compareDate)}`,
      earlierDate: compareDate,
      currentDate: asOf,
    };
  }

  const earlier = closestOnOrBefore(unique, compareDate);
  if (earlier && earlier.date < latest.date) {
    return {
      windowDays,
      deltaKg: latest.kg - earlier.kg,
      method: "weigh-in",
      label: `Last ${windowDays} days`,
      detail: `Latest weigh-in on ${formatWeightDate(latest.date)} versus ${formatWeightDate(earlier.date)}`,
      earlierDate: earlier.date,
      currentDate: latest.date,
    };
  }

  if (first.date < latest.date) {
    return {
      windowDays,
      deltaKg: latest.kg - first.kg,
      method: "since-start",
      label: `since ${formatWeightDate(first.date)}`,
      detail: `Change since the first weigh-in on ${formatWeightDate(first.date)}`,
      earlierDate: first.date,
      currentDate: latest.date,
    };
  }

  return emptyDelta(windowDays, "Not enough weigh-ins yet");
}

/** Most recent weigh-in on or before `asOf`. */
export function latestWeighIn(points: readonly WeighIn[], asOf: string): WeighIn | null {
  const unique = finitePoints(points, asOf);
  return unique.length === 0 ? null : unique[unique.length - 1];
}

export function formatWeightDelta(deltaKg: number | null): {
  text: string;
  direction: "down" | "up" | "flat" | "none";
} {
  if (deltaKg == null || !Number.isFinite(deltaKg)) return { text: "—", direction: "none" };
  const rounded = Math.round(deltaKg * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return { text: "0.0 kg", direction: "flat" };
  const direction = rounded < 0 ? "down" : "up";
  const arrow = direction === "down" ? "↓" : "↑";
  const sign = direction === "down" ? "−" : "+";
  return {
    text: `${arrow} ${sign}${formatNumber(Math.abs(rounded), 1)} kg`,
    direction,
  };
}

function kgLabel(kg: number): string {
  const whole = Math.abs(kg - Math.round(kg)) < 1e-6;
  return formatNumber(kg, whole ? 0 : 1);
}

/** "7.0 kg to 95 kg goal", or under / at the goal. */
export function kgToGoal(currentKg: number, goalKg: number): string | null {
  if (!Number.isFinite(currentKg) || !Number.isFinite(goalKg)) return null;
  const delta = Math.round((currentKg - goalKg) * 10) / 10;
  const goal = `${kgLabel(goalKg)} kg goal`;
  if (delta === 0) return `At the ${goal}`;
  if (delta > 0) return `${formatNumber(delta, 1)} kg to ${goal}`;
  return `${formatNumber(Math.abs(delta), 1)} kg under the ${goal}`;
}
