// Scoring rules for the F1 fantasy game.
//
// Driver pick: standard F1 points for the finishing position of the picked driver
// (25-18-15-12-10-8-6-4-2-1 for P1..P10, 0 otherwise).
// Constructor pick: sum of points for both of that constructor's drivers in the race.
//
// We deliberately ignore sprint races and fastest-lap bonuses for now to keep the MVP simple.

export const POSITION_POINTS: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

export function pointsForPosition(position: number | null | undefined): number {
  if (!position || position <= 0) return 0;
  return POSITION_POINTS[position] ?? 0;
}
