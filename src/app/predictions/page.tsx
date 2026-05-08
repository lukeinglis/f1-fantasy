import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2026);

  const [users, races, predictionScores, predictionCounts] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.race.findMany({
      where: { season },
      orderBy: { round: "asc" },
      select: {
        id: true,
        round: true,
        name: true,
        country: true,
        pickDeadline: true,
        resultsLocked: true,
      },
    }),
    prisma.predictionScore.findMany({
      where: { race: { season } },
      select: {
        userId: true,
        raceId: true,
        totalPoints: true,
        exactMatches: true,
        closeMatches: true,
      },
    }),
    prisma.prediction.groupBy({
      by: ["userId", "raceId"],
      where: { race: { season } },
      _count: { id: true },
    }),
  ]);

  const activeRaces = races.filter((r) => !isPreSeasonRound(r.round));
  const now = new Date();

  // Build leaderboard
  const board = new Map<
    string,
    {
      userId: string;
      userName: string;
      totalPoints: number;
      exactMatches: number;
      closeMatches: number;
      racesScored: number;
      bestRace: number;
    }
  >();

  for (const u of users) {
    board.set(u.id, {
      userId: u.id,
      userName: u.name,
      totalPoints: 0,
      exactMatches: 0,
      closeMatches: 0,
      racesScored: 0,
      bestRace: 0,
    });
  }

  for (const ps of predictionScores) {
    const row = board.get(ps.userId);
    if (!row) continue;
    row.totalPoints += ps.totalPoints;
    row.exactMatches += ps.exactMatches;
    row.closeMatches += ps.closeMatches;
    row.racesScored += 1;
    if (ps.totalPoints > row.bestRace) row.bestRace = ps.totalPoints;
  }

  const rows = Array.from(board.values())
    .filter((r) => r.racesScored > 0 || predictionCounts.some((pc) => pc.userId === r.userId))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Build per-race data: who predicted, what scores
  const predCountByUserRace = new Map<string, number>();
  for (const pc of predictionCounts) {
    predCountByUserRace.set(`${pc.userId}:${pc.raceId}`, pc._count.id);
  }

  const predScoreByUserRace = new Map<string, number>();
  for (const ps of predictionScores) {
    predScoreByUserRace.set(`${ps.userId}:${ps.raceId}`, ps.totalPoints);
  }

  // Next race needing predictions
  const nextRace = activeRaces.find((r) => r.pickDeadline > now);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">
          <span className="text-red-500">Prediction</span> Challenge
        </h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Predict the top 10 finishing order before each race.
          Exact position = 5 pts, off by 1 = 2 pts, off by 2 = 1 pt.
        </p>
      </header>

      {/* Next race to predict */}
      {nextRace && (
        <Link
          href={`/races/${nextRace.id}`}
          className="block bg-gradient-to-r from-zinc-900 to-red-950/30 border border-zinc-800 rounded-lg p-5 hover:border-red-800/50 transition-colors"
        >
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
            Next prediction
          </div>
          <div className="text-lg font-semibold">
            R{nextRace.round}: {nextRace.name}
          </div>
          {nextRace.country && (
            <div className="text-sm text-zinc-400">{nextRace.country}</div>
          )}
          <div className="text-sm text-red-400 mt-2">
            Submit your prediction &rarr;
          </div>
        </Link>
      )}

      {/* Overall leaderboard */}
      {rows.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Season Standings</h2>
          <div className="overflow-x-auto bg-zinc-900 border border-zinc-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 w-12">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    Exact
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    Close
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    Best race
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    Races
                  </th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className={`border-t border-zinc-800 hover:bg-zinc-800/30 ${
                      i === 0 && r.totalPoints > 0 ? "bg-amber-900/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3 tabular-nums">
                      {i === 0 && r.totalPoints > 0 ? (
                        <span className="text-amber-400 font-bold">{i + 1}</span>
                      ) : i < 3 && r.totalPoints > 0 ? (
                        <span className="text-zinc-300 font-bold">{i + 1}</span>
                      ) : (
                        <span className="text-zinc-500">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.userName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400 hidden sm:table-cell">
                      {r.exactMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-yellow-400 hidden sm:table-cell">
                      {r.closeMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300 hidden sm:table-cell">
                      {r.bestRace > 0 ? r.bestRace : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500 hidden sm:table-cell">
                      {r.racesScored}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-red-400">
                      {r.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rows.length === 0 && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <p className="text-zinc-400">
            No predictions submitted yet. Head to a{" "}
            <Link href="/races" className="text-red-400 hover:underline">
              race page
            </Link>{" "}
            to make your first prediction.
          </p>
        </section>
      )}

      {/* Race-by-race breakdown */}
      {rows.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Race by Race</h2>
          <div className="overflow-x-auto bg-zinc-900 border border-zinc-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 sticky left-0 bg-zinc-900 z-10">
                    Race
                  </th>
                  {rows.map((r) => (
                    <th
                      key={r.userId}
                      className="text-center px-3 py-3 whitespace-nowrap"
                    >
                      {r.userName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRaces
                  .filter(
                    (race) =>
                      race.pickDeadline <= now ||
                      predictionCounts.some((pc) => pc.raceId === race.id),
                  )
                  .map((race) => (
                    <tr
                      key={race.id}
                      className="border-t border-zinc-800 hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 bg-zinc-900 z-10">
                        <Link
                          href={`/races/${race.id}`}
                          className="hover:text-red-400 transition-colors"
                        >
                          R{race.round}
                        </Link>
                      </td>
                      {rows.map((player) => {
                        const key = `${player.userId}:${race.id}`;
                        const predicted = predCountByUserRace.has(key);
                        const score = predScoreByUserRace.get(key);

                        return (
                          <td
                            key={player.userId}
                            className="text-center px-3 py-2.5 tabular-nums"
                          >
                            {score !== undefined ? (
                              <span className="font-bold text-red-400">
                                {score}
                              </span>
                            ) : predicted ? (
                              <span className="text-zinc-500 text-xs">
                                &#9679;
                              </span>
                            ) : (
                              <span className="text-zinc-700">&mdash;</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
