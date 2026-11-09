import type { Metadata } from "next";
import { ProgressBar } from "@/components/ProgressBar";
import { SampleNote } from "@/components/SampleNote";
import { Section } from "@/components/Section";
import { getBodyView } from "@/lib/data";
import { formatKg, formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Body",
};

export default async function BodyPage() {
  const body = await getBodyView();

  return (
    <main className="flex flex-1 flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Started {body.startDateLabel}</p>
          <h1 className="font-display mt-1 text-4xl tracking-tight">Body</h1>
        </div>
        <SampleNote />
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Current</p>
        <p className="font-display mt-1 text-5xl tracking-tight">
          {body.currentWeightKg === null ? "—" : formatNumber(body.currentWeightKg, 1)}
        </p>
        <p className="mt-2 text-sm text-muted">
          {body.kgToGoal === null
            ? "Log a weigh-in to see progress"
            : `${formatNumber(Math.max(0, body.kgToGoal), 1)} kg to goal`}
        </p>
        <div className="mt-5">
          <ProgressBar percent={body.weightProgressPct} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <WeightStat label="Start" value={formatKg(body.startWeightKg)} />
          <WeightStat
            label="Now"
            value={body.currentWeightKg === null ? "—" : formatKg(body.currentWeightKg)}
          />
          <WeightStat label="Goal" value={formatKg(body.goalWeightKg)} />
        </div>
      </section>

      <Section title="Daily targets">
        <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
          <TargetRow label="Calories" value={`${formatNumber(body.targets.calories_kcal)} kcal`} />
          <TargetRow label="Protein" value={`${formatNumber(body.targets.protein_g)} g`} />
          <TargetRow label="Carbs" value={`${formatNumber(body.targets.carbs_g)} g`} />
          <TargetRow label="Fat" value={`${formatNumber(body.targets.fat_g)} g`} />
          <TargetRow label="Water" value={`${formatNumber(body.targets.water_l, 1)} L`} />
        </ul>
      </Section>

      <Section title="Fasting">
        <p className="rounded-3xl border border-line bg-surface px-4 py-4 text-sm leading-6">
          {body.targets.fasting}
        </p>
      </Section>
    </main>
  );
}

function WeightStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function TargetRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between border-b border-line px-4 py-3.5 last:border-b-0">
      <p className="text-sm">{label}</p>
      <p className="text-sm tabular-nums text-muted">{value}</p>
    </li>
  );
}
