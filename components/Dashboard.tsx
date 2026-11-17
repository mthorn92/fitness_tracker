"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChartRangeBar } from "@/components/ChartRangeBar";
import {
  CaloriesChartTile,
  DeficitChartTile,
  ObservedTdeeTile,
  ProteinChartTile,
  useDietCharts,
  WeightChartTile,
} from "@/components/DietCharts";
import { DietTodayCard } from "@/components/DietTodayCard";
import { EatingDateBar } from "@/components/EatingDateBar";
import { MonthRings } from "@/components/MonthRings";
import { ExerciseDayTile, ExerciseToday, OverloadTile, PhaseSummaryTile } from "@/components/ExerciseTiles";
import { RunsTile } from "@/components/RunsTile";
import { StravaWorkoutsTile } from "@/components/StravaWorkoutsTile";
import { TodayFood } from "@/components/TodayFood";
import {
  DASHBOARD_TAB_EVENT,
  DASHBOARD_TABS,
  isDashboardTab,
  resolveDashboardTab,
  RETIRED_DASHBOARD_TAB,
  type DashboardTab,
} from "@/components/dashboard-tab";
import type { ExerciseBoard } from "@/lib/exercise-board";
import { formatStrengthDayCopy } from "@/lib/strength-copy";
import type { RunScore } from "@/lib/run-tile";
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
  workoutMovingTimes,
  runs,
  today,
}: {
  initialTab: DashboardTab;
  initialRange: ChartRangeId;
  updated: string;
  data: DietDashboardView;
  foods: FoodItem[];
  board: ExerciseBoard;
  workouts: StravaWorkoutsModel;
  workoutMovingTimes: ReadonlyMap<string, number>;
  runs: RunScore[];
  today: string;
}) {
  const router = useRouter();
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
        today,
        highlightDate: data.today.date <= today ? data.today.date : null,
      }),
    [data, range, today],
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

  const weekKey = `${board.planId}:${board.currentWeek}`;
  const [weekChoice, setWeekChoice] = useState({ key: weekKey, week: board.currentWeek });
  if (weekChoice.key !== weekKey) {
    setWeekChoice({ key: weekKey, week: board.currentWeek });
  }
  const exerciseWeek = weekChoice.week;
  const selectedWeek = board.weeks.find((entry) => entry.week === exerciseWeek) ?? board.weeks[0];

  function openDate(next: string) {
    const params = new URLSearchParams(window.location.search);
    if (next === today) params.delete("date");
    else params.set("date", next);
    if (!params.get("tab")) params.set("tab", "diet");
    const query = params.toString();
    router.push(`${window.location.pathname}${query ? `?${query}` : ""}`);
  }

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
        {tab === "diet" ? <ChartRangeBar range={range} onChange={selectRange} /> : null}
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
      <EatingDateBar
        date={data.today.date}
        today={today}
        minDate={data.start_date}
        goalWeightKg={data.goal_weight_kg}
        phases={data.calorie_phases}
      />
      <DietTodayCard data={data} today={today} />
      <TodayFood
        foods={foods}
        date={data.today.date}
        dateLabel={data.today.label}
        today={today}
        tomorrow={data.tomorrow}
        onOpenTomorrow={data.tomorrow ? () => openDate(data.tomorrow!.date) : undefined}
      />
      <MonthRings days={data.days} today={today} />
      <WeightChartTile canvasRef={charts.weight} model={model} />
      <CaloriesChartTile canvasRef={charts.calories} data={data} model={model} />
      <DeficitChartTile canvasRef={charts.deficit} data={data} model={model} />
      <ProteinChartTile
        proteinRef={charts.protein}
        data={data}
        model={model}
        today={today}
        focusDate={data.today.date}
      />
      <ObservedTdeeTile data={data} today={today} />
      {selectedWeek ? (
        <>
          <ExerciseToday board={board} week={selectedWeek} onWeek={(week) => setWeekChoice((current) => ({ ...current, week }))} />
          {selectedWeek.days.map((day, index) => {
            const copyDay = selectedWeek.copyDays[index];
            const copyText = copyDay ? formatStrengthDayCopy(copyDay) : undefined;
            return <ExerciseDayTile key={day.slot} day={day} copyText={copyText} />;
          })}
          <RunsTile rows={runs} movingTimes={workoutMovingTimes} />
          <StravaWorkoutsTile model={workouts} />
          <OverloadTile board={board} week={selectedWeek} />
          <PhaseSummaryTile board={board} week={selectedWeek} />
        </>
      ) : null}
    </main>
  );
}
