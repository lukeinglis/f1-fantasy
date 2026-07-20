import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import { getCurrentSeason } from "@/lib/data";
import { teamColor, teamShort, teamTextColor } from "@/lib/f1-meta";
import { DriverAvatar } from "@/components/DriverAvatar";

export const dynamic = "force-dynamic";

interface DriverPopularity {
  driverId: string;
  driverName: string;
  code: string;
  count: number;
}

interface ConsPopularity {
  constructorId: string;
  name: string;
  count: number;
}

interface PlayerBudget {
  userName: string;
  driversUsed: number;
  driversExhausted: number;
  totalDriverSlots: number;
  constructorsUsed: number;
  constructorsExhausted: number;
  totalConstructorSlots: number;
}

interface RaceScore {
  round: number;
  raceName: string;
  userName: string;
  totalPoints: number;
}

async function getStatsData() {
  const league = await prisma.league.findFirst();
  const season = await getCurrentSeason();
  const maxDriver = league?.maxDriverPicks ?? 2;
  const maxConstructor = league?.maxConstructorPicks ?? 3;

  const [users, races, picks, scores, drivers, constructors] =
    await Promise.all([
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
          resultsLocked: true,
        },
      }),
      prisma.pick.findMany({
        where: { race: { season } },
        include: {
          driver: {
            select: {
              id: true,
              familyName: true,
              givenName: true,
              code: true,
            },
          },
          team: { select: { id: true, name: true } },
        },
      }),
      prisma.score.findMany({
        where: { race: { season } },
        include: {
          user: { select: { id: true, name: true } },
          race: { select: { round: true, name: true } },
        },
      }),
      prisma.driver.findMany({ select: { id: true } }),
      prisma.team.findMany({ select: { id: true } }),
    ]);

  const activeRaces = races.filter((r) => !isPreSeasonRound(r.round));

  // Driver popularity
  const driverCounts = new Map<
    string,
    { name: string; code: string; count: number }
  >();
  for (const p of picks) {
    if (!p.driver) continue;
    const key = p.driver.id;
    const existing = driverCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      driverCounts.set(key, {
        name: `${p.driver.givenName} ${p.driver.familyName}`,
        code: p.driver.code ?? p.driver.familyName.substring(0, 3).toUpperCase(),
        count: 1,
      });
    }
  }
  const driverPopularity: DriverPopularity[] = Array.from(
    driverCounts.entries(),
  )
    .map(([driverId, d]) => ({
      driverId,
      driverName: d.name,
      code: d.code,
      count: d.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Constructor popularity
  const consCounts = new Map<string, { name: string; count: number }>();
  for (const p of picks) {
    if (!p.team) continue;
    const key = p.team.id;
    const existing = consCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      consCounts.set(key, { name: p.team.name, count: 1 });
    }
  }
  const consPopularity: ConsPopularity[] = Array.from(consCounts.entries())
    .map(([constructorId, c]) => ({
      constructorId,
      name: c.name,
      count: c.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Player budgets
  const playerBudgets: PlayerBudget[] = users.map((u) => {
    const userPicks = picks.filter((p) => p.userId === u.id);
    const driverUsage = new Map<string, number>();
    const consUsage = new Map<string, number>();
    for (const p of userPicks) {
      if (p.driverId)
        driverUsage.set(
          p.driverId,
          (driverUsage.get(p.driverId) ?? 0) + 1,
        );
      if (p.teamId)
        consUsage.set(p.teamId, (consUsage.get(p.teamId) ?? 0) + 1);
    }

    const driversExhausted = Array.from(driverUsage.values()).filter(
      (v) => v >= maxDriver,
    ).length;
    const constructorsExhausted = Array.from(consUsage.values()).filter(
      (v) => v >= maxConstructor,
    ).length;

    return {
      userName: u.name,
      driversUsed: driverUsage.size,
      driversExhausted,
      totalDriverSlots: drivers.length,
      constructorsUsed: consUsage.size,
      constructorsExhausted,
      totalConstructorSlots: constructors.length,
    };
  });

  // Best and worst individual race scores
  const activeRaceIds = new Set(activeRaces.map((r) => r.id));
  const activeScores = scores.filter((s) => activeRaceIds.has(s.raceId));

  let bestRace: RaceScore | null = null;
  let worstRace: RaceScore | null = null;

  for (const s of activeScores) {
    const entry: RaceScore = {
      round: s.race.round,
      raceName: s.race.name,
      userName: s.user.name,
      totalPoints: s.totalPoints,
    };
    if (!bestRace || s.totalPoints > bestRace.totalPoints) bestRace = entry;
    if (!worstRace || s.totalPoints < worstRace.totalPoints) worstRace = entry;
  }

  // Per-race average scores (for trend)
  const raceAverages: { round: number; name: string; avg: number }[] = [];
  for (const r of activeRaces) {
    const rScores = activeScores.filter((s) => s.raceId === r.id);
    if (rScores.length === 0) continue;
    const avg =
      rScores.reduce((sum, s) => sum + s.totalPoints, 0) / rScores.length;
    raceAverages.push({
      round: r.round,
      name: r.name,
      avg: Math.round(avg * 10) / 10,
    });
  }

  // Head-to-head: wins by player
  const raceWins = new Map<string, number>();
  for (const r of activeRaces) {
    const rScores = activeScores.filter((s) => s.raceId === r.id);
    if (rScores.length === 0) continue;
    const best = rScores.reduce((a, b) =>
      a.totalPoints > b.totalPoints ? a : b,
    );
    if (best.totalPoints > 0) {
      raceWins.set(
        best.user.name,
        (raceWins.get(best.user.name) ?? 0) + 1,
      );
    }
  }
  const winsLeaderboard = Array.from(raceWins.entries())
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins);

  return {
    season,
    scoredRaces: activeRaces.filter((r) => r.resultsLocked).length,
    totalActiveRaces: activeRaces.length,
    driverPopularity,
    consPopularity,
    playerBudgets,
    bestRace,
    worstRace,
    raceAverages,
    winsLeaderboard,
    maxDriver,
    maxConstructor,
  };
}

const STAT_ROTATIONS = ["-rotate-1", "rotate-[1deg]", "-rotate-[0.5deg]", "rotate-[1.5deg]"];

export default async function StatsPage() {
  const data = await getStatsData();

  return (
    <div className="space-y-8">
      <header>
        <h1
          className="text-3xl text-stone-900"
          style={{ fontFamily: "var(--font-f1-bold)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          Season <span className="text-red-700">Stats</span>
        </h1>
        <p className="text-[var(--color-garage-metal)] mt-1 text-sm">
          {data.scoredRaces} of {data.totalActiveRaces} active races scored.
        </p>
      </header>

      {/* Highlight cards */}
      <section className="garage-card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.bestRace && (
            <StatCard
              label="Best single race"
              value={`${data.bestRace.totalPoints} pts`}
              sub={`${data.bestRace.userName}, R${data.bestRace.round}`}
              color="text-amber-700"
              rotation={STAT_ROTATIONS[0]}
            />
          )}
          {data.worstRace && data.scoredRaces > 0 && (
            <StatCard
              label="Lowest race score"
              value={`${data.worstRace.totalPoints} pts`}
              sub={`${data.worstRace.userName}, R${data.worstRace.round}`}
              color="text-stone-600"
              rotation={STAT_ROTATIONS[1]}
            />
          )}
          {data.winsLeaderboard[0] && (
            <StatCard
              label="Most race wins"
              value={`${data.winsLeaderboard[0].wins}`}
              sub={data.winsLeaderboard[0].name}
              color="text-emerald-700"
              rotation={STAT_ROTATIONS[2]}
            />
          )}
          {data.raceAverages.length > 0 && (
            <StatCard
              label="Average race score"
              value={`${(data.raceAverages.reduce((s, r) => s + r.avg, 0) / data.raceAverages.length).toFixed(1)}`}
              sub="across all players"
              color="text-blue-700"
              rotation={STAT_ROTATIONS[3]}
            />
          )}
        </div>
      </section>

      {/* Race wins leaderboard */}
      {data.winsLeaderboard.length > 0 && (
        <section className="garage-card">
          <h2
            className="text-lg mb-3 text-stone-800"
            style={{ fontFamily: "var(--font-f1-bold)" }}
          >
            Race wins
          </h2>
          <div className="space-y-2">
            {data.winsLeaderboard.map((w, i) => {
              const maxWins = data.winsLeaderboard[0].wins;
              const pct = maxWins > 0 ? (w.wins / maxWins) * 100 : 0;
              return (
                <div key={w.name} className="flex items-center gap-3">
                  <span className="text-stone-500 text-sm w-4 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium w-28 truncate text-stone-800">
                    {w.name}
                  </span>
                  <div className="flex-1 bg-stone-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-red-700 tabular-nums w-8 text-right">
                    {w.wins}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Average scores per race */}
      {data.raceAverages.length > 0 && (
        <section className="garage-card">
          <h2
            className="text-lg mb-3 text-stone-800"
            style={{ fontFamily: "var(--font-f1-bold)" }}
          >
            Average score by race
          </h2>
          <div className="space-y-1.5">
            {data.raceAverages.map((r) => {
              const maxAvg = Math.max(...data.raceAverages.map((x) => x.avg));
              const pct = maxAvg > 0 ? (r.avg / maxAvg) * 100 : 0;
              return (
                <div key={r.round} className="flex items-center gap-3">
                  <span className="text-stone-500 text-xs w-8 tabular-nums font-mono">
                    R{r.round}
                  </span>
                  <div className="flex-1 bg-stone-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-stone-700 tabular-nums w-12 text-right">
                    {r.avg}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Driver & Constructor popularity */}
      <div className="grid sm:grid-cols-2 gap-4">
        {data.driverPopularity.length > 0 && (
          <section className="garage-card">
            <h2
              className="text-lg mb-3 text-stone-800"
              style={{ fontFamily: "var(--font-f1-bold)" }}
            >
              Driver popularity
            </h2>
            <div className="space-y-1.5">
              {data.driverPopularity.slice(0, 10).map((d) => {
                const maxPick = data.driverPopularity[0].count;
                const pct = maxPick > 0 ? (d.count / maxPick) * 100 : 0;
                return (
                  <div key={d.driverId} className="flex items-center gap-2">
                    <DriverAvatar driverId={d.driverId} size={20} />
                    <span className="text-xs font-mono text-stone-500 w-10">
                      {d.code}
                    </span>
                    <div className="flex-1 bg-stone-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-stone-700 tabular-nums w-6 text-right">
                      {d.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {data.consPopularity.length > 0 && (
          <section className="garage-card">
            <h2
              className="text-lg mb-3 text-stone-800"
              style={{ fontFamily: "var(--font-f1-bold)" }}
            >
              Constructor popularity
            </h2>
            <div className="space-y-1.5">
              {data.consPopularity.map((c) => {
                const maxPick = data.consPopularity[0].count;
                const pct = maxPick > 0 ? (c.count / maxPick) * 100 : 0;
                return (
                  <div
                    key={c.constructorId}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded w-10 text-center"
                      style={{
                        backgroundColor: teamColor(c.constructorId),
                        color: teamTextColor(c.constructorId),
                      }}
                    >
                      {teamShort(c.constructorId)}
                    </span>
                    <div className="flex-1 bg-stone-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: teamColor(c.constructorId),
                          width: `${pct}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-stone-700 tabular-nums w-6 text-right">
                      {c.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Player budgets */}
      {data.playerBudgets.length > 0 && (
        <section className="whiteboard rounded-2xl overflow-hidden">
          <h2
            className="text-lg p-4 border-b border-[var(--color-garage-metal)]/20 text-[var(--color-oil-stain)]"
            style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.03em" }}
          >
            Pick budget remaining
          </h2>
          <p className="text-xs text-[var(--color-garage-metal)] px-4 pt-2">
            How many unique drivers/constructors each player has used vs exhausted.
            Max {data.maxDriver} uses per driver, {data.maxConstructor} per constructor.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-xs tracking-wide">
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Player</th>
                  <th className="text-right px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Drivers used</th>
                  <th className="text-right px-4 py-2 hidden sm:table-cell" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Exhausted</th>
                  <th className="text-right px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Constructors used</th>
                  <th className="text-right px-4 py-2 hidden sm:table-cell" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Exhausted</th>
                </tr>
              </thead>
              <tbody>
                {data.playerBudgets.map((b, i) => (
                  <tr
                    key={b.userName}
                    className={`border-t border-[var(--color-garage-metal)]/20 hover:bg-[var(--color-garage-wall)]/50`}
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--color-oil-stain)]">{b.userName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-oil-stain)]/70">
                      {b.driversUsed}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums hidden sm:table-cell">
                      {b.driversExhausted > 0 ? (
                        <span className="text-[var(--color-racing-red)]">
                          {b.driversExhausted}
                        </span>
                      ) : (
                        <span className="text-[var(--color-garage-metal)]/30">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-oil-stain)]/70">
                      {b.constructorsUsed}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums hidden sm:table-cell">
                      {b.constructorsExhausted > 0 ? (
                        <span className="text-[var(--color-racing-red)]">
                          {b.constructorsExhausted}
                        </span>
                      ) : (
                        <span className="text-[var(--color-garage-metal)]/30">0</span>
                      )}
                    </td>
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

function StatCard({
  label,
  value,
  sub,
  color,
  rotation,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  rotation?: string;
}) {
  return (
    <div className={`garage-card ${rotation ?? ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1 font-bold" style={{ fontFamily: "var(--font-f1-bold)" }}>
        {label}
      </div>
      <div className={`text-xl font-bold ${color ?? "text-stone-800"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-stone-600 mt-0.5 font-medium">{sub}</div>}
    </div>
  );
}
