import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Aggregate season leaderboard. Sums Score.totalPoints across all races
// where results have been locked. Players with no scores yet show 0.
export async function GET() {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2026);

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const scores = await prisma.score.findMany({
    where: { race: { season } },
    select: {
      userId: true,
      driverPoints: true,
      constructorPoints: true,
      totalPoints: true,
      raceId: true,
    },
  });

  const totalsByUser = new Map<
    string,
    { totalPoints: number; driverPoints: number; constructorPoints: number; races: number }
  >();
  for (const u of users) {
    totalsByUser.set(u.id, {
      totalPoints: 0,
      driverPoints: 0,
      constructorPoints: 0,
      races: 0,
    });
  }
  for (const s of scores) {
    const t = totalsByUser.get(s.userId);
    if (!t) continue;
    t.totalPoints += s.totalPoints;
    t.driverPoints += s.driverPoints;
    t.constructorPoints += s.constructorPoints;
    t.races += 1;
  }

  const rows = users
    .filter((u) => u.role !== "admin" || true) // include admins too — they can play
    .map((u) => {
      const t = totalsByUser.get(u.id)!;
      return {
        userId: u.id,
        userName: u.name,
        totalPoints: round1(t.totalPoints),
        driverPoints: round1(t.driverPoints),
        constructorPoints: round1(t.constructorPoints),
        racesScored: t.races,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({ season, leaderboard: rows });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
