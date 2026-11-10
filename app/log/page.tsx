import type { Metadata } from "next";
import { Suspense } from "react";
import { AddFoodButton } from "@/components/AddFoodButton";
import { MealCard } from "@/components/MealCard";
import { OrangeHeader } from "@/components/OrangeHeader";
import { getLogView, getSavedMeals } from "@/lib/data";
import { formatHours, formatNumber, formatTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Log",
};

export default function LogPage({ searchParams }: PageProps<"/log">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <Log searchParams={searchParams} />
    </Suspense>
  );
}

async function Log({
  searchParams,
}: {
  searchParams: PageProps<"/log">["searchParams"];
}) {
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  const [day, meals] = await Promise.all([getLogView(date), getSavedMeals()]);
  const loggedMeals = day.meals.filter((meal) => meal.foods.length > 0);

  return (
    <main className="flex flex-1 flex-col pb-28">
      <OrangeHeader dateNav={day.dateNav} dateBasePath="/log" />
      <div className="mt-3 flex flex-col gap-3 px-4">
        <section className="grid grid-cols-2 gap-3">
          <SummaryCard label="Calories" value={formatNumber(day.foodKcal)} hint={`/ ${formatNumber(day.calories.target)}`} />
          <SummaryCard
            label="Water"
            value={`${formatNumber(day.water.current, 1)} L`}
            hint={`/ ${formatNumber(day.water.target, 1)} L`}
          />
        </section>

        {day.recovery ? (
          <section className="card !mb-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">WHOOP</h2>
              {day.complete ? (
                <p className="text-xs font-bold uppercase tracking-wide text-accent">Complete</p>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Recovery</dt>
                <dd className="font-bold">{formatNumber(day.recovery.score, 0)}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">HRV</dt>
                <dd className="font-bold">{formatNumber(day.recovery.hrv, 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Resting HR</dt>
                <dd className="font-bold">{formatNumber(day.recovery.rhr, 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Sleep</dt>
                <dd className="font-bold">{formatHours(day.recovery.sleepHours)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Strain</dt>
                <dd className="font-bold">{formatNumber(day.recovery.strain, 1)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Burn</dt>
                <dd className="font-bold">{formatNumber(day.recovery.kcal, 0)} kcal</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {loggedMeals.length === 0 ? (
          <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
            <h2 className="text-lg font-extrabold">Food</h2>
            <p className="py-6 text-center text-sm font-semibold text-muted">No food logged this day.</p>
            <div className="mt-3 flex justify-end">
              <AddFoodButton date={day.date} />
            </div>
            <p className="mt-1 text-right text-xs font-semibold text-muted">Rare corrections only — meals come from the Grok Bot</p>
          </section>
        ) : (
          <>
            {loggedMeals.map((meal) => (
              <MealCard key={meal.name} meal={meal} />
            ))}
            <div className="flex justify-end px-1">
              <AddFoodButton date={day.date} />
            </div>
            <p className="px-1 text-right text-xs font-semibold text-muted">Rare corrections only — meals come from the Grok Bot</p>
          </>
        )}

        <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <h2 className="text-lg font-extrabold">Water</h2>
          {day.waterEntries.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-muted">No drinks logged this day.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {day.waterEntries.map((entry, index) => (
                <li key={entry.id ?? `${entry.time}-${entry.item}-${index}`} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold leading-5">{entry.item}</p>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {formatTime(entry.time)}
                      {entry.estimated ? " · Estimated" : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold">{formatNumber(entry.litres, 2)} L</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <h2 className="text-lg font-extrabold">Saved meals</h2>
          <ul className="mt-3 space-y-4">
            {meals.map((meal) => (
              <li key={meal.name}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold capitalize">{meal.name}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{meal.serve}</p>
                  </div>
                  <p className="text-sm font-bold">{formatNumber(meal.kcal)} kcal</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{meal.recipe}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[1.6rem] bg-surface px-4 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted">{hint}</p>
    </div>
  );
}
