import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface BoardRow {
  userId: string;
  userName: string;
  totalPoints: number;
  driverPoints: number;
  constructorPoints: number;
  racesScored: number;
}

async function getLeaderboard(): Promise<{
  season: number;
  rows: BoardRow[];
  racesScored: number;
  totalRaces: number;
}> {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2025);

  const [users, scores, totalRaces] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.score.findMany({
      where: { race: { season } },
      select: {
        userId: true,
        driverPoints: true,
        constructorPoints: true,
        totalPoints: true,
      },
    }),
    prisma.race.count({ where: { season } }),
  ]);

  const scoredRaceIds = new Set<string>();
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

  const racesScoredCount = await prisma.race.count({
    where: { season, resultsLocked: true },
  });

  const rows = Array.from(m.values())
    .map((r) => ({
      ...r,
      totalPoints: round1(r.totalPoints),
      driverPoints: round1(r.driverPoints),
      constructorPoints: round1(r.constructorPoints),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
  return { season, rows, racesScored: racesScoredCount, totalRaces };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default async function HomePage() {
  const { season, rows, racesScored, totalRaces } = await getLeaderboard();
  const noLeague = rows.length === 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/30 border border-zinc-800 rounded-xl p-8">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-red-500">F1</span> Fantasy League
          </h1>
          <p className="text-zinc-400 mt-2 max-w-lg">
            Pick a driver and a constructor each race. Use them wisely: each
            driver can only be picked twice and each constructor three times
            per season.
          </p>
          <div className="flex items-center gap-6 mt-4">
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
                <span className="text-zinc-500 text-lg">/{totalRaces}</span>
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
                  <th className="text-right px-4 py-3">Driver pts</th>
                  <th className="text-right px-4 py-3">Constructor pts</th>
                  <th className="text-right px-4 py-3">Races</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className="border-t border-zinc-800 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3 tabular-nums">
                      {i === 0 && r.totalPoints > 0 ? (
                        <span className="text-amber-400 font-bold">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-zinc-500">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.userName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      {r.driverPoints}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      {r.constructorPoints}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
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

      <div className="flex gap-3 text-sm">
        <Link
          href="/races"
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
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
          href="/rules"
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          How to play
        </Link>
      </div>
    </div>
  );
}
