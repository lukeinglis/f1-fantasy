import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import { teamColor, teamShort, teamTextColor } from "@/lib/f1-meta";
import { DriverAvatar } from "@/components/DriverAvatar";
import { ensureSeasonSynced } from "@/lib/autoSync";
import { getCurrentSeason } from "@/lib/data";

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

interface SeasonStat {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  driverId?: string;
  constructorId?: string;
}

function round1(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

async function getStandingsData() {
  await ensureSeasonSynced();
  const season = await getCurrentSeason();

  const [users, scores, races, picks, allScores, predictionScores] =
    await Promise.all([
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

  const usersWithPicks = new Set(picks.map((p) => p.userId));
  const rows = Array.from(m.values())
    .filter((r) => usersWithPicks.has(r.userId))
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

  // Fun stats
  const stats: SeasonStat[] = [];

  if (allScores.length > 0) {
    const best = allScores.reduce((a, b) =>
      a.totalPoints > b.totalPoints ? a : b,
    );
    if (best.totalPoints > 0) {
      stats.push({
        label: "Best single race",
        value: `${best.totalPoints} pts`,
        sub: `${best.user.name} at R${best.race.round}`,
        color: "text-amber-600",
      });
    }
  }

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
  const topDriverEntry = Array.from(driverCounts.entries()).sort(
    (a, b) => b[1].count - a[1].count,
  )[0];
  if (topDriverEntry) {
    stats.push({
      label: "Most picked driver",
      value: topDriverEntry[1].name,
      sub: `${topDriverEntry[1].count} picks`,
      color: "text-emerald-700",
      driverId: topDriverEntry[0],
    });
  }

  const consCounts = new Map<
    string,
    { name: string; id: string; count: number }
  >();
  for (const p of picks) {
    if (!p.team) continue;
    const key = p.team.id;
    const existing = consCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      consCounts.set(key, { name: p.team.name, id: p.team.id, count: 1 });
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
      constructorId: topCons.id,
    });
  }

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
        color: "text-red-600",
      });
    }
  }

  return {
    season,
    rows,
    predictionRows,
    racesScored: racesScoredCount,
    activeRaceCount: activeRaces.length,
    stats,
  };
}

const STAT_ICONS = ["\u{1F3C6}", "\u{1F3CE}\u{FE0F}", "\u{1F527}", "\u{1F525}"];

