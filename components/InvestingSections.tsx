"use client";

import { useEffect, useState, type ComponentType } from "react";
import { DASHBOARD_TAB_EVENT } from "@/components/dashboard-tab";
import { markdownBody } from "@/lib/doc-text";
import { formatUpdatedLabel } from "@/lib/format";
import { readInvestingPaper, type InvestingPaperPayload } from "@/lib/investing-paper";

type MarkdownProps = {
  markdown: string;
  slug: string;
  images?: Record<string, { width: number; height: number }>;
};

type PaperState =
  | { status: "idle" }
  | { status: "ready"; paper: InvestingPaperPayload }
  | { status: "empty" }
  | { status: "error" };

/**
 * Tiles on the Investing tab. The paper is the first one.
 * Add another `<section className="card">` in this list for performance
 * or a daily note; each section is one tile.
 *
 * The note is not part of the Diet document. It loads when this tab is shown,
 * so the charts do not wait on it.
 */
export function InvestingSections() {
  const [state, setState] = useState<PaperState>({ status: "idle" });
  const [Doc, setDoc] = useState<ComponentType<MarkdownProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let running = false;

    const load = () => {
      if (cancelled || running) return;
      const tab = document.querySelector("main.dashboard")?.getAttribute("data-tab");
      if (tab !== "investing") return;
      running = true;
      void Promise.all([import("@/components/MarkdownDocument"), readInvestingPaper()]).then(
        ([mod, paper]) => {
          if (cancelled) return;
          setDoc(() => mod.MarkdownDocument);
          setState(paper ? { status: "ready", paper } : { status: "empty" });
        },
        () => {
          if (cancelled) return;
          setState({ status: "error" });
        },
      );
    };

    load();
    document.addEventListener(DASHBOARD_TAB_EVENT, load);
    return () => {
      cancelled = true;
      document.removeEventListener(DASHBOARD_TAB_EVENT, load);
    };
  }, []);

  return (
    <div className="investing-sections" data-tab-group="investing">
      <section className="card investing-paper" data-tile="paper" aria-labelledby="investing-paper-title">
        {state.status === "ready" && Doc ? (
          <PaperBody paper={state.paper} Doc={Doc} />
        ) : state.status === "empty" ? (
          <EmptyPaper />
        ) : state.status === "error" ? (
          <PaperError />
        ) : (
          <PendingPaper />
        )}
      </section>
    </div>
  );
}

function PaperBody({
  paper,
  Doc,
}: {
  paper: InvestingPaperPayload;
  Doc: ComponentType<MarkdownProps>;
}) {
  const updated = new Date(paper.updatedAt);
  const updatedLabel = Number.isNaN(updated.getTime()) ? paper.updatedAt : formatUpdatedLabel(updated);
  return (
    <>
      <div className="tile-heading">
        <h2 id="investing-paper-title">{paper.title}</h2>
      </div>
      <p className="doc-meta">
        Version {paper.version} · Last updated {updatedLabel}
      </p>
      <Doc slug={paper.slug} markdown={markdownBody(paper.markdown, paper.title)} images={paper.images} />
    </>
  );
}

function PendingPaper() {
  return (
    <div className="tile-heading">
      <h2 id="investing-paper-title">Research</h2>
    </div>
  );
}

function PaperError() {
  return (
    <>
      <div className="tile-heading">
        <h2 id="investing-paper-title">Research</h2>
      </div>
      <p className="note">The paper couldn&apos;t be loaded.</p>
    </>
  );
}

function EmptyPaper() {
  return (
    <>
      <div className="tile-heading">
        <h2 id="investing-paper-title">Research</h2>
      </div>
      <div className="doc-empty">
        <p>No research paper has been uploaded yet.</p>
        <p className="note">When one is sent to this tab, it will show up here. More sections can be added later.</p>
      </div>
    </>
  );
}
