import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Race detail: race info, results (if locked), all players' picks (only after deadline).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ raceId: string }> },
) {
  const { raceId } = await ctx.params;
  const session = await auth();

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      results: {
        orderBy: { position: "asc" },
      },
    },
  });
  if (!race) return NextResponse.json({ error: "Race not found" }, { status: 404 });

  const now = new Date();
  const deadlinePassed = now >= race.pickDeadline;
  const showAllPicks =
    deadlinePassed || (session?.user as { role?: string } | undefined)?.role === "admin";

  let picks: Array<{
    id: string;
    userId: string;
    userName: string;
    driverId: string | null;
    driverName: string | null;
    constructorId: string | null;
    constructorName: string | null;
  }> = [];

  if (showAllPicks) {
    const rows = await prisma.pick.findMany({
      where: { raceId },
      include: {
        user: { select: { id: true, name: true } },
        driver: { select: { id: true, givenName: true, familyName: true } },
        team: { select: { id: true, name: true } },
      },
    });
    picks = rows.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name,
      driverId: p.driverId,
      driverName: p.driver
        ? `${p.driver.givenName} ${p.driver.familyName}`
        : null,
      constructorId: p.teamId,
      constructorName: p.team?.name ?? null,
    }));
  } else if (session?.user?.id) {
    const mine = await prisma.pick.findUnique({
      where: { userId_raceId: { userId: session.user.id, raceId } },
      include: {
        user: { select: { id: true, name: true } },
        driver: { select: { id: true, givenName: true, familyName: true } },
        team: { select: { id: true, name: true } },
      },
    });
    if (mine) {
      picks = [
        {
          id: mine.id,
          userId: mine.userId,
          userName: mine.user.name,
          driverId: mine.driverId,
          driverName: mine.driver
            ? `${mine.driver.givenName} ${mine.driver.familyName}`
            : null,
          constructorId: mine.teamId,
          constructorName: mine.team?.name ?? null,
        },
      ];
    }
  }

  const scores = await prisma.score.findMany({
    where: { raceId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { totalPoints: "desc" },
  });

  return NextResponse.json({
    race: {
      id: race.id,
      season: race.season,
      round: race.round,
      name: race.name,
      circuitName: race.circuitName,
      locality: race.locality,
      country: race.country,
      date: race.date,
      pickDeadline: race.pickDeadline,
      resultsLocked: race.resultsLocked,
    },
    results: race.results.map((r) => ({
      driverId: r.driverId,
      constructorId: r.teamId,
      position: r.position,
      positionText: r.positionText,
      points: r.points,
      status: r.status,
    })),
    picks,
    scores: scores.map((s) => ({
      userId: s.userId,
      userName: s.user.name,
      driverPoints: s.driverPoints,
      constructorPoints: s.constructorPoints,
      totalPoints: s.totalPoints,
    })),
    deadlinePassed,
  });
}
