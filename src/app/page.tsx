import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import { teamShort } from "@/lib/f1-meta";
import Countdown from "@/components/Countdown";
import { ensureSeasonSynced } from "@/lib/autoSync";

export const dynamic = "force-dynamic";

interface BoardRow {
  userId: string;
  userName: string;
  totalPoints: number;
  driverPoints: number;
  constructorPoints: number;
  racesScored: number;
}

interface PredictionBoardRow {
  userId: string;
  userName: string;
  totalPoints: number;
  exactMatches: number;
  closeMatches: number;
  racesScored: number;
}

interface NextRaceInfo {
  name: string;
  country: string | null;
  round: number;
  deadline: string;
}

interface SeasonStat {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

async function getHomeData() {
  await ensureSeasonSynced();
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2026);

  const [users, scores, races, picks, allScores, predictionScores] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.score.findMany({
      where: { race: { season } },
      select: {
        userId: true,
        raceId: true,
        driverPoints: true,
        constructorPoints: true,
        totalPoints: true,
      },
    }),
    prisma.race.findMany({
      where: { season },
      orderBy: { round: "asc" },
      select: {
        id: true,
        round: true,
        name: true,
        country: true,
        date: true,
        pickDeadline: true,
        resultsLocked: true,
      },
    }),
    prisma.pick.findMany({
      where: { race: { season } },
      include: {
        driver: { select: { id: true, familyName: true, code: true } },
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.score.findMany({
      where: { race: { season } },
      include: {
        user: { select: { name: true } },
        race: { select: { round: true, name: true } },
      },
    }),
    prisma.predictionScore.findMany({
      where: { race: { season } },
      select: {
        userId: true,
        totalPoints: true,
        exactMatches: true,
        closeMatches: true,
      },
    }),
  ]);

  const totalRaces = races.length;
  const activeRaces = races.filter((r) => !isPreSeasonRound(r.round));
  const racesScoredCount = activeRaces.filter((r) => r.resultsLocked).length;

  // Leaderboard
  const m = new Map<string, BoardRow>();
  for (const u of users) {
    m.set(u.id, {
      userId: u.id,
      userName: u.name,
      totalPoints: 0,
      driverPoints: 0,
      constructorPoints: 0,
      racesScored: 0,
    });
  }
  for (const s of scores) {
    const r = m.get(s.userId);
    if (!r) continue;
    r.totalPoints += s.totalPoints;
    r.driverPoints += s.driverPoints;
    r.constructorPoints += s.constructorPoints;
    r.racesScored += 1;
  }

  const rows = Array.from(m.values())
    .map((r) => ({
      ...r,
      totalPoints: round1(r.totalPoints),
      driverPoints: round1(r.driverPoints),
      constructorPoints: round1(r.constructorPoints),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Prediction leaderboard
  const pm = new Map<string, PredictionBoardRow>();
  for (const u of users) {
    pm.set(u.id, {
      userId: u.id,
      userName: u.name,
      totalPoints: 0,
      exactMatches: 0,
      closeMatches: 0,
      racesScored: 0,
    });
  }
  for (const ps of predictionScores) {
    const r = pm.get(ps.userId);
    if (!r) continue;
    r.totalPoints += ps.totalPoints;
    r.exactMatches += ps.exactMatches;
    r.closeMatches += ps.closeMatches;
    r.racesScored += 1;
  }
  const predictionRows = Array.from(pm.values())
    .filter((r) => r.racesScored > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Next race
  const now = new Date();
  const nextRace = races.find((r) => r.pickDeadline > now && !isPreSeasonRound(r.round));
  const nextRaceInfo: NextRaceInfo | null = nextRace
    ? {
        name: nextRace.name,
        country: nextRace.country,
        round: nextRace.round,
        deadline: nextRace.pickDeadline.toISOString(),
      }
    : null;

  // Fun stats
  const stats: SeasonStat[] = [];

  // Best single-race score
  if (allScores.length > 0) {
    const best = allScores.reduce((a, b) =>
      a.totalPoints > b.totalPoints ? a : b,
    );
    if (best.totalPoints > 0) {
      stats.push({
        label: "Best single race",
        value: `${best.totalPoints} pts`,
        sub: `${best.user.name} at R${best.race.round}`,
        color: "text-amber-400",
      });
    }
  }

  // Most popular driver pick
  const driverCounts = new Map<string, { name: string; count: number }>();
  for (const p of picks) {
    if (!p.driver) continue;
    const key = p.driver.id;
    const existing = driverCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      driverCounts.set(key, {
        name: p.driver.code ?? p.driver.familyName,
        count: 1,
      });
    }
  }
  const topDriver = Array.from(driverCounts.values()).sort(
    (a, b) => b.count - a.count,
  )[0];
  if (topDriver) {
    stats.push({
      label: "Most picked driver",
      value: topDriver.name,
      sub: `${topDriver.count} picks`,
      color: "text-emerald-400",
    });
  }

  // Most popular constructor
  const consCounts = new Map<string, { name: string; id: string; count: number }>();
  for (const p of picks) {
    if (!p.team) continue;
    const key = p.team.id;
    const existing = consCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      consCounts.set(key, {
        name: p.team.name,
        id: p.team.id,
        count: 1,
      });
    }
  }
  const topCons = Array.from(consCounts.values()).sort(
    (a, b) => b.count - a.count,
  )[0];
  if (topCons) {
    stats.push({
      label: "Most picked constructor",
      value: teamShort(topCons.id),
      sub: `${topCons.count} picks`,
      color: "text-blue-400",
    });
  }

  // Race winner streak (consecutive best scores)
  const raceWinners: { userId: string; raceId: string }[] = [];
  const scoredRaceIds = [...new Set(allScores.map((s) => s.raceId))];
  for (const rid of scoredRaceIds) {
    const raceScores = allScores.filter((s) => s.raceId === rid);
    if (raceScores.length === 0) continue;
    const best = raceScores.reduce((a, b) =>
      a.totalPoints > b.totalPoints ? a : b,
    );
    if (best.totalPoints > 0) {
      raceWinners.push({ userId: best.userId, raceId: rid });
    }
  }
  if (raceWinners.length >= 2) {
    // Check for streak from the end
    const streakUser = raceWinners[raceWinners.length - 1]?.userId;
    let streak = 0;
    for (let i = raceWinners.length - 1; i >= 0; i--) {
      if (raceWinners[i].userId === streakUser) {
        streak++;
      } else {
        break;
      }
    }
    if (streak >= 2) {
      const streakName = users.find((u) => u.id === streakUser)?.name ?? "?";
      stats.push({
        label: "Hot streak",
        value: `${streak} wins`,
        sub: streakName,
        color: "text-red-400",
      });
    }
  }

  return {
    season,
    rows,
    predictionRows,
    racesScored: racesScoredCount,
    totalRaces,
    activeRaceCount: activeRaces.length,
    nextRace: nextRaceInfo,
    stats,
  };
}

function round1(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export default async function HomePage() {
  const {
    season,
    rows,
    predictionRows,
    racesScored,
    activeRaceCount,
    nextRace,
    stats,
  } = await getHomeData();
  const noLeague = rows.length === 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/30 border border-zinc-800 rounded-xl p-6 sm:p-8">
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="text-red-500">F1</span> Fantasy League
          </h1>
          <p className="text-zinc-400 mt-2 max-w-lg text-sm sm:text-base">
            Pick a driver and a constructor each race. Use them wisely: each
            driver can only be picked twice and each constructor three times
            per season.
          </p>

          {/* Next race countdown */}
          {nextRace && (
            <div className="mt-5 p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg inline-block">
              <div className="text-sm font-medium text-zinc-300 mb-1">
                R{nextRace.round}: {nextRace.name}
                {nextRace.country && (
                  <span className="text-zinc-500"> / {nextRace.country}</span>
                )}
              </div>
              <Countdown
                targetDate={nextRace.deadline}
                label="Pick deadline"
              />
            </div>
          )}

          <div className="flex items-center gap-6 mt-5">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{season}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">
                Season
              </div>
            </div>
            <div className="w-px h-8 bg-zinc-700" />
            <div className="text-center">
              <div className="text-2xl font-bold">
                {racesScored}
                <span className="text-zinc-500 text-lg">/{activeRaceCount}</span>
              </div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">
                Races scored
              </div>
            </div>
            <div className="w-px h-8 bg-zinc-700" />
            <div className="text-center">
              <div className="text-2xl font-bold">{rows.length}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide">
                Players
              </div>
            </div>
          </div>
        </div>
        {/* Decorative */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-3xl" />
      </section>

      {/* Fun stats */}
      {stats.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                {s.label}
              </div>
              <div className={`text-xl font-bold ${s.color ?? "text-white"}`}>
                {s.value}
              </div>
              {s.sub && (
                <div className="text-xs text-zinc-400 mt-0.5">{s.sub}</div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Leaderboard */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Standings</h2>
        {noLeague ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <p>No players yet.</p>
            <Link
              href="/register"
              className="mt-3 inline-block px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            >
              Create the first account
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto bg-zinc-900 border border-zinc-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50 text-zinc-400 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 w-12">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    Driver pts
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">
                    Constructor pts
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
                        <span className="text-amber-400 font-bold">
                          {i + 1}
                        </span>
                      ) : i < 3 && r.totalPoints > 0 ? (
                        <span className="text-zinc-300 font-bold">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-zinc-500">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.userName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300 hidden sm:table-cell">
                      {r.driverPoints}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300 hidden sm:table-cell">
                      {r.constructorPoints}
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
        )}
      </section>

      {/* Prediction leaderboard */}
      {predictionRows.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">
            Prediction Standings
          </h2>
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
                    Races
                  </th>
                  <th className="text-right px-4 py-3">Points</th>
                </tr>
              </thead>
              <tbody>
                {predictionRows.map((r, i) => (
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

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/grid"
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
        >
          Season grid
        </Link>
        <Link
          href="/races"
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          Race calendar
        </Link>
        <Link
          href="/picks"
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          My picks
        </Link>
        <Link
          href="/stats"
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          Stats
        </Link>
        <Link
          href="/rules"
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          How to play
        </Link>
      </div>
    </div>
  );
}
