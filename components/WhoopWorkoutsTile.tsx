import type { WhoopWorkoutsModel } from "@/lib/whoop-workouts";

export function WhoopWorkoutsTile({ model }: { model: WhoopWorkoutsModel }) {
  return (
    <section className="card whoop-tile" data-tab-group="exercise" data-tile="whoop" data-position="3">
      <div className="tile-heading">
        <h2>
          <span>WHOOP workouts — last 7 days</span>
        </h2>
      </div>
      {model.rows.length === 0 ? (
        <p className="whoop-empty">No WHOOP workouts logged in the last 7 days</p>
      ) : (
        <>
          <p className="whoop-summary">{model.summary}</p>
          <ul className="whoop-list">
            {model.rows.map((row) => (
              <li key={row.id}>
                <div className="train-name">{row.name}</div>
                <div className="train-dose">
                  {row.dateLabel} · {row.durationLabel} · strain {row.strainLabel} · {row.hrLabel} · {row.kcalLabel}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
