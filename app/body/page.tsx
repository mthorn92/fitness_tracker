import type { Metadata } from "next";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import { OrangeHeader } from "@/components/OrangeHeader";
import { WeightChart } from "@/components/WeightChart";
import { getBodyView } from "@/lib/data";
import { formatKg, formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Goals",
};

export default async function BodyPage() {
  const body = await getBodyView();

  return (
    <main className="flex flex-1 flex-col pb-28">
      <OrangeHeader title="Goals" />
      <div className="-mt-10 flex flex-col gap-3 px-4">
        <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <h2 className="text-xl font-black">Goal {formatKg(body.goalWeightKg)}</h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            {body.kgToGoal === null
              ? "Log a weigh-in to see progress"
              : `${formatNumber(Math.max(0, body.kgToGoal), 1)} kg to go`}
          </p>
          <div className="mt-4">
            <WeightChart points={body.points} goalKg={body.goalWeightKg} />
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Today</p>
              <p className="text-3xl font-black">
                {body.currentWeightKg === null ? "—" : formatNumber(body.currentWeightKg, 1)}
                <span className="ml-1 text-base font-bold text-muted">kgs</span>
              </p>
            </div>
            <ComingSoonButton label="Record Weight" />
          </div>
        </section>

        <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Journey</h2>
            <p className="text-sm font-bold text-muted">
              {formatNumber(body.weightProgressPct, 0)}% of the way
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Started {body.startDateLabel} at {formatKg(body.startWeightKg)}. Sample data only has this starting weigh-in so far.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${body.weightProgressPct}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs font-bold text-muted">
            <span>{formatKg(body.startWeightKg)}</span>
            <span>{formatKg(body.goalWeightKg)}</span>
          </div>
        </section>

        <section className="rounded-[1.6rem] bg-surface px-5 py-4 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
          <h2 className="text-lg font-extrabold">Daily targets</h2>
          <ul className="mt-2 divide-y divide-line">
            <TargetRow label="Calories" value={`${formatNumber(body.targets.calories_kcal)} kcal`} />
            <TargetRow label="Protein" value={`${formatNumber(body.targets.protein_g)} g`} />
            <TargetRow label="Carbs" value={`${formatNumber(body.targets.carbs_g)} g`} />
            <TargetRow label="Fat" value={`${formatNumber(body.targets.fat_g)} g`} />
            <TargetRow label="Water" value={`${formatNumber(body.targets.water_l, 1)} L`} />
          </ul>
          <p className="mt-4 text-sm leading-6 text-muted">{body.targets.fasting}</p>
        </section>
      </div>
    </main>
  );
}

function TargetRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between py-3">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-sm font-bold text-muted">{value}</p>
    </li>
  );
}
