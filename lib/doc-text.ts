/** Slug of the research paper shown on the Investing tab. */
export const INVESTING_PAPER_SLUG = "quad-strategy";

/** Markdown text cap. About 2 MB of typical UTF-8. */
export const MAX_MARKDOWN_CHARS = 2_000_000;

/** Raw JSON body cap, a little above the markdown cap for quoting. */
export const MAX_BODY_BYTES = 2_500_000;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(value: string): string | null {
  const slug = value.trim().toLowerCase();
  if (slug.length < 1 || slug.length > 80 || !SLUG.test(slug)) return null;
  return slug;
}

export function normalizeMarkdown(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

/** First `# heading`, or the slug when the file has none. */
export function titleFromMarkdown(markdown: string, slug: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  const heading = match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  if (heading.length > 0 && heading.length <= 200) return heading;
  return slug;
}

/**
 * Drop a leading `# title` when it repeats the stored title, so the tile
 * heading and the paper do not say the same thing twice.
 */
export function markdownBody(markdown: string, title: string): string {
  const match = /^#\s+([^\n]+)\n/.exec(markdown);
  if (!match) return markdown;
  const heading = match[1].replace(/\s+/g, " ").trim();
  if (heading !== title.trim()) return markdown;
  return markdown.slice(match[0].length).replace(/^\n+/, "");
}

/** `undefined` means omitted. `null` means the value was present but not usable. */
export function parseDocumentTitle(value: unknown): string | null | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") return null;
  const title = value.trim();
  if (title.length < 1 || title.length > 200) return null;
  return title;
}

/** Whole number, 1 or more. `undefined` means omitted. `null` means invalid. */
export function parseDocumentVersion(value: unknown): number | null | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000_000) return null;
  return parsed;
}

export function bodyTooLarge(raw: string, contentLength: number | null): boolean {
  if (contentLength != null && contentLength > MAX_BODY_BYTES) return true;
  return Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES;
}

/**
 * Keep `$...$` / `$$...$$` math, and escape the `$` used for dollars and
 * tickers (`$176,608`, `$XJO`, `A$70k`) so they stay text.
 */
export function protectCurrencyDollars(markdown: string): string {
  const masks: string[] = [];
  const mask = (value: string) => {
    masks.push(value);
    return `\u0000${masks.length - 1}\u0000`;
  };
  let text = markdown.replace(/```[\s\S]*?```/g, mask);
  text = text.replace(/`[^`\n]*`/g, mask);
  text = text.replace(/\$\$[\s\S]*?\$\$/g, mask);

  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "$" || text[i - 1] === "\\") {
      out += ch;
      continue;
    }
    if (text[i + 1] === "$") {
      out += "\\$";
      continue;
    }
    if (isCurrencyOrTicker(text, i)) {
      out += "\\$";
      continue;
    }
    const close = findInlineClose(text, i + 1);
    if (close === -1) {
      out += "\\$";
      continue;
    }
    const inner = text.slice(i + 1, close);
    if (looksLikeMath(inner)) {
      out += text.slice(i, close + 1);
      i = close;
      continue;
    }
    out += "\\$";
  }

  return out.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => masks[Number(index)] ?? "");
}

function isCurrencyOrTicker(text: string, index: number): boolean {
  const prev = index > 0 ? text[index - 1] : "";
  if (/[A-Za-z]/.test(prev)) return true;
  const rest = text.slice(index + 1);
  if (/^\d/.test(rest)) return true;
  return /^[A-Z][A-Z0-9.+-]{1,14}(?![A-Za-z0-9(])/.test(rest);
}

function findInlineClose(text: string, from: number): number {
  const end = Math.min(text.length, from + 500);
  for (let j = from; j < end; j++) {
    if (text[j] === "\n") return -1;
    if (text[j] === "$" && text[j - 1] !== "\\") return j;
  }
  return -1;
}

function looksLikeMath(inner: string): boolean {
  const t = inner.trim();
  if (t.length === 0 || t.length > 400) return false;
  if (/[\\^_=]/.test(t) || /[A-Za-z]\{/.test(t)) return true;
  if (/^[A-Za-z]$/.test(t)) return true;
  if (/^[A-Za-z0-9()[\]+\-*/.,\s]+$/.test(t) && /[()+\-*/]/.test(t)) {
    const words = t.split(/\s+/).filter((word) => /[A-Za-z]{4,}/.test(word));
    return words.length < 3;
  }
  return false;
}
