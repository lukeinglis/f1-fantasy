import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// API contract uses "constructorId" externally (the F1 term).
// Internally the DB column is "teamId" because "constructor" clashes with JS prototype names.
const Body = z.object({
  raceId: z.string().min(1),
  driverId: z.string().min(1).nullable().optional(),
  constructorId: z.string().min(1).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

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
  const { raceId, driverId, constructorId } = parsed.data;
  const teamId = constructorId; // map external name to internal field

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  if (new Date() >= race.pickDeadline) {
    return NextResponse.json(
      { error: "Pick deadline has passed" },
      { status: 400 },
    );
  }

  const league = await prisma.league.findFirst();
  const maxDriver = league?.maxDriverPicks ?? 2;
  const maxConstructor = league?.maxConstructorPicks ?? 3;

  if (driverId) {
    const d = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!d) return NextResponse.json({ error: "Unknown driver" }, { status: 400 });
  }
  if (teamId) {
    const c = await prisma.team.findUnique({ where: { id: teamId } });
    if (!c) return NextResponse.json({ error: "Unknown constructor" }, { status: 400 });
  }

  const existing = await prisma.pick.findUnique({
    where: { userId_raceId: { userId, raceId } },
  });

  if (driverId) {
    const used = await prisma.pick.count({
      where: { userId, driverId, NOT: { raceId } },
    });
    if (used >= maxDriver) {
      return NextResponse.json(
        { error: `Driver already used ${used} time(s) (max ${maxDriver})` },
        { status: 400 },
      );
    }
  }
  if (teamId) {
    const used = await prisma.pick.count({
      where: { userId, teamId, NOT: { raceId } },
    });
    if (used >= maxConstructor) {
      return NextResponse.json(
        { error: `Constructor already used ${used} time(s) (max ${maxConstructor})` },
        { status: 400 },
      );
    }
  }

  const pick = await prisma.pick.upsert({
    where: { userId_raceId: { userId, raceId } },
    create: {
      userId,
      raceId,
      driverId: driverId ?? null,
      teamId: teamId ?? null,
    },
    update: {
      driverId: driverId ?? null,
      teamId: teamId ?? null,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({
    pick: {
      id: pick.id,
      userId: pick.userId,
      raceId: pick.raceId,
      driverId: pick.driverId,
      constructorId: pick.teamId,
      submittedAt: pick.submittedAt,
    },
    replaced: !!existing,
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const picks = await prisma.pick.findMany({
    where: { userId },
    include: {
      race: {
        select: {
          id: true,
          name: true,
          round: true,
          season: true,
          date: true,
          pickDeadline: true,
          resultsLocked: true,
        },
      },
      driver: { select: { id: true, givenName: true, familyName: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { race: { round: "asc" } },
  });
  // Re-shape to expose the external "constructor" name
  const shaped = picks.map((p) => ({
    id: p.id,
    raceId: p.raceId,
    race: p.race,
    driverId: p.driverId,
    driver: p.driver,
    constructorId: p.teamId,
    constructor: p.team,
    submittedAt: p.submittedAt,
  }));
  return NextResponse.json({ picks: shaped });
}
