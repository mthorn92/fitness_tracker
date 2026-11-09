import type { Metadata } from "next";
import { Suspense } from "react";
import { OrangeHeader } from "@/components/OrangeHeader";
import { RecordWeightButton } from "@/components/RecordWeightButton";
import { TrendChart } from "@/components/TrendChart";
import { getChartsView } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Charts",
};

export default function ChartsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-header" />}>
      <Charts />
    </Suspense>
  );
}

async function Charts() {
  const charts = await getChartsView();
  const latestWeight = charts.weight[charts.weight.length - 1];
  const latestCalories = charts.calories[charts.calories.length - 1];

  return (
    <main className="flex flex-1 flex-col pb-28">
      <OrangeHeader title="Charts" />
      <div className="-mt-10 flex flex-col gap-3 px-4">
        <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Weight</h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Daily weigh-ins and 7-day average
              </p>
            </div>
            <RecordWeightButton date={charts.currentDate} currentKg={charts.currentWeightKg} />
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Latest</p>
              <p className="text-3xl font-black">
                {charts.currentWeightKg == null ? "—" : formatNumber(charts.currentWeightKg, 1)}
                <span className="ml-1 text-base font-bold text-muted">kg</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">7dma</p>
              <p className="text-lg font-extrabold">
                {latestWeight ? formatNumber(latestWeight.avg7d, 1) : "—"}
                <span className="ml-1 text-sm font-bold text-muted">kg</span>
              </p>
            </div>
          </div>

          <div className="mt-2">
            <TrendChart
              points={charts.weight}
              ariaLabel="Weight trend with seven day moving average"
              valueDigits={1}
              reference={charts.goalWeightKg}
            />
          </div>
          <ChartLegend unit="kg" />
        </section>

        <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <div>
            <h2 className="text-xl font-black">Calories</h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              Daily food calories and 7-day average
            </p>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Latest</p>
              <p className="text-3xl font-black">
                {charts.latestCaloriesKcal == null ? "—" : formatNumber(charts.latestCaloriesKcal)}
                <span className="ml-1 text-base font-bold text-muted">kcal</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">7dma</p>
              <p className="text-lg font-extrabold">
                {latestCalories ? formatNumber(Math.round(latestCalories.avg7d)) : "—"}
                <span className="ml-1 text-sm font-bold text-muted">kcal</span>
              </p>
            </div>
          </div>

          <div className="mt-2">
            <TrendChart
              points={charts.calories}
              ariaLabel="Calorie trend with seven day moving average"
              valueDigits={0}
              reference={charts.calorieTargetKcal}
              accent="#2fae4a"
            />
          </div>
          <ChartLegend unit="kcal" tone="go" />
        </section>
      </div>
    </main>
  );
}

function ChartLegend({ unit, tone = "accent" }: { unit: string; tone?: "accent" | "go" }) {
  const swatch = tone === "go" ? "bg-go" : "bg-accent";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-muted">
      <span className="inline-flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${swatch} opacity-35`} />
        <span>Daily {unit}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span className={`inline-block h-0.5 w-5 shrink-0 rounded-full ${swatch}`} />
        <span>7-day average</span>
      </span>
    </div>
  );
}
