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

function componentsFor(slug: string): Components {
  return {
    table({ children }) {
      return (
        <div className="doc-table-scroll">
          <table>{children}</table>
        </div>
      );
    },
    img({ src, alt }) {
      const resolved = typeof src === "string" ? resolveRenderedImageSrc(src, slug) : null;
      if (!resolved) return null;
      // Document images are stored files or arbitrary remote URLs, so they are not passed through next/image.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={resolved} alt={alt ?? ""} className="doc-image" />;
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

export function MarkdownDocument({ markdown, slug }: { markdown: string; slug: string }) {
  return (
    <div className="investing-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeSlug, rehypeKatex]}
        components={componentsFor(slug)}
      >
        {protectCurrencyDollars(markdown)}
      </ReactMarkdown>
    </div>
  );
}
