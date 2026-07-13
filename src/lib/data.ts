import { prisma } from "@/lib/prisma";

export async function getCurrentSeason(): Promise<number> {
  const league = await prisma.league.findFirst();
  return league?.season ?? Number(process.env.F1_SEASON ?? 2026);
}

export async function getPickUsage(
  userId: string,
  season: number,
  excludeRaceId?: string,
): Promise<{
  driverUses: Record<string, number>;
  constructorUses: Record<string, number>;
}> {
  const picks = await prisma.pick.findMany({
    where: { userId, race: { season } },
    select: { driverId: true, teamId: true, raceId: true },
  });

  const driverUses: Record<string, number> = {};
  const constructorUses: Record<string, number> = {};
  for (const p of picks) {
    if (excludeRaceId && p.raceId === excludeRaceId) continue;
    if (p.driverId) driverUses[p.driverId] = (driverUses[p.driverId] ?? 0) + 1;
    if (p.teamId) constructorUses[p.teamId] = (constructorUses[p.teamId] ?? 0) + 1;
  }

  return { driverUses, constructorUses };
}
