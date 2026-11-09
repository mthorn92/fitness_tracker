import type { Metadata } from "next";
import { OrangeHeader } from "@/components/OrangeHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { RingStat } from "@/components/RingStat";
import { getRecoveryDays, getWorkouts } from "@/lib/data";
import { formatHours, formatNumber, recoveryTone } from "@/lib/format";

export const metadata: Metadata = {
  title: "Recover",
};

export default async function RecoveryPage() {
  const [days, workouts] = await Promise.all([getRecoveryDays(), getWorkouts()]);
  const latest = days[0];
  const toneName = latest?.recoveryScore == null ? "accent" : recoveryTone(latest.recoveryScore);
  const ringTone = toneName === "high" ? "go" : toneName === "mid" ? "warn" : "low";

  return (
    <main className="flex flex-1 flex-col pb-28">
      <OrangeHeader title={latest ? latest.dateLabel : "Recover"} />
      <div className="-mt-10 flex flex-col gap-3 px-4">
        {latest ? (
          <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
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
          <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
            <h2 className="text-lg font-extrabold">Sleep</h2>
            <p className="mt-1 text-4xl font-black">{formatHours(latest.sleepHours)}</p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {latest.inBedHours == null ? "Asleep" : `${formatHours(latest.inBedHours)} in bed`}
            </p>
            <div className="mt-4 space-y-4">
              <SleepBar label="Performance" value={latest.sleepPerformance} />
              <SleepBar label="Consistency" value={latest.sleepConsistency} />
              <SleepBar label="Efficiency" value={latest.sleepEfficiency} />
            </div>
          </section>
        ) : null}

        <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <h2 className="text-lg font-extrabold">Last days</h2>
          <ul className="mt-2">
            {days.map((day) => (
              <li key={day.date} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 border-b border-line py-3 last:border-b-0">
                <p className="text-sm font-semibold">{day.dateLabel}</p>
                <ProgressBar
                  percent={day.recoveryScore ?? 0}
                  tone={
                    day.recoveryScore == null
                      ? "muted"
                      : recoveryTone(day.recoveryScore) === "high"
                        ? "go"
                        : recoveryTone(day.recoveryScore) === "mid"
                          ? "warn"
                          : "low"
                  }
                />
                <p className="text-sm font-bold">
                  {day.recoveryScore == null ? "—" : formatNumber(day.recoveryScore, 0)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <h2 className="text-lg font-extrabold">Workouts</h2>
          {workouts.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-muted">No workouts in the sample data.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {workouts.map((workout) => (
                <li key={workout.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold">{workout.sport}</p>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        {workout.dateLabel} · {workout.durationMin} min
                      </p>
                    </div>
                    <p className="text-sm font-bold">{formatNumber(workout.kcal)} kcal</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SleepBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm font-bold text-muted">{value == null ? "—" : `${formatNumber(value, 0)}%`}</p>
      </div>
      <ProgressBar percent={value ?? 0} />
    </div>
  );
}
