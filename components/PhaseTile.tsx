import type { CalorieAverage } from "@/lib/calorie-average";
import { clampPercent, formatNumber, shiftIsoDate } from "@/lib/format";
import { formatPhaseRange } from "@/lib/phase-balance";
import type { DietDashboardView } from "@/lib/types";
import { formatWeightDate } from "@/lib/weight-delta";

function deltaText(average: CalorieAverage): string {
  if (average.status === "even") return "on target";
  const amount = formatNumber(Math.abs(average.deltaKcal));
  return average.status === "under" ? `${amount} under` : `${amount} over`;
}

function signedKg(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0.0 kg";
  const sign = rounded < 0 ? "−" : "+";
  return `${sign}${formatNumber(Math.abs(rounded), 1)} kg`;
}

function Meter({
  label,
  current,
  total,
  text,
}: {
  label: string;
  current: number;
  total: number;
  text: string;
}) {
  const max = Math.max(total, 0);
  return (
    <div className="phase-meter">
      <span className="phase-meter-k">{label}</span>
      <span
        className="bar"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(Math.max(current, 0), max)}
        aria-valuetext={text}
      >
        <span style={{ width: `${clampPercent(Math.max(current, 0), max)}%` }} />
      </span>
      <span className="phase-meter-n">{text}</span>
    </div>
  );
}

export function PhaseTile({ data }: { data: DietDashboardView }) {
  const board = data.phase_board;
  if (!board) {
    return (
      <section className="card phase-tile" data-tab-group="diet" data-tile="phase">
        <h2>Phase summary</h2>
        <p className="note">No active phase.</p>
      </section>
    );
  }

  const { phase, average } = board;
  const asOf = data.today.date < data.calendar_today ? data.today.date : data.calendar_today;
  const weighIns = data.weight_points.filter((point) => point.date >= phase.start && point.date <= asOf);
  const first = weighIns[0] ?? null;
  const last = weighIns[weighIns.length - 1] ?? null;
  const lost = first && last ? first.kg - last.kg : null;
  const toCut = first ? first.kg - data.goal_weight_kg : null;
  const actual = first && last ? last.kg - first.kg : null;
  const title = phase.subtitle ? `${phase.name} ${phase.subtitle}` : phase.name;
  const nextDate = shiftIsoDate(phase.end, 1);
  const loggedText = `${formatNumber(board.loggedDays)} / ${formatNumber(board.logSlots)}`;
  const cutText =
    lost != null && toCut != null
      ? `${formatNumber(lost, 1)} / ${formatNumber(toCut, 1)} kg`
      : "—";

  return (
    <section className="card phase-tile" data-tab-group="diet" data-tile="phase">
      <h2>Phase summary</h2>
      <p className="phase-name">{title}</p>
      <p className="phase-dates">{formatPhaseRange(phase)}</p>
      {phase.next ? (
        <p className="phase-next">
          Next: {phase.next} from {formatWeightDate(nextDate)}
        </p>
      ) : null}
      <div className="phase-facts">
        <div>
          <p className="daily-kicker">Days left</p>
          <p className="phase-fact-value">
            {formatNumber(board.daysLeft)} {board.daysLeft === 1 ? "day" : "days"}
          </p>
        </div>
        <div>
          <p className="daily-kicker">Avg calories</p>
          <p className="phase-fact-value">
            {average ? formatNumber(average.averageKcal) : "—"}
            <span className="phase-of">/ {formatNumber(average?.targetKcal ?? phase.kcal_target)}</span>
            {average ? <span className={`daily-pill ${average.status}`}>{deltaText(average)}</span> : null}
          </p>
        </div>
      </div>
      <div className="phase-meters">
        <Meter label="Days logged" current={board.loggedDays} total={board.logSlots} text={loggedText} />
        <Meter label="Cut" current={lost ?? 0} total={toCut ?? 0} text={cutText} />
      </div>
      <div className="phase-weight">
        <p className="daily-kicker">Weight since {formatWeightDate(phase.start)}</p>
        <p className="phase-weight-value">
          <span>
            {first && last
              ? `${formatNumber(first.kg, 1)} → ${formatNumber(last.kg, 1)} kg`
              : "—"}
          </span>
          {actual != null ? (
            <span className={actual < 0 ? "is-down" : actual > 0 ? "is-up" : undefined}>{signedKg(actual)}</span>
          ) : null}
        </p>
      </div>
      <div className="phase-compare">
        <div>
          <p className="daily-kicker">Expected</p>
          <p className="phase-fact-value">
            {signedKg(board.expectedKg).replace(" kg", "")} <span className="phase-of">kg</span>
          </p>
        </div>
        <div>
          <p className="daily-kicker">Actual</p>
          <p className="phase-fact-value">
            {actual == null ? "—" : signedKg(actual).replace(" kg", "")} <span className="phase-of">kg</span>
          </p>
        </div>
      </div>
      <p className="phase-note">
        Expected at {formatNumber(data.kcal_per_kg)} kcal/kg. Includes water weight.
      </p>
    </section>
  );
}
