"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today", icon: TodayIcon },
  { href: "/log", label: "Log", icon: LogIcon },
  { href: "/recovery", label: "Recover", icon: RecoverIcon },
  { href: "/body", label: "Body", icon: BodyIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/92 backdrop-blur-md md:inset-x-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2">
      <ul className="grid w-full grid-cols-4 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] tracking-wide touch-manipulation ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon active={active} />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function LogIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {active ? <circle cx="18" cy="17" r="1.4" fill="currentColor" /> : null}
    </svg>
  );
}

function RecoverIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 13h3l2-5 3 10 2-6h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active ? <circle cx="19" cy="7" r="1.4" fill="currentColor" /> : null}
    </svg>
  );
}

function BodyIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 10.5h10l-1.2 8.5H8.2L7 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 10.5V8.8a3 3 0 0 1 6 0v1.7" stroke="currentColor" strokeWidth="1.6" />
      {active ? <circle cx="12" cy="14.5" r="1.2" fill="currentColor" /> : null}
    </svg>
  );
}
