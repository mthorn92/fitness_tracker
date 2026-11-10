/**
 * Which WHOOP burn figure to show and to use in the deficit chart and rings.
 *
 * Diet Coach posts whoop_burn_kcal. That write lands on day_whoop.kcal, and load
 * copies it onto the flat whoop_burn_kcal field, so those two numbers match.
 * That posted figure wins over whoop_cycles.
 *
 * whoop_cycles is the one-time sample seed (data/fitness.json). Nothing in the
 * log API updates it. Monday's seeded cycle is 1,372 kcal at strain ~0.86, a
 * part-day snapshot, and must not replace a later post for that date (2,219).
 * Use the cycle only when no posted burn exists (flat and day_whoop both empty).
 *
 * Burn is analysis only and never increases the 2,000 kcal food budget.
 */
export function preferredWhoopBurnKcal(
  flatKcal: number | null | undefined,
  cycleKcal: number | null | undefined,
  snapshotKcal: number | null | undefined,
): number | null {
  const flat = flatKcal ?? null;
  const cycle = cycleKcal ?? null;
  const snapshot = snapshotKcal ?? null;
  if (flat != null) return flat;
  if (snapshot != null) return snapshot;
  return cycle;
}
