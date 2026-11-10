"use client";

import { useEffect, useId, useRef } from "react";
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

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
  const muted = cssVar("--muted");
  const line = cssVar("--line");
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
  const weightId = useId();
  const deficitId = useId();
  const caloriesId = useId();
  const proteinId = useId();
  const waterId = useId();
  const charts = useRef<Chart[]>([]);

  useEffect(() => {
    const ink = cssVar("--ink");
    const muted = cssVar("--muted");
    const accent = cssVar("--accent");
    const food = cssVar("--food");
    const burn = cssVar("--burn");
    const labels = data.days.map((d) => d.label);

    Chart.defaults.font.family =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.color = muted;
    Chart.defaults.borderColor = cssVar("--line");
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.padding = 12;
    Chart.defaults.elements.point.hitRadius = 8;

    const configs: Array<{ id: string; config: ChartConfiguration }> = [
      {
        id: weightId,
        config: {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Daily",
                data: data.days.map((d) => d.weight_kg),
                borderColor: "transparent",
                backgroundColor: hexAlpha(ink, 0.35),
                pointRadius: 4,
                pointHoverRadius: 5,
                showLine: false,
                order: 2,
              },
              {
                label: "7-day avg",
                data: data.weight_rolling7,
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
      },
      {
        id: deficitId,
        config: {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Cumulative deficit",
                data: data.days.map((d) => (d.deficit_kcal == null ? null : d.cumulative_deficit_kcal)),
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
      },
      {
        id: caloriesId,
        config: {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                type: "bar",
                label: "Food",
                data: data.days.map((d) => d.kcal),
                backgroundColor: hexAlpha(food, 0.55),
                borderColor: food,
                borderWidth: 0,
                borderRadius: 3,
                order: 2,
              } as ChartDataset,
              {
                type: "line",
                label: "WHOOP burn",
                data: data.days.map((d) => d.whoop_burn_kcal),
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
      },
      {
        id: proteinId,
        config: {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                type: "bar",
                label: "Protein",
                data: data.days.map((d) => d.protein_g),
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
      },
      {
        id: waterId,
        config: {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                type: "bar",
                label: "Water",
                data: data.days.map((d) => d.water_l),
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
      },
    ];

    charts.current = configs.map(({ id, config }) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement | null;
      if (!canvas) throw new Error(`Missing chart canvas ${id}`);
      return new Chart(canvas, config);
    });

    return () => {
      for (const chart of charts.current) chart.destroy();
      charts.current = [];
    };
  }, [caloriesId, data, deficitId, proteinId, waterId, weightId]);

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
          <canvas id={deficitId} aria-label="Cumulative deficit chart" />
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
          <canvas id={caloriesId} aria-label="Calories versus WHOOP burn chart" />
        </div>
        <p className="note">
          Bars are food. The solid line is WHOOP cycle burn. Dashed line is the{" "}
          {data.targets.calories_kcal.toLocaleString("en-AU")} kcal food budget.
        </p>
      </section>

      <section className="card chart-tile">
        <h2>Weight</h2>
        <div className="chart-wrap">
          <canvas id={weightId} aria-label="Weight chart" />
        </div>
        <p className="note">
          Faint dots are daily weigh-ins. The bold line is a 7-day rolling average. Dashed line is the{" "}
          {data.goal_weight_kg} kg goal.
        </p>
      </section>

      <section className="card chart-tile">
        <h2>Protein</h2>
        <div className="chart-wrap">
          <canvas id={proteinId} aria-label="Protein chart" />
        </div>
        <p className="note">Daily protein vs {data.targets.protein_g} g target.</p>
      </section>

      <section className="card chart-tile">
        <h2>Water</h2>
        <div className="chart-wrap">
          <canvas id={waterId} aria-label="Water chart" />
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
