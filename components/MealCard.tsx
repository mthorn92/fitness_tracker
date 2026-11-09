import { AddFoodButton } from "@/components/AddFoodButton";
import { formatNumber, formatTime } from "@/lib/format";
import type { MealGroup, MealName } from "@/lib/types";

const MEAL_DEFAULT_TIME: Record<MealName, string> = {
  Breakfast: "08:00",
  "Morning Snacks": "10:30",
  Lunch: "12:30",
  "Afternoon Snacks": "15:30",
  Dinner: "19:00",
  "Evening Snacks": "21:30",
};

function defaultTimeForMeal(name: MealName): string {
  return MEAL_DEFAULT_TIME[name];
}

export function MealCard({ meal, date }: { meal: MealGroup; date: string }) {
  return (
    <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{meal.name}</h2>
        {meal.kcal > 0 ? (
          <p className="text-sm font-bold text-muted">{formatNumber(meal.kcal)} kcal</p>
        ) : null}
      </div>
      {meal.foods.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {meal.foods.map((food, index) => (
            <li key={food.id ?? `${food.time}-${food.item}-${index}`} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">{food.item}</p>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {formatTime(food.time)}
                  {food.saved_meal ? " · Saved meal" : ""}
                </p>
              </div>
              <p className="text-sm font-bold">{formatNumber(food.kcal)}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex justify-end">
        <AddFoodButton date={date} defaultTime={defaultTimeForMeal(meal.name)} />
      </div>
    </section>
  );
}
