"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2" />
      </svg>
    ),
    exact: true,
  },
  {
    href: "/standings",
    label: "Standings",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 19.24 7 20h10c0-.76-.85-1.25-2.03-1.79C14.47 17.98 14 17.55 14 17v-2.34" />
        <path d="M18 2H6v7a6 6 0 1012 0V2z" />
      </svg>
    ),
  },
  {
    href: "/races",
    label: "Races",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
  },
  {
    href: "/picks",
    label: "Picks",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
] satisfies Array<{ href: string; label: string; icon: React.ReactNode; exact?: boolean }>;

const MORE_LINKS = [
  { href: "/grid", label: "Grid" },
  { href: "/predictions", label: "Predictions" },
  { href: "/stats", label: "Stats" },
  { href: "/rules", label: "Rules" },
  { href: "/game", label: "Game" },
  { href: "/admin", label: "Admin" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const moreActive = MORE_LINKS.some((link) => pathname?.startsWith(link.href));

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 md:hidden bg-[var(--color-garage-metal-dark)] border-t-2 border-[var(--color-garage-metal)] pb-safe-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] py-2 px-1 flex-1 text-[10px] uppercase tracking-wider font-bold transition-colors ${
                active
                  ? "text-[var(--color-racing-yellow)] border-t-2 border-[var(--color-racing-yellow)] -mt-[2px]"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}

        <div ref={moreRef} className="relative flex-1">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] py-2 px-1 w-full text-[10px] uppercase tracking-wider font-bold transition-colors ${
              moreActive || moreOpen
                ? "text-[var(--color-racing-yellow)] border-t-2 border-[var(--color-racing-yellow)] -mt-[2px]"
                : "text-white/50 hover:text-white/80"
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="true"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
            <span>More</span>
          </button>

          {moreOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-44 bg-[var(--color-garage-metal-dark)] border border-[var(--color-garage-metal)] rounded-lg shadow-xl overflow-hidden">
              {MORE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={`block px-4 py-3 text-xs uppercase tracking-wider font-bold transition-colors ${
                    pathname?.startsWith(link.href)
                      ? "text-[var(--color-racing-yellow)] bg-white/5"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
