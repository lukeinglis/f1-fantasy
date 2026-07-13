import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TEAM_COLORS, teamTextColor, teamShort } from "@/lib/f1-meta";
import { isPreSeasonRound } from "@/lib/season";
import { DriverAvatar } from "@/components/DriverAvatar";

export const dynamic = "force-dynamic";

interface CellData {
  driverId: string | null;
  driverCode: string | null;
  driverName: string | null;
  constructorId: string | null;
  constructorName: string | null;
  totalPoints: number | null;
}

async function getGridData(currentUserId: string | null) {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2026);

  const [races, users, picks, scores] = await Promise.all([
    prisma.race.findMany({
      where: { season },
      orderBy: { round: "asc" },
      select: {
        id: true,
        round: true,
        name: true,
        country: true,
        date: true,
        pickDeadline: true,
        resultsLocked: true,
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pick.findMany({
      where: { race: { season } },
      include: {
        driver: {
          select: {
            id: true,
            code: true,
            givenName: true,
            familyName: true,
          },
        },
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.score.findMany({
      where: { race: { season } },
      select: { userId: true, raceId: true, totalPoints: true },
    }),
  ]);

  // Build a set of race IDs where the pick deadline has passed (picks are public)
  const now = new Date();
  const raceDeadlineMap = new Map(races.map((r) => [r.id, r.pickDeadline]));

  // Build lookup: picksByUserRace[userId][raceId]
  // Only include other players' picks for races where the deadline has passed
  const pickMap = new Map<string, Map<string, CellData>>();
  for (const p of picks) {
    const deadline = raceDeadlineMap.get(p.raceId);
    const isOwn = p.userId === currentUserId;
    const deadlinePassed = deadline ? now >= deadline : false;

    // Skip other players' picks for races where the deadline hasn't passed
    if (!isOwn && !deadlinePassed) continue;

    if (!pickMap.has(p.userId)) pickMap.set(p.userId, new Map());
    const userPicks = pickMap.get(p.userId)!;
    userPicks.set(p.raceId, {
      driverId: p.driver?.id ?? null,
      driverCode:
        p.driver?.code ??
        p.driver?.familyName?.substring(0, 3).toUpperCase() ??
        null,
      driverName: p.driver
        ? `${p.driver.givenName} ${p.driver.familyName}`
        : null,
      constructorId: p.team?.id ?? null,
      constructorName: p.team?.name ?? null,
      totalPoints: null,
    });
  }

  // Overlay scores
  for (const s of scores) {
    const userPicks = pickMap.get(s.userId);
    if (!userPicks) continue;
    const cell = userPicks.get(s.raceId);
    if (cell) {
      cell.totalPoints = Math.round(s.totalPoints * 10) / 10;
    }
  }

  // Compute season totals per user (active races only)
  const activeRaceIds = new Set(
    races.filter((r) => !isPreSeasonRound(r.round)).map((r) => r.id),
  );
  const userTotals = new Map<string, number>();
  for (const s of scores) {
    if (!activeRaceIds.has(s.raceId)) continue;
    userTotals.set(
      s.userId,
      (userTotals.get(s.userId) ?? 0) + s.totalPoints,
    );
  }

  return { season, races, users, pickMap, userTotals };
}

// Country code to flag emoji
function countryFlag(country: string | null): string {
  const flags: Record<string, string> = {
    Australia: "AU",
    Bahrain: "BH",
    "Saudi Arabia": "SA",
    Japan: "JP",
    China: "CN",
    USA: "US",
    Italy: "IT",
    Monaco: "MC",
    Canada: "CA",
    Spain: "ES",
    Austria: "AT",
    UK: "GB",
    Hungary: "HU",
    Belgium: "BE",
    Netherlands: "NL",
    Singapore: "SG",
    Azerbaijan: "AZ",
    Mexico: "MX",
    Brazil: "BR",
    "United States": "US",
    Qatar: "QA",
    UAE: "AE",
    "Abu Dhabi": "AE",
    Portugal: "PT",
    France: "FR",
    Germany: "DE",
    Turkey: "TR",
    Russia: "RU",
    Emilia: "IT",
  };
  const code = flags[country ?? ""] ?? null;
  if (!code) return "";
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export default async function GridPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const { season, races, users, pickMap, userTotals } = await getGridData(currentUserId);
  const now = new Date();

  if (users.length === 0 || races.length === 0) {
    return (
      <div className="space-y-4">
        <h1
          className="text-3xl text-stone-900"
          style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          Season Grid
        </h1>
        <p className="text-stone-700">
          No data yet. Sync the season from the admin panel first.
        </p>
      </div>
    );
  }

  // Sort users by total points descending
  const sortedUsers = [...users].sort(
    (a, b) =>
      (userTotals.get(b.id) ?? 0) - (userTotals.get(a.id) ?? 0),
  );

  const activeRaces = races.filter((r) => !isPreSeasonRound(r.round));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-3xl text-stone-900"
            style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
          >
            Season Grid <span className="text-red-700">{season}</span>
          </h1>
          <p className="text-stone-700 mt-1 text-sm">
            Every pick at a glance. Hover for details.
          </p>
        </div>
      </header>

      {/* Main grid: active races */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <table className="border-separate border-spacing-[3px] text-xs w-auto">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 bg-[#3d2b1f] px-3 py-2 text-left text-amber-300/70 uppercase tracking-wide text-[10px] min-w-[110px]"
                style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}
              >
                Player
              </th>
              <th
                className="sticky left-[110px] z-20 bg-[#3d2b1f] px-2 py-2 text-right text-amber-300/70 uppercase tracking-wide text-[10px] min-w-[48px]"
                style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}
              >
                Total
              </th>
              {activeRaces.map((r) => {
                const isPast = new Date(r.date) < now;
                return (
                  <th
                    key={r.id}
                    className={`px-1 py-2 text-center min-w-[72px] ${
                      isPast ? "text-zinc-400" : "text-zinc-200"
                    }`}
                  >
                    <Link
                      href={`/races/${r.id}`}
                      className="hover:text-red-400 transition-colors"
                    >
                      <div className="text-sm leading-tight">
                        {countryFlag(r.country)}
                      </div>
                      <div className="leading-tight font-bold text-xs">
                        R{r.round}
                      </div>
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, userIdx) => {
              const total = Math.round(
                (userTotals.get(user.id) ?? 0) * 10,
              ) / 10;
              return (
                <tr key={user.id}>
                  <td className="sticky left-0 z-10 bg-[#3d2b1f] px-3 py-2 font-medium text-sm whitespace-nowrap text-amber-50">
                    {userIdx === 0 && total > 0 && (
                      <span className="text-amber-300 mr-1.5">&#9733;</span>
                    )}
                    {user.name}
                  </td>
                  <td className="sticky left-[110px] z-10 bg-[#3d2b1f] px-2 py-2 text-right font-bold text-white tabular-nums text-sm">
                    {total || ""}
                  </td>
                  {activeRaces.map((r) => {
                    const cell = pickMap.get(user.id)?.get(r.id);
                    if (
                      !cell ||
                      (!cell.driverCode && !cell.constructorId)
                    ) {
                      const isPast = new Date(r.date) < now;
                      return (
                        <td
                          key={r.id}
                          className={`rounded-md text-center py-2 px-1 min-h-[52px] ${
                            isPast
                              ? "bg-stone-800/60 text-stone-500"
                              : "bg-[#f5f0e8]/60 text-stone-500 border border-dashed border-stone-400"
                          }`}
                        >
                          {isPast ? (
                            <span className="text-stone-500 text-[10px]">
                              &mdash;
                            </span>
                          ) : (
                            ""
                          )}
                        </td>
                      );
                    }

                    const bgColor = cell.constructorId
                      ? (TEAM_COLORS[cell.constructorId] ?? "#555")
                      : "#555";
                    const txtColor = cell.constructorId
                      ? teamTextColor(cell.constructorId)
                      : "#fff";

                    const shortName = cell.constructorId
                      ? teamShort(cell.constructorId)
                      : "";

                    return (
                      <td
                        key={r.id}
                        className="rounded-md text-center py-1.5 px-1 cursor-default transition-transform hover:scale-110 hover:z-10 hover:shadow-lg hover:shadow-black/40 relative group overflow-hidden"
                        style={{ backgroundColor: bgColor, color: txtColor }}
                      >
                        {shortName && (
                          <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-xl font-black leading-none"
                            style={{ color: txtColor, opacity: 0.12 }}
                          >
                            {shortName}
                          </div>
                        )}
                        <div className="relative z-[1] flex flex-col items-center gap-0.5">
                          {cell.driverId && (
                            <DriverAvatar
                              driverId={cell.driverId}
                              size={28}
                              className="ring-1 ring-white/20"
                            />
                          )}
                          <div className="font-bold text-[10px] leading-tight">
                            {cell.driverCode ?? "?"}
                          </div>
                          <div className="text-[8px] leading-tight opacity-70 font-semibold">
                            {shortName}
                          </div>
                          {cell.totalPoints != null && (
                            <div className="text-[10px] font-bold leading-tight opacity-90">
                              {cell.totalPoints}
                            </div>
                          )}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                          <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-left text-xs whitespace-nowrap shadow-xl">
                            <div className="text-zinc-200 font-medium">
                              {cell.driverName ?? "No driver"}
                            </div>
                            <div className="text-zinc-400">
                              {cell.constructorName ?? "No constructor"}
                            </div>
                            {cell.totalPoints != null && (
                              <div className="text-red-400 font-bold mt-1">
                                {cell.totalPoints} pts
                              </div>
                            )}
                          </div>
                          <div
                            className="w-2 h-2 bg-zinc-900 border-b border-r border-zinc-700 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Constructor legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(TEAM_COLORS).map(([id, color]) => (
          <span
            key={id}
            className="px-2.5 py-1 rounded-md font-bold tracking-wide"
            style={{
              backgroundColor: color,
              color: teamTextColor(id),
            }}
          >
            {teamShort(id)}
          </span>
        ))}
      </div>

    </div>
  );
}
