import { MarkdownDocument } from "@/components/MarkdownDocument";
import { markdownBody } from "@/lib/doc-text";
import { formatUpdatedLabel } from "@/lib/format";

export type InvestingPaper = {
  title: string;
  version: number;
  updatedAt: string;
  markdown: string;
};

/**
 * Tiles on the Investing tab. The paper is the first one.
 * Add another `<section className="card">` in this list for performance
 * or a daily note; each section is one tile.
 */
export function InvestingSections({ paper }: { paper: InvestingPaper | null }) {
  return (
    <div className="investing-sections" data-tab-group="investing">
      <ResearchPaperTile paper={paper} />
    </div>
  );
}

function ResearchPaperTile({ paper }: { paper: InvestingPaper | null }) {
  return (
    <section className="card investing-paper" data-tile="paper" aria-labelledby="investing-paper-title">
      {paper ? <PaperBody paper={paper} /> : <EmptyPaper />}
    </section>
  );
}

function PaperBody({ paper }: { paper: InvestingPaper }) {
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
      <MarkdownDocument markdown={markdownBody(paper.markdown, paper.title)} />
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
