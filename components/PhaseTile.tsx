import { phaseCalorieSummary, type CalorieAverage } from "@/lib/calorie-average";
import { formatNumber } from "@/lib/format";
import { activePhaseFoodBalance, formatPhaseRange } from "@/lib/phase-balance";
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
    complete: day.complete,
    cycleClosed: day.cycle_closed,
  }));
  const summary = phaseCalorieSummary(loggedDays, today);
  const balance = activePhaseFoodBalance(loggedDays, today);

  if (!summary || !balance) {
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
  const shownDeficit = Math.round(balance.deficitKcal);
  const deficitTone = shownDeficit > 0 ? "under" : shownDeficit < 0 ? "over" : "even";
  const deficitWord = deficitTone === "under" ? "under" : deficitTone === "over" ? "over" : "on target";
  const dayWord = balance.loggedDays === 1 ? "day" : "days";
  const todayOpen = today >= phase.start && today <= phase.end && !balance.countsToday;

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
          <p className="phase-logged">{loggedLabel(balance.loggedDays)}</p>
        </div>
      </div>
      <div className="phase-deficit">
        <p className="phase-kicker">Food deficit</p>
        {balance.loggedDays > 0 ? (
          <>
            <p className={`phase-deficit-kcal is-${deficitTone}`}>
              {deficitTone === "even"
                ? "On target"
                : `${formatNumber(Math.abs(shownDeficit))} kcal ${deficitWord}`}
            </p>
            <p className="phase-deficit-kg">≈ {formatNumber(Math.abs(balance.deficitKg), 2)} kg</p>
            <p className="note">
              vs {formatNumber(phase.kcal_target)} × {formatNumber(balance.loggedDays)} logged {dayWord}.
              {todayOpen ? " Today isn't counted yet." : ""}
            </p>
          </>
        ) : (
          <p className="note">No completed days logged yet.{todayOpen ? " Today isn't counted yet." : ""}</p>
        )}
      </div>
    </section>
  );
}
