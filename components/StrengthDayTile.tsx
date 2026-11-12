import { formatRpe, TrainingBlocks } from "@/components/TrainingBlocks";
import type { StrengthTileModel } from "@/lib/exercise-board";

export function StrengthDayTile({ day }: { day: StrengthTileModel }) {
  const meta = day.isToday ? `Today · ${day.dateLabel}` : day.dateLabel;
  return (
    <section
      className={`card training-tile strength-tile${day.isToday ? " is-today" : ""}`}
      data-tab-group="exercise"
      data-tile="strength"
      data-position={day.position}
      data-plan-day={day.planDay}
      data-today={day.isToday ? "true" : "false"}
    >
      <div className="tile-heading">
        <h2>{day.name}</h2>
        <p className="tile-meta">{meta}</p>
      </div>
      <p className="train-lead">
        <span className={`train-status${day.completed ? " is-done" : ""}`}>{day.status}</span>
        <span className="train-tag">{day.weekLabel}</span>
      </p>
      {day.deloadNote ? <p className="note train-deload">{day.deloadNote}</p> : null}
      <TrainingBlocks groups={day.groups} completed={day.completed} />
      {day.rpe != null ? <p className="train-result">RPE {formatRpe(day.rpe)}</p> : null}
      {day.feedback ? <p className="note">{day.feedback}</p> : null}
    </section>
  );
}
