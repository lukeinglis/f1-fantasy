// Season constants
// The league started mid-season at Race 8.
// Races 1-7 happened before anyone joined and are hidden entirely.
export const FIRST_ACTIVE_ROUND = 8;
export const CURRENT_SEASON = 2026;

export function isPreSeasonRound(round: number): boolean {
  return round < FIRST_ACTIVE_ROUND;
}
