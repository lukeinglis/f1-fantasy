import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PredictionSlot = z.object({
  position: z.number().int().min(1).max(10),
  driverId: z.string().min(1),
});

const Body = z.object({
  raceId: z.string().min(1),
  predictions: z.array(PredictionSlot).min(1).max(10),
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

  const { raceId, predictions } = parsed.data;

  // Validate race exists and deadline not passed
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }
  if (new Date() >= race.pickDeadline) {
    return NextResponse.json(
      { error: "Prediction deadline has passed" },
      { status: 400 },
    );
  }

  // Validate no duplicate positions
  const positions = predictions.map((p) => p.position);
  if (new Set(positions).size !== positions.length) {
    return NextResponse.json(
      { error: "Duplicate positions in prediction" },
      { status: 400 },
    );
  }

  // Validate no duplicate drivers
  const driverIds = predictions.map((p) => p.driverId);
  if (new Set(driverIds).size !== driverIds.length) {
    return NextResponse.json(
      { error: "Duplicate drivers in prediction" },
      { status: 400 },
    );
  }

  // Validate all drivers exist
  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true },
  });
  if (drivers.length !== driverIds.length) {
    return NextResponse.json(
      { error: "One or more unknown drivers" },
      { status: 400 },
    );
  }

  // Delete existing predictions for this user/race, then create new ones
  const now = new Date();
  await prisma.$transaction([
    prisma.prediction.deleteMany({
      where: { userId, raceId },
    }),
    ...predictions.map((p) =>
      prisma.prediction.create({
        data: {
          userId,
          raceId,
          position: p.position,
          driverId: p.driverId,
          submittedAt: now,
        },
      }),
    ),
  ]);

  return NextResponse.json({ ok: true, count: predictions.length });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const raceId = req.nextUrl.searchParams.get("raceId");
  if (!raceId) {
    return NextResponse.json(
      { error: "raceId query parameter required" },
      { status: 400 },
    );
  }

  const predictions = await prisma.prediction.findMany({
    where: { userId, raceId },
    orderBy: { position: "asc" },
    include: {
      driver: {
        select: {
          id: true,
          code: true,
          givenName: true,
          familyName: true,
        },
      },
    },
  });

  return NextResponse.json({
    predictions: predictions.map((p) => ({
      position: p.position,
      driverId: p.driverId,
      driver: p.driver,
      submittedAt: p.submittedAt,
    })),
  });
}
