import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { recomputeScoresForRace } from "@/lib/scoreCompute";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Body = z.object({ raceId: z.string().min(1).optional() });

// Recompute scores. With { raceId } -> just that race; otherwise -> every race that has results.
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.raceId) {
    const result = await recomputeScoresForRace(parsed.data.raceId);
    return NextResponse.json({ ok: true, raceId: parsed.data.raceId, ...result });
  }

  // All races with at least one RaceResult row
  const races = await prisma.race.findMany({
    where: { results: { some: {} } },
    select: { id: true },
  });
  let total = 0;
  for (const r of races) {
    const out = await recomputeScoresForRace(r.id);
    total += out.updated;
  }
  return NextResponse.json({ ok: true, racesProcessed: races.length, totalScores: total });
}
