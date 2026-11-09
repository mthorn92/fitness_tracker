import Link from "next/link";
import { Suspense } from "react";
import { BudgetCard } from "@/components/BudgetCard";
import { MealCard } from "@/components/MealCard";
import { OrangeHeader } from "@/components/OrangeHeader";
import { getTodayView } from "@/lib/data";
import { formatHours, formatNumber } from "@/lib/format";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  const today = await getTodayView(date);
  const loggedMeals = today.meals.filter((meal) => meal.foods.length > 0);

  return (
    <main className="flex flex-1 flex-col pb-28">
      <OrangeHeader dateNav={today.dateNav} dateBasePath="/" />
      <div className="-mt-10 flex flex-col gap-3 px-4">
        <BudgetCard
          budgetKcal={today.calories.target}
          foodKcal={today.foodKcal}
          exerciseKcal={today.exerciseKcal}
          remainingKcal={today.remainingKcal}
          underBudget={today.underBudget}
          protein={today.protein}
          carbs={today.carbs}
          fat={today.fat}
        />

        {today.recovery ? (
          <Link href="/recovery" className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-muted">WHOOP</p>
                <p className="mt-0.5 text-lg font-extrabold">
                  {formatNumber(today.recovery.score, 0)}% recovery
                </p>
              </div>
              {today.complete ? (
                <p className="text-xs font-bold uppercase tracking-wide text-accent">Complete</p>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">HRV</dt>
                <dd className="font-bold">{formatNumber(today.recovery.hrv, 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Resting HR</dt>
                <dd className="font-bold">{formatNumber(today.recovery.rhr, 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Sleep</dt>
                <dd className="font-bold">{formatHours(today.recovery.sleepHours)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Strain</dt>
                <dd className="font-bold">{formatNumber(today.recovery.strain, 1)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Burn</dt>
                <dd className="font-bold">{formatNumber(today.recovery.kcal, 0)} kcal</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-muted">Steps</dt>
                <dd className="font-bold">{formatNumber(today.recovery.steps)}</dd>
              </div>
            </dl>
          </Link>
        ) : null}

        {loggedMeals.length === 0 ? (
          <section className="rounded-[1.6rem] bg-surface px-5 py-8 text-center shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
            <p className="text-base font-extrabold">Nothing logged yet</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Tell your Grok Bot what you ate. This screen is for checking the day, not typing meals in.
            </p>
          </section>
        ) : (
          loggedMeals.map((meal) => <MealCard key={meal.name} meal={meal} />)
        )}

        <p className="px-1 text-center text-sm font-semibold text-muted">{today.fasting}</p>
        <p className="px-1 pb-2 text-center text-xs font-semibold text-muted">Logged by Grok Bot</p>
      </div>
    </main>
  );
}

function PageFallback() {
  return <div className="min-h-dvh bg-header" />;
}
