import { describe, expect, it } from "vitest";
import { isPreSeasonRound, FIRST_ACTIVE_ROUND, CURRENT_SEASON } from "../season";

describe("isPreSeasonRound", () => {
  it("returns true for rounds before FIRST_ACTIVE_ROUND", () => {
    for (let r = 1; r < FIRST_ACTIVE_ROUND; r++) {
      expect(isPreSeasonRound(r)).toBe(true);
    }
  });

  it("returns false for FIRST_ACTIVE_ROUND and above", () => {
    expect(isPreSeasonRound(FIRST_ACTIVE_ROUND)).toBe(false);
    expect(isPreSeasonRound(FIRST_ACTIVE_ROUND + 1)).toBe(false);
    expect(isPreSeasonRound(24)).toBe(false);
  });

  it("returns true for round 0", () => {
    expect(isPreSeasonRound(0)).toBe(true);
  });

  it("returns true for negative rounds", () => {
    expect(isPreSeasonRound(-1)).toBe(true);
  });
});

describe("FIRST_ACTIVE_ROUND", () => {
  it("is 5 (Canadian GP)", () => {
    expect(FIRST_ACTIVE_ROUND).toBe(5);
  });
});

describe("CURRENT_SEASON", () => {
  it("is 2026", () => {
    expect(CURRENT_SEASON).toBe(2026);
  });
});
