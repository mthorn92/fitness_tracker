"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  type ChartConfiguration,
  type ChartDataset,
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import type { DietDashboardView } from "@/lib/types";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Chart.js throws or draws nothing on NaN, Infinity, or a numeric string. */
function chartPoint(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function hexAlpha(c: string, a: number): string {
  if (c.startsWith("#") && c.length === 7) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return c;
}

function baseOpts(yTitle?: string, beginAtZero = false) {
  const muted = cssVar("--muted", "#6b6964");
  const line = cssVar("--line", "#e4e0d8");
  const ticks = { padding: 6, maxRotation: 0 as const, autoSkip: true, maxTicksLimit: 6 };
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, right: 4, bottom: 0, left: 0 } },
    interaction: { mode: "index" as const, intersect: false },
    plugins: { legend: { display: true, position: "bottom" as const } },
    scales: {
      x: { grid: { display: false }, ticks, border: { display: false } },
      y: {
        grid: { color: line, drawTicks: false },
        ticks,
        border: { display: false },
        title: yTitle ? { display: true, text: yTitle, color: muted } : undefined,
        beginAtZero,
      },
    },
  };
}

export function DietCharts({ data }: { data: DietDashboardView }) {
  const weightCanvas = useRef<HTMLCanvasElement>(null);
  const deficitCanvas = useRef<HTMLCanvasElement>(null);
  const caloriesCanvas = useRef<HTMLCanvasElement>(null);
  const proteinCanvas = useRef<HTMLCanvasElement>(null);
  const waterCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ink = cssVar("--ink", "#1c1b19");
    const muted = cssVar("--muted", "#6b6964");
    const accent = cssVar("--accent", "#2c6e5a");
    const food = cssVar("--food", "#3b6d9a");
    const burn = cssVar("--burn", "#c16a2d");
    const labels = data.days.map((d) => d.label);
    const series = (values: unknown[]) => values.map(chartPoint);

    Chart.defaults.font.family =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = muted;
    Chart.defaults.borderColor = cssVar("--line", "#e4e0d8");
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.padding = 12;
    Chart.defaults.elements.point.hitRadius = 8;

    const configs: ChartConfiguration[] = [
      {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Daily",
                data: series(data.days.map((d) => d.weight_kg)),
                borderColor: "transparent",
                backgroundColor: hexAlpha(ink, 0.35),
                pointRadius: 4,
                pointHoverRadius: 5,
                showLine: false,
                order: 2,
              },
              {
                label: "7-day avg",
                data: series(data.weight_rolling7),
                borderColor: accent,
                backgroundColor: accent,
                borderWidth: 2.6,
                pointRadius: 3,
                pointHoverRadius: 4,
                tension: 0.25,
                spanGaps: true,
                order: 1,
              },
              {
                label: `Goal ${data.goal_weight_kg} kg`,
                data: data.days.map(() => data.goal_weight_kg),
                borderColor: muted,
                borderWidth: 1.25,
                borderDash: [5, 4],
                pointRadius: 0,
                fill: false,
                order: 3,
              },
            ],
          },
          options: baseOpts("kg"),
      },
      {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Cumulative deficit",
                data: series(
                  data.days.map((d) => (d.deficit_kcal == null ? null : d.cumulative_deficit_kcal)),
                ),
                borderColor: accent,
                backgroundColor: hexAlpha(accent, 0.16),
                borderWidth: 2.4,
                pointRadius: 4,
                fill: true,
                tension: 0.2,
                spanGaps: false,
              },
            ],
          },
          options: baseOpts("kcal", true),
      },
      {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                type: "bar",
                label: "Food",
                data: series(data.days.map((d) => d.kcal)),
                backgroundColor: hexAlpha(food, 0.55),
                borderColor: food,
                borderWidth: 0,
                borderRadius: 3,
                order: 2,
              } as ChartDataset,
              {
                type: "line",
                label: "WHOOP burn",
                data: series(data.days.map((d) => d.whoop_burn_kcal)),
                borderColor: burn,
                backgroundColor: burn,
                borderWidth: 2.2,
                pointRadius: 3,
                tension: 0.2,
                spanGaps: true,
                order: 1,
              },
              {
                type: "line",
                label: `${data.targets.calories_kcal.toLocaleString("en-AU")} target`,
                data: data.days.map(() => data.targets.calories_kcal),
                borderColor: muted,
                borderWidth: 1.25,
                borderDash: [5, 4],
                pointRadius: 0,
                order: 3,
              },
            ],
          },
          options: baseOpts("kcal", true),
      },
      {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                type: "bar",
                label: "Protein",
                data: series(data.days.map((d) => d.protein_g)),
                backgroundColor: hexAlpha(accent, 0.55),
                borderRadius: 3,
              } as ChartDataset,
              {
                type: "line",
                label: `${data.targets.protein_g} g`,
                data: data.days.map(() => data.targets.protein_g),
                borderColor: muted,
                borderWidth: 1.25,
                borderDash: [5, 4],
                pointRadius: 0,
              },
            ],
          },
          options: baseOpts("g", true),
      },
      {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                type: "bar",
                label: "Water",
                data: series(data.days.map((d) => d.water_l)),
                backgroundColor: hexAlpha(food, 0.55),
                borderRadius: 3,
              } as ChartDataset,
              {
                type: "line",
                label: `${data.targets.water_l} L`,
                data: data.days.map(() => data.targets.water_l),
                borderColor: muted,
                borderWidth: 1.25,
                borderDash: [5, 4],
                pointRadius: 0,
              },
            ],
          },
          options: baseOpts("L", true),
      },
    ];

    const canvases = [weightCanvas, deficitCanvas, caloriesCanvas, proteinCanvas, waterCanvas].map(
      (slot) => slot.current,
    );
    if (canvases.some((canvas) => canvas == null)) return;

    // iOS Safari keeps several full-resolution canvases and then throws the
    // bitmaps away. Cap the backing store so a phone is less likely to do that.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const created: Chart[] = [];
    canvases.forEach((canvas, index) => {
      const node = canvas as HTMLCanvasElement;
      try {
        // Chart.js otherwise forces border-box, and Safari then collapses the bitmap.
        node.style.boxSizing = "content-box";
        const config = configs[index];
        created.push(
          new Chart(node, {
            ...config,
            options: {
              ...config.options,
              responsive: false,
              animation: false,
              devicePixelRatio: pixelRatio,
            },
          }),
        );
      } catch (error) {
        console.error("Chart failed to start:", node.getAttribute("aria-label"), error);
      }
    });

    // Resize only when the tile has a real size. A 0×0 pass locks in a blank canvas.
    // force redraws even when the size is unchanged, which is what iOS needs after
    // it discards the bitmap (background tab, bfcache) without changing layout.
    const paint = (force = false) => {
      let waiting = false;
      for (const chart of created) {
        try {
          const parent = chart.canvas.parentElement;
          const width = Math.floor(parent?.clientWidth ?? 0);
          const height = Math.floor(parent?.clientHeight ?? 0);
          if (width < 2 || height < 2) {
            waiting = true;
            continue;
          }
          if (force || chart.width !== width || chart.height !== height) {
            (chart as Chart & { currentDevicePixelRatio?: number }).currentDevicePixelRatio = 0;
            chart.resize(width, height);
          }
        } catch (error) {
          console.error("Chart redraw failed:", chart.canvas.getAttribute("aria-label"), error);
        }
      }
      return waiting;
    };

    let frames = 0;
    let raf = 0;
    const tick = () => {
      if (!paint(false) || frames >= 20) return;
      frames += 1;
      raf = requestAnimationFrame(tick);
    };
    tick();

    const redraw = () => {
      paint(true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") redraw();
    };
    const observer = new ResizeObserver(() => {
      paint(false);
    });
    const paintedOnScreen = new WeakSet<HTMLCanvasElement>();
    const seen = new IntersectionObserver((entries) => {
      let due = false;
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLCanvasElement)) continue;
        if (paintedOnScreen.has(entry.target)) continue;
        paintedOnScreen.add(entry.target);
        due = true;
      }
      if (due) redraw();
    });
    for (const chart of created) {
      if (chart.canvas.parentElement) observer.observe(chart.canvas.parentElement);
      seen.observe(chart.canvas);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", redraw);
    window.addEventListener("orientationchange", redraw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", redraw);
      window.removeEventListener("orientationchange", redraw);
      for (const chart of created) chart.destroy();
    };
  }, [data]);

  const expected = data.expected_kg_lost;
  const personal = data.personal;

  return (
    <>
      <section className="card chart-tile">
        <div className="tile-heading">
          <h2>Cumulative deficit</h2>
          <div className="big">{Math.round(data.cumulative_deficit_kcal).toLocaleString("en-AU")} kcal</div>
        </div>
        <div className="chart-wrap">
          <canvas ref={deficitCanvas} aria-label="Cumulative deficit chart" />
        </div>
        <p className="note">
          ≈{expected.toLocaleString("en-AU", { maximumFractionDigits: 2 })} kg expected lost at{" "}
          {data.kcal_per_kg.toLocaleString("en-AU")} kcal/kg. Completed days only (burn − food); past
          days count even if WHOOP still shows an open cycle. Analysis — not added to the food budget.
          {data.in_progress_label ? ` ${data.in_progress_label} is in progress and not counted yet.` : null}
        </p>
      </section>

      <section className="card chart-tile">
        <h2>Calories vs WHOOP burn</h2>
        <div className="chart-wrap">
          <canvas ref={caloriesCanvas} aria-label="Calories versus WHOOP burn chart" />
        </div>
        <p className="note">
          Bars are food. The solid line is WHOOP cycle burn. Dashed line is the{" "}
          {data.targets.calories_kcal.toLocaleString("en-AU")} kcal food budget.
        </p>
      </section>

      <section className="card chart-tile">
        <h2>Weight</h2>
        <div className="chart-wrap">
          <canvas ref={weightCanvas} aria-label="Weight chart" />
        </div>
        <p className="note">
          Faint dots are daily weigh-ins. The bold line is a 7-day rolling average. Dashed line is the{" "}
          {data.goal_weight_kg} kg goal.
        </p>
      </section>

      <section className="card chart-tile">
        <h2>Protein</h2>
        <div className="chart-wrap">
          <canvas ref={proteinCanvas} aria-label="Protein chart" />
        </div>
        <p className="note">Daily protein vs {data.targets.protein_g} g target.</p>
      </section>

      <section className="card chart-tile">
        <h2>Water</h2>
        <div className="chart-wrap">
          <canvas ref={waterCanvas} aria-label="Water chart" />
        </div>
        <p className="note">Daily water vs {data.targets.water_l} L target.</p>
      </section>

      <section className="card">
        <h2>Personal kcal/kg</h2>
        <div className="big">
          {personal.ready && personal.kcal_per_kg != null
            ? `${Math.round(personal.kcal_per_kg).toLocaleString("en-AU")} kcal/kg`
            : `Needs ~2 weeks of data (${personal.completed_days}/${personal.needed_days})`}
        </div>
        <p className="note">
          WHOOP burn estimates and water weight mean this figure settles over a few weeks. Comparing it
          with {data.kcal_per_kg.toLocaleString("en-AU")} shows how accurate WHOOP burn is for you.
        </p>
      </section>
    </>
  );
}
