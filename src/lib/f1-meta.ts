// Constructor team colors (2025 season) keyed by ergast constructorId
export const TEAM_COLORS: Record<string, string> = {
  red_bull: "#3671C6",
  ferrari: "#E8002D",
  mercedes: "#27F4D2",
  mclaren: "#FF8000",
  aston_martin: "#229971",
  alpine: "#0093CC",
  williams: "#64C4FF",
  rb: "#6692FF",
  sauber: "#52E252",
  haas: "#B6BABD",
};

export function teamColor(constructorId: string): string {
  return TEAM_COLORS[constructorId] ?? "#555555";
}

export function teamTextColor(constructorId: string): string {
  const dark = ["mercedes", "sauber", "williams", "haas", "rb"];
  return dark.includes(constructorId) ? "#111111" : "#FFFFFF";
}

// Short team labels for compact display
export const TEAM_SHORT: Record<string, string> = {
  red_bull: "RBR",
  ferrari: "FER",
  mercedes: "MER",
  mclaren: "MCL",
  aston_martin: "AMR",
  alpine: "ALP",
  williams: "WIL",
  rb: "RB",
  sauber: "SAU",
  haas: "HAS",
};

export function teamShort(constructorId: string): string {
  return TEAM_SHORT[constructorId] ?? constructorId.substring(0, 3).toUpperCase();
}