export default async function StandingsPage() {
  const { season, rows, predictionRows, racesScored, activeRaceCount, stats } =
    await getStandingsData();
  const noLeague = rows.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-4xl sm:text-5xl text-[var(--color-oil-stain)]"
          style={{ fontFamily: "var(--font-f1-bold)" }}
        >
          Standings
        </h1>
        <p className="text-sm text-[var(--color-garage-metal)] mt-1">
          {season} Season &middot; {racesScored}/{activeRaceCount} races scored
        </p>
      </div>

      {/* Fun stats */}
      {stats.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <div key={s.label} className="garage-card text-center">
              <div className="text-lg mb-1" aria-hidden="true">
                {STAT_ICONS[i % STAT_ICONS.length]}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-garage-metal)] font-bold mb-1">
                {s.label}
              </div>
              {s.driverId ? (
                <div className="flex items-center justify-center gap-2">
                  <DriverAvatar driverId={s.driverId} size={24} />
                  <span className="text-lg font-bold text-[var(--color-oil-stain)]">
                    {s.value}
                  </span>
                </div>
              ) : s.constructorId ? (
                <span
                  className="inline-block px-2 py-0.5 rounded text-sm font-bold"
                  style={{
                    backgroundColor: teamColor(s.constructorId),
                    color: teamTextColor(s.constructorId),
                  }}
                >
                  {s.value}
                </span>
              ) : (
                <div className="text-lg font-bold text-[var(--color-oil-stain)]">
                  {s.value}
                </div>
              )}
              {s.sub && (
                <div className="text-xs text-[var(--color-garage-metal)] mt-0.5">
                  {s.sub}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Fantasy Picks Standings */}
      <section>
        <h2
          className="text-2xl mb-3 text-[var(--color-oil-stain)]"
          style={{ fontFamily: "var(--font-f1-bold)" }}
        >
          Fantasy Picks Standings
        </h2>
        {noLeague ? (
          <div className="garage-card">
            <p className="text-[var(--color-garage-metal)]">No players yet.</p>
            <Link href="/register" className="garage-button-primary mt-3 inline-block">
              Create the first account
            </Link>
          </div>
        ) : (
          <div className="whiteboard overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-xs tracking-wide">
                  <th
                    className="text-left px-4 py-3 w-12"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    #
                  </th>
                  <th
                    className="text-left px-4 py-3"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Player
                  </th>
                  <th
                    className="text-right px-4 py-3 hidden sm:table-cell"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Driver
                  </th>
                  <th
                    className="text-right px-4 py-3 hidden sm:table-cell"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Constructor
                  </th>
                  <th
                    className="text-right px-4 py-3 hidden sm:table-cell"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Races
                  </th>
                  <th
                    className="text-right px-4 py-3"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className={
                      i === 0 && r.totalPoints > 0
                        ? "bg-[var(--color-racing-yellow)]/10 font-semibold"
                        : i % 2 === 0
                          ? "bg-[var(--color-whiteboard)]"
                          : "bg-[var(--color-garage-wall)]"
                    }
                  >
                    <td className="px-4 py-3 tabular-nums text-[var(--color-oil-stain)]">
                      {i === 0 && r.totalPoints > 0 ? (
                        <span className="text-[var(--color-racing-yellow)] font-bold text-base">
                          <span aria-hidden="true" className="text-sm">
                            &#9733;
                          </span>{" "}
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-[var(--color-garage-metal)]">
                          {i + 1}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-oil-stain)]">
                      {r.userName}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-garage-metal)] hidden sm:table-cell">
                      {r.driverPoints}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-garage-metal)] hidden sm:table-cell">
                      {r.constructorPoints}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-garage-metal)] hidden sm:table-cell">
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
        )}
      </section>

      {/* Prediction Standings */}
      {predictionRows.length > 0 && (
        <section>
          <h2
            className="text-2xl mb-3 text-[var(--color-oil-stain)]"
            style={{ fontFamily: "var(--font-f1-bold)" }}
          >
            Prediction Standings
          </h2>
          <div className="whiteboard overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-xs tracking-wide">
                  <th
                    className="text-left px-4 py-3 w-12"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    #
                  </th>
                  <th
                    className="text-left px-4 py-3"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Player
                  </th>
                  <th
                    className="text-right px-4 py-3 hidden sm:table-cell"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Exact
                  </th>
                  <th
                    className="text-right px-4 py-3 hidden sm:table-cell"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Close
                  </th>
                  <th
                    className="text-right px-4 py-3 hidden sm:table-cell"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Races
                  </th>
                  <th
                    className="text-right px-4 py-3"
                    style={{ fontFamily: "var(--font-russo-one)" }}
                  >
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictionRows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className={
                      i === 0 && r.totalPoints > 0
                        ? "bg-[var(--color-racing-yellow)]/10 font-semibold"
                        : i % 2 === 0
                          ? "bg-[var(--color-whiteboard)]"
                          : "bg-[var(--color-garage-wall)]"
                    }
                  >
                    <td className="px-4 py-3 tabular-nums text-[var(--color-oil-stain)]">
                      {i === 0 && r.totalPoints > 0 ? (
                        <span className="text-[var(--color-racing-yellow)] font-bold text-base">
                          <span aria-hidden="true" className="text-sm">
                            &#9733;
                          </span>{" "}
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-[var(--color-garage-metal)]">
                          {i + 1}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-oil-stain)]">
                      {r.userName}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 hidden sm:table-cell">
                      {r.exactMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 hidden sm:table-cell">
                      {r.closeMatches}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-garage-metal)] hidden sm:table-cell">
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

      {/* Link to grid */}
      <div className="text-center">
        <Link
          href="/grid"
          className="inline-block garage-button-secondary text-sm"
          style={{ fontFamily: "var(--font-russo-one)" }}
        >
          View full season grid &rarr;
        </Link>
      </div>
    </div>
  );
}
