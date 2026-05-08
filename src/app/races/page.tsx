import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isPreSeasonRound, FIRST_ACTIVE_ROUND } from "@/lib/season";

export const dynamic = "force-dynamic";

function shortDate(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function RacesPage() {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2025);
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
  const preSeasonRaces = races.filter((r) => isPreSeasonRound(r.round));
  const scoredCount = activeRaces.filter((r) => r.resultsLocked).length;

  // Find the next upcoming active race for highlight
  const nextRaceIdx = activeRaces.findIndex(
    (r) => r.pickDeadline.getTime() > now.getTime(),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{season} Race Calendar</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          {scoredCount} of {activeRaces.length} races scored.{" "}
          {nextRaceIdx >= 0
            ? `Next up: Round ${activeRaces[nextRaceIdx].round}.`
            : "Season complete."}
        </p>
      </header>

      {races.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <p>
            No races loaded yet. Admin: go to{" "}
            <Link href="/admin" className="text-red-400 underline">
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
                  className={`bg-zinc-900 border rounded-lg p-4 transition-colors flex justify-between items-center gap-4 ${
                    isNext
                      ? "border-red-600/60 ring-1 ring-red-600/20"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`tabular-nums text-sm font-mono w-8 shrink-0 ${
                        r.resultsLocked
                          ? "text-zinc-600"
                          : isNext
                            ? "text-red-400 font-bold"
                            : "text-zinc-500"
                      }`}
                    >
                      R{r.round}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`font-semibold truncate ${
                          r.resultsLocked ? "text-zinc-400" : ""
                        }`}
                      >
                        {r.name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {r.country ? `${r.country} / ` : ""}
                        {shortDate(r.date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.resultsLocked ? (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800">
                        Scored
                      </span>
                    ) : past ? (
                      <span className="text-xs px-2 py-1 rounded bg-amber-900/40 text-amber-300 border border-amber-800">
                        Awaiting results
                      </span>
                    ) : hasPick ? (
                      <span className="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800">
                        Pick set
                      </span>
                    ) : isNext ? (
                      <span className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 border border-red-800 font-medium">
                        Pick now
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Open
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pre-season races */}
          {preSeasonRaces.length > 0 && (
            <details className="bg-zinc-900/40 border border-zinc-800 rounded-lg">
              <summary className="px-4 py-3 text-sm text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none">
                Pre-season: Rounds 1&ndash;{FIRST_ACTIVE_ROUND - 1} (before the league started)
              </summary>
              <div className="grid gap-1 p-2">
                {preSeasonRaces.map((r) => (
                  <Link
                    key={r.id}
                    href={`/races/${r.id}`}
                    className="bg-zinc-800/30 border border-zinc-800/50 rounded-lg px-4 py-2.5 flex justify-between items-center gap-4 text-zinc-500 hover:text-zinc-400 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="tabular-nums text-sm font-mono w-8 shrink-0">
                        R{r.round}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate text-sm">
                          {r.name}
                        </div>
                        <div className="text-xs mt-0.5">
                          {r.country ? `${r.country} / ` : ""}
                          {shortDate(r.date)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-zinc-800/50 border border-zinc-700/50">
                      Pre-season
                    </span>
                  </Link>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
