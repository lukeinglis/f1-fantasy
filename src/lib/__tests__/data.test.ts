import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: {
      findFirst: vi.fn(),
    },
    pick: {
      findMany: vi.fn(),
    },
  },
}));

import { getCurrentSeason, getPickUsage } from "../data";
import { prisma } from "@/lib/prisma";

const mockedLeagueFindFirst = vi.mocked(prisma.league.findFirst);
const mockedPickFindMany = vi.mocked(prisma.pick.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentSeason", () => {
  it("returns the league season when a league exists", async () => {
    mockedLeagueFindFirst.mockResolvedValue({
      id: "1",
      name: "Test League",
      season: 2025,
      maxDriverPicks: 2,
      maxConstructorPicks: 3,
      createdAt: new Date("2025-01-01"),
    });
    expect(await getCurrentSeason()).toBe(2025);
  });

  it("falls back to F1_SEASON env var when no league exists", async () => {
    mockedLeagueFindFirst.mockResolvedValue(null);
    const original = process.env.F1_SEASON;
    process.env.F1_SEASON = "2024";
    try {
      expect(await getCurrentSeason()).toBe(2024);
    } finally {
      if (original === undefined) delete process.env.F1_SEASON;
      else process.env.F1_SEASON = original;
    }
  });

  it("falls back to 2026 when no league and no env var", async () => {
    mockedLeagueFindFirst.mockResolvedValue(null);
    const original = process.env.F1_SEASON;
    delete process.env.F1_SEASON;
    try {
      expect(await getCurrentSeason()).toBe(2026);
    } finally {
      if (original !== undefined) process.env.F1_SEASON = original;
    }
  });
});

describe("getPickUsage", () => {
  it("counts driver and constructor uses from picks", async () => {
    mockedPickFindMany.mockResolvedValue([
      { driverId: "d1", teamId: "t1", raceId: "r1" },
      { driverId: "d1", teamId: "t2", raceId: "r2" },
      { driverId: "d2", teamId: "t1", raceId: "r3" },
    ] as never);

    const result = await getPickUsage("user1", 2026);
    expect(result.driverUses).toEqual({ d1: 2, d2: 1 });
    expect(result.constructorUses).toEqual({ t1: 2, t2: 1 });
  });

  it("excludes picks for the specified raceId", async () => {
    mockedPickFindMany.mockResolvedValue([
      { driverId: "d1", teamId: "t1", raceId: "r1" },
      { driverId: "d1", teamId: "t2", raceId: "r2" },
    ] as never);

    const result = await getPickUsage("user1", 2026, "r1");
    expect(result.driverUses).toEqual({ d1: 1 });
    expect(result.constructorUses).toEqual({ t2: 1 });
  });

  it("returns empty records when no picks exist", async () => {
    mockedPickFindMany.mockResolvedValue([]);

    const result = await getPickUsage("user1", 2026);
    expect(result.driverUses).toEqual({});
    expect(result.constructorUses).toEqual({});
  });

  it("skips null driverId and teamId", async () => {
    mockedPickFindMany.mockResolvedValue([
      { driverId: null, teamId: null, raceId: "r1" },
      { driverId: "d1", teamId: null, raceId: "r2" },
      { driverId: null, teamId: "t1", raceId: "r3" },
    ] as never);

    const result = await getPickUsage("user1", 2026);
    expect(result.driverUses).toEqual({ d1: 1 });
    expect(result.constructorUses).toEqual({ t1: 1 });
  });
});
