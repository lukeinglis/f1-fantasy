import { prisma } from "@/lib/prisma";
import { pointsForPosition, predictionPointsForSlot } from "@/lib/scoring";

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

// Recompute PredictionScore rows for every player who submitted predictions for a race.
export async function recomputePredictionScoresForRace(
  raceId: string,
): Promise<{ updated: number }> {
  const results = await prisma.raceResult.findMany({ where: { raceId } });
  if (results.length === 0) {
    return { updated: 0 };
  }

  // Map driverId to finishing position (only top 10 matter for scoring)
  const driverFinishPos: Record<string, number> = {};
  for (const r of results) {
    driverFinishPos[r.driverId] = r.position;
  }

  // Get all predictions grouped by user
  const predictions = await prisma.prediction.findMany({ where: { raceId } });
  const byUser = new Map<string, { position: number; driverId: string }[]>();
  for (const p of predictions) {
    const list = byUser.get(p.userId) ?? [];
    list.push({ position: p.position, driverId: p.driverId });
    byUser.set(p.userId, list);
  }

  let updated = 0;
  for (const [userId, slots] of byUser) {
    let totalPoints = 0;
    let exactMatches = 0;
    let closeMatches = 0;

    for (const slot of slots) {
      const actualPos = driverFinishPos[slot.driverId];
      const pts = predictionPointsForSlot(slot.position, actualPos);
      totalPoints += pts;
      if (pts === 5) exactMatches += 1;
      if (pts === 2 || pts === 1) closeMatches += 1;
    }

    await prisma.predictionScore.upsert({
      where: { userId_raceId: { userId, raceId } },
      create: { userId, raceId, totalPoints, exactMatches, closeMatches },
      update: { totalPoints, exactMatches, closeMatches, computedAt: new Date() },
    });
    updated += 1;
  }

  return { updated };
}
