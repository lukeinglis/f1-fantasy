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

      <div className="bg-gradient-to-b from-[#4a3728] to-[#3d2b1f] border-b-4 border-amber-500 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="shrink-0" style={{ fontFamily: "var(--font-bangers)" }}>
            <span className="text-red-500 text-3xl tracking-wide">F1</span>{" "}
            <span className="text-white text-2xl tracking-wide">Fantasy</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1 text-sm">
            {NAV_LINKS.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== "/" && pathname?.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 uppercase text-xs tracking-wider font-bold rounded-full transition-all ${
                    active
                      ? "bg-amber-400 text-stone-900 shadow-md"
                      : "text-white hover:scale-105 hover:bg-white/10"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 uppercase text-xs tracking-wider font-bold rounded-full transition-all ${
                  pathname?.startsWith("/admin")
                    ? "bg-amber-400 text-stone-900 shadow-md"
                    : "text-amber-400 hover:scale-105 hover:bg-white/10"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-amber-200/70 hidden sm:inline font-medium">
                  {user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="hidden md:block px-3 py-1.5 rounded-full border-2 border-amber-700 text-amber-200 hover:bg-amber-900/50 hover:text-white font-bold text-xs uppercase tracking-wider"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-500 hover:scale-105 font-bold text-xs uppercase tracking-wider sticker transition-transform"
              >
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-1.5 rounded-md hover:bg-white/10 text-white"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {open ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
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
        <nav className="md:hidden bg-gradient-to-b from-[#3d2b1f] to-[#35241a] border-b-2 border-amber-600 px-4 py-3 space-y-2">
          {NAV_LINKS.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname?.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm uppercase tracking-wider font-bold transition-all ${
                  active
                    ? "bg-amber-400 text-stone-900 cartoon-shadow"
                    : "text-white hover:bg-white/10"
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
              className={`block px-4 py-2.5 rounded-xl text-sm uppercase tracking-wider font-bold transition-all ${
                pathname?.startsWith("/admin")
                  ? "bg-amber-400 text-stone-900 cartoon-shadow"
                  : "text-amber-400 hover:bg-white/10"
              }`}
            >
              Admin
            </Link>
          )}
          {user && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-amber-200/70 hover:bg-white/10 uppercase tracking-wider font-bold"
            >
              Sign out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
