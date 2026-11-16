import { formatUpdatedLabel, parseIsoDate } from "@/lib/format";
import type { ActivityKind, StravaWorkoutsModel, WorkoutDayColumn } from "@/lib/strava-workouts";

export function StravaWorkoutsTile({ model }: { model: StravaWorkoutsModel }) {
  return (
    <section className="card workouts-tile workouts-tile-v3" data-tab-group="exercise" data-tile="workouts" data-position="5">
      <div className="tile-heading workouts-tile-head">
        <div>
          <h2>Workouts</h2>
          <p className="workouts-tile-meta">Last 7 days</p>
        </div>
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
  const endDate = model.days[model.days.length - 1]?.date;
  return (
    <>
      {model.stale ? <p className="note strava-stale">Showing saved workouts. Strava was busy.</p> : null}
      <WeekStrip days={model.days} endDate={endDate} />
      {model.rows.length === 0 ? (
        <p className="workouts-empty">No workouts in the last 7 days</p>
      ) : model.stripTotals ? (
        <StripTotals totals={model.stripTotals} />
      ) : null}
      <SyncedNote syncedAt={model.syncedAt} />
    </>
  );
}

function WeekStrip({ days, endDate }: { days: WorkoutDayColumn[]; endDate?: string }) {
  const label = days
    .map((day) => (day.count === 0 ? `${day.label} none` : `${day.label} ${day.kinds.join(" ")}`))
    .join(", ");
  return (
    <div className="wf-week" role="img" aria-label={`Last 7 days. ${label}`}>
      {days.map((day) => (
        <WorkoutDay key={day.date} day={day} isToday={day.date === endDate} />
      ))}
    </div>
  );
}

function WorkoutDay({ day, isToday }: { day: WorkoutDayColumn; isToday: boolean }) {
  const icon = dayIcon(day.kinds);
  const dateNum = parseIsoDate(day.date).getUTCDate();
  return (
    <div className={`wf-day${isToday ? " is-today" : ""}`} title={day.title}>
      <span className="wf-dow">{weekdayLetter(day.date)}</span>
      <span className="wf-date">{dateNum}</span>
      <span className="wf-icons">
        <span className={`wf-icon${icon === "empty" ? " empty" : ` ${icon}`}`} aria-hidden="true">
          {icon === "run" ? <RunIcon /> : null}
          {icon === "lift" ? <LiftIcon /> : null}
          {icon === "walk" ? <WalkIcon /> : null}
        </span>
      </span>
    </div>
  );
}

function StripTotals({ totals }: { totals: { hero: string; caption: string } }) {
  return (
    <div className="wf-totals">
      <p className="wf-hero">{totals.hero}</p>
      <p className="wf-sub">{totals.caption}</p>
      <p className="wf-legend" aria-hidden="true">
        <span>
          <i data-kind="run" />
          Run
        </span>
        <span>
          <i data-kind="lift" />
          Lift
        </span>
        <span>
          <i data-kind="rest" />
          Rest
        </span>
      </p>
    </div>
  );
}

function dayIcon(kinds: ActivityKind[]): "run" | "lift" | "walk" | "empty" {
  if (kinds.length === 0) return "empty";
  if (kinds.includes("run")) return "run";
  if (kinds.includes("other")) return "lift";
  if (kinds.includes("walk")) return "walk";
  return "empty";
}

function weekdayLetter(iso: string): string {
  const short = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(parseIsoDate(iso));
  return short.charAt(0).toUpperCase();
}

function RunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="9.2" cy="2.4" r="1.25" fill="currentColor" />
      <path
        d="M8.2 4.1l-1.5 2.1-2.2-.4-.8 1.3 2.6.6 1.1 1.7-1.7 3.2.95.5 1.85-3.15 1.55.95 1.35 2.35.9-.55-1.2-2.15-1.7-1.2 1.05-2.15L9.6 5.6l1.55-.15.35-1.15z"
        fill="currentColor"
      />
    </svg>
  );
}

function LiftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.2 5.2h1.1v3.6H2.2zm8.5 0h1.1v3.6h-1.1zM3.6 6.2h6.8v1.6H3.6zM1.4 4.6h.7v4.8h-.7zm10.5 0h.7v4.8h-.7z" fill="currentColor" />
    </svg>
  );
}

function WalkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
      <path d="M6 4.2 4.8 8.2l-1.5.2-.4 1.2 2.1-.1 1.5-5.4zM7.5 4.2l2 4 1.8-.3.9 1-.8.2-2.5.4-1.9-5.3z" fill="currentColor" />
    </svg>
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