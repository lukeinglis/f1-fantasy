import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("adminGuard");

export async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "admin") {
    log.warn({ userId: session?.user?.id ?? null, role: role ?? null }, "admin access denied");
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin only" }, { status: 403 }),
    };
  }
  log.info({ userId: session.user.id }, "admin access granted");
  return { ok: true, userId: session.user.id };
}
