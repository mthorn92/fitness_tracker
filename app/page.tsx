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
                <p className="text-sm font-semibold text-muted">Recovery</p>
                <p className="mt-0.5 text-lg font-extrabold">{formatNumber(today.recovery.score, 0)}</p>
              </div>
              <p className="text-sm font-semibold text-muted">
                Sleep {formatHours(today.recovery.sleepHours)} · {formatNumber(today.recovery.steps)} steps
              </p>
            </div>
          </Link>
        ) : null}

        {today.meals.map((meal) => (
          <MealCard key={meal.name} meal={meal} />
        ))}

        <p className="px-1 pb-2 text-center text-sm font-semibold text-muted">{today.fasting}</p>
      </div>
    </main>
  );
}

function PageFallback() {
  return <div className="min-h-dvh bg-header" />;
}
