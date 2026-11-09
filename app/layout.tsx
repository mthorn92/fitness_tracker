import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Training log",
    template: "%s · Training log",
  },
  description: "A mobile-first personal fitness dashboard.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "Training log",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ee9a3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${nunito.className} min-h-full bg-background text-foreground`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
