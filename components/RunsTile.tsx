"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  formatEf,
  formatElevParts,
  formatHr,
  formatKm,
  formatPctUnder,
  formatRunDate,
  formatRunPace,
  formatRunTime,
  indexMark,
  type RunScore,
} from "@/lib/run-tile";

export function RunsTile({
  rows,
  movingTimes,
}: {
  rows: RunScore[];
  movingTimes: ReadonlyMap<string, number>;
}) {
  return (
    <section
      className="card runs-tile"
      data-tab-group="exercise"
      data-tile="runs"
      data-position="6"
      aria-label="Runs"
    >
      <div className="tile-heading">
        <h2>Runs</h2>
        <span className="runs-baseline">Baseline 100 · 10–14 Nov</span>
      </div>
      {rows.length === 0 ? (
        <p className="runs-empty">No runs from 1 Nov.</p>
      ) : (
        <RunsTable rows={rows} movingTimes={movingTimes} />
      )}
      <p className="runs-caption">From 1 Nov · newest first. Peak is p97 HR.</p>
    </section>
  );
}

function RunsTable({
  rows,
  movingTimes,
}: {
  rows: RunScore[];
  movingTimes: ReadonlyMap<string, number>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setOverflow(el.scrollHeight > el.clientHeight + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rows]);

  return (
    <div className="runs-shell" data-overflow={overflow ? "true" : "false"}>
      <div
        className="runs-scroll"
        ref={scrollRef}
        style={{ "--runs-rows": rows.length } as CSSProperties}
      >
        <table className="runs-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Index</th>
              <th scope="col">km</th>
              <th scope="col">Time</th>
              <th scope="col">Pace</th>
              <th scope="col">Elev m</th>
              <th scope="col">Avg HR</th>
              <th scope="col">
                <span className="runs-h">Peak HR</span>
                <span className="runs-sub">p97</span>
              </th>
              <th scope="col">
                <span className="runs-h">Under 145</span>
                <span className="runs-sub">%</span>
              </th>
              <th scope="col">
                <span className="runs-h">EF</span>
                <span className="runs-sub">GAP</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const older = i + 1 < rows.length ? rows[i + 1]?.index : undefined;
              const mark = indexMark(row.index, older);
              const elev = formatElevParts(row.elev_gain_m, row.elev_loss_m);
              const under = formatPctUnder(row.pct_under_145);
              const movingTimeS = movingTimes.get(row.strava_id);
              return (
                <tr key={row.strava_id}>
                  <td className="runs-date">{formatRunDate(row.date)}</td>
                  <td>
                    <span className={`runs-index is-${mark.tone}`}>
                      {mark.text}
                      {mark.arrow === "up" ? <span className="runs-arrow">▲</span> : null}
                      {mark.arrow === "down" ? <span className="runs-arrow">▼</span> : null}
                    </span>
                  </td>
                  <td>{formatKm(row.distance_m)}</td>
                  <td>{formatRunTime(movingTimeS)}</td>
                  <td>{formatRunPace(movingTimeS, row.distance_m)}</td>
                  <td className="runs-elev">
                    {elev.gain == null && elev.loss == null ? (
                      "—"
                    ) : (
                      <>
                        {elev.gain != null ? <span className="runs-up">{elev.gain}</span> : null}
                        {elev.gain != null && elev.loss != null ? <span className="runs-sep"> </span> : null}
                        {elev.loss != null ? <span className="runs-dn">{elev.loss}</span> : null}
                      </>
                    )}
                  </td>
                  <td>{formatHr(row.avg_hr)}</td>
                  <td>{formatHr(row.p97_hr)}</td>
                  <td className={under.full ? "runs-under is-full" : "runs-under"}>{under.text}</td>
                  <td>{formatEf(row.ef_gap)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="runs-fade" aria-hidden="true" />
    </div>
  );
}
