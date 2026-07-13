import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import { teamColor, teamShort, teamTextColor } from "@/lib/f1-meta";
import { DriverAvatar } from "@/components/DriverAvatar";
import Countdown from "@/components/Countdown";
import { ensureSeasonSynced } from "@/lib/autoSync";
import { auth } from "@/lib/auth";
import PickBanner from "@/components/PickBanner";
import F1Game from "@/components/F1Game";

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
  driverId?: string;
  constructorId?: string;
}

interface PickBannerData {
  raceId: string;
  raceName: string;
  raceRound: number;
  drivers: { id: string; code: string | null; givenName: string; familyName: string }[];
  constructors: { id: string; name: string }[];
  currentDriverId: string | null;
  currentConstructorId: string | null;
  driverUses: Record<string, number>;
  constructorUses: Record<string, number>;
  maxDriverPicks: number;
  maxConstructorPicks: number;
}

interface ExistingPickInfo {
  driverCode: string | null;
  driverId: string | null;
  constructorShort: string;
  constructorId: string | null;
  raceId: string;
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
        color: "text-amber-600",
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
      constructorId: topCons.id,
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
        color: "text-red-600",
      });
    }
  }

  // Pick banner: check if logged-in user needs to pick for the next race
  let pickBanner: PickBannerData | null = null;
  let existingPick: ExistingPickInfo | null = null;

  const session = await auth();
  const userId = session?.user?.id as string | undefined;

  if (nextRace && userId) {
    const myPickForNext = await prisma.pick.findUnique({
      where: { userId_raceId: { userId, raceId: nextRace.id } },
      include: {
        driver: { select: { id: true, code: true } },
        team: { select: { id: true } },
      },
    });

    if (myPickForNext && (myPickForNext.driverId || myPickForNext.teamId)) {
      existingPick = {
        driverCode: myPickForNext.driver?.code ?? null,
        driverId: myPickForNext.driver?.id ?? null,
        constructorShort: myPickForNext.team ? teamShort(myPickForNext.team.id) : "—",
        constructorId: myPickForNext.team?.id ?? null,
        raceId: nextRace.id,
      };
    } else {
      const [drivers, constructors, myPicks] = await Promise.all([
        prisma.driver.findMany({ orderBy: { familyName: "asc" } }),
        prisma.team.findMany({ orderBy: { name: "asc" } }),
        prisma.pick.findMany({
          where: { userId },
          select: { driverId: true, teamId: true, raceId: true },
        }),
      ]);

      const driverUses: Record<string, number> = {};
      const constructorUses: Record<string, number> = {};
      for (const p of myPicks) {
        if (p.raceId === nextRace.id) continue;
        if (p.driverId) driverUses[p.driverId] = (driverUses[p.driverId] ?? 0) + 1;
        if (p.teamId) constructorUses[p.teamId] = (constructorUses[p.teamId] ?? 0) + 1;
      }

      pickBanner = {
        raceId: nextRace.id,
        raceName: nextRace.name,
        raceRound: nextRace.round,
        drivers: drivers.map((d) => ({
          id: d.id,
          code: d.code,
          givenName: d.givenName,
          familyName: d.familyName,
        })),
        constructors: constructors.map((c) => ({ id: c.id, name: c.name })),
        currentDriverId: null,
        currentConstructorId: null,
        driverUses,
        constructorUses,
        maxDriverPicks: league?.maxDriverPicks ?? 2,
        maxConstructorPicks: league?.maxConstructorPicks ?? 3,
      };
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
    pickBanner,
    existingPick,
  };
}

