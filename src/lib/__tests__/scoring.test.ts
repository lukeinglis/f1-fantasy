import { describe, expect, it } from "vitest";
import { pointsForPosition, predictionPointsForSlot, POSITION_POINTS } from "../scoring";

describe("pointsForPosition", () => {
  it("awards 25 pts for P1", () => {
    expect(pointsForPosition(1)).toBe(25);
  });

  it("awards 18 pts for P2", () => {
    expect(pointsForPosition(2)).toBe(18);
  });

  it("awards standard F1 points for P1-P10", () => {
    const expected = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    for (let pos = 1; pos <= 10; pos++) {
      expect(pointsForPosition(pos)).toBe(expected[pos - 1]);
    }
  });

  it("awards 0 pts for P11 and beyond", () => {
    expect(pointsForPosition(11)).toBe(0);
    expect(pointsForPosition(20)).toBe(0);
    expect(pointsForPosition(100)).toBe(0);
  });

  it("awards 0 pts for position 0", () => {
    expect(pointsForPosition(0)).toBe(0);
  });

  it("awards 0 pts for negative positions", () => {
    expect(pointsForPosition(-1)).toBe(0);
    expect(pointsForPosition(-100)).toBe(0);
  });

  it("awards 0 pts for null", () => {
    expect(pointsForPosition(null)).toBe(0);
  });

  it("awards 0 pts for undefined", () => {
    expect(pointsForPosition(undefined)).toBe(0);
  });

  it("awards 0 pts for very large positions", () => {
    expect(pointsForPosition(999999)).toBe(0);
  });
});

describe("POSITION_POINTS", () => {
  it("has exactly 10 entries (P1-P10)", () => {
    expect(Object.keys(POSITION_POINTS)).toHaveLength(10);
  });
});

describe("predictionPointsForSlot", () => {
  it("awards 5 pts for exact match", () => {
    expect(predictionPointsForSlot(1, 1)).toBe(5);
    expect(predictionPointsForSlot(5, 5)).toBe(5);
    expect(predictionPointsForSlot(10, 10)).toBe(5);
  });

  it("awards 2 pts for off-by-1", () => {
    expect(predictionPointsForSlot(1, 2)).toBe(2);
    expect(predictionPointsForSlot(5, 4)).toBe(2);
    expect(predictionPointsForSlot(10, 9)).toBe(2);
  });

  it("awards 1 pt for off-by-2", () => {
    expect(predictionPointsForSlot(1, 3)).toBe(1);
    expect(predictionPointsForSlot(5, 3)).toBe(1);
    expect(predictionPointsForSlot(10, 8)).toBe(1);
  });

  it("awards 0 pts for off-by-3 or more", () => {
    expect(predictionPointsForSlot(1, 4)).toBe(0);
    expect(predictionPointsForSlot(1, 10)).toBe(0);
    expect(predictionPointsForSlot(5, 1)).toBe(0);
  });

  it("awards 0 pts when actualPos is null", () => {
    expect(predictionPointsForSlot(1, null)).toBe(0);
  });

  it("awards 0 pts when actualPos is undefined", () => {
    expect(predictionPointsForSlot(1, undefined)).toBe(0);
  });

  it("awards 0 pts when actualPos is 0 or negative", () => {
    expect(predictionPointsForSlot(1, 0)).toBe(0);
    expect(predictionPointsForSlot(1, -1)).toBe(0);
  });

  it("awards 0 pts when actualPos is outside top 10", () => {
    expect(predictionPointsForSlot(1, 11)).toBe(0);
    expect(predictionPointsForSlot(5, 20)).toBe(0);
  });
});
