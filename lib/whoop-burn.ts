/**
 * Which WHOOP burn figure to show and to use in the deficit chart and rings.
 *
 * On load, day_whoop.kcal is copied onto the flat whoop_burn_kcal field, so those
 * two numbers are the same snapshot. A synced cycle keeps updating and wins over
 * that copy. A flat figure that actually differs from the snapshot is a bot
 * override and wins. Burn is analysis only and never increases the food budget.
 */
export function preferredWhoopBurnKcal(
  flatKcal: number | null | undefined,
  cycleKcal: number | null | undefined,
  snapshotKcal: number | null | undefined,
): number | null {
  const flat = flatKcal ?? null;
  const cycle = cycleKcal ?? null;
  const snapshot = snapshotKcal ?? null;
  if (flat != null && flat !== snapshot) return flat;
  if (cycle != null) return cycle;
  if (flat != null) return flat;
  return snapshot;
}
