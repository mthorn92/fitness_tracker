"use client";

import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { ChartRangeBar } from "@/components/ChartRangeBar";
import {
  CaloriesChartTile,
  DeficitChartTile,
  PersonalKcalTile,
  ProteinWaterChartTile,
  useDietCharts,
  WeightChartTile,
} from "@/components/DietCharts";
import { DietTodayCard } from "@/components/DietTodayCard";
import { PhaseTile } from "@/components/PhaseTile";
import { MonthRings } from "@/components/MonthRings";
import { StravaRunsTile } from "@/components/StravaRunsTile";
import { StrengthDayTile } from "@/components/StrengthDayTile";
import { StravaWorkoutsTile } from "@/components/StravaWorkoutsTile";
import { TodayFood } from "@/components/TodayFood";
import { TrainingTodayCard } from "@/components/TrainingTodayCard";
import {
  DASHBOARD_TAB_EVENT,
  DASHBOARD_TABS,
  isDashboardTab,
  resolveDashboardTab,
  RETIRED_DASHBOARD_TAB,
  type DashboardTab,
} from "@/components/dashboard-tab";
import type { ExerciseBoard } from "@/lib/exercise-board";
import type { StravaTileModel } from "@/lib/strava-summary";
import type { StravaWorkoutsModel } from "@/lib/strava-workouts";
import {
  buildDietChartModel,
  isChartRange,
  type ChartRangeId,
} from "@/lib/chart-range";
import type { DietDashboardView, FoodItem } from "@/lib/types";

const STORAGE_KEY = "dashboard-tab";
const RANGE_STORAGE_KEY = "dashboard-range";

const TAB_LABELS: Record<DashboardTab, string> = {
  diet: "Diet",
  exercise: "Exercise",
};

function readStoredTab(): DashboardTab | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDashboardTab(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredTab(tab: DashboardTab) {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Private mode can reject storage. The URL still keeps the choice.
  }
}

function writeTabUrl(tab: DashboardTab) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("tab") === tab) return;
  url.searchParams.set("tab", tab);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

const tabListeners = new Set<() => void>();

function subscribeTab(listener: () => void) {
  tabListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    tabListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emitTab() {
  for (const listener of tabListeners) listener();
}

function readStoredRange(): ChartRangeId | null {
  try {
    const stored = localStorage.getItem(RANGE_STORAGE_KEY);
    return isChartRange(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredRange(range: ChartRangeId) {
  try {
    localStorage.setItem(RANGE_STORAGE_KEY, range);
  } catch {
    // Private mode can reject storage. The URL still keeps the choice.
  }
}

function writeRangeUrl(range: ChartRangeId) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("range") === range) return;
  url.searchParams.set("range", range);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

const rangeListeners = new Set<() => void>();

function subscribeRange(listener: () => void) {
  rangeListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === RANGE_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    rangeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emitRange() {
  for (const listener of rangeListeners) listener();
}

function currentRange(fallback: ChartRangeId): ChartRangeId {
  const fromUrl = new URLSearchParams(window.location.search).get("range");
  if (isChartRange(fromUrl)) return fromUrl;
  return readStoredRange() ?? fallback;
}

function currentTab(fallback: DashboardTab): DashboardTab {
  const fromUrl = new URLSearchParams(window.location.search).get("tab");
  return resolveDashboardTab(fromUrl, readStoredTab(), fallback);
}

export function Dashboard({
  initialTab,
  initialRange,
  updated,
  data,
  foods,
  board,
  workouts,
  strava,
  today,
}: {
  initialTab: DashboardTab;
  initialRange: ChartRangeId;
  updated: string;
  data: DietDashboardView;
  foods: FoodItem[];
  board: ExerciseBoard;
  workouts: StravaWorkoutsModel;
  strava: StravaTileModel;
  today: string;
}) {
  const tab = useSyncExternalStore(
    subscribeTab,
    () => currentTab(initialTab),
    () => initialTab,
  );
  const range = useSyncExternalStore(
    subscribeRange,
    () => currentRange(initialRange),
    () => initialRange,
  );
  const model = useMemo(
    () =>
      buildDietChartModel({
        days: data.days,
        weightRolling7: data.weight_rolling7,
        range,
        targets: data.targets,
        goalWeightKg: data.goal_weight_kg,
      }),
    [data, range],
  );
  const charts = useDietCharts(model);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("tab");
    if (fromUrl === RETIRED_DASHBOARD_TAB) {
      writeStoredTab("diet");
      params.set("tab", "diet");
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}?${params.toString()}${window.location.hash}`,
      );
      emitTab();
      return;
    }
    if (isDashboardTab(fromUrl)) {
      writeStoredTab(fromUrl);
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === RETIRED_DASHBOARD_TAB) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Private mode can reject storage. Diet is still the fallback.
    }
    const stored = readStoredTab();
    if (!stored) return;
    params.set("tab", stored);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
    emitTab();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("range");
    if (isChartRange(fromUrl)) {
      writeStoredRange(fromUrl);
      return;
    }
    const stored = readStoredRange();
    if (!stored) return;
    params.set("range", stored);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
    emitRange();
  }, []);

  useLayoutEffect(() => {
    document.dispatchEvent(new Event(DASHBOARD_TAB_EVENT));
  }, [tab]);

  function select(next: DashboardTab) {
    writeStoredTab(next);
    writeTabUrl(next);
    emitTab();
  }

  function selectRange(next: ChartRangeId) {
    writeStoredRange(next);
    writeRangeUrl(next);
    emitRange();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const order: DashboardTab[] = [...DASHBOARD_TABS];
    const index = order.indexOf(tab);
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % order.length
        : event.key === "ArrowLeft"
          ? (index - 1 + order.length) % order.length
          : event.key === "Home"
            ? 0
            : order.length - 1;
    const next = order[nextIndex];
    select(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <main className="dashboard" data-tab={tab}>
      <header className="dashboard-head">
        <h1>Max&apos;s Dashboard</h1>
        <p className="updated">Updated {updated}</p>
        <ChartRangeBar range={range} onChange={selectRange} />
        <div className="tabs" role="tablist" aria-label="Dashboard sections" onKeyDown={onKeyDown}>
          {DASHBOARD_TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tab-${name}`}
              aria-selected={tab === name}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => select(name)}
            >
              {TAB_LABELS[name]}
            </button>
          ))}
        </div>
      </header>
      <DietTodayCard data={data} today={today} />
      <TodayFood foods={foods} dateLabel={data.today.label} />
      <MonthRings days={data.days} today={today} />
      <WeightChartTile canvasRef={charts.weight} model={model} />
      <CaloriesChartTile canvasRef={charts.calories} data={data} model={model} />
      <DeficitChartTile canvasRef={charts.deficit} data={data} model={model} />
      <ProteinWaterChartTile
        proteinRef={charts.protein}
        waterRef={charts.water}
        data={data}
        model={model}
      />
      <PhaseTile data={data} today={today} />
      <PersonalKcalTile data={data} />
      <TrainingTodayCard view={board.today} mode={board.todayMode} weekCopy={board.weekCopyText} />
      {board.days.map((day) => (
        <StrengthDayTile key={day.planDay} day={day} />
      ))}
      <StravaWorkoutsTile model={workouts} />
      <StravaRunsTile model={strava} />
    </main>
  );
}
