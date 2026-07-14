import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }
  if (role !== "admin") {
    return (
      <div className="garage-card p-6">
        <h1 className="text-xl font-semibold text-stone-800">Admin only</h1>
        <p className="text-[var(--color-garage-metal)] mt-1">
          This page is only available to the league admin.
        </p>
      </div>
    );
  }

  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2026);
  const races = await prisma.race.findMany({
    where: { season },
    orderBy: { round: "asc" },
    include: {
      results: { select: { id: true } },
    },
  });
  const drivers = await prisma.driver.findMany({
    orderBy: [{ familyName: "asc" }],
    select: { id: true, givenName: true, familyName: true, code: true },
  });
  const constructors = await prisma.team.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1
          className="text-3xl text-stone-900"
          style={{ fontFamily: "var(--font-f1-bold)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          Admin
        </h1>
        <p className="text-[var(--color-garage-metal)] mt-1">
          Sync calendar/grid from jolpica, pull race results, or enter results manually.
        </p>
      </header>
      <AdminPanel
        season={season}
        races={races.map((r) => ({
          id: r.id,
          round: r.round,
          name: r.name,
          date: r.date.toISOString(),
          resultsLocked: r.resultsLocked,
          hasResults: r.results.length > 0,
        }))}
        drivers={drivers}
        constructors={constructors}
      />
    </div>
  );
}
