import Link from "next/link";
import { FoodList } from "@/components/FoodList";
import { MetricRow } from "@/components/MetricRow";
import { ProgressBar } from "@/components/ProgressBar";
import { RingStat } from "@/components/RingStat";
import { SampleNote } from "@/components/SampleNote";
import { Section } from "@/components/Section";
import { getTodayView } from "@/lib/data";
import { formatHours, formatKg, formatNumber, recoveryTone } from "@/lib/format";

export default async function HomePage() {
  const today = await getTodayView();
  const recoveryToneName = today.recovery ? recoveryTone(today.recovery.score) : "accent";
  const ringTone = recoveryToneName === "high" ? "accent" : recoveryToneName === "mid" ? "warn" : "low";

  return (
    <main className="flex flex-1 flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{today.dateLabel}</p>
          <h1 className="font-display mt-1 text-4xl tracking-tight">Today</h1>
        </div>
        <SampleNote />
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Weight</p>
            <p className="font-display mt-1 text-5xl tracking-tight">
              {today.weightKg === null ? "—" : formatNumber(today.weightKg, 1)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {today.kgToGoal === null
                ? "No weigh-in yet"
                : `${formatNumber(Math.max(0, today.kgToGoal), 1)} kg to ${formatKg(today.goalWeightKg)}`}
            </p>
          </div>
          <Link href="/body" className="text-sm text-accent">
            Goal
          </Link>
        </div>
        <div className="mt-5">
          <ProgressBar percent={today.weightProgressPct} />
          <p className="mt-2 text-xs text-muted">
            Started at {formatKg(today.startWeightKg)} · {formatNumber(today.weightProgressPct, 0)}% of the way
          </p>
        </div>
      </section>

      {today.recovery ? (
        <section className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-3xl border border-line bg-surface p-5">
          <RingStat
            value={today.recovery.score}
            max={100}
            label="Recovery"
            display={formatNumber(today.recovery.score, 0)}
            tone={ringTone}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <MiniStat label="Sleep" value={formatHours(today.recovery.sleepHours)} />
            <MiniStat label="Strain" value={formatNumber(today.recovery.strain, 1)} />
            <MiniStat label="HRV" value={`${formatNumber(today.recovery.hrv, 0)} ms`} />
            <MiniStat label="Steps" value={formatNumber(today.recovery.steps)} />
          </div>
        </section>
      ) : null}

      <Section title="Nutrition" action={<Link href="/log" className="text-sm text-accent">Log</Link>}>
        <div className="space-y-5 rounded-3xl border border-line bg-surface p-5">
          <MetricRow label="Calories" metric={today.calories} unit="kcal" />
          <MetricRow label="Protein" metric={today.protein} unit="g" digits={1} />
          <MetricRow label="Carbs" metric={today.carbs} unit="g" digits={1} />
          <MetricRow label="Fat" metric={today.fat} unit="g" digits={1} />
          <MetricRow label="Water" metric={today.water} unit="L" digits={1} />
        </div>
      </Section>

      <Section title="Fasting">
        <p className="rounded-3xl border border-line bg-surface px-4 py-4 text-sm leading-6">
          {today.fasting}
        </p>
      </Section>

      <Section title="Food so far">
        <FoodList foods={today.foods} />
      </Section>

      {today.notes ? (
        <Section title="Notes">
          <p className="rounded-3xl border border-line bg-surface px-4 py-4 text-sm leading-6 text-muted">
            {today.notes}
          </p>
        </Section>
      ) : null}
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-lg tracking-tight">{value}</p>
    </div>
  );
}
