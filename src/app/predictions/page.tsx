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
          className="text-3xl text-[var(--color-oil-stain)]"
          style={{ fontFamily: "var(--font-f1-bold)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          <span className="text-[var(--color-racing-red)]">Prediction</span> Challenge
        </h1>
        <p className="text-[var(--color-garage-metal)] mt-1 text-sm">
          A separate challenge: predict the top 10 race finishers. Earn 5 points for exact position, 2 for off-by-1, 1 for off-by-2.
        </p>
      </header>

      {/* Next race to predict */}
      {nextRace && (
        <Link
          href={`/races/${nextRace.id}`}
          className="block garage-card hover:border-[var(--color-racing-red)] transition-colors"
        >
          <div
            className="text-xs uppercase tracking-wider text-[var(--color-garage-metal)] mb-1 font-bold"
            style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.1em" }}
          >
            Next prediction
          </div>
          <div className="text-lg font-semibold text-[var(--color-oil-stain)]">
            R{nextRace.round}: {nextRace.name}
          </div>
          {nextRace.country && (
            <div className="text-sm text-[var(--color-garage-metal)]">{nextRace.country}</div>
          )}
          <div className="text-sm text-[var(--color-racing-red)] font-bold mt-2">
            Submit your prediction &rarr;
          </div>
        </Link>
      )}

      {/* Overall leaderboard */}
      {rows.length > 0 && (
        <section>
          <h2
            className="text-xl mb-3 text-[var(--color-oil-stain)]"
            style={{ fontFamily: "var(--font-f1-bold)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
          >
            Season Standings
          </h2>
          <div className="overflow-x-auto whiteboard rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-xs tracking-wide">
                  <th className="text-left px-4 py-3 w-12" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>#</th>
                  <th className="text-left px-4 py-3" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Player</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>
                    Exact
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>
                    Close
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>
                    Best race
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>
                    Races
                  </th>
                  <th className="text-right px-4 py-3" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className={`border-t border-[var(--color-garage-metal)]/20 hover:bg-[var(--color-garage-wall)]/50 ${
                      i === 0 && r.totalPoints > 0
                        ? "bg-[var(--color-racing-yellow)]/15"
                        : i % 2 === 0
                          ? "even:bg-[var(--color-whiteboard)]"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-3 tabular-nums">
                      {i === 0 && r.totalPoints > 0 ? (
                        <span className="text-[var(--color-racing-yellow)] font-bold text-base">🏆 {i + 1}</span>
                      ) : i === 1 && r.totalPoints > 0 ? (
                        <span className="text-[var(--color-garage-metal)] font-bold">🥈 {i + 1}</span>
                      ) : i === 2 && r.totalPoints > 0 ? (
                        <span className="text-amber-700 font-bold">🥉 {i + 1}</span>
                      ) : (
                        <span className="text-[var(--color-garage-metal)]">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-oil-stain)]">{r.userName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 hidden sm:table-cell">
                      {r.exactMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-yellow-600 hidden sm:table-cell">
                      {r.closeMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-garage-metal)] hidden sm:table-cell">
                      {r.bestRace > 0 ? r.bestRace : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-garage-metal)]/60 hidden sm:table-cell">
                      {r.racesScored}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-[var(--color-oil-stain)] text-base">
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
        <section className="garage-card text-center">
          <p className="text-[var(--color-garage-metal)]">
            No predictions submitted yet. Head to a{" "}
            <Link href="/races" className="text-[var(--color-racing-red)] hover:underline font-bold">
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
            className="text-xl mb-3 text-[var(--color-oil-stain)]"
            style={{ fontFamily: "var(--font-f1-bold)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
          >
            Race by Race
          </h2>
          <div className="overflow-x-auto whiteboard rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-xs tracking-wide">
                  <th
                    className="text-left px-4 py-3 sticky left-0 z-10 bg-[var(--color-garage-metal-dark)]"
                    style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}
                  >
                    Race
                  </th>
                  {rows.map((r) => (
                    <th
                      key={r.userId}
                      className="text-center px-3 py-3 whitespace-nowrap"
                      style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}
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
                      className={`border-t border-[var(--color-garage-metal)]/20 hover:bg-[var(--color-garage-wall)]/50 ${
                        raceIdx % 2 === 0 ? "bg-[var(--color-whiteboard)]" : "bg-[var(--color-garage-wall)]/30"
                      }`}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 z-10 bg-[var(--color-whiteboard)]">
                        <Link
                          href={`/races/${race.id}`}
                          className="text-[var(--color-oil-stain)] hover:text-[var(--color-racing-red)] transition-colors"
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
                              <span className="font-bold text-[var(--color-oil-stain)]">
                                {score}
                              </span>
                            ) : predicted ? (
                              <span className="text-[var(--color-garage-metal)] text-xs">
                                &#9679;
                              </span>
                            ) : (
                              <span className="text-[var(--color-garage-metal)]/30">&mdash;</span>
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
