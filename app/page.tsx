import { Suspense } from "react";
import { DietCharts } from "@/components/DietCharts";
import { DietTodayCard } from "@/components/DietTodayCard";
import { MonthRings } from "@/components/MonthRings";
import { TodayFood } from "@/components/TodayFood";
import { TrainingTodayCard } from "@/components/TrainingTodayCard";
import { getDietDashboardView, getLogView } from "@/lib/data";
import { todayIsoDate } from "@/lib/format";
import { getTrainingTile } from "@/lib/training-view";

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
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : undefined;
  const data = await getDietDashboardView(date);
  const log = await getLogView(data.today.date);
  const trainingDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIsoDate();
  const training = await getTrainingTile(trainingDate);

  return (
    <main className="dashboard">
      <header className="dashboard-head">
        <h1>Diet dashboard</h1>
        <p className="updated">Updated {data.generated_label}</p>
      </header>
      <TrainingTodayCard view={training} />
      <DietTodayCard data={data} />
      <TodayFood foods={log.foods} dateLabel={data.today.label} />
      <MonthRings days={data.days} today={todayIsoDate()} />
      <DietCharts data={data} />
    </main>
  );
}
