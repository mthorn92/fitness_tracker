import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col md:border-x md:border-line">
        {children}
      </div>
      <Suspense>
        <BottomNav />
      </Suspense>
    </div>
  );
}
