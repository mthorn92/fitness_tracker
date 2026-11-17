/**
 * Shared hover rounding for Diet and Exercise charts.
 * Kilocalories are whole numbers. Mass and volume keep one decimal place.
 */
export type ChartHoverUnit = "kcal" | "kg" | "g" | "L";

export function formatChartHoverValue(value: number, unit: ChartHoverUnit): string {
  if (!Number.isFinite(value)) return "";
  if (unit === "kcal") {
    return Math.round(value).toLocaleString("en-AU");
  }
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
