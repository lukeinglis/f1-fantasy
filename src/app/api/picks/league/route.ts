import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("api/picks/league");

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    log.warn("GET league picks: unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raceId = req.nextUrl.searchParams.get("raceId");
  if (!raceId) {
    return NextResponse.json(
      { error: "raceId query parameter is required" },
      { status: 400 },
    );
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  if (new Date() < race.pickDeadline) {
    log.info({ raceId }, "GET league picks: deadline not passed");
    return NextResponse.json(
      { error: "Picks are hidden until the pick deadline has passed" },
      { status: 403 },
    );
  }

  const picks = await prisma.pick.findMany({
    where: { raceId },
    include: {
      user: { select: { id: true, name: true } },
      driver: {
        select: { id: true, givenName: true, familyName: true, code: true },
      },
      team: { select: { id: true, name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const shaped = picks.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.user.name,
    raceId: p.raceId,
    driverId: p.driverId,
    driver: p.driver,
    constructorId: p.teamId,
    constructor: p.team,
    submittedAt: p.submittedAt,
  }));

  log.info(
    { raceId, count: shaped.length },
    "GET league picks complete",
  );
  return NextResponse.json({ picks: shaped, race: { id: race.id, name: race.name, round: race.round } });
}
