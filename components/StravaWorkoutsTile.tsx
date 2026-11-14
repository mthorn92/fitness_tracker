import { formatUpdatedLabel } from "@/lib/format";
import type { ActivityKind, StravaWorkoutsModel, WorkoutDayColumn, WorkoutStatChips } from "@/lib/strava-workouts";

export function StravaWorkoutsTile({ model }: { model: StravaWorkoutsModel }) {
  return (
    <section className="card workouts-tile" data-tab-group="exercise" data-tile="workouts" data-position="5">
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
      <WeekStrip days={model.days} />
      {model.rows.length === 0 ? (
        <p className="workouts-empty">No workouts in the last 7 days</p>
      ) : (
        <>
          <KindLegend days={model.days} />
          {model.chips ? <StatChips chips={model.chips} /> : null}
          {model.highlight ? <p className="wo-highlight">{model.highlight}</p> : null}
          <ul className="workouts-list">
            {model.rows.map((row) => (
              <li key={row.id}>
                <span className="wo-dot" data-kind={row.kind} aria-hidden="true" />
                <div className="wo-row-text">
                  <div className="train-name">{row.name}</div>
                  <div className="train-dose">{row.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <SyncedNote syncedAt={model.syncedAt} />
    </>
  );
}

function WeekStrip({ days }: { days: WorkoutDayColumn[] }) {
  const label = days
    .map((day) => (day.count === 0 ? `${day.label} none` : `${day.label} ${day.kinds.join(" ")}`))
    .join(", ");
  return (
    <div className="wo-week" role="img" aria-label={`Last 7 days. ${label}`}>
      {days.map((day, index) => (
        <div key={day.date} className={`wo-day${day.count > 0 ? " is-active" : ""}`} title={day.title}>
          <span className={`wo-letter${index === days.length - 1 ? " is-end" : ""}`}>{day.label}</span>
          <span className="wo-track">
            <span className="wo-bar" style={day.count > 0 ? { height: barHeight(day.count) } : undefined}>
              {day.kinds.length === 0 ? (
                <span className="wo-seg is-empty" />
              ) : (
                day.kinds.map((kind) => <span key={kind} className="wo-seg" data-kind={kind} />)
              )}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function barHeight(count: number): string {
  const steps = Math.min(count, 3);
  return `${0.85 + (steps - 1) * 0.32}rem`;
}

const KIND_LABEL: Record<ActivityKind, string> = {
  run: "Run",
  walk: "Walk",
  other: "Other",
};

function KindLegend({ days }: { days: WorkoutDayColumn[] }) {
  const present = new Set(days.flatMap((day) => day.kinds));
  const kinds = (["run", "walk", "other"] as const).filter((kind) => present.has(kind));
  if (kinds.length === 0) return null;
  return (
    <p className="wo-legend">
      {kinds.map((kind) => (
        <span key={kind}>
          <i data-kind={kind} />
          {KIND_LABEL[kind]}
        </span>
      ))}
    </p>
  );
}

function StatChips({ chips }: { chips: WorkoutStatChips }) {
  return (
    <ul className="wo-chips">
      <li className="wo-chip">
        <strong>{chips.countLabel}</strong> {chips.countUnit}
      </li>
      <li className="wo-chip">
        <strong>{chips.duration}</strong>
      </li>
      <li className="wo-chip">
        <strong>{chips.kcal}</strong> kcal
      </li>
    </ul>
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
