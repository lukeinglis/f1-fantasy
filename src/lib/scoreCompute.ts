import { prisma } from "@/lib/prisma";
import { pointsForPosition } from "@/lib/scoring";

// Recompute Score rows for every player for a single race.
// Driver pick = position-points for picked driver.
// Constructor pick = sum of position-points for both drivers of that constructor in this race.
export async function recomputeScoresForRace(
  raceId: string,
): Promise<{ updated: number }> {
  const results = await prisma.raceResult.findMany({ where: { raceId } });
  if (results.length === 0) {
    return { updated: 0 };
  }

  const driverPos: Record<string, number> = {};
  const teamPositions: Record<string, number[]> = {};
  for (const r of results) {
    driverPos[r.driverId] = r.position;
    if (!teamPositions[r.teamId]) teamPositions[r.teamId] = [];
    teamPositions[r.teamId].push(r.position);
  }

  const picks = await prisma.pick.findMany({ where: { raceId } });

  let updated = 0;
  for (const p of picks) {
    let driverPoints = 0;
    let constructorPoints = 0;

    if (p.driverId && driverPos[p.driverId] !== undefined) {
      driverPoints = pointsForPosition(driverPos[p.driverId]);
    }
    if (p.teamId) {
      const positions = teamPositions[p.teamId] ?? [];
      constructorPoints = positions.reduce(
        (sum, pos) => sum + pointsForPosition(pos),
        0,
      );
    }
    const total = driverPoints + constructorPoints;

    await prisma.score.upsert({
      where: { userId_raceId: { userId: p.userId, raceId } },
      create: {
        userId: p.userId,
        raceId,
        driverPoints,
        constructorPoints,
        totalPoints: total,
      },
      update: {
        driverPoints,
        constructorPoints,
        totalPoints: total,
        computedAt: new Date(),
      },
    });
    updated += 1;
  }

  await prisma.race.update({
    where: { id: raceId },
    data: { resultsLocked: true },
  });

  return { updated };
}
