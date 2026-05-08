// Season constants
// The league started mid-season at Race 8 (Emilia Romagna GP).
// Races 1-7 happened before anyone joined, so they are "pre-season" for fantasy purposes.
export const FIRST_ACTIVE_ROUND = 8;

export function isPreSeasonRound(round: number): boolean {
  return round < FIRST_ACTIVE_ROUND;
}
