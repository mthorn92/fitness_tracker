import type { Metadata } from "next";
import { Suspense } from "react";
import { DietCharts } from "@/components/DietCharts";
import { getDietDashboardView } from "@/lib/data";

export const metadata: Metadata = {
  title: "Charts",
};

export default function ChartsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <Charts />
    </Suspense>
  );
}

async function Charts() {
  const data = await getDietDashboardView();

  return (
    <main className="diet-main">
      <h1>Charts</h1>
      <p className="updated">Updated {data.generated_label}</p>
      <DietCharts data={data} />
    </main>
  );
}
