import { Suspense } from "react";
import { DietCharts } from "@/components/DietCharts";
import { DietTodayCard } from "@/components/DietTodayCard";
import { MonthRings } from "@/components/MonthRings";
import { getDietDashboardView } from "@/lib/data";
import { todayIsoDate } from "@/lib/format";

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

  return (
    <main className="diet-main">
      <h1>Diet dashboard</h1>
      <p className="updated">Updated {data.generated_label}</p>
      <DietTodayCard data={data} />
      <MonthRings days={data.days} today={todayIsoDate()} />
      <DietCharts data={data} />
    </main>
  );
}
