"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatDriftBpm,
  formatHr,
  formatInclinePair,
  formatKcal,
  formatKm,
  formatPctUnder,
  formatPts,
  formatResistance,
  formatRideDate,
  formatRideTime,
  formatRpm,
  formatWatts,
  formatWPerBpm,
  indexMark,
  rideHasScoreColumns,
  type RideScore,
} from "@/lib/ride-tile";

export function RidesTile({ rows }: { rows: RideScore[] }) {
  return (
    <section
      className="card rides-tile"
      data-tab-group="exercise"
      data-tile="rides"
      aria-label="Rides"
    >
      <div className="tile-heading">
        <h2>Rides</h2>
      </div>
      {rows.length === 0 ? (
        <p className="rides-empty">No rides yet.</p>
      ) : (
        <RidesTable rows={rows} />
      )}
      <p className="rides-caption">
        Manual NordicTrack X24 rides. Watts, km, res and incline from console; HR and kcal from Strava. W/bpm = avg
        watts ÷ avg HR.
      </p>
    </section>
  );
}

function RidesTable({ rows }: { rows: RideScore[] }) {
  const showScores = useMemo(() => rideHasScoreColumns(rows), [rows]);
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
    const table = scroller.querySelector(".rides-table");
    if (table) observer.observe(table);
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [rows, showScores]);

  return (
    <div
      ref={shellRef}
      className={`rides-shell${scrolledX ? " is-scrolled-x" : ""}${endX ? " is-end-x" : ""}`}
      data-overflow={yOverflow ? "true" : "false"}
      data-x-overflow={xOverflow ? "true" : "false"}
    >
      <div className="rides-scroll" ref={scrollRef}>
        <table
          className="rides-table"
          style={{ "--rides-cols": String(showScores ? 16 : 12) } as React.CSSProperties}
        >
          <colgroup>
            <col className="rides-date-col" />
            {Array.from({ length: showScores ? 16 : 12 }, (_, i) => (
              <col key={i} className="rides-data-col" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Time</th>
              <th scope="col">km</th>
              <th scope="col">Watts</th>
              <th scope="col">W/bpm</th>
              <th scope="col">RPM</th>
              <th scope="col">Res</th>
              <th scope="col">Incline %</th>
              <th scope="col">kcal</th>
              <th scope="col">
                <span className="rides-h">Avg</span>
                <span className="rides-sub">HR</span>
              </th>
              <th scope="col">
                <span className="rides-h">Peak</span>
                <span className="rides-sub">p97</span>
              </th>
              <th scope="col">
                <span className="rides-h">&lt;145</span>
                <span className="rides-sub">%</span>
              </th>
              <th scope="col">Drift</th>
              {showScores ? (
                <>
                  <th scope="col" className="rides-score-start">Index</th>
                  <th scope="col">Disc</th>
                  <th scope="col">Eff</th>
                  <th scope="col">Dur</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const older = i + 1 < rows.length ? rows[i + 1]?.index : undefined;
              const mark = indexMark(row.index, older);
              const under = formatPctUnder(row.pct_under_145);
              return (
                <tr key={row.row_key}>
                  <td className="rides-date">{formatRideDate(row.date)}</td>
                  <td>{formatRideTime(row.duration_s)}</td>
                  <td>{formatKm(row.distance_m)}</td>
                  <td>{formatWatts(row.avg_watts)}</td>
                  <td>{formatWPerBpm(row.w_per_bpm)}</td>
                  <td>{formatRpm(row.avg_rpm)}</td>
                  <td>{formatResistance(row.resistance_avg, row.resistance_max)}</td>
                  <td>{formatInclinePair(row.incline_avg, row.incline_max)}</td>
                  <td>{formatKcal(row.calories)}</td>
                  <td>{formatHr(row.avg_hr)}</td>
                  <td>{formatHr(row.p97_hr)}</td>
                  <td className={under.full ? "rides-under is-full" : "rides-under"}>{under.text}</td>
                  <td>{formatDriftBpm(row.drift_bpm)}</td>
                  {showScores ? (
                    <>
                      <td className="rides-score-start">
                        <span className={`rides-index is-${mark.tone}`}>
                          {mark.text}
                          {mark.arrow === "up" ? <span className="rides-arrow">▲</span> : null}
                          {mark.arrow === "down" ? <span className="rides-arrow">▼</span> : null}
                        </span>
                      </td>
                      <td>{formatPts(row.disc_pts)}</td>
                      <td>{formatPts(row.eff_pts)}</td>
                      <td>{formatPts(row.dur_pts)}</td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rides-fade" aria-hidden="true" />
      <div className="rides-fade-x" aria-hidden="true" />
    </div>
  );
}