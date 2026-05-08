import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const Body = z.object({
  name: z.string().min(1).max(60),
  password: z.string().min(4).max(200),
});

export async function POST(req: Request) {
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
  const { name, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Name already taken" }, { status: 409 });
  }

  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "admin" : "player";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, passwordHash, role },
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    role: user.role,
  });
}
