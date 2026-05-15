import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signGameToken } from "@/lib/gameToken";

/* GET /api/game/token  — issue a signed game token (auth required) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, startTime } = signGameToken(session.user.id);
  return NextResponse.json({ token, startTime });
}
