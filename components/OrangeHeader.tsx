import Link from "next/link";
import { DateStrip } from "@/components/DateStrip";
import type { DateNav } from "@/lib/types";

type OrangeHeaderProps = {
  title?: string;
  dateNav?: DateNav;
  dateBasePath?: string;
};

export function OrangeHeader({ title, dateNav, dateBasePath = "/" }: OrangeHeaderProps) {
  return (
    <header className="header-wave border-b border-line px-4 pb-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
        <Link
          href="/body"
          aria-label="Charts"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-accent"
        >
          <ScaleIcon />
        </Link>
        {dateNav ? (
          <DateStrip nav={dateNav} basePath={dateBasePath} />
        ) : (
          <h1 className="text-center text-lg font-semibold text-foreground">{title}</h1>
        )}
        <p className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-[9px] font-bold uppercase leading-tight tracking-wide text-muted">
          DB
        </p>
      </div>
    </header>
  );
}

function ScaleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 12 16 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}
