"use client";

import { useEffect, useRef, type RefObject } from "react";
import { DASHBOARD_TAB_EVENT } from "@/components/dashboard-tab";
import type { Chart, ChartConfiguration, ChartDataset, Plugin, TooltipItem } from "chart.js";
import {
  formatKcalPerDay,
  formatProteinPerDay,
  formatWaterPerDay,
  type DietChartModel,
} from "@/lib/chart-range";
import { formatAverageLabel, proteinAxis, targetAxis } from "@/lib/chart-scale";
import { ASSUMED_TDEE_KCAL, fixedTdeeCumulativeForChartDays, fixedTdeeSeriesLabel } from "@/lib/deficit";
import { formatNumber } from "@/lib/format";
import type { DietDashboardView } from "@/lib/types";

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

function formatTarget(value: number): string {
  return value.toLocaleString("en-AU", { maximumFractionDigits: 1 });
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

/** Same stroke, markers, and gaps for both cumulative-deficit lines. */
function equalDeficitLine(label: string, color: string, data: Array<number | null>) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2.4,
    pointRadius: 4,
    pointHoverRadius: 5,
    pointBackgroundColor: color,
    pointBorderColor: color,
    pointBorderWidth: 1.5,
    fill: false as const,
    tension: 0.2,
    spanGaps: false,
  };
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

export type DietChartRefs = {
  weight: RefObject<HTMLCanvasElement | null>;
  deficit: RefObject<HTMLCanvasElement | null>;
  calories: RefObject<HTMLCanvasElement | null>;
  protein: RefObject<HTMLCanvasElement | null>;
  water: RefObject<HTMLCanvasElement | null>;
};

function averageDataset(value: number | null, count: number): ChartDataset | null {
  if (value == null || count === 0) return null;
  return {
    type: "line",
    label: "Average",
    data: Array.from({ length: count }, () => value),
    borderWidth: 0,
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    order: 0,
    spanGaps: true,
  } as ChartDataset;
}

function finiteMax(values: Array<number | null | undefined>): number {
  let max = 0;
  for (const value of values) {
    if (value != null && Number.isFinite(value)) max = Math.max(max, value);
  }
  return max;
}

function targetScale(
  yTitle: string,
  target: number,
  values: Array<number | null | undefined>,
  reserveLabel: boolean,
  axisFor: (target: number, dataMax: number) => { step: number; max: number } = targetAxis,
) {
  const axis = axisFor(target, finiteMax(values));
  const base = baseOpts(yTitle, true);
  return {
    ...base,
    layout: {
      padding: { top: 8, right: reserveLabel ? 68 : 4, bottom: 0, left: 0 },
    },
    scales: {
      ...base.scales,
      y: {
        ...base.scales.y,
        min: 0,
        max: axis.max,
        ticks: {
          ...base.scales.y.ticks,
          stepSize: axis.step,
          autoSkip: false,
          maxTicksLimit: 24,
          callback(value: string | number) {
            const number = Number(value);
            if (!Number.isFinite(number)) return "";
            if (Math.abs(number - Math.round(number)) < 1e-6) {
              return Math.round(number).toLocaleString("en-AU");
            }
            return number.toLocaleString("en-AU", { maximumFractionDigits: 1 });
          },
        },
      },
    },
  };
}

function averageTooltip(stat: string | null) {
  return {
    callbacks: {
      label(context: TooltipItem<"bar">) {
        const name = context.dataset.label ?? "";
        if (name === "Average" && stat) return stat;
        return name ? `${name}: ${context.formattedValue}` : context.formattedValue;
      },
    },
  };
}

