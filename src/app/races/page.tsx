import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isPreSeasonRound } from "@/lib/season";
import { getCurrentSeason } from "@/lib/data";

export const dynamic = "force-dynamic";

function shortDate(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function RacesPage() {
  const season = await getCurrentSeason();
  const races = await prisma.race.findMany({
    where: { season },
    orderBy: { round: "asc" },
  });
  const session = await auth();
  const myUserId = session?.user?.id;

  const myPicks = myUserId
    ? await prisma.pick.findMany({
        where: { userId: myUserId },
        select: { raceId: true, driverId: true, teamId: true },
      })
    : [];
  const pickByRace = new Map(myPicks.map((p) => [p.raceId, p]));

  const now = new Date();

  const activeRaces = races.filter((r) => !isPreSeasonRound(r.round));
  const scoredCount = activeRaces.filter((r) => r.resultsLocked).length;

  // Find the next upcoming active race for highlight
  const nextRaceIdx = activeRaces.findIndex(
    (r) => r.pickDeadline.getTime() > now.getTime(),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1
          className="text-3xl text-[var(--color-oil-stain)]"
          style={{ fontFamily: "var(--font-permanent-marker)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          {season} Race Calendar
        </h1>
        <p className="text-[var(--color-garage-metal)] mt-1 text-sm">
          {scoredCount} of {activeRaces.length} races scored.{" "}
          {nextRaceIdx >= 0
            ? `Next up: Round ${activeRaces[nextRaceIdx].round}.`
            : "Season complete."}
        </p>
      </header>

      {races.length === 0 ? (
        <div className="garage-card">
          <p className="text-[var(--color-garage-metal)]">
            No races loaded yet. Admin: go to{" "}
            <Link href="/admin" className="text-[var(--color-racing-red)] underline font-bold">
              Admin
            </Link>{" "}
            and click &quot;Sync season&quot;.
          </p>
        </div>
      ) : (
        <>
          {/* Active races */}
          <div className="grid gap-2">
            {activeRaces.map((r, idx) => {
              const past = r.pickDeadline.getTime() < now.getTime();
              const myPick = pickByRace.get(r.id);
              const hasPick = !!(myPick?.driverId && myPick?.teamId);
              const isNext = idx === nextRaceIdx;

              return (
                <Link
                  key={r.id}
                  href={`/races/${r.id}`}
                  className={`garage-card transition-colors flex justify-between items-center gap-4 ${
                    isNext
                      ? "border-[var(--color-racing-red)] ring-1 ring-[var(--color-racing-red)]/30"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`tabular-nums text-sm font-mono w-8 shrink-0 ${
                        r.resultsLocked
                          ? "text-[var(--color-garage-metal)]"
                          : isNext
                            ? "text-[var(--color-racing-red)] font-bold"
                            : "text-[var(--color-garage-metal)]"
                      }`}
                    >
                      R{r.round}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`font-semibold truncate ${
                          r.resultsLocked ? "text-[var(--color-garage-metal)]" : "text-[var(--color-oil-stain)]"
                        }`}
                      >
                        {r.name}
                      </div>
                      <div className="text-xs text-[var(--color-garage-metal)] mt-0.5">
                        {r.country ? `${r.country} / ` : ""}
                        {shortDate(r.date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.resultsLocked ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold garage-badge">
                        Scored
                      </span>
                    ) : past ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-bold garage-badge">
                        Awaiting
                      </span>
                    ) : hasPick ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold garage-badge">
                        Pick set
                      </span>
                    ) : isNext ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-600 text-white font-bold garage-badge">
                        Pick now
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-stone-400 text-white font-bold garage-badge">
                        Open
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

        </>
      )}
    </div>
  );
}
