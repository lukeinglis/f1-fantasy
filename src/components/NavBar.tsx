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
    <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-lg shrink-0">
          <span className="text-red-500">F1</span> Fantasy
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
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  active
                    ? "bg-red-600 text-white"
                    : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-md transition-colors ${
                pathname?.startsWith("/admin")
                  ? "bg-amber-600 text-white"
                  : "text-amber-400 hover:bg-zinc-800"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-zinc-400 hidden sm:inline">
                {user.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="hidden md:block px-3 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800"
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
            className="md:hidden p-1.5 rounded-md hover:bg-zinc-800"
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

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-zinc-800 px-4 py-2 space-y-1">
          {NAV_LINKS.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/" && pathname?.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm ${
                  active
                    ? "bg-red-600 text-white"
                    : "text-zinc-300 hover:bg-zinc-800"
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
              className={`block px-3 py-2 rounded-md text-sm ${
                pathname?.startsWith("/admin")
                  ? "bg-amber-600 text-white"
                  : "text-amber-400 hover:bg-zinc-800"
              }`}
            >
              Admin
            </Link>
          )}
          {user && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Sign out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
