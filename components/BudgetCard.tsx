import { formatNumber } from "@/lib/format";
import type { ProgressMetric } from "@/lib/types";

type BudgetCardProps = {
  budgetKcal: number;
  foodKcal: number;
  exerciseKcal: number;
  remainingKcal: number;
  underBudget: boolean;
  protein: ProgressMetric;
  carbs: ProgressMetric;
  fat: ProgressMetric;
};

export function BudgetCard({
  budgetKcal,
  foodKcal,
  exerciseKcal,
  remainingKcal,
  underBudget,
  protein,
  carbs,
  fat,
}: BudgetCardProps) {
  const consumed = budgetKcal <= 0 ? 0 : Math.min(1, foodKcal / budgetKcal);

  return (
    <section className="rounded-[1.6rem] bg-surface px-5 py-5 shadow-[0_8px_24px_rgba(28,28,30,0.06)]">
      <h2 className="text-lg font-extrabold">Budget: {formatNumber(budgetKcal)} cals</h2>
      <div className="mt-5 grid grid-cols-3 items-center">
        <SideStat label="Food" value={formatNumber(foodKcal)} />
        <BudgetRing remaining={remainingKcal} consumed={consumed} under={underBudget} />
        <SideStat label="Exercise" value={formatNumber(exerciseKcal)} />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <MacroStat label="Protein" metric={protein} />
        <MacroStat label="Carbs" metric={carbs} />
        <MacroStat label="Fat" metric={fat} />
      </div>
    </section>
  );
}

function SideStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function BudgetRing({
  remaining,
  consumed,
  under,
}: {
  remaining: number;
  consumed: number;
  under: boolean;
}) {
  const size = 118;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - consumed);

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={under ? "stroke-go" : "stroke-low"}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className={`text-[1.7rem] font-black leading-none ${under ? "text-go" : "text-low"}`}>
            {formatNumber(Math.abs(remaining))}
          </p>
          <p className={`mt-1 text-sm font-bold ${under ? "text-go" : "text-low"}`}>
            {under ? "Under" : "Over"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MacroStat({ label, metric }: { label: string; metric: ProgressMetric }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mx-auto mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${metric.percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs font-semibold text-muted">
        {formatNumber(metric.current, 0)} / {formatNumber(metric.target, 0)}g
      </p>
    </div>
  );
}
