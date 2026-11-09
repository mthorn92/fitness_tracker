import { formatNumber, formatTime } from "@/lib/format";
import type { FoodItem } from "@/lib/types";

export function FoodList({ foods }: { foods: FoodItem[] }) {
  if (foods.length === 0) {
    return (
      <div className="rounded-3xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
        No food logged yet.
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
      {foods.map((food, index) => (
        <li
          key={`${food.time}-${food.item}-${index}`}
          className="grid grid-cols-[4.25rem_1fr_auto] items-start gap-3 border-b border-line px-4 py-3.5 last:border-b-0"
        >
          <p className="pt-0.5 text-xs tabular-nums text-muted">{formatTime(food.time)}</p>
          <div className="min-w-0">
            <p className="text-sm leading-5">{food.item}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">
              P {formatNumber(food.protein_g, 1)} · C {formatNumber(food.carbs_g, 1)} · F {formatNumber(food.fat_g, 1)}
              {food.saved_meal ? " · Saved meal" : ""}
            </p>
          </div>
          <p className="pt-0.5 text-sm tabular-nums text-foreground">
            {formatNumber(food.kcal)}
            <span className="ml-1 text-[11px] text-muted">kcal</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
