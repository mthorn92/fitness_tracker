import { CopyTextButton } from "@/components/CopyTextButton";
import { formatRpe, TrainingBlocks } from "@/components/TrainingBlocks";
import type { StrengthTileModel } from "@/lib/exercise-board";

export function StrengthDayTile({ day }: { day: StrengthTileModel }) {
  const meta = day.dateLabel;
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
        <div className="strength-titles">
          <h2>{day.name}</h2>
          <p className="tile-meta">{meta}</p>
        </div>
        <CopyTextButton text={day.copyText} label="Copy" />
      </div>
      <p className={`strength-week${day.isToday ? " is-today" : ""}`}>
        {day.weekLabel}
        {day.completed ? <span className="strength-done">Done</span> : null}
      </p>
      {day.deloadNote ? <p className="note train-deload">{day.deloadNote}</p> : null}
      <TrainingBlocks groups={day.groups} completed={day.completed} />
      {day.rpe != null ? <p className="train-result">RPE {formatRpe(day.rpe)}</p> : null}
      {day.feedback ? <p className="note">{day.feedback}</p> : null}
    </section>
  );
}
