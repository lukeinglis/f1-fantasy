import { prisma } from "@/lib/prisma";
import { syncSeason, syncRaceResults } from "@/lib/sync";
import { recomputeScoresForRace } from "@/lib/scoreCompute";

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let lastSyncAt = 0;

export async function ensureSeasonSynced(): Promise<void> {
  const now = Date.now();
  if (now - lastSyncAt < SYNC_INTERVAL_MS) return;

  const season = Number(process.env.F1_SEASON ?? 2026);
  const raceCount = await prisma.race.count({ where: { season } });

  if (raceCount === 0) {
    await syncSeason(season);
    lastSyncAt = now;
    return;
  }

  // Check if any past races are missing results
  const unscoredPastRaces = await prisma.race.findMany({
    where: {
      season,
      resultsLocked: false,
      date: { lt: new Date() },
    },
    orderBy: { round: "asc" },
  });

  if (unscoredPastRaces.length > 0) {
    // Sync season data first (picks up new drivers/constructors)
    await syncSeason(season);

    // Try to fetch results for each unscored past race
    for (const race of unscoredPastRaces) {
      try {
        const fetched = await syncRaceResults(season, race.round);
        if (fetched.available && fetched.results > 0) {
          await recomputeScoresForRace(race.id);
        }
      } catch {
        // API may not have results yet, skip silently
      }
    }
  }

  lastSyncAt = now;
}
