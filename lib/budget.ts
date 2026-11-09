/**
 * Daily calorie budget.
 *
 * Exercise is shown on the dashboard as a log of the day's work.
 * It is never eaten back into remaining calories or macros.
 */
export function dayBudget(targetKcal: number, foodKcal: number, exerciseKcal: number) {
  const remainingKcal = targetKcal - foodKcal;
  return {
    foodKcal,
    exerciseKcal,
    remainingKcal,
    underBudget: remainingKcal >= 0,
  };
}
