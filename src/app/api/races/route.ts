import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/data";

// List all races for the active season, with each race's results-locked flag.
export async function GET() {
  const season = await getCurrentSeason();
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
