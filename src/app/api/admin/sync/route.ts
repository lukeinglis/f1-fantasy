import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { syncRaceResults, syncSeason } from "@/lib/sync";
import {
  recomputeScoresForRace,
  recomputePredictionScoresForRace,
} from "@/lib/scoreCompute";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Body = z.object({
  season: z.number().int().positive().optional(),
  round: z.number().int().positive().optional(),
  scope: z.enum(["season", "results"]).default("season"),
});

// POST /api/admin/sync
//   { scope: "season" }  -> syncs calendar + drivers + constructors for season
//   { scope: "results", round }  -> pulls jolpica results for a round and recomputes scores
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = Body.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const league = await prisma.league.findFirst();
  const season =
    parsed.data.season ?? league?.season ?? Number(process.env.F1_SEASON ?? 2026);

  if (parsed.data.scope === "season") {
    const result = await syncSeason(season);
    return NextResponse.json({ ok: true, scope: "season", season, ...result });
  }

  // Results scope
  const round = parsed.data.round;
  if (!round) {
    return NextResponse.json(
      { error: "round is required when scope=results" },
      { status: 400 },
    );
  }
  const fetched = await syncRaceResults(season, round);
  if (!fetched.available) {
    return NextResponse.json({
      ok: false,
      message: "No results available from API yet",
      season,
      round,
    });
  }
  const race = await prisma.race.findUnique({
    where: { season_round: { season, round } },
  });
  if (!race) {
    return NextResponse.json({ error: "Race row not found" }, { status: 404 });
  }
  const scored = await recomputeScoresForRace(race.id);
  await recomputePredictionScoresForRace(race.id);

  return NextResponse.json({
    ok: true,
    scope: "results",
    season,
    round,
    resultsWritten: fetched.results,
    scoresUpdated: scored.updated,
  });
}
