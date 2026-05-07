import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Returns the current driver/constructor grid stored in the DB.
export async function GET() {
  const [drivers, constructors] = await Promise.all([
    prisma.driver.findMany({
      orderBy: [{ familyName: "asc" }],
      select: {
        id: true,
        code: true,
        givenName: true,
        familyName: true,
        permanentNumber: true,
        nationality: true,
      },
    }),
    prisma.team.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, nationality: true },
    }),
  ]);
  return NextResponse.json({ drivers, constructors });
}
