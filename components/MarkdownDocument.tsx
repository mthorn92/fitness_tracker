import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { protectCurrencyDollars } from "@/lib/doc-text";

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "figure", "figcaption"],
  attributes: {
    ...defaultSchema.attributes,
    figure: ["className"],
    figcaption: ["className"],
  },
};

const components: Components = {
  table({ children }) {
    return (
      <div className="doc-table-scroll">
        <table>{children}</table>
      </div>
    );
  },
  img({ src, alt }) {
    if (typeof src === "string" && /^https?:\/\//i.test(src)) {
      // Document images are arbitrary remote URLs, so they are not passed through next/image.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={alt ?? ""} className="doc-image" />;
    }
    return null;
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

export function MarkdownDocument({ markdown }: { markdown: string }) {
  return (
    <div className="investing-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeSlug, rehypeKatex]}
        components={components}
      >
        {protectCurrencyDollars(markdown)}
      </ReactMarkdown>
    </div>
  );
}
