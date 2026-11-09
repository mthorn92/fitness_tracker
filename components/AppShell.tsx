import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-28 pt-5 sm:px-6 md:border-x md:border-line">
        {children}
      </div>
      <Suspense>
        <BottomNav />
      </Suspense>
    </div>
  );
}
