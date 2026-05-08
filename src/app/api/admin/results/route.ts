import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import {
  recomputeScoresForRace,
  recomputePredictionScoresForRace,
} from "@/lib/scoreCompute";
import { z } from "zod";

// Body uses external "constructorId" naming, internally maps to teamId.
const Row = z.object({
  driverId: z.string().min(1),
  constructorId: z.string().min(1),
  position: z.number().int(),
  positionText: z.string().optional(),
  points: z.number().optional(),
  status: z.string().optional(),
});
const Body = z.object({
  raceId: z.string().min(1),
  results: z.array(Row).min(1),
});

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { raceId, results } = parsed.data;

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  for (const r of results) {
    await prisma.raceResult.upsert({
      where: { raceId_driverId: { raceId, driverId: r.driverId } },
      create: {
        raceId,
        driverId: r.driverId,
        teamId: r.constructorId,
        position: r.position,
        positionText: r.positionText ?? String(r.position),
        points: r.points ?? 0,
        status: r.status ?? null,
      },
      update: {
        teamId: r.constructorId,
        position: r.position,
        positionText: r.positionText ?? String(r.position),
        points: r.points ?? 0,
        status: r.status ?? null,
      },
    });
  }

  const scored = await recomputeScoresForRace(raceId);
  await recomputePredictionScoresForRace(raceId);

  return NextResponse.json({
    ok: true,
    raceId,
    resultsWritten: results.length,
    scoresUpdated: scored.updated,
  });
}
