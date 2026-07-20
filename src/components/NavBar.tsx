"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

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
              style={{ fontFamily: "var(--font-f1-bold)" }}
            >
              F1
            </span>
            <span
              className="text-white text-xl"
              style={{ fontFamily: "var(--font-f1-bold)" }}
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

          {/* Auth */}
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
          </div>
        </div>
      </div>
    </header>
  );
}
