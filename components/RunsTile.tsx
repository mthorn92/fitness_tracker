"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  formatEf,
  formatElevParts,
  formatGapPace,
  formatHr,
  formatKm,
  formatPctUnder,
  formatRunDate,
  formatRunPace,
  formatRunTime,
  formatScorePts,
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
      <p className="runs-caption">
        From 1 Nov · newest first. Peak is p97 HR · &lt;145 is % under 145 bpm. Disc, Eff, Dist and Elev sum to
        Index.
      </p>
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
  const shellRef = useRef<HTMLDivElement>(null);
  const [yOverflow, setYOverflow] = useState(false);
  const [xOverflow, setXOverflow] = useState(false);
  const [scrolledX, setScrolledX] = useState(false);
  const [endX, setEndX] = useState(true);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const shell = shellRef.current;
    if (!scroller || !shell) return;
    const update = () => {
      const y = scroller.scrollHeight > scroller.clientHeight + 1;
      const x = scroller.scrollWidth > scroller.clientWidth + 1;
      setYOverflow(y);
      setXOverflow(x);
      setScrolledX(scroller.scrollLeft > 1);
      const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
      setEndX(!x || atEnd);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    const table = scroller.querySelector(".runs-table");
    if (table) observer.observe(table);
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [rows]);

  return (
    <div
      ref={shellRef}
      className={`runs-shell${scrolledX ? " is-scrolled-x" : ""}${endX ? " is-end-x" : ""}`}
      data-overflow={yOverflow ? "true" : "false"}
      data-x-overflow={xOverflow ? "true" : "false"}
    >
      <div className="runs-scroll" ref={scrollRef}>
        <table className="runs-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Index</th>
              <th scope="col">km</th>
              <th scope="col">Time</th>
              <th scope="col">
                <span className="runs-h">Pace</span>
                <span className="runs-sub">/km</span>
              </th>
              <th scope="col">
                <span className="runs-h">GAP</span>
                <span className="runs-sub">/km</span>
              </th>
              <th scope="col">
                <span className="runs-h">Elev</span>
                <span className="runs-sub">m</span>
              </th>
              <th scope="col">
                <span className="runs-h">Avg</span>
                <span className="runs-sub">HR</span>
              </th>
              <th scope="col">
                <span className="runs-h">Peak</span>
                <span className="runs-sub">p97</span>
              </th>
              <th scope="col">
                <span className="runs-h">&lt;145</span>
                <span className="runs-sub">%</span>
              </th>
              <th scope="col" className="runs-before-part">
                <span className="runs-h">EF</span>
                <span className="runs-sub">GAP</span>
              </th>
              <th scope="col" className="runs-part runs-part-start">
                <span className="runs-h">Disc</span>
              </th>
              <th scope="col" className="runs-part">
                <span className="runs-h">Eff</span>
              </th>
              <th scope="col" className="runs-part">
                <span className="runs-h">Dist</span>
              </th>
              <th scope="col" className="runs-part">
                <span className="runs-h">Elev</span>
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
                  <td>{formatGapPace(row.gap_pace_s)}</td>
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
                  <td className="runs-before-part">{formatEf(row.ef_gap)}</td>
                  <td className="runs-part runs-part-start">
                    {formatScorePts(row.disc_pts, row.disc, 0.3)}
                  </td>
                  <td className="runs-part">{formatScorePts(row.eff_pts, row.eff, 0.3)}</td>
                  <td className="runs-part">{formatScorePts(row.dist_pts, row.dist, 0.3)}</td>
                  <td className="runs-part">{formatScorePts(row.elev_pts, row.elev, 0.1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="runs-fade" aria-hidden="true" />
      <div className="runs-fade-x" aria-hidden="true" />
    </div>
  );
}