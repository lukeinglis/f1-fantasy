// Constructor team colors (2026 season) keyed by jolpica constructorId
export const TEAM_COLORS: Record<string, string> = {
  red_bull: "#3671C6",
  ferrari: "#E8002D",
  mercedes: "#27F4D2",
  mclaren: "#FF8000",
  aston_martin: "#229971",
  alpine: "#0093CC",
  williams: "#64C4FF",
  rb: "#6692FF",
  haas: "#B6BABD",
  audi: "#DE3226",
  cadillac: "#1B2D4B",
};

export function teamColor(constructorId: string): string {
  return TEAM_COLORS[constructorId] ?? "#555555";
}

export function teamTextColor(constructorId: string): string {
  const dark = ["mercedes", "williams", "haas", "rb"];
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
  haas: "HAS",
  audi: "AUD",
  cadillac: "CAD",
};

export function teamShort(constructorId: string): string {
  return TEAM_SHORT[constructorId] ?? constructorId.substring(0, 3).toUpperCase();
}
