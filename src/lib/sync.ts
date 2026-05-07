import { prisma } from "@/lib/prisma";
import {
  combineRaceDateTime,
  fetchRaceResults,
  fetchSeasonConstructors,
  fetchSeasonDrivers,
  fetchSeasonRaces,
} from "@/lib/jolpica";

// Pull the calendar, drivers, and constructors for a season from jolpica
// and upsert into the local DB.
export async function syncSeason(season: number): Promise<{
  races: number;
  drivers: number;
  constructors: number;
}> {
  const [races, drivers, constructors] = await Promise.all([
    fetchSeasonRaces(season),
    fetchSeasonDrivers(season),
    fetchSeasonConstructors(season),
  ]);

  for (const d of drivers) {
    await prisma.driver.upsert({
      where: { id: d.driverId },
      create: {
        id: d.driverId,
        code: d.code ?? null,
        givenName: d.givenName,
        familyName: d.familyName,
        permanentNumber: d.permanentNumber ?? null,
        nationality: d.nationality ?? null,
      },
      update: {
        code: d.code ?? null,
        givenName: d.givenName,
        familyName: d.familyName,
        permanentNumber: d.permanentNumber ?? null,
        nationality: d.nationality ?? null,
      },
    });
  }

  for (const c of constructors) {
    await prisma.team.upsert({
      where: { id: c.constructorId },
      create: {
        id: c.constructorId,
        name: c.name,
        nationality: c.nationality ?? null,
      },
      update: {
        name: c.name,
        nationality: c.nationality ?? null,
      },
    });
  }

  for (const r of races) {
    const round = Number(r.round);
    const dateTime = combineRaceDateTime(r.date, r.time);
    await prisma.race.upsert({
      where: { season_round: { season, round } },
      create: {
        season,
        round,
        name: r.raceName,
        circuitName: r.Circuit.circuitName,
        locality: r.Circuit.Location.locality,
        country: r.Circuit.Location.country,
        date: dateTime,
        pickDeadline: dateTime,
      },
      update: {
        name: r.raceName,
        circuitName: r.Circuit.circuitName,
        locality: r.Circuit.Location.locality,
        country: r.Circuit.Location.country,
        date: dateTime,
      },
    });
  }

  return {
    races: races.length,
    drivers: drivers.length,
    constructors: constructors.length,
  };
}

// Pull race results for one round.
export async function syncRaceResults(
  season: number,
  round: number,
): Promise<{ results: number; available: boolean }> {
  const data = await fetchRaceResults(season, round);
  if (!data || data.results.length === 0) {
    return { results: 0, available: false };
  }

  const race = await prisma.race.findUnique({
    where: { season_round: { season, round } },
  });
  if (!race) {
    throw new Error(`Race for ${season}/${round} not in DB — run season sync first`);
  }

  for (const r of data.results) {
    await prisma.driver.upsert({
      where: { id: r.Driver.driverId },
      create: {
        id: r.Driver.driverId,
        code: r.Driver.code ?? null,
        givenName: r.Driver.givenName,
        familyName: r.Driver.familyName,
        permanentNumber: r.Driver.permanentNumber ?? null,
        nationality: r.Driver.nationality ?? null,
      },
      update: {},
    });
    await prisma.team.upsert({
      where: { id: r.Constructor.constructorId },
      create: {
        id: r.Constructor.constructorId,
        name: r.Constructor.name,
        nationality: r.Constructor.nationality ?? null,
      },
      update: {},
    });

    const positionNum = Number(r.position);
    await prisma.raceResult.upsert({
      where: {
        raceId_driverId: { raceId: race.id, driverId: r.Driver.driverId },
      },
      create: {
        raceId: race.id,
        driverId: r.Driver.driverId,
        teamId: r.Constructor.constructorId,
        position: Number.isFinite(positionNum) ? positionNum : -1,
        positionText: r.positionText ?? null,
        points: Number(r.points) || 0,
        status: r.status ?? null,
      },
      update: {
        teamId: r.Constructor.constructorId,
        position: Number.isFinite(positionNum) ? positionNum : -1,
        positionText: r.positionText ?? null,
        points: Number(r.points) || 0,
        status: r.status ?? null,
      },
    });
  }

  return { results: data.results.length, available: true };
}
