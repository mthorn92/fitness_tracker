import { formatShortDate, formatUpdatedLabel } from "@/lib/format";
import {
  formatDuration,
  formatKm,
  formatPace,
  formatRunClock,
  runPaceSecPerKm,
  type StravaTileModel,
} from "@/lib/strava-summary";

export function StravaRunsTile({ model }: { model: StravaTileModel }) {
  return (
    <section className="card strava-tile" data-tab-group="exercise" data-tile="strava" data-position="6">
      <div className="tile-heading">
        <h2>Strava runs</h2>
        {model.status === "ready" ? (
          <a
            className="strava-link"
            href="https://www.strava.com/athlete/training"
            target="_blank"
            rel="noreferrer noopener"
          >
            View on Strava
          </a>
        ) : null}
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
      <p className="note">Runs will show here once Strava is connected.</p>
      {canConnect ? <ConnectLink /> : null}
    </>
  );
}

function ErrorState({ model }: { model: Extract<StravaTileModel, { status: "error" }> }) {
  return (
    <>
      <p className="train-lead">{model.message}</p>
      {model.canConnect ? <ConnectLink /> : null}
    </>
  );
}

function Ready({ model }: { model: Extract<StravaTileModel, { status: "ready" }> }) {
  const empty = model.thisWeek.count === 0 && model.last4Weeks.count === 0;
  return (
    <>
      {model.stale ? <p className="note strava-stale">Showing saved runs. Strava was busy.</p> : null}
      <div className="strava-stats">
        <Stat label="This week" totals={model.thisWeek} />
        <Stat label="Last 4 weeks" totals={model.last4Weeks} />
      </div>
      <p className="note">Last 4 weeks includes this week.</p>
      {empty ? <p className="note">No runs in the last 4 weeks.</p> : null}
      {model.recent.length > 0 ? (
        <ul className="strava-runs">
          {model.recent.map((run) => (
            <li key={run.id} className="strava-run">
              <div className="train-name">{run.name}</div>
              <div className="train-dose">
                {formatShortDate(run.date)} · {formatKm(run.distanceM)} · {formatRunClock(run.movingTimeS)} ·{" "}
                {formatPace(runPaceSecPerKm(run))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
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

function Stat({
  label,
  totals,
}: {
  label: string;
  totals: { count: number; distanceM: number; movingTimeS: number; paceSecPerKm: number | null };
}) {
  const runs = totals.count === 1 ? "1 run" : `${totals.count} runs`;
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{runs}</div>
      <div className="sub">
        {formatKm(totals.distanceM)} · {formatDuration(totals.movingTimeS)} · {formatPace(totals.paceSecPerKm)}
      </div>
    </div>
  );
}

function ConnectLink() {
  return (
    <p className="strava-connect">
      <a href="/api/strava/connect">Connect Strava</a>
    </p>
  );
}
