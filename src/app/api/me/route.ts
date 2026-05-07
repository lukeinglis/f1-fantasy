import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the signed-in user's profile + per-driver/constructor usage counts.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [user, league, picks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.league.findFirst(),
    prisma.pick.findMany({
      where: { userId },
      select: { driverId: true, teamId: true, raceId: true },
    }),
  ]);

  const driverUses: Record<string, number> = {};
  const constructorUses: Record<string, number> = {};
  for (const p of picks) {
    if (p.driverId) driverUses[p.driverId] = (driverUses[p.driverId] ?? 0) + 1;
    if (p.teamId)
      constructorUses[p.teamId] = (constructorUses[p.teamId] ?? 0) + 1;
  }

  return NextResponse.json({
    user: user
      ? { id: user.id, email: user.email, name: user.name, role: user.role }
      : null,
    league: league
      ? {
          id: league.id,
          name: league.name,
          season: league.season,
          maxDriverPicks: league.maxDriverPicks,
          maxConstructorPicks: league.maxConstructorPicks,
        }
      : null,
    driverUses,
    constructorUses,
  });
}
