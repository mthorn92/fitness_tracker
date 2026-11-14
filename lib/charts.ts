import { shiftIsoDate } from "@/lib/format";

export type SeriesPoint = {
  date: string;
  value: number;
};

export type TrendSeriesPoint = SeriesPoint & {
  label: string;
  /** 7-day calendar moving average ending on this date. */
  avg7d: number;
};

/**
 * For each point, average all values whose date falls in [date-6, date].
 * Days without a logged value do not contribute a point; they can still sit
 * inside another day's window when a neighbor was logged.
 */
export function withSevenDayAverage(points: SeriesPoint[]): Array<SeriesPoint & { avg7d: number }> {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  let start = 0;
  let sum = 0;
  return sorted.map((point, index) => {
    sum += point.value;
    const windowStart = shiftIsoDate(point.date, -6);
    while (start < index && sorted[start].date < windowStart) {
      sum -= sorted[start].value;
      start += 1;
    }
    const count = index - start + 1;
    return { ...point, avg7d: sum / count };
  });
}
