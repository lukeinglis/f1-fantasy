// Thin client over the jolpica F1 (Ergast-compat) API.
// Docs: https://github.com/jolpica/jolpica-f1
//
// We only fetch the small set of endpoints we need for this MVP and
// shape the responses into plain JS objects the rest of the app uses.

const BASE = process.env.JOLPICA_BASE_URL || "https://api.jolpi.ca/ergast/f1";

export interface JolpicaRace {
  season: string;
  round: string;
  raceName: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM:SSZ (UTC)
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: { lat: string; long: string; locality: string; country: string };
  };
}

export interface JolpicaDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality?: string;
}

export interface JolpicaConstructor {
  constructorId: string;
  name: string;
  nationality?: string;
}

export interface JolpicaResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: JolpicaDriver;
  Constructor: JolpicaConstructor;
  status: string;
}

async function get(path: string): Promise<unknown> {
  const url = `${BASE}/${path}`;
  const res = await fetch(url, {
    // Avoid Next.js default caching for live data
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Jolpica ${url} -> ${res.status}`);
  }
  return res.json();
}

export async function fetchSeasonRaces(season: number): Promise<JolpicaRace[]> {
  type Resp = { MRData: { RaceTable: { Races: JolpicaRace[] } } };
  const data = (await get(`${season}.json?limit=100`)) as Resp;
  return data.MRData.RaceTable.Races;
}

export async function fetchSeasonDrivers(
  season: number,
): Promise<JolpicaDriver[]> {
  type Resp = { MRData: { DriverTable: { Drivers: JolpicaDriver[] } } };
  const data = (await get(`${season}/drivers.json?limit=60`)) as Resp;
  return data.MRData.DriverTable.Drivers;
}

export async function fetchSeasonConstructors(
  season: number,
): Promise<JolpicaConstructor[]> {
  type Resp = {
    MRData: { ConstructorTable: { Constructors: JolpicaConstructor[] } };
  };
  const data = (await get(
    `${season}/constructors.json?limit=30`,
  )) as Resp;
  return data.MRData.ConstructorTable.Constructors;
}

export async function fetchRaceResults(
  season: number,
  round: number,
): Promise<{ race: JolpicaRace; results: JolpicaResult[] } | null> {
  type Resp = {
    MRData: {
      RaceTable: {
        Races: (JolpicaRace & { Results?: JolpicaResult[] })[];
      };
    };
  };
  const data = (await get(`${season}/${round}/results.json`)) as Resp;
  const r = data.MRData.RaceTable.Races[0];
  if (!r) return null;
  return { race: r, results: r.Results ?? [] };
}

// Combine the date + time fields from the API into a JS Date.
// Race time is in UTC (Z suffix). When time is missing (older races),
// fall back to noon UTC of the race date.
export function combineRaceDateTime(date: string, time?: string): Date {
  const t = time && time.length > 0 ? time : "12:00:00Z";
  const iso = `${date}T${t.replace(/Z?$/, "Z")}`;
  return new Date(iso);
}
