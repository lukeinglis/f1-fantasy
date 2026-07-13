"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavUser {
  name: string;
  email: string;
  role: string;
}

const NAV_LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/grid", label: "Grid" },
  { href: "/races", label: "Races" },
  { href: "/picks", label: "My Picks" },
  { href: "/predictions", label: "Predictions" },
  { href: "/stats", label: "Stats" },
  { href: "/rules", label: "Rules" },
];

export default function NavBar({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10">
      {/* Checkerboard racing stripe */}
      <div className="racing-stripe" />

      <div className="bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border-b-[3px] border-amber-700/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-[var(--font-heading)] tracking-tight text-xl shrink-0" style={{ fontFamily: "var(--font-russo-one)" }}>
            <span className="text-red-500 text-2xl">F1</span>{" "}
            <span className="text-stone-200">Fantasy</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-0.5 text-sm">
            {NAV_LINKS.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== "/" && pathname?.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 uppercase text-xs tracking-wider font-medium border-b-2 transition-colors ${
                    active
                      ? "border-amber-400 text-amber-300"
                      : "border-transparent text-stone-400 hover:text-stone-200 hover:border-stone-600"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 uppercase text-xs tracking-wider font-medium border-b-2 transition-colors ${
                  pathname?.startsWith("/admin")
                    ? "border-amber-400 text-amber-300"
                    : "border-transparent text-amber-500 hover:text-amber-300 hover:border-amber-700"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-stone-500 hidden sm:inline">
                  {user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="hidden md:block px-3 py-1.5 rounded-md border border-stone-700 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-1.5 rounded-md hover:bg-stone-800"
              aria-label="Toggle menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {open ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden bg-stone-900 border-b border-stone-700 px-4 py-2 space-y-1">
          {NAV_LINKS.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname?.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm uppercase tracking-wider ${
                  active
                    ? "bg-stone-800 text-amber-300 border-l-2 border-amber-400"
                    : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm uppercase tracking-wider ${
                pathname?.startsWith("/admin")
                  ? "bg-stone-800 text-amber-300 border-l-2 border-amber-400"
                  : "text-amber-500 hover:bg-stone-800 hover:text-amber-300"
              }`}
            >
              Admin
            </Link>
          )}
          {user && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-stone-400 hover:bg-stone-800"
            >
              Sign out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
