import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { resolveRenderedImageSrc } from "@/lib/doc-assets";
import { protectCurrencyDollars } from "@/lib/doc-text";

const schema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), "figure", "figcaption", "img"])],
  attributes: {
    ...defaultSchema.attributes,
    figure: ["className"],
    figcaption: ["className"],
    img: [...(defaultSchema.attributes?.img ?? []), "alt", "src"],
  },
};

function componentsFor(
  slug: string,
  images?: Record<string, { width: number; height: number }>,
): Components {
  return {
    table({ children }) {
      return (
        <div className="doc-table-scroll">
          <table>{children}</table>
        </div>
      );
    },
    th({ children }) {
      return <th className={isNumericText(nodeText(children)) ? "num" : undefined}>{children}</th>;
    },
    td({ children }) {
      return <td className={isNumericText(nodeText(children)) ? "num" : undefined}>{children}</td>;
    },
    img({ src, alt }) {
      const resolved = typeof src === "string" ? resolveRenderedImageSrc(src, slug) : null;
      if (!resolved) return null;
      const size = (typeof src === "string" ? images?.[src] : undefined) ?? images?.[resolved];
      // Document images are stored files or arbitrary remote URLs, so they are not passed through next/image.
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={resolved}
          alt={alt ?? ""}
          className="doc-image"
          loading="lazy"
          decoding="async"
          {...(size ? { width: size.width, height: size.height } : {})}
        />
      );
    },
    a({ href, children }) {
      if (href && /^https?:\/\//i.test(href)) {
        return (
          <a href={href} rel="noreferrer" target="_blank">
            {children}
          </a>
        );
      }
      return <a href={href}>{children}</a>;
    },
  };
}

export function MarkdownDocument({
  markdown,
  slug,
  images,
}: {
  markdown: string;
  slug: string;
  images?: Record<string, { width: number; height: number }>;
}) {
  return (
    <div className="investing-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeSlug, rehypeKatex]}
        components={componentsFor(slug, images)}
      >
        {protectCurrencyDollars(markdown)}
      </ReactMarkdown>
    </div>
  );
}

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    const element = node as { props?: { children?: ReactNode } };
    return nodeText(element.props?.children);
  }
  return "";
}

function isNumericText(value: string): boolean {
  const text = value.replace(/\u00a0/g, " ").trim();
  if (text === "" || text === "—" || text === "-" || text === "–") return false;
  return /^[±+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s*(?:%|pp|km|kcal|kg))?$/.test(text);
}
