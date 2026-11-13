import { formatUpdatedLabel } from "@/lib/format";
import type { StravaWorkoutsModel } from "@/lib/strava-workouts";

export function StravaWorkoutsTile({ model }: { model: StravaWorkoutsModel }) {
  return (
    <section className="card workouts-tile" data-tab-group="exercise" data-tile="workouts" data-position="3">
      <div className="tile-heading">
        <h2>
          <span>Workouts: last 7 days (Strava)</span>
        </h2>
      </div>
      {model.status === "disconnected" ? <Disconnected canConnect={model.canConnect} /> : null}
      {model.status === "error" ? <ErrorState model={model} /> : null}
      {model.status === "ready" ? <Ready model={model} /> : null}
    </section>
  );
}

function Disconnected({ canConnect }: { canConnect: boolean }) {
  return (
    <>
      <p className="train-lead">Strava not connected yet</p>
      <p className="note">Workouts will show here once Strava is connected.</p>
      {canConnect ? <ConnectLink /> : null}
    </>
  );
}

function ErrorState({ model }: { model: Extract<StravaWorkoutsModel, { status: "error" }> }) {
  return (
    <>
      <p className="train-lead">{model.message}</p>
      {model.canConnect ? <ConnectLink /> : null}
    </>
  );
}

function Ready({ model }: { model: Extract<StravaWorkoutsModel, { status: "ready" }> }) {
  return (
    <>
      {model.stale ? <p className="note strava-stale">Showing saved workouts. Strava was busy.</p> : null}
      {model.rows.length === 0 ? (
        <p className="workouts-empty">No workouts in the last 7 days</p>
      ) : (
        <>
          <p className="workouts-summary">{model.summary}</p>
          <ul className="workouts-list">
            {model.rows.map((row) => (
              <li key={row.id}>
                <div className="train-name">{row.name}</div>
                <div className="train-dose">{row.detail}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      <SyncedNote syncedAt={model.syncedAt} />
    </>
  );
}

function SyncedNote({ syncedAt }: { syncedAt?: string | null }) {
  if (syncedAt === undefined) return null;
  if (syncedAt === null) return <p className="note synced-note">Not synced yet</p>;
  const date = new Date(syncedAt);
  const label = Number.isNaN(date.getTime()) ? syncedAt : formatUpdatedLabel(date);
  return <p className="note synced-note">last synced {label}</p>;
}

function ConnectLink() {
  return (
    <p className="strava-connect">
      <a href="/api/strava/connect">Connect Strava</a>
    </p>
  );
}
