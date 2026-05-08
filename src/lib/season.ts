// Season constants
// The league starts at Race 5 (Canadian GP, May 24).
// Races 1-4 happened before anyone joined and are hidden entirely.
export const FIRST_ACTIVE_ROUND = 5;
export const CURRENT_SEASON = 2026;

export function isPreSeasonRound(round: number): boolean {
  return round < FIRST_ACTIVE_ROUND;
}
