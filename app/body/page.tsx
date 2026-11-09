import type { Metadata } from "next";
import { Suspense } from "react";
import { DeficitOverlayChart } from "@/components/DeficitOverlayChart";
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
  const { deficit } = charts;

  return (
    <main className="flex flex-1 flex-col pb-28">
      <OrangeHeader title="Charts" />
      <div className="-mt-10 flex flex-col gap-3 px-4">
        <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Deficit vs scale</h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Actual kg change vs expected from Whoop burn − food
              </p>
            </div>
            <RecordWeightButton date={charts.currentDate} currentKg={charts.currentWeightKg} />
          </div>

          <div className="mt-4">
            <DeficitOverlayChart points={deficit.points} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 shrink-0 rounded-full bg-accent" />
              <span>Actual kg</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-5 shrink-0 border-t-2 border-dashed border-[#6d6d72]" />
              <span>Expected kg</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 shrink-0 rounded-full bg-[#c7c7cc]" />
              <span>Cumulative deficit</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent opacity-35" />
              <span>Weigh-ins</span>
            </span>
          </div>

          <p className="mt-3 text-xs font-semibold text-muted">
            Baseline {formatNumber(deficit.baselineKg, 1)} kg · Whoop burn · ~7700 kcal/kg
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard
              label="Expected loss"
              value={formatNumber(deficit.expectedKgLost, 2)}
              unit="kg"
              hint={`${formatNumber(Math.round(deficit.cumulativeDeficitKcal))} kcal deficit`}
            />
            <StatCard
              label="kcal / kg lost"
              value={deficit.kcalPerKgLost == null ? "—" : formatNumber(Math.round(deficit.kcalPerKgLost))}
              unit={deficit.kcalPerKgLost == null ? "" : "kcal"}
              hint={
                deficit.actualKgLost == null || deficit.actualKgLost <= 0
                  ? "Need scale loss for efficiency"
                  : `${formatNumber(deficit.actualKgLost, 2)} kg lost on scale`
              }
            />
          </div>
        </section>

        <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">Weight</h2>
              <p className="mt-0.5 text-xs font-semibold text-muted">Daily + 7dma</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black">
                {charts.currentWeightKg == null ? "—" : formatNumber(charts.currentWeightKg, 1)}
                <span className="ml-1 text-sm font-bold text-muted">kg</span>
              </p>
              <p className="text-xs font-semibold text-muted">
                7dma {latestWeight ? formatNumber(latestWeight.avg7d, 1) : "—"}
              </p>
            </div>
          </div>
          <div className="mt-1">
            <TrendChart
              points={charts.weight}
              ariaLabel="Weight trend with seven day moving average"
              valueDigits={1}
              reference={charts.goalWeightKg}
            />
          </div>
          <ChartLegend unit="kg" />
        </section>

        <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">Calories</h2>
              <p className="mt-0.5 text-xs font-semibold text-muted">Daily food + 7dma</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black">
                {charts.latestCaloriesKcal == null ? "—" : formatNumber(charts.latestCaloriesKcal)}
                <span className="ml-1 text-sm font-bold text-muted">kcal</span>
              </p>
              <p className="text-xs font-semibold text-muted">
                7dma {latestCalories ? formatNumber(Math.round(latestCalories.avg7d)) : "—"}
              </p>
            </div>
          </div>
          <div className="mt-1">
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

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black">
        {value}
        {unit ? <span className="ml-1 text-sm font-bold text-muted">{unit}</span> : null}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted">{hint}</p>
    </div>
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
