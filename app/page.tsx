import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { parseDashboardTab } from "@/components/dashboard-tab";
import { parseChartRange } from "@/lib/chart-range";
import { getDashboardPageData } from "@/lib/data";
import { getExerciseBoard } from "@/lib/exercise-board";
import { todayIsoDate } from "@/lib/format";
import { loadExerciseActivities } from "@/lib/workouts";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <DietDashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function DietDashboard({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  // Each request reads the database. Caching this page kept the food deficit stale after a log.
  await connection();
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  const range = parseChartRange(params.range);
  const calendarToday = todayIsoDate("Australia/Melbourne");
  const trainingDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : calendarToday;
  const [diet, board, activity] = await Promise.all([
    getDashboardPageData(date, range),
    getExerciseBoard(trainingDate),
    loadExerciseActivities(trainingDate),
  ]);

  return (
    <Dashboard
      initialTab={parseDashboardTab(params.tab)}
      initialRange={range}
      updated={diet.data.generated_label}
      data={diet.data}
      foods={diet.log.foods}
      board={board}
      workouts={activity.workouts}
      strava={activity.runs}
      today={calendarToday}
    />
  );
}