function round1(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

const STAT_ROTATIONS = ["-rotate-2", "rotate-[1.5deg]", "-rotate-1", "rotate-2"];
const PIN_COLORS = ["bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-blue-500"];
const STAT_TEXT_COLORS = ["text-red-700", "text-amber-700", "text-emerald-700", "text-blue-700"];

export default async function HomePage() {
  const {
    season,
    rows,
    predictionRows,
    racesScored,
    activeRaceCount,
    nextRace,
    stats,
    pickBanner,
    existingPick,
  } = await getHomeData();
  const noLeague = rows.length === 0;

  return (
    <div className="space-y-8">
      {/* Hero — Cork board with hand-painted sign */}
      <section className="relative overflow-hidden cork-board border-4 border-[#3d2b1f] rounded-3xl cartoon-shadow">
        <div className="p-6 sm:p-8 relative z-10">
          <h1
            className="text-5xl sm:text-6xl tracking-wide -rotate-1"
            style={{
              fontFamily: "var(--font-bangers)",
              textShadow: "2px 2px 0px rgba(0,0,0,0.5)",
            }}
          >
            <span className="text-red-600">F1</span>{" "}
            <span className="text-white">Fantasy League</span>
          </h1>
          <p className="text-stone-800 mt-2 max-w-lg text-sm sm:text-base italic font-medium">
            Pick a driver and a constructor each race. Use them wisely: each
            driver can only be picked twice and each constructor three times
            per season.
          </p>

          {/* Next race countdown — Chalkboard pit board */}
          {nextRace && (
            <div className="mt-5">
              <div className="chalkboard p-4 border-4 border-[#3d2b1f] rounded-xl inline-block cartoon-shadow" style={{ boxShadow: "4px 4px 0px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.2)" }}>
                <div
                  className="text-sm uppercase tracking-widest text-amber-300 font-bold mb-1.5"
                  style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.15em" }}
                >
                  Pit Board
                </div>
                <div className="text-sm font-medium text-white/90 mb-1" style={{ fontFamily: "var(--font-geist-mono)" }}>
                  R{nextRace.round}: {nextRace.name}
                  {nextRace.country && (
                    <span className="text-white/50"> / {nextRace.country}</span>
                  )}
                </div>
                <Countdown
                  targetDate={nextRace.deadline}
                  label="Pick deadline"
                />
              </div>
              {existingPick && (
                <div className="mt-2 text-sm text-stone-800 flex items-center gap-1.5 flex-wrap font-medium">
                  <span>You picked</span>
                  <span className="inline-flex items-center gap-1">
                    {existingPick.driverId && (
                      <DriverAvatar driverId={existingPick.driverId} size={20} />
                    )}
                    <span className="text-stone-900 font-bold">
                      {existingPick.driverCode ?? "—"}
                    </span>
                  </span>
                  <span>+</span>
                  {existingPick.constructorId ? (
                    <span
                      className="px-1.5 py-0.5 rounded text-[11px] font-bold"
                      style={{
                        backgroundColor: teamColor(existingPick.constructorId),
                        color: teamTextColor(existingPick.constructorId),
                      }}
                    >
                      {existingPick.constructorShort}
                    </span>
                  ) : (
                    <span className="text-stone-900 font-bold">—</span>
                  )}
                  <span>for this race</span>
                  <Link
                    href={`/races/${existingPick.raceId}`}
                    className="text-red-700 hover:text-red-600 underline underline-offset-2 font-bold"
                  >
                    Edit
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Season stat badges — stickers on cork board */}
          <div className="flex items-center gap-3 sm:gap-4 mt-5 flex-wrap">
            <div className="text-center bg-red-600 rounded-full px-5 py-3 sticker">
              <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-bangers)" }}>{season}</div>
              <div className="text-[10px] text-red-100 uppercase tracking-widest font-bold">
                Season
              </div>
            </div>
            <div className="text-center bg-amber-500 rounded-full px-5 py-3 sticker">
              <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-bangers)" }}>
                {racesScored}
                <span className="text-amber-100 text-lg">/{activeRaceCount}</span>
              </div>
              <div className="text-[10px] text-amber-100 uppercase tracking-widest font-bold">
                Races
              </div>
            </div>
            <div className="text-center bg-blue-600 rounded-full px-5 py-3 sticker">
              <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-bangers)" }}>{rows.length}</div>
              <div className="text-[10px] text-blue-100 uppercase tracking-widest font-bold">
                Players
              </div>
            </div>
          </div>
        </div>

        {/* Decorative diagonal racing stripe */}
        <div className="absolute top-0 right-0 w-40 h-40 overflow-hidden">
          <div className="absolute -top-2 -right-8 w-56 h-10 bg-red-600/20 rotate-45 origin-center" />
          <div className="absolute top-4 -right-8 w-56 h-3 bg-red-600/25 rotate-45 origin-center" />
        </div>
      </section>

      {/* Pick banner — shown when logged-in user hasn't picked for next race */}
      {pickBanner && (
        <PickBanner
          raceId={pickBanner.raceId}
          raceName={pickBanner.raceName}
          raceRound={pickBanner.raceRound}
          drivers={pickBanner.drivers}
          constructors={pickBanner.constructors}
          currentDriverId={pickBanner.currentDriverId}
          currentConstructorId={pickBanner.currentConstructorId}
          driverUses={pickBanner.driverUses}
          constructorUses={pickBanner.constructorUses}
          maxDriverPicks={pickBanner.maxDriverPicks}
          maxConstructorPicks={pickBanner.maxConstructorPicks}
        />
      )}

      {/* Fun stats — bulletin board pinned cards */}
      {stats.length > 0 && (
        <section className="cork-board border-4 border-[#3d2b1f] rounded-2xl p-4 sm:p-6 cartoon-shadow">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`relative card-paper border-2 border-[#3d2b1f] rounded-lg p-4 cartoon-shadow ${STAT_ROTATIONS[i % STAT_ROTATIONS.length]}`}
              >
                {/* Pin dot */}
                <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${PIN_COLORS[i % PIN_COLORS.length]} shadow-md`} style={{ background: `radial-gradient(circle at 35% 35%, ${i === 0 ? '#f87171' : i === 1 ? '#fbbf24' : i === 2 ? '#34d399' : '#60a5fa'}, ${i === 0 ? '#dc2626' : i === 1 ? '#d97706' : i === 2 ? '#059669' : '#2563eb'})`, boxShadow: '0 2px 3px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.4)' }} />

                <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1 font-bold">
                  {s.label}
                </div>
                {s.driverId ? (
                  <div className="flex items-center gap-2">
                    <DriverAvatar driverId={s.driverId} size={24} />
                    <span className={`text-xl font-bold ${STAT_TEXT_COLORS[i % STAT_TEXT_COLORS.length]}`}>
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
                  <div className={`text-xl font-bold ${STAT_TEXT_COLORS[i % STAT_TEXT_COLORS.length]}`}>
                    {s.value}
                  </div>
                )}
                {s.sub && (
                  <div className="text-xs text-stone-600 mt-0.5 font-medium">{s.sub}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard — wooden scoreboard */}
      <section>
        <h2
          className="text-2xl mb-3 text-stone-900"
          style={{
            fontFamily: "var(--font-bangers)",
            textShadow: "1px 1px 0px rgba(0,0,0,0.15)",
          }}
        >
          Standings
        </h2>
        {noLeague ? (
          <div className="wood-panel border-4 border-[#2a1f15] rounded-2xl p-6 cartoon-shadow">
            <p className="text-amber-100">No players yet.</p>
            <Link
              href="/register"
              className="mt-3 inline-block px-5 py-2.5 bg-red-600 hover:bg-red-500 hover:scale-105 rounded-xl text-white font-bold uppercase tracking-wider sticker transition-transform"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              Create the first account
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto wood-panel border-4 border-[#2a1f15] rounded-2xl cartoon-shadow">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2a1f15] text-amber-300/70 uppercase text-xs tracking-wide">
                  <th className="text-left px-4 py-3 w-12" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>#</th>
                  <th className="text-left px-4 py-3" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Player</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>
                    Driver
                  </th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>
                    Constructor
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
                        <span className="text-amber-300 font-bold text-base">
                          🏆 {i + 1}
                        </span>
                      ) : i === 1 && r.totalPoints > 0 ? (
                        <span className="text-stone-300 font-bold">
                          🥈 {i + 1}
                        </span>
                      ) : i === 2 && r.totalPoints > 0 ? (
                        <span className="text-amber-700 font-bold">
                          🥉 {i + 1}
                        </span>
                      ) : (
                        <span className="text-amber-100/50">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-amber-50">{r.userName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-100/60 hidden sm:table-cell">
                      {r.driverPoints}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-100/60 hidden sm:table-cell">
                      {r.constructorPoints}
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
        )}
      </section>

      {/* Prediction leaderboard */}
      {predictionRows.length > 0 && (
        <section>
          <h2
            className="text-2xl mb-3 text-stone-900"
            style={{
              fontFamily: "var(--font-bangers)",
              textShadow: "1px 1px 0px rgba(0,0,0,0.15)",
            }}
          >
            Prediction Standings
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
                    Races
                  </th>
                  <th className="text-right px-4 py-3" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {predictionRows.map((r, i) => (
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

      {/* F1 Mini Game — Arcade cabinet framing */}
      <section>
        <div className="wood-panel border-4 border-[#2a1f15] rounded-2xl p-1 cartoon-shadow">
          <div className="bg-gradient-to-b from-red-700 to-red-800 rounded-t-xl px-4 py-2 text-center border-b-2 border-red-900">
            <h2
              className="text-2xl text-white inline-block"
              style={{
                fontFamily: "var(--font-bangers)",
                textShadow: "2px 2px 0px rgba(0,0,0,0.4)",
                letterSpacing: "0.05em",
              }}
            >
              <span className="text-yellow-300">F1</span> Dodge
              <span className="text-red-200 text-base font-normal ml-2" style={{ fontFamily: "var(--font-geist-sans)" }}>arcade</span>
            </h2>
          </div>
          <div className="p-2">
            <F1Game />
          </div>
        </div>
      </section>

      {/* Bottom links — chunky cartoon buttons */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/grid"
          className="px-6 py-3 bg-red-600 hover:bg-red-500 hover:scale-105 rounded-xl text-white border-3 border-white cartoon-shadow uppercase tracking-wider transition-transform"
          style={{ fontFamily: "var(--font-bangers)", fontSize: "1rem", letterSpacing: "0.08em", borderWidth: "3px" }}
        >
          Season Grid
        </Link>
        <Link
          href="/races"
          className="px-5 py-3 bg-blue-600 hover:bg-blue-500 hover:scale-105 rounded-xl text-white border-3 border-white cartoon-shadow uppercase tracking-wider transition-transform"
          style={{ fontFamily: "var(--font-bangers)", fontSize: "0.95rem", letterSpacing: "0.08em", borderWidth: "3px" }}
        >
          Race Calendar
        </Link>
        <Link
          href="/picks"
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 hover:scale-105 rounded-xl text-white border-3 border-white cartoon-shadow uppercase tracking-wider transition-transform"
          style={{ fontFamily: "var(--font-bangers)", fontSize: "0.95rem", letterSpacing: "0.08em", borderWidth: "3px" }}
        >
          My Picks
        </Link>
        <Link
          href="/stats"
          className="px-5 py-3 bg-purple-600 hover:bg-purple-500 hover:scale-105 rounded-xl text-white border-3 border-white cartoon-shadow uppercase tracking-wider transition-transform"
          style={{ fontFamily: "var(--font-bangers)", fontSize: "0.95rem", letterSpacing: "0.08em", borderWidth: "3px" }}
        >
          Stats
        </Link>
        <Link
          href="/rules"
          className="px-5 py-3 bg-amber-500 hover:bg-amber-400 hover:scale-105 rounded-xl text-white border-3 border-white cartoon-shadow uppercase tracking-wider transition-transform"
          style={{ fontFamily: "var(--font-bangers)", fontSize: "0.95rem", letterSpacing: "0.08em", borderWidth: "3px" }}
        >
          How to Play
        </Link>
      </div>
    </div>
  );
}
