"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import {
  CaloriesChartTile,
  DeficitChartTile,
  PersonalKcalTile,
  ProteinChartTile,
  useDietCharts,
  WaterChartTile,
  WeightChartTile,
} from "@/components/DietCharts";
import { DietTodayCard } from "@/components/DietTodayCard";
import { MonthRings } from "@/components/MonthRings";
import { TodayFood } from "@/components/TodayFood";
import { TrainingTodayCard } from "@/components/TrainingTodayCard";
import { DASHBOARD_TAB_EVENT, type DashboardTab } from "@/components/dashboard-tab";
import type { TrainingTile } from "@/lib/training-view";
import type { DietDashboardView, FoodItem } from "@/lib/types";

const STORAGE_KEY = "dashboard-tab";

function readStoredTab(): DashboardTab | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "diet" || stored === "exercise" ? stored : null;
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

function currentTab(fallback: DashboardTab): DashboardTab {
  const fromUrl = new URLSearchParams(window.location.search).get("tab");
  if (fromUrl === "diet" || fromUrl === "exercise") return fromUrl;
  return readStoredTab() ?? fallback;
}

export function Dashboard({
  initialTab,
  updated,
  data,
  foods,
  training,
  today,
}: {
  initialTab: DashboardTab;
  updated: string;
  data: DietDashboardView;
  foods: FoodItem[];
  training: TrainingTile;
  today: string;
}) {
  const tab = useSyncExternalStore(
    subscribeTab,
    () => currentTab(initialTab),
    () => initialTab,
  );
  const charts = useDietCharts(data);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("tab");
    if (fromUrl === "diet" || fromUrl === "exercise") {
      writeStoredTab(fromUrl);
      return;
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

  useLayoutEffect(() => {
    document.dispatchEvent(new Event(DASHBOARD_TAB_EVENT));
  }, [tab]);

  function select(next: DashboardTab) {
    writeStoredTab(next);
    writeTabUrl(next);
    emitTab();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const order: DashboardTab[] = ["diet", "exercise"];
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
    document.getElementById(next === "diet" ? "tab-diet" : "tab-exercise")?.focus();
  }

  return (
    <main className="dashboard" data-tab={tab}>
      <header className="dashboard-head">
        <div className="dashboard-heading">
          <h1>Max&apos;s Dashboard</h1>
          <p className="updated">Updated {updated}</p>
        </div>
        <div className="tabs" role="tablist" aria-label="Dashboard sections" onKeyDown={onKeyDown}>
          <button
            type="button"
            role="tab"
            id="tab-diet"
            aria-selected={tab === "diet"}
            tabIndex={tab === "diet" ? 0 : -1}
            onClick={() => select("diet")}
          >
            Diet
          </button>
          <button
            type="button"
            role="tab"
            id="tab-exercise"
            aria-selected={tab === "exercise"}
            tabIndex={tab === "exercise" ? 0 : -1}
            onClick={() => select("exercise")}
          >
            Exercise
          </button>
        </div>
      </header>
      <DietTodayCard data={data} />
      <TodayFood foods={foods} dateLabel={data.today.label} />
      <WeightChartTile canvasRef={charts.weight} data={data} />
      <CaloriesChartTile canvasRef={charts.calories} data={data} />
      <DeficitChartTile canvasRef={charts.deficit} data={data} />
      <ProteinChartTile canvasRef={charts.protein} data={data} />
      <WaterChartTile canvasRef={charts.water} data={data} />
      <PersonalKcalTile data={data} />
      <MonthRings days={data.days} today={today} />
      <TrainingTodayCard view={training} />
    </main>
  );
}
