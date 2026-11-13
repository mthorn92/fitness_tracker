import { connection } from "next/server";
import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { InvestingSections } from "@/components/InvestingSections";
import { parseDashboardTab } from "@/components/dashboard-tab";
import { getDietDashboardView, getLogView } from "@/lib/data";
import { INVESTING_PAPER_SLUG } from "@/lib/doc-text";
import { loadDocument } from "@/lib/documents";
import { getExerciseBoard } from "@/lib/exercise-board";
import { todayIsoDate } from "@/lib/format";
import { getStravaSummary } from "@/lib/strava";
import { fixtureRuns, modelFromRuns } from "@/lib/strava-summary";

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
  const board = await getExerciseBoard(trainingDate);
  // Sample runs for local screenshots. A production build ignores this.
  const previewStrava =
    process.env.NODE_ENV !== "production" &&
    (params.strava === "preview" || process.env.STRAVA_FIXTURE === "1");
  const strava = previewStrava
    ? modelFromRuns(fixtureRuns(trainingDate), trainingDate)
    : await getStravaSummary(trainingDate);
  await connection();
  const paper = await loadDocument(INVESTING_PAPER_SLUG);

  return (
    <Dashboard
      initialTab={parseDashboardTab(params.tab)}
      updated={data.generated_label}
      data={data}
      foods={log.foods}
      board={board}
      strava={strava}
      today={todayIsoDate()}
      investing={
        <InvestingSections
          paper={
            paper
              ? {
                  title: paper.title,
                  version: paper.version,
                  updatedAt: paper.updated_at,
                  markdown: paper.markdown,
                }
              : null
          }
        />
      }
    />
  );
}
