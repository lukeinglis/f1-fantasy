import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { verifyGameToken } from "./token/route";

// ── Anti-cheat constants ──
const MAX_SCORE = 5000;
const MIN_SECONDS_PER_METER = 0.06; // generous floor
const TOKEN_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const RATE_LIMIT_MS = 10_000; // 1 submission per 10 seconds

// ── In-memory stores (fine for a small friends league) ──
const usedNonces = new Set<string>();
const rateLimitMap = new Map<string, number>();

// Clean up stale nonces every 10 minutes
setInterval(() => {
  usedNonces.clear();
}, 10 * 60 * 1000);

const ScoreBody = z.object({
  score: z.number().int().min(0).max(MAX_SCORE),
  token: z.string().min(1),
});

/* POST /api/game  — submit a score (auth + token required) */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // ── Rate limiting ──
  const lastSubmission = rateLimitMap.get(userId) ?? 0;
  const now = Date.now();
  if (now - lastSubmission < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Too many submissions. Wait a few seconds." },
      { status: 429 },
    );
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

  const { score, token } = parsed.data;

  // ── Verify game token ──
  const tokenData = verifyGameToken(token);
  if (!tokenData) {
    return NextResponse.json(
      { error: "Invalid game token" },
      { status: 403 },
    );
  }

  // ── Check token belongs to this user ──
  if (tokenData.userId !== userId) {
    return NextResponse.json(
      { error: "Token user mismatch" },
      { status: 403 },
    );
  }

  // ── Check token freshness (within 30 minutes) ──
  if (now - tokenData.startTime > TOKEN_MAX_AGE_MS) {
    return NextResponse.json(
      { error: "Game token expired" },
      { status: 403 },
    );
  }

  // ── Check nonce not already used (replay protection) ──
  if (usedNonces.has(tokenData.nonce)) {
    return NextResponse.json(
      { error: "Token already used" },
      { status: 403 },
    );
  }

  // ── Timing plausibility check ──
  const elapsedSeconds = (now - tokenData.startTime) / 1000;
  const minExpectedSeconds = score * MIN_SECONDS_PER_METER;
  if (elapsedSeconds < minExpectedSeconds) {
    return NextResponse.json(
      { error: "Score not plausible for elapsed time" },
      { status: 403 },
    );
  }

  // ── All checks passed: mark nonce used, update rate limit ──
  usedNonces.add(tokenData.nonce);
  rateLimitMap.set(userId, now);

  // ── Upsert: keep only the best score per user ──
  const existing = await prisma.gameScore.findUnique({
    where: { userId },
    select: { score: true },
  });

  if (existing && existing.score >= score) {
    // Current best is higher or equal; no update needed
    return NextResponse.json({ ok: true, updated: false });
  }

  await prisma.gameScore.upsert({
    where: { userId },
    update: {
      score,
      playerName: session.user.name ?? "Unknown",
    },
    create: {
      userId,
      playerName: session.user.name ?? "Unknown",
      score,
    },
  });

  return NextResponse.json({ ok: true, updated: true });
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
