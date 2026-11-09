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
  return sorted.map((point) => {
    const windowStart = shiftIsoDate(point.date, -6);
    const inWindow = sorted.filter((candidate) => candidate.date >= windowStart && candidate.date <= point.date);
    const avg7d = inWindow.reduce((sum, candidate) => sum + candidate.value, 0) / inWindow.length;
    return { ...point, avg7d };
  });
}