/** Solid average line with a short label at the right end, plus dashed rules for a one-point chart. */
function chartGuides(input: {
  average: number | null;
  averageLabel: string | null;
  averageColor: string;
  rules: Array<{ value: number | null; color: string; dash: number[]; width: number }>;
}): Plugin {
  const rules = input.rules.flatMap((rule) => (rule.value == null ? [] : [rule]));
  return {
    id: "chartGuides",
    afterDatasetsDraw(chart) {
      const yScale = chart.scales.y;
      const { ctx, chartArea } = chart;
      if (!yScale || !chartArea) return;
      const drawRule = (value: number, color: string, dash: number[], width: number, x2: number) => {
        const y = yScale.getPixelForValue(value);
        if (!Number.isFinite(y) || y < chartArea.top - 1 || y > chartArea.bottom + 1) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.restore();
      };
      for (const rule of rules) {
        if (rule.value == null) continue;
        drawRule(rule.value, rule.color, rule.dash, rule.width, chartArea.right);
      }
      if (input.average == null || !input.averageLabel) return;
      const y = yScale.getPixelForValue(input.average);
      if (!Number.isFinite(y)) return;
      ctx.save();
      ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
      ctx.fillStyle = input.averageColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const textY = Math.min(Math.max(y, chartArea.top + 6), chartArea.bottom - 6);
      drawRule(input.average, input.averageColor, [], 1.5, chartArea.right);
      ctx.fillText(input.averageLabel, chartArea.right + 6, textY);
      ctx.restore();
    },
  };
}

