import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin only" }, { status: 403 }),
    };
  }
  return { ok: true, userId: session.user.id };
}
