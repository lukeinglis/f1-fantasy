import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TEAM_COLORS, teamTextColor, teamShort } from "@/lib/f1-meta";

export const dynamic = "force-dynamic";

interface CellData {
  driverCode: string | null;
  driverName: string | null;
  constructorId: string | null;
  constructorName: string | null;
  totalPoints: number | null;
}

async function getGridData() {
  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2025);

  const [races, users, picks, scores] = await Promise.all([
    prisma.race.findMany({
      where: { season },
      orderBy: { round: "asc" },
      select: { id: true, round: true, name: true, country: true, date: true, resultsLocked: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pick.findMany({
      where: { race: { season } },
      include: {
        driver: { select: { id: true, code: true, givenName: true, familyName: true } },
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.score.findMany({
      where: { race: { season } },
      select: { userId: true, raceId: true, totalPoints: true },
    }),
  ]);

  // Build lookup: picksByUserRace[userId][raceId]
  const pickMap = new Map<string, Map<string, CellData>>();
  for (const p of picks) {
    if (!pickMap.has(p.userId)) pickMap.set(p.userId, new Map());
    const userPicks = pickMap.get(p.userId)!;
    userPicks.set(p.raceId, {
      driverCode: p.driver?.code ?? p.driver?.familyName?.substring(0, 3).toUpperCase() ?? null,
      driverName: p.driver ? `${p.driver.givenName} ${p.driver.familyName}` : null,
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

  // Compute season totals per user
  const userTotals = new Map<string, number>();
  for (const s of scores) {
    userTotals.set(s.userId, (userTotals.get(s.userId) ?? 0) + s.totalPoints);
  }

  return { season, races, users, pickMap, userTotals };
}

// Country code to flag emoji
function countryFlag(country: string | null): string {
  const flags: Record<string, string> = {
    Australia: "AU", Bahrain: "BH", "Saudi Arabia": "SA", Japan: "JP",
    China: "CN", USA: "US", Italy: "IT", Monaco: "MC", Canada: "CA",
    Spain: "ES", Austria: "AT", UK: "GB", Hungary: "HU", Belgium: "BE",
    Netherlands: "NL", Singapore: "SG", Azerbaijan: "AZ", Mexico: "MX",
    Brazil: "BR", "United States": "US", Qatar: "QA", UAE: "AE",
    "Abu Dhabi": "AE", Portugal: "PT", France: "FR", Germany: "DE",
    Turkey: "TR", Russia: "RU", Emilia: "IT",
  };
  const code = flags[country ?? ""] ?? null;
  if (!code) return "";
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

function raceShortName(name: string): string {
  return name
    .replace(/ Grand Prix$/, "")
    .replace(/ GP$/, "")
    .substring(0, 12);
}

export default async function GridPage() {
  const { season, races, users, pickMap, userTotals } = await getGridData();
  const now = new Date();

  if (users.length === 0 || races.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Season Grid</h1>
        <p className="text-zinc-400">No data yet. Sync the season from the admin panel first.</p>
      </div>
    );
  }

  // Sort users by total points descending
  const sortedUsers = [...users].sort((a, b) =>
    (userTotals.get(b.id) ?? 0) - (userTotals.get(a.id) ?? 0)
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Season Grid <span className="text-red-500">{season}</span>
          </h1>
          <p className="text-zinc-400 mt-1">
            Every pick at a glance. Driver code on constructor colors.
          </p>
        </div>
      </header>

      <div className="overflow-x-auto pb-4">
        <table className="border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-950 px-3 py-2 text-left text-zinc-400 uppercase tracking-wide min-w-[100px]">
                Player
              </th>
              <th className="sticky left-[100px] z-10 bg-zinc-950 px-2 py-2 text-right text-zinc-400 uppercase tracking-wide min-w-[40px]">
                Pts
              </th>
              {races.map((r) => {
                const isPast = new Date(r.date) < now;
                return (
                  <th
                    key={r.id}
                    className={`px-1 py-2 text-center min-w-[64px] ${
                      isPast ? "text-zinc-400" : "text-zinc-300"
                    }`}
                  >
                    <Link href={`/races/${r.id}`} className="hover:text-red-400">
                      <div className="text-[10px] leading-tight">
                        {countryFlag(r.country)}
                      </div>
                      <div className="leading-tight font-medium">
                        R{r.round}
                      </div>
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const total = Math.round((userTotals.get(user.id) ?? 0) * 10) / 10;
              return (
                <tr key={user.id}>
                  <td className="sticky left-0 z-10 bg-zinc-950 px-3 py-1 font-medium text-sm whitespace-nowrap">
                    {user.name}
                  </td>
                  <td className="sticky left-[100px] z-10 bg-zinc-950 px-2 py-1 text-right font-bold text-red-400 tabular-nums">
                    {total || ""}
                  </td>
                  {races.map((r) => {
                    const cell = pickMap.get(user.id)?.get(r.id);
                    if (!cell || (!cell.driverCode && !cell.constructorId)) {
                      const isPast = new Date(r.date) < now;
                      return (
                        <td
                          key={r.id}
                          className={`rounded text-center py-1 px-1 ${
                            isPast
                              ? "bg-zinc-900/50 text-zinc-600"
                              : "bg-zinc-800/30 text-zinc-600"
                          }`}
                        >
                          {isPast ? "—" : ""}
                        </td>
                      );
                    }

                    const bgColor = cell.constructorId
                      ? TEAM_COLORS[cell.constructorId] ?? "#555"
                      : "#555";
                    const textColor = cell.constructorId
                      ? teamTextColor(cell.constructorId)
                      : "#fff";

                    return (
                      <td
                        key={r.id}
                        className="rounded text-center py-1 px-1 cursor-default"
                        style={{ backgroundColor: bgColor, color: textColor }}
                        title={`${cell.driverName ?? "No driver"} / ${cell.constructorName ?? "No constructor"}${
                          cell.totalPoints != null ? ` = ${cell.totalPoints} pts` : ""
                        }`}
                      >
                        <div className="font-bold text-[11px] leading-tight">
                          {cell.driverCode ?? "?"}
                        </div>
                        <div className="text-[9px] leading-tight opacity-80">
                          {cell.constructorId ? teamShort(cell.constructorId) : ""}
                        </div>
                        {cell.totalPoints != null && (
                          <div className="text-[9px] font-semibold leading-tight mt-0.5 opacity-90">
                            {cell.totalPoints}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(TEAM_COLORS).map(([id, color]) => (
          <span
            key={id}
            className="px-2 py-1 rounded font-medium"
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
