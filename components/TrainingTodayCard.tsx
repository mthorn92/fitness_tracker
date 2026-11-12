import { formatRpe, TrainingBlocks } from "@/components/TrainingBlocks";
import type { TrainingTile } from "@/lib/training-view";

export function TrainingTodayCard({
  view,
  mode = "full",
}: {
  view: TrainingTile;
  mode?: "full" | "lift";
}) {
  const meta = [view.dateLabel, view.weekLabel].filter(Boolean).join(" · ");

  if (mode === "lift") {
    return (
      <section className="card exercise-today" data-tab-group="exercise" data-tile="today">
        <div className="tile-heading">
          <h2>Today</h2>
          {meta ? <p className="tile-meta">{meta}</p> : null}
        </div>
        <p className="train-lead">{view.dayLabel ?? "Strength"} is highlighted.</p>
        {view.dailyWalk ? <p className="note">{view.dailyWalk}</p> : null}
      </section>
    );
  }

  return (
    <section className="card training-tile exercise-today" data-tab-group="exercise" data-tile="today">
      <div className="tile-heading">
        <h2>{view.heading}</h2>
        {meta ? <p className="tile-meta">{meta}</p> : null}
      </div>

      {view.state === "before" || view.state === "after" ? (
        <>
          <p className="train-lead">{view.restNote}</p>
          {view.dailyWalk ? <p className="note">{view.dailyWalk}</p> : null}
        </>
      ) : (
        <>
          <p className="train-lead">
            {view.dayLabel}
            {view.kindLabel ? <span className="train-tag">{view.kindLabel}</span> : null}
          </p>
          {view.deloadNote ? <p className="note train-deload">{view.deloadNote}</p> : null}
          {view.cardioText ? (
            <p className="train-dose">
              {view.state === "completed" && view.loggedCardio
                ? `Logged ${view.loggedCardio}`
                : view.cardioText}
            </p>
          ) : null}
          {view.state === "completed" && view.cardioText && view.loggedCardio ? (
            <p className="note">Plan {view.cardioText}</p>
          ) : null}
          {view.restNote ? <p className="train-dose">{view.restNote}</p> : null}
          <TrainingBlocks groups={view.groups} completed={view.state === "completed"} />
          {view.rpe != null ? <p className="train-result">RPE {formatRpe(view.rpe)}</p> : null}
          {view.feedback ? <p className="note">{view.feedback}</p> : null}
          {view.dailyWalk ? <p className="note">{view.dailyWalk}</p> : null}
        </>
      )}
    </section>
  );
}
