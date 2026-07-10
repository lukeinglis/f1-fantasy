import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("f1-meta");

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
  const color = TEAM_COLORS[constructorId];
  if (!color) {
    log.debug({ constructorId }, "unknown team color, using fallback");
  }
  return color ?? "#555555";
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
  const short = TEAM_SHORT[constructorId];
  if (!short) {
    log.debug({ constructorId }, "unknown team short name, using fallback");
  }
  return short ?? constructorId.substring(0, 3).toUpperCase();
}

export function driverImage(driverId: string): string {
  return `/drivers/${driverId}.png`;
}
