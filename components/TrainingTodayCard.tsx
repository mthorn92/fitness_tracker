import type { TrainingTile } from "@/lib/training-view";

export function TrainingTodayCard({ view }: { view: TrainingTile }) {
  const meta = [view.dateLabel, view.weekLabel].filter(Boolean).join(" · ");

  return (
    <section className="card training-tile">
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
          {view.groups.length > 0 ? (
            <div className="train-groups">
              {view.groups.map((group, index) => (
                <div key={`${group.letter ?? "set"}-${index}`} className="train-block">
                  {group.letter ? <p className="train-kicker">Superset {group.letter}</p> : null}
                  <ul className="train-list">
                    {group.rows.map((row) => (
                      <li key={row.key}>
                        <div className="train-name">{row.name}</div>
                        <div className="train-dose">
                          {view.state === "completed" ? `Plan ${row.prescription}` : row.prescription}
                        </div>
                        {row.logged ? <div className="train-log">{row.logged}</div> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          {view.rpe != null ? <p className="train-result">RPE {formatRpe(view.rpe)}</p> : null}
          {view.feedback ? <p className="note">{view.feedback}</p> : null}
          {view.dailyWalk ? <p className="note">{view.dailyWalk}</p> : null}
        </>
      )}
    </section>
  );
}

function formatRpe(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
