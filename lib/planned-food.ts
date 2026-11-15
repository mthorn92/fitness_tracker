/** A name already used by the bot, for example "Oats (planned)". */
export function nameMarkedPlanned(item: string): boolean {
  return /\(planned\)/i.test(item);
}

/**
 * Planned food is faded in the day list and left out of averages, deficit, and trends.
 * A future Melbourne date is planned even when the flag is omitted.
 */
export function isPlannedFood(
  food: { item?: string | null; planned?: boolean | null },
  date: string,
  today: string,
): boolean {
  if (food.planned === true) return true;
  if (date > today) return true;
  return nameMarkedPlanned(food.item ?? "");
}
