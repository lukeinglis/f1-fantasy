import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import { getCurrentSeason } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const season = await getCurrentSeason();

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
        <h1
          className="text-3xl text-stone-900"
          style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          <span className="text-red-700">Prediction</span> Challenge
        </h1>
        <p className="text-stone-700 mt-1 text-sm">
          A separate challenge: predict the top 10 race finishers. Earn 5 points for exact position, 2 for off-by-1, 1 for off-by-2.
        </p>
      </header>

      {/* Next race to predict */}
      {nextRace && (
        <Link
          href={`/races/${nextRace.id}`}
          className="block card-paper border-2 border-stone-400 rounded-xl p-5 hover:border-red-600 transition-colors cartoon-shadow"
        >
          <div
            className="text-xs uppercase tracking-wider text-stone-500 mb-1 font-bold"
            style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.1em" }}
          >
            Next prediction
          </div>
          <div className="text-lg font-semibold text-stone-800">
            R{nextRace.round}: {nextRace.name}
          </div>
          {nextRace.country && (
            <div className="text-sm text-stone-500">{nextRace.country}</div>
          )}
          <div className="text-sm text-red-700 font-bold mt-2">
            Submit your prediction &rarr;
          </div>
        </Link>
      )}

      {/* Overall leaderboard */}
      {rows.length > 0 && (
        <section>
          <h2
            className="text-xl mb-3 text-stone-900"
            style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
          >
            Season Standings
          </h2>
          <div className="overflow-x-auto wood-panel border-4 border-[#2a1f15] rounded-2xl cartoon-shadow">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2a1f15] text-amber-300/70 uppercase text-xs tracking-wide">
                  <th className="text-left px-4 py-3 w-12" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>#</th>
                  <th className="text-left px-4 py-3" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Player</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>
                    Exact
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>
                    Close
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>
                    Best race
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>
                    Races
                  </th>
                  <th className="text-right px-4 py-3" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className={`border-t border-[#2a1f15]/50 hover:bg-white/5 ${
                      i === 0 && r.totalPoints > 0
                        ? "bg-amber-900/20"
                        : i % 2 === 0
                          ? "bg-white/[0.03]"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-3 tabular-nums">
                      {i === 0 && r.totalPoints > 0 ? (
                        <span className="text-amber-300 font-bold text-base">🏆 {i + 1}</span>
                      ) : i === 1 && r.totalPoints > 0 ? (
                        <span className="text-stone-300 font-bold">🥈 {i + 1}</span>
                      ) : i === 2 && r.totalPoints > 0 ? (
                        <span className="text-amber-700 font-bold">🥉 {i + 1}</span>
                      ) : (
                        <span className="text-amber-100/50">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-amber-50">{r.userName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400 hidden sm:table-cell">
                      {r.exactMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-yellow-400 hidden sm:table-cell">
                      {r.closeMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-100/60 hidden sm:table-cell">
                      {r.bestRace > 0 ? r.bestRace : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-100/40 hidden sm:table-cell">
                      {r.racesScored}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-white text-base">
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
        <section className="card-paper border-2 border-stone-400 rounded-xl p-6 text-center cartoon-shadow">
          <p className="text-stone-600">
            No predictions submitted yet. Head to a{" "}
            <Link href="/races" className="text-red-700 hover:underline font-bold">
              race page
            </Link>{" "}
            to make your first prediction.
          </p>
        </section>
      )}

      {/* Race-by-race breakdown */}
      {rows.length > 0 && (
        <section>
          <h2
            className="text-xl mb-3 text-stone-900"
            style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
          >
            Race by Race
          </h2>
          <div className="overflow-x-auto wood-panel border-4 border-[#2a1f15] rounded-2xl cartoon-shadow">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2a1f15] text-amber-300/70 uppercase text-xs tracking-wide">
                  <th
                    className="text-left px-4 py-3 sticky left-0 z-10 bg-[#2a1f15]"
                    style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}
                  >
                    Race
                  </th>
                  {rows.map((r) => (
                    <th
                      key={r.userId}
                      className="text-center px-3 py-3 whitespace-nowrap"
                      style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}
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
                  .map((race, raceIdx) => (
                    <tr
                      key={race.id}
                      className={`border-t border-[#2a1f15]/50 hover:bg-white/5 ${
                        raceIdx % 2 === 0 ? "bg-white/[0.03]" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 z-10 wood-panel">
                        <Link
                          href={`/races/${race.id}`}
                          className="text-amber-100 hover:text-red-400 transition-colors"
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
                              <span className="font-bold text-white">
                                {score}
                              </span>
                            ) : predicted ? (
                              <span className="text-amber-100/40 text-xs">
                                &#9679;
                              </span>
                            ) : (
                              <span className="text-amber-100/20">&mdash;</span>
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
