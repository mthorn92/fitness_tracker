import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { parseDashboardTab } from "@/components/dashboard-tab";
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
    <Dashboard
      initialTab={parseDashboardTab(params.tab)}
      updated={data.generated_label}
      data={data}
      foods={log.foods}
      training={training}
      today={todayIsoDate()}
    />
  );
}
