import type { Metadata } from "next";
import { FoodList } from "@/components/FoodList";
import { MetricRow } from "@/components/MetricRow";
import { SampleNote } from "@/components/SampleNote";
import { Section } from "@/components/Section";
import { getLogView, getSavedMeals } from "@/lib/data";
import { formatNumber, formatTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Log",
};

export default async function LogPage() {
  const [day, meals] = await Promise.all([getLogView(), getSavedMeals()]);

  return (
    <main className="flex flex-1 flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{day.dateLabel}</p>
          <h1 className="font-display mt-1 text-4xl tracking-tight">Log</h1>
        </div>
        <SampleNote />
      </header>

      <section className="grid grid-cols-2 gap-3">
        <SummaryCard label="Calories" value={formatNumber(day.calories.current)} hint={`/ ${formatNumber(day.calories.target)}`} />
        <SummaryCard label="Water" value={`${formatNumber(day.water.current, 1)} L`} hint={`/ ${formatNumber(day.water.target, 1)} L`} />
      </section>

      <Section title="Macros">
        <div className="space-y-5 rounded-3xl border border-line bg-surface p-5">
          <MetricRow label="Protein" metric={day.protein} unit="g" digits={1} />
          <MetricRow label="Carbs" metric={day.carbs} unit="g" digits={1} />
          <MetricRow label="Fat" metric={day.fat} unit="g" digits={1} />
        </div>
      </Section>

      <Section title="Food">
        <FoodList foods={day.foods} />
      </Section>

      <Section title="Water">
        {day.waterEntries.length === 0 ? (
          <p className="rounded-3xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            No drinks logged yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
            {day.waterEntries.map((entry, index) => (
              <li
                key={`${entry.time}-${entry.item}-${index}`}
                className="grid grid-cols-[4.25rem_1fr_auto] items-start gap-3 border-b border-line px-4 py-3.5 last:border-b-0"
              >
                <p className="pt-0.5 text-xs tabular-nums text-muted">{formatTime(entry.time)}</p>
                <div>
                  <p className="text-sm leading-5">{entry.item}</p>
                  {entry.estimated ? (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">Estimated</p>
                  ) : null}
                </div>
                <p className="pt-0.5 text-sm tabular-nums">
                  {formatNumber(entry.litres, 2)}
                  <span className="ml-1 text-[11px] text-muted">L</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Saved meals">
        <ul className="space-y-3">
          {meals.map((meal) => (
            <li key={meal.name} className="rounded-3xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium capitalize">{meal.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">{meal.serve}</p>
                </div>
                <p className="text-sm tabular-nums">{formatNumber(meal.kcal)} kcal</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{meal.recipe}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted">
                P {formatNumber(meal.protein_g)} · C {formatNumber(meal.carbs_g)} · F {formatNumber(meal.fat_g)}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="font-display mt-2 text-3xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
