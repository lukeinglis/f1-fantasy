import { PrismaClient } from "@/generated/prisma";

declare global {
  var prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.prismaClient ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaClient = prisma;
}
