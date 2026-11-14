import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { InvestingSections } from "@/components/InvestingSections";
import { parseDashboardTab } from "@/components/dashboard-tab";
import { parseChartRange, type ChartRangeId } from "@/lib/chart-range";
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

async function loadDiet(date: string | undefined, range: ChartRangeId) {
  "use cache: private";
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  cacheTag("dashboard");
  return getDashboardPageData(date, range);
}

async function DietDashboard({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  const range = parseChartRange(params.range);
  const calendarToday = todayIsoDate("Australia/Melbourne");
  const trainingDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : calendarToday;
  const [diet, board, activity] = await Promise.all([
    loadDiet(date, range),
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
      investing={<InvestingSections />}
    />
  );
}
