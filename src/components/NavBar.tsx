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
  { href: "/standings", label: "Standings" },
  { href: "/races", label: "Races" },
  { href: "/picks", label: "My Picks" },
  { href: "/predictions", label: "Predictions" },
  { href: "/stats", label: "Stats" },
  { href: "/rules", label: "Rules" },
];

export default function NavBar({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-10">
      <div className="checkered-stripe" />

      <div className="bg-[var(--color-garage-metal-dark)] border-b-2 border-[var(--color-garage-metal)] shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-1.5">
            <span
              className="text-[var(--color-racing-red)] text-2xl"
              style={{ fontFamily: "var(--font-permanent-marker)" }}
            >
              F1
            </span>
            <span
              className="text-white text-xl"
              style={{ fontFamily: "var(--font-permanent-marker)" }}
            >
              Fantasy
            </span>
          </Link>

          {/* Desktop nav — hidden on homepage (garage scene IS the nav) */}
          {!isHome && (
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="px-3 py-1.5 text-[var(--color-racing-yellow)] text-xs uppercase tracking-wider font-bold hover:bg-white/10 rounded transition-colors"
              >
                &larr; Garage
              </Link>
              <span className="w-px h-4 bg-white/20 mx-1" />
              {NAV_LINKS.map((l) => {
                const active = pathname?.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider font-bold rounded transition-colors ${
                      active
                        ? "text-[var(--color-racing-yellow)] border-b-2 border-[var(--color-racing-yellow)]"
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
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider font-bold rounded transition-colors ${
                    pathname?.startsWith("/admin")
                      ? "text-[var(--color-racing-yellow)] border-b-2 border-[var(--color-racing-yellow)]"
                      : "text-[var(--color-racing-yellow)]/70 hover:bg-white/10"
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
          )}

          {/* Auth + mobile hamburger */}
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-white/60 hidden sm:inline text-xs font-medium">
                  {user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="hidden md:block px-3 py-1 rounded border border-white/20 text-white/70 hover:bg-white/10 hover:text-white text-xs uppercase tracking-wider font-bold transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="garage-button-primary text-xs py-1.5 px-4"
              >
                Sign in
              </Link>
            )}

            {/* Mobile hamburger — hidden on homepage */}
            {!isHome && (
              <button
                onClick={() => setOpen(!open)}
                className="md:hidden p-1.5 rounded hover:bg-white/10 text-white"
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
            )}
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {!isHome && open && (
        <nav className="md:hidden bg-[var(--color-garage-metal-dark)] border-b-2 border-[var(--color-garage-metal)] px-4 py-3 space-y-1">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 rounded-lg text-sm text-[var(--color-racing-yellow)] uppercase tracking-wider font-bold hover:bg-white/10"
          >
            &larr; Garage
          </Link>
          {NAV_LINKS.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm uppercase tracking-wider font-bold transition-colors ${
                  active
                    ? "bg-white/10 text-[var(--color-racing-yellow)]"
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
              className={`block px-4 py-2.5 rounded-lg text-sm uppercase tracking-wider font-bold transition-colors ${
                pathname?.startsWith("/admin")
                  ? "bg-white/10 text-[var(--color-racing-yellow)]"
                  : "text-[var(--color-racing-yellow)]/70 hover:bg-white/10"
              }`}
            >
              Admin
            </Link>
          )}
          {user && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-white/50 hover:bg-white/10 uppercase tracking-wider font-bold"
            >
              Sign out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
