"use server";

import { INVESTING_PAPER_SLUG } from "@/lib/doc-text";
import { listDocumentImageSizes } from "@/lib/document-assets";
import { loadDocument } from "@/lib/documents";

export type InvestingPaperPayload = {
  slug: string;
  title: string;
  version: number;
  updatedAt: string;
  markdown: string;
  images: Record<string, { width: number; height: number }>;
};

/** Paper for the Investing tab. Called after the Diet charts have a chance to paint. */
export async function readInvestingPaper(): Promise<InvestingPaperPayload | null> {
  const [paper, images] = await Promise.all([
    loadDocument(INVESTING_PAPER_SLUG),
    listDocumentImageSizes(INVESTING_PAPER_SLUG),
  ]);
  if (!paper) return null;
  return {
    slug: paper.slug,
    title: paper.title,
    version: paper.version,
    updatedAt: paper.updated_at,
    markdown: paper.markdown,
    images,
  };
}
