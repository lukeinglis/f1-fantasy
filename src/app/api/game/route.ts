import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ScoreBody = z.object({
  score: z.number().int().min(0).max(999_999_999),
});

/* POST /api/game  — submit a score (auth required) */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ScoreBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const record = await prisma.gameScore.create({
    data: {
      userId: session.user.id,
      playerName: session.user.name ?? "Unknown",
      score: parsed.data.score,
    },
  });

  return NextResponse.json({ ok: true, id: record.id });
}

/* GET /api/game  — top 10 high scores */
export async function GET() {
  const scores = await prisma.gameScore.findMany({
    orderBy: { score: "desc" },
    take: 10,
    select: {
      id: true,
      playerName: true,
      score: true,
      createdAt: true,
    },
  });

  return NextResponse.json(scores);
}
