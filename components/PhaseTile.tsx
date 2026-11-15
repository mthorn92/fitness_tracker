import { phaseCalorieSummary, type CalorieAverage } from "@/lib/calorie-average";
import { formatNumber } from "@/lib/format";
import { formatPhaseRange } from "@/lib/phase-balance";
import { phaseLengthDays, phaseProgress } from "@/lib/phases";
import type { DietDashboardView } from "@/lib/types";
import { DailyRing } from "@/components/DailyRing";

function deltaText(average: CalorieAverage): string {
  if (average.status === "even") return "on target";
  const amount = formatNumber(Math.abs(average.deltaKcal));
  return average.status === "under" ? `${amount} under` : `${amount} over`;
}

function loggedLabel(days: number): string {
  if (days <= 0) return "No days logged yet";
  return days === 1 ? "1 day logged" : `${formatNumber(days)} days logged`;
}

export function PhaseTile({
  data,
  today,
}: {
  data: DietDashboardView;
  today: string;
}) {
  const loggedDays = data.days.map((day) => ({
    date: day.date,
    kcal: day.kcal,
  }));
  const summary = phaseCalorieSummary(loggedDays, today);

  if (!summary) {
    return (
      <section className="card phase-tile" data-tab-group="diet" data-tile="phase">
        <h2>Phase</h2>
        <p className="note">No active phase.</p>
      </section>
    );
  }

  const { phase } = summary;
  const total = phaseLengthDays(phase);
  const lastDay = summary.daysLeft === 1;
  const average = summary.average;

  return (
    <section className="card phase-tile" data-tab-group="diet" data-tile="phase">
      <h2>{phase.name}</h2>
      <p className="phase-dates">{formatPhaseRange(phase)}</p>
      <div className="phase-top">
        <DailyRing
          compact
          flag
          progress={phaseProgress(today, phase)}
          tone="good"
          label={phase.name}
          valueNow={Math.max(0, total - summary.daysLeft)}
          valueMax={total}
          valueText={
            lastDay
              ? `Last day of ${phase.name}`
              : `${formatNumber(summary.daysLeft)} days to go in ${phase.name}`
          }
        >
          <span className="daily-ring-num">{formatNumber(summary.daysLeft)}</span>
          <span className={`daily-ring-sub${lastDay ? " is-last" : ""}`}>
            {lastDay ? "last day!" : "days to go"}
          </span>
        </DailyRing>
        <div className="phase-avg">
          <p className="daily-chip-label">{phase.name} avg</p>
          <p className="daily-chip-figure">
            <span className="daily-chip-num">{average ? formatNumber(average.averageKcal) : "—"}</span>
            <span className="daily-chip-of">
              / {formatNumber(average?.targetKcal ?? phase.kcal_target)}
            </span>
          </p>
          {average ? <span className={`daily-pill ${average.status}`}>{deltaText(average)}</span> : null}
          <p className="phase-logged">{loggedLabel(average?.days ?? 0)}</p>
        </div>
      </div>
    </section>
  );
}
