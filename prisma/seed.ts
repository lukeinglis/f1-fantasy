// Seed: ensure a single League row exists.
// Calendar/grid sync happens via the admin endpoint, not at seed time.

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.league.findFirst();
  if (existing) {
    console.log("League already exists:", existing.name);
    return;
  }
  const season = Number(process.env.F1_SEASON ?? 2025);
  const league = await prisma.league.create({
    data: {
      name: `F1 Fantasy ${season}`,
      season,
      maxDriverPicks: 2,
      maxConstructorPicks: 3,
    },
  });
  console.log("Created league:", league);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
