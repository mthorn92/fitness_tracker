import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      { source: "/log", destination: "/", permanent: false },
      { source: "/body", destination: "/", permanent: false },
      { source: "/recovery", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Keep the Next.js dev indicator off the page.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