export function useDietCharts(model: DietChartModel): DietChartRefs {
  const weightCanvas = useRef<HTMLCanvasElement>(null);
  const deficitCanvas = useRef<HTMLCanvasElement>(null);
  const caloriesCanvas = useRef<HTMLCanvasElement>(null);
  const proteinCanvas = useRef<HTMLCanvasElement>(null);
  const waterCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let release = () => {};
    void import("chart.js").then((charts) => {
      if (disposed) return;
      const {
        Chart,
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
      } = charts;
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
      const ink = cssVar("--ink", "#1c1b19");
      const muted = cssVar("--muted", "#6b6964");
      const accent = cssVar("--accent", "#2c6e5a");
      const food = cssVar("--food", "#3b6d9a");
      const burn = cssVar("--burn", "#c16a2d");
      const avgColor = cssVar("--avg", "#6b3fa0");
      const labels = model.labels;
      const series = (values: unknown[]) => values.map(chartPoint);
      const count = labels.length;
      const single = count < 2;
      const kcalAverage = averageDataset(model.averages.kcalLine, count);
      const proteinAverage = averageDataset(model.averages.proteinLine, count);
      const waterAverage = averageDataset(model.averages.waterLine, count);
      const kcalStat = formatKcalPerDay(model.averages.kcalPerDay);
      const proteinStat = formatProteinPerDay(model.averages.proteinPerDay);
      const waterStat = formatWaterPerDay(model.averages.waterPerDay);
      const kcalMark = formatAverageLabel("kcal", model.averages.kcalPerDay ?? Number.NaN);
      const proteinMark = formatAverageLabel("protein", model.averages.proteinPerDay ?? Number.NaN);
      const waterMark = formatAverageLabel("water", model.averages.waterPerDay ?? Number.NaN);
      const hideAverage = {
        filter(item: { text: string }) {
          return item.text !== "Average";
        },
      };

      Chart.defaults.font.family =
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
      Chart.defaults.font.size = 11;
      Chart.defaults.color = muted;
      Chart.defaults.borderColor = cssVar("--line", "#e4e0d8");
      Chart.defaults.plugins.legend.labels.boxWidth = 10;
      Chart.defaults.plugins.legend.labels.boxHeight = 10;
      Chart.defaults.plugins.legend.labels.padding = 12;
      Chart.defaults.elements.point.hitRadius = 8;

      const targetLine = (label: string, value: number) => ({
        type: "line" as const,
        label,
        data: labels.map(() => value),
        borderColor: muted,
        borderWidth: 1.25,
        borderDash: [5, 4],
        pointRadius: 0,
        order: 3,
      });
      const guidesFor = (
        average: number | null,
        averageLabel: string,
        rules: Array<{ value: number | null; color: string; dash: number[]; width: number }>,
      ) => [
        chartGuides({
          average,
          averageLabel: average == null ? null : averageLabel,
          averageColor: avgColor,
          rules: single ? rules : [],
        }),
      ];

      const configs: ChartConfiguration[] = [
        {
            type: "line",
            data: {
              labels,
              datasets: [
                {
                  label: model.weekly ? "Weekly avg" : "Daily",
                  data: series(model.weightKg),
                  borderColor: "transparent",
                  backgroundColor: hexAlpha(ink, 0.35),
                  pointRadius: 4,
                  pointHoverRadius: 5,
                  showLine: false,
                  order: 2,
                },
                {
                  label: "7-day avg",
                  data: series(model.weightAvg7),
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
                  label: `Goal ${model.goalWeightKg} kg`,
                  data: labels.map(() => model.goalWeightKg),
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
            plugins: single
              ? [
                  chartGuides({
                    average: null,
                    averageLabel: null,
                    averageColor: avgColor,
                    rules: [{ value: model.goalWeightKg, color: muted, dash: [5, 4], width: 1.25 }],
                  }),
                ]
              : [],
        },
        {
            type: "line",
            data: {
              labels,
              datasets: [
                equalDeficitLine("WHOOP burn", accent, series(model.deficitWhoop)),
                equalDeficitLine(fixedTdeeSeriesLabel(), burn, series(model.deficitFixed)),
              ],
            },
            options: {
              ...baseOpts("kcal", true),
              plugins: {
                legend: {
                  display: true,
                  position: "bottom" as const,
                  labels: {
                    color: ink,
                    usePointStyle: true,
                    pointStyle: "circle" as const,
                    boxWidth: 7,
                    boxHeight: 7,
                    padding: 16,
                    font: { size: 12 },
                  },
                },
              },
            },
        },
        {
            type: "bar",
            data: {
              labels,
              datasets: [
                {
                  type: "bar",
                  label: "Food",
                  data: series(model.kcal),
                  backgroundColor: hexAlpha(food, 0.55),
                  borderColor: food,
                  borderWidth: 0,
                  borderRadius: 3,
                  order: 2,
                } as ChartDataset,
                {
                  type: "line",
                  label: "WHOOP burn",
                  data: series(model.whoopKcal),
                  borderColor: burn,
                  backgroundColor: burn,
                  borderWidth: 2.2,
                  pointRadius: 3,
                  tension: 0.2,
                  spanGaps: true,
                  order: 1,
                },
                targetLine(`${model.targets.calories_kcal.toLocaleString("en-AU")} target`, model.targets.calories_kcal),
                ...(kcalAverage ? [kcalAverage] : []),
              ],
            },
            options: {
              ...targetScale(
                "kcal",
                model.targets.calories_kcal,
                [...model.kcal, ...model.whoopKcal, model.averages.kcalLine],
                model.averages.kcalLine != null,
              ),
              plugins: {
                legend: { display: true, position: "bottom" as const, labels: hideAverage },
                tooltip: averageTooltip(kcalStat),
              },
            },
            plugins: guidesFor(model.averages.kcalLine, kcalMark, [
              { value: model.targets.calories_kcal, color: muted, dash: [5, 4], width: 1.25 },
            ]),
        },
        {
            type: "bar",
            data: {
              labels,
              datasets: [
                {
                  type: "bar",
                  label: "Protein",
                  data: series(model.proteinG),
                  backgroundColor: hexAlpha(accent, 0.55),
                  borderRadius: 3,
                } as ChartDataset,
                targetLine(
                  `${model.targets.protein_g.toLocaleString("en-AU")} g`,
                  model.targets.protein_g,
                ),
                ...(proteinAverage ? [proteinAverage] : []),
              ],
            },
            options: {
              ...targetScale(
                "g",
                model.targets.protein_g,
                [...model.proteinG, model.averages.proteinLine],
                model.averages.proteinLine != null,
                proteinAxis,
              ),
              plugins: {
                legend: { display: true, position: "bottom" as const, labels: hideAverage },
                tooltip: averageTooltip(proteinStat),
              },
            },
            plugins: guidesFor(model.averages.proteinLine, proteinMark, [
              { value: model.targets.protein_g, color: muted, dash: [5, 4], width: 1.25 },
            ]),
        },
        {
            type: "bar",
            data: {
              labels,
              datasets: [
                {
                  type: "bar",
                  label: "Water",
                  data: series(model.waterL),
                  backgroundColor: hexAlpha(food, 0.55),
                  borderRadius: 3,
                } as ChartDataset,
                targetLine(`${formatTarget(model.targets.water_l)} L`, model.targets.water_l),
                ...(waterAverage ? [waterAverage] : []),
              ],
            },
            options: {
              ...targetScale(
                "L",
                model.targets.water_l,
                [...model.waterL, model.averages.waterLine],
                model.averages.waterLine != null,
              ),
              plugins: {
                legend: { display: true, position: "bottom" as const, labels: hideAverage },
                tooltip: averageTooltip(waterStat),
              },
            },
            plugins: guidesFor(model.averages.waterLine, waterMark, [
              { value: model.targets.water_l, color: muted, dash: [5, 4], width: 1.25 },
            ]),
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
      // A hidden tab is display:none, so its canvas is 0×0 until the tab is shown.
      // Reuse the same non-zero-size redraw; a second frame covers a late layout.
      let tabFrame = 0;
      const onTab = () => {
        redraw();
        cancelAnimationFrame(tabFrame);
        tabFrame = requestAnimationFrame(() => redraw());
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("pageshow", redraw);
      window.addEventListener("orientationchange", redraw);
      document.addEventListener(DASHBOARD_TAB_EVENT, onTab);

      let stopped = false;
      release = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(raf);
        cancelAnimationFrame(tabFrame);
        observer.disconnect();
        seen.disconnect();
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("pageshow", redraw);
        window.removeEventListener("orientationchange", redraw);
        document.removeEventListener(DASHBOARD_TAB_EVENT, onTab);
        for (const chart of created) chart.destroy();
      };
      if (disposed) release();
    });
    return () => {
      disposed = true;
      release();
    };
  }, [model]);

  return {
    weight: weightCanvas,
    deficit: deficitCanvas,
    calories: caloriesCanvas,
    protein: proteinCanvas,
    water: waterCanvas,
  };
}

function PeriodAverage({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="chart-stat">{text}</p>;
}

export function WeightChartTile({
  canvasRef,
  model,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  model: DietChartModel;
}) {
  return (
    <section className="card chart-tile" data-tab-group="diet" data-tile="weight">
      <h2>Weight</h2>
      <div className="chart-wrap">
        <canvas ref={canvasRef} aria-label="Weight chart" />
      </div>
      <p className="note">
        {model.weekly
          ? "Faint dots are weekly average weigh-ins. The bold line is a 7-day rolling average. Dashed line is the "
          : "Faint dots are daily weigh-ins. The bold line is a 7-day rolling average. Dashed line is the "}
        {model.goalWeightKg} kg goal.
      </p>
    </section>
  );
}

export function CaloriesChartTile({
  canvasRef,
  data,
  model,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  data: DietDashboardView;
  model: DietChartModel;
}) {
  const daily = data.targets.calories_kcal.toLocaleString("en-AU");
  const weeklyTarget = model.targets.calories_kcal.toLocaleString("en-AU");
  return (
    <section className="card chart-tile" data-tab-group="diet" data-tile="burn">
      <h2>Calories vs WHOOP burn</h2>
      <PeriodAverage text={formatKcalPerDay(model.averages.kcalPerDay)} />
      <div className="chart-wrap">
        <canvas ref={canvasRef} aria-label="Calories versus WHOOP burn chart" />
      </div>
      <p className="note">
        {model.weekly
          ? `Bars are weekly food totals. The solid orange line is weekly WHOOP burn. The dashed line is ${weeklyTarget} kcal (7 × ${daily}). The violet line is the daily average, drawn ×7 so it lines up.`
          : `Bars are food. The solid orange line is WHOOP cycle burn. The dashed line is the ${daily} kcal food budget. The violet line is the average of logged days.`}
      </p>
    </section>
  );
}

export function DeficitChartTile({
  canvasRef,
  data,
  model,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  data: DietDashboardView;
  model: DietChartModel;
}) {
  const fixed = fixedTdeeCumulativeForChartDays(
    data.days.map((day) => ({
      plotted: day.deficit_kcal != null,
      foodKcal: day.kcal,
      whoopKcal: day.whoop_burn_kcal,
    })),
  );
  const kcalPerKg = data.kcal_per_kg.toLocaleString("en-AU");
  return (
    <section className="card chart-tile" data-tab-group="diet" data-tile="deficit">
      <h2>Cumulative deficit</h2>
      <div className="deficit-stats-wrap">
        <div className="deficit-stats">
          <div className="deficit-stat">
            <div className="deficit-stat-label">
              <span className="deficit-swatch" data-series="whoop" aria-hidden="true" />
              WHOOP burn
            </div>
            <div className="big">{formatNumber(Math.round(data.cumulative_deficit_kcal))} kcal</div>
            <div className="deficit-kg">≈ {formatNumber(data.expected_kg_lost, 2)} kg</div>
          </div>
          <div className="deficit-stat">
            <div className="deficit-stat-label">
              <span className="deficit-swatch" data-series="fixed" aria-hidden="true" />
              {fixedTdeeSeriesLabel()}
            </div>
            <div className="big">{formatNumber(Math.round(fixed.cumulativeDeficitKcal))} kcal</div>
            <div className="deficit-kg">≈ {formatNumber(fixed.expectedKgLost, 2)} kg</div>
          </div>
        </div>
      </div>
      <div className="chart-wrap">
        <canvas
          ref={canvasRef}
          aria-label={`Cumulative deficit chart comparing WHOOP burn with ${fixedTdeeSeriesLabel()}`}
        />
      </div>
      <p className="note">
        WHOOP burn is calories burned minus food. {fixedTdeeSeriesLabel()} uses{" "}
        {ASSUMED_TDEE_KCAL.toLocaleString("en-AU")} kcal as the burn instead, minus food on those
        same days. The kilograms under each total are the expected weight lost at {kcalPerKg} kcal
        per kg. Counted days only: a past day counts even if WHOOP still shows an open cycle.
        Comparison only. Neither figure is added to the food budget.
        {model.weekly ? " Each point is the cumulative total at the end of that week." : null}
        {data.in_progress_label ? ` ${data.in_progress_label} is in progress and not counted yet.` : null}
      </p>
    </section>
  );
}

export function ProteinChartTile({
  canvasRef,
  data,
  model,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  data: DietDashboardView;
  model: DietChartModel;
}) {
  const daily = data.targets.protein_g.toLocaleString("en-AU");
  const weeklyTarget = model.targets.protein_g.toLocaleString("en-AU");
  return (
    <section className="card chart-tile" data-tab-group="diet" data-tile="protein">
      <h2>Protein</h2>
      <PeriodAverage text={formatProteinPerDay(model.averages.proteinPerDay)} />
      <div className="chart-wrap">
        <canvas ref={canvasRef} aria-label="Protein chart" />
      </div>
      <p className="note">
        {model.weekly
          ? `Weekly protein totals. The dashed line is ${weeklyTarget} g (7 × ${daily} g). The violet line is the daily average, drawn ×7.`
          : `Daily protein vs the ${daily} g target. The violet line is the average of logged days.`}
      </p>
    </section>
  );
}

export function WaterChartTile({
  canvasRef,
  data,
  model,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  data: DietDashboardView;
  model: DietChartModel;
}) {
  const daily = formatTarget(data.targets.water_l);
  const weeklyTarget = formatTarget(model.targets.water_l);
  return (
    <section className="card chart-tile" data-tab-group="diet" data-tile="water">
      <h2>Water</h2>
      <PeriodAverage text={formatWaterPerDay(model.averages.waterPerDay)} />
      <div className="chart-wrap">
        <canvas ref={canvasRef} aria-label="Water chart" />
      </div>
      <p className="note">
        {model.weekly
          ? `Weekly water totals. The dashed line is ${weeklyTarget} L (7 × ${daily} L). The violet line is the daily average, drawn ×7.`
          : `Daily water vs the ${daily} L target. The violet line is the average of logged days.`}
      </p>
    </section>
  );
}

export function PersonalKcalTile({ data }: { data: DietDashboardView }) {
  const personal = data.personal;
  return (
    <section className="card" data-tab-group="diet" data-tile="personal">
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
  );
}
