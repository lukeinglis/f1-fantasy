import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const secret = process.env.AUTH_SECRET ?? "fallback-secret";

if (!process.env.AUTH_SECRET) {
  console.warn(
    "[game/token] AUTH_SECRET not set; using fallback. Tokens are NOT secure.",
  );
}

/** Build an HMAC-signed game token: `nonce:startTime:userId:hmac` */
export function signGameToken(userId: string): {
  token: string;
  startTime: number;
} {
  const nonce = randomBytes(16).toString("hex");
  const startTime = Date.now();
  const payload = `${nonce}:${startTime}:${userId}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${payload}:${hmac}`, startTime };
}

/** Verify a game token. Returns parsed fields or null on failure. */
export function verifyGameToken(token: string): {
  nonce: string;
  startTime: number;
  userId: string;
} | null {
  const parts = token.split(":");
  if (parts.length !== 4) return null;

  const [nonce, startTimeStr, userId, providedHmac] = parts;
  const startTime = Number(startTimeStr);
  if (!Number.isFinite(startTime)) return null;

  const payload = `${nonce}:${startTimeStr}:${userId}`;
  const expectedHmac = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison to prevent timing side-channel attacks
  if (expectedHmac.length !== providedHmac.length) return null;
  const expected = Buffer.from(expectedHmac, "utf8");
  const provided = Buffer.from(providedHmac, "utf8");
  if (!timingSafeEqual(expected, provided)) return null;

  return { nonce, startTime, userId };
}

/* GET /api/game/token  — issue a signed game token (auth required) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, startTime } = signGameToken(session.user.id);
  return NextResponse.json({ token, startTime });
}
