import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// List all races for the active season, with each race's results-locked flag.
export async function GET() {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2025);
  const races = await prisma.race.findMany({
    where: { season },
    orderBy: { round: "asc" },
    select: {
      id: true,
      season: true,
      round: true,
      name: true,
      circuitName: true,
      locality: true,
      country: true,
      date: true,
      pickDeadline: true,
      resultsLocked: true,
    },
  });
  return NextResponse.json({ season, races });
}
