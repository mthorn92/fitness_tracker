"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/log", label: "Log", icon: LogIcon },
  { href: "/body", label: "Charts", icon: ChartsIcon },
  { href: "/recovery", label: "Recover", icon: RecoverIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <ul className="pointer-events-auto mx-auto flex max-w-[40rem] items-center justify-between rounded-[14px] border border-line bg-surface px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                className={`flex flex-col items-center gap-0.5 rounded-[10px] px-2 py-1.5 text-[11px] font-semibold touch-manipulation ${
                  active ? "bg-surface-2 text-accent" : "text-muted"
                }`}
              >
                <Icon />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DashboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 5h11v14H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 9h5M11 13h5M11 17h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChartsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M6 15.5 10 11l3 3 5-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="15.5" r="1.2" fill="currentColor" opacity="0.35" />
      <circle cx="10" cy="11" r="1.2" fill="currentColor" opacity="0.35" />
      <circle cx="13" cy="14" r="1.2" fill="currentColor" opacity="0.35" />
      <circle cx="18" cy="7" r="1.2" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function RecoverIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 13h3l2-5 3 10 2-6h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
