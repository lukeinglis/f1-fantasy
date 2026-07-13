import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isPreSeasonRound } from "@/lib/season";

export const dynamic = "force-dynamic";

function shortDate(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function RacesPage() {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2026);
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
          className="text-3xl text-stone-900"
          style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          {season} Race Calendar
        </h1>
        <p className="text-stone-700 mt-1 text-sm">
          {scoredCount} of {activeRaces.length} races scored.{" "}
          {nextRaceIdx >= 0
            ? `Next up: Round ${activeRaces[nextRaceIdx].round}.`
            : "Season complete."}
        </p>
      </header>

      {races.length === 0 ? (
        <div className="card-paper border-2 border-stone-400 rounded-xl p-6 cartoon-shadow">
          <p className="text-stone-600">
            No races loaded yet. Admin: go to{" "}
            <Link href="/admin" className="text-red-700 underline font-bold">
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
                  className={`card-paper border-2 rounded-xl p-4 transition-colors flex justify-between items-center gap-4 cartoon-shadow ${
                    isNext
                      ? "border-red-600 ring-1 ring-red-600/30"
                      : "border-stone-400 hover:border-stone-500"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`tabular-nums text-sm font-mono w-8 shrink-0 ${
                        r.resultsLocked
                          ? "text-stone-400"
                          : isNext
                            ? "text-red-700 font-bold"
                            : "text-stone-500"
                      }`}
                    >
                      R{r.round}
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`font-semibold truncate ${
                          r.resultsLocked ? "text-stone-500" : "text-stone-800"
                        }`}
                      >
                        {r.name}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {r.country ? `${r.country} / ` : ""}
                        {shortDate(r.date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.resultsLocked ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold sticker">
                        Scored
                      </span>
                    ) : past ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-bold sticker">
                        Awaiting
                      </span>
                    ) : hasPick ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold sticker">
                        Pick set
                      </span>
                    ) : isNext ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-600 text-white font-bold sticker">
                        Pick now
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-stone-400 text-white font-bold sticker">
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
