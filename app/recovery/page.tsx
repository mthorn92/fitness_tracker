import type { Metadata } from "next";
import { ProgressBar } from "@/components/ProgressBar";
import { RingStat } from "@/components/RingStat";
import { SampleNote } from "@/components/SampleNote";
import { Section } from "@/components/Section";
import { getRecoveryDays, getWorkouts } from "@/lib/data";
import { formatHours, formatNumber, recoveryTone } from "@/lib/format";

export const metadata: Metadata = {
  title: "Recover",
};

export default async function RecoveryPage() {
  const [days, workouts] = await Promise.all([getRecoveryDays(), getWorkouts()]);
  const latest = days[0];
  const toneName = latest?.recoveryScore == null ? "accent" : recoveryTone(latest.recoveryScore);
  const ringTone = toneName === "high" ? "accent" : toneName === "mid" ? "warn" : "low";

  return (
    <main className="flex flex-1 flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
            {latest ? latest.dateLabel : "No days yet"}
          </p>
          <h1 className="font-display mt-1 text-4xl tracking-tight">Recover</h1>
        </div>
        <SampleNote />
      </header>

      {latest ? (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center gap-4">
            <RingStat
              value={latest.recoveryScore ?? 0}
              max={100}
              label="Recovery"
              display={latest.recoveryScore == null ? "—" : formatNumber(latest.recoveryScore, 0)}
              tone={ringTone}
            />
            <div className="grid flex-1 grid-cols-2 gap-4">
              <MiniStat label="HRV" value={latest.hrv == null ? "—" : `${formatNumber(latest.hrv, 0)} ms`} />
              <MiniStat label="RHR" value={latest.rhr == null ? "—" : `${formatNumber(latest.rhr, 0)} bpm`} />
              <MiniStat label="Sleep" value={latest.sleepHours == null ? "—" : formatHours(latest.sleepHours)} />
              <MiniStat label="Strain" value={latest.strain == null ? "—" : formatNumber(latest.strain, 1)} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Detail label="SpO2" value={latest.spo2 == null ? "—" : `${formatNumber(latest.spo2, 1)}%`} />
            <Detail label="Skin temp" value={latest.skinTemp == null ? "—" : `${formatNumber(latest.skinTemp, 1)}°C`} />
            <Detail label="Steps" value={latest.steps == null ? "—" : formatNumber(latest.steps)} />
            <Detail label="Calories" value={latest.kcal == null ? "—" : `${formatNumber(latest.kcal)} kcal`} />
          </div>
        </section>
      ) : null}

      {latest && latest.sleepHours !== null ? (
        <Section title="Sleep">
          <div className="space-y-4 rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-4xl tracking-tight">{formatHours(latest.sleepHours)}</p>
                <p className="mt-1 text-sm text-muted">
                  {latest.inBedHours == null ? "Asleep" : `${formatHours(latest.inBedHours)} in bed`}
                </p>
              </div>
            </div>
            <SleepBar label="Performance" value={latest.sleepPerformance} />
            <SleepBar label="Consistency" value={latest.sleepConsistency} />
            <SleepBar label="Efficiency" value={latest.sleepEfficiency} />
          </div>
        </Section>
      ) : null}

      <Section title="Last days">
        <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
          {days.map((day) => (
            <li key={day.date} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
              <p className="text-sm">{day.dateLabel}</p>
              <div>
                <ProgressBar
                  percent={day.recoveryScore ?? 0}
                  tone={
                    day.recoveryScore == null
                      ? "muted"
                      : recoveryTone(day.recoveryScore) === "high"
                        ? "accent"
                        : recoveryTone(day.recoveryScore) === "mid"
                          ? "warn"
                          : "low"
                  }
                />
              </div>
              <p className="text-sm tabular-nums">
                {day.recoveryScore == null ? "—" : formatNumber(day.recoveryScore, 0)}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Workouts">
        {workouts.length === 0 ? (
          <p className="rounded-3xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            No workouts in the sample data.
          </p>
        ) : (
          <ul className="space-y-3">
            {workouts.map((workout) => (
              <li key={workout.id} className="rounded-3xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{workout.sport}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                      {workout.dateLabel} · {workout.durationMin} min
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">{formatNumber(workout.kcal)} kcal</p>
                </div>
                <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted">
                  Strain {formatNumber(workout.strain, 1)} · Avg {workout.avgHr} bpm · Max {workout.maxHr} bpm
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function SleepBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm">{label}</p>
        <p className="text-sm tabular-nums text-muted">
          {value == null ? "—" : `${formatNumber(value, 0)}%`}
        </p>
      </div>
      <ProgressBar percent={value ?? 0} />
    </div>
  );
}
