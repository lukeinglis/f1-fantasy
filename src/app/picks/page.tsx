import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teamColor, teamShort, teamTextColor } from "@/lib/f1-meta";
import { createModuleLogger } from "@/lib/logger";
import { DriverAvatar } from "@/components/DriverAvatar";

const log = createModuleLogger("picks/page");

export const dynamic = "force-dynamic";

export default async function MyPicksPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/picks");
  }
  const userId = session.user.id;

  const league = await prisma.league.findFirst();
  const season = league?.season ?? Number(process.env.F1_SEASON ?? 2026);

  const now = new Date();

  const [picks, drivers, constructors, scores, currentRace] = await Promise.all([
    prisma.pick.findMany({
      where: { userId, race: { season } },
      include: {
        race: true,
        driver: true,
        team: true,
      },
      orderBy: { race: { round: "asc" } },
    }),
    prisma.driver.findMany(),
    prisma.team.findMany(),
    prisma.score.findMany({ where: { userId } }),
    prisma.race.findFirst({
      where: { season, pickDeadline: { lte: now } },
      orderBy: { round: "desc" },
    }),
  ]);

  const currentRacePicks = currentRace
    ? await prisma.pick.findMany({
        where: { raceId: currentRace.id },
        include: {
          user: { select: { id: true, name: true } },
          driver: {
            select: { id: true, givenName: true, familyName: true, code: true },
          },
          team: { select: { id: true, name: true } },
        },
        orderBy: { user: { name: "asc" } },
      })
    : [];

  log.info(
    { userId, currentRaceId: currentRace?.id, leaguePickCount: currentRacePicks.length },
    "picks page loaded",
  );

  const scoreByRace = new Map(scores.map((s) => [s.raceId, s]));

  const driverUses = new Map<string, number>();
  const consUses = new Map<string, number>();
  for (const p of picks) {
    if (p.driverId)
      driverUses.set(p.driverId, (driverUses.get(p.driverId) ?? 0) + 1);
    if (p.teamId) consUses.set(p.teamId, (consUses.get(p.teamId) ?? 0) + 1);
  }

  const maxDriver = league?.maxDriverPicks ?? 2;
  const maxConstructor = league?.maxConstructorPicks ?? 3;

  // Compute season total
  const seasonTotal = picks.reduce((sum, p) => {
    const s = scoreByRace.get(p.raceId);
    return sum + (s?.totalPoints ?? 0);
  }, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">My Picks</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Track everything you&rsquo;ve used and what you have left.
          {seasonTotal > 0 && (
            <span className="text-red-400 font-medium ml-2">
              Season total: {Math.round(seasonTotal * 10) / 10} pts
            </span>
          )}
        </p>
      </header>

      <section className="grid sm:grid-cols-2 gap-4">
        <UsagePanel
          title="Drivers"
          totalAvailable={drivers.length}
          items={drivers.map((d) => ({
            id: d.id,
            label: `${d.familyName}${d.code ? ` (${d.code})` : ""}`,
          }))}
          uses={driverUses}
          max={maxDriver}
        />
        <UsagePanel
          title="Constructors"
          totalAvailable={constructors.length}
          items={constructors.map((c) => ({ id: c.id, label: c.name }))}
          uses={consUses}
          max={maxConstructor}
          showTeamColors
        />
      </section>

      {/* Current race league picks (visible only after deadline) */}
      {currentRace && currentRacePicks.length > 0 && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold p-4 border-b border-zinc-800">
            <Link
              href={`/races/${currentRace.id}`}
              className="hover:text-red-400 transition-colors"
            >
              R{currentRace.round} / {currentRace.name}
            </Link>
            <span className="text-sm text-zinc-400 font-normal ml-2">
              League picks
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/40 text-zinc-400 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-left px-4 py-2">Driver</th>
                  <th className="text-left px-4 py-2">Constructor</th>
                </tr>
              </thead>
              <tbody>
                {currentRacePicks.map((p) => {
                  const isMe = p.userId === userId;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-zinc-800 ${
                        isMe ? "bg-red-900/5" : "hover:bg-zinc-800/30"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                        {p.user.name}
                        {isMe && (
                          <span className="text-zinc-500 text-xs ml-1.5">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {p.driver ? (
                          <span className="inline-flex items-center gap-1.5">
                            <DriverAvatar driverId={p.driver.id} size={24} />
                            {p.driver.givenName} {p.driver.familyName}
                            {p.driver.code && (
                              <span className="text-zinc-500 text-xs">
                                {p.driver.code}
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.team ? (
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-bold"
                            style={{
                              backgroundColor: teamColor(p.team.id),
                              color: teamTextColor(p.team.id),
                            }}
                          >
                            {teamShort(p.team.id)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-4">By race</h2>
        {picks.length === 0 ? (
          <p className="text-zinc-400">
            No picks yet.{" "}
            <Link href="/races" className="text-red-400 hover:underline">
              Head to the calendar
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {picks.map((p) => {
              const s = scoreByRace.get(p.raceId);
              const color = p.team ? teamColor(p.team.id) : "#555555";

              return (
                <Link
                  key={p.id}
                  href={`/races/${p.raceId}`}
                  className="group relative rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors"
                  style={{
                    background: `linear-gradient(135deg, ${color}20 0%, transparent 60%)`,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: color }}
                  />

                  {p.team && (
                    <span
                      className="absolute right-[-0.25rem] top-1/2 -translate-y-1/2 text-4xl font-black uppercase pointer-events-none select-none leading-none"
                      style={{ color: `${color}28` }}
                    >
                      {teamShort(p.team.id)}
                    </span>
                  )}

                  <div className="p-3 pl-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${color}40`, color }}
                        >
                          R{p.race.round}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate max-w-[80px]">
                          {p.race.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums">
                        {s ? (
                          <span className="text-red-400">
                            {s.totalPoints}
                          </span>
                        ) : (
                          <span className="text-zinc-600">&mdash;</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {p.driver ? (
                        <DriverAvatar
                          driverId={p.driver.id}
                          size={56}
                          className="shrink-0 ring-2 ring-zinc-700 group-hover:ring-zinc-500 transition-all"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-zinc-800 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {p.driver
                            ? `${p.driver.givenName} ${p.driver.familyName}`
                            : "No driver"}
                        </p>
                        {p.team ? (
                          <span
                            className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: teamColor(p.team.id),
                              color: teamTextColor(p.team.id),
                            }}
                          >
                            {teamShort(p.team.id)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 mt-1">
                            No constructor
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

interface UsagePanelItem {
  id: string;
  label: string;
}
function UsagePanel({
  title,
  items,
  uses,
  max,
  showTeamColors,
}: {
  title: string;
  items: UsagePanelItem[];
  uses: Map<string, number>;
  max: number;
  totalAvailable: number;
  showTeamColors?: boolean;
}) {
  const usedItems = items.filter((i) => (uses.get(i.id) ?? 0) > 0);
  const exhaustedCount = usedItems.filter(
    (i) => (uses.get(i.id) ?? 0) >= max,
  ).length;
  const availableCount = items.length - exhaustedCount;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      <div className="flex items-baseline gap-3 mt-1">
        <p className="text-2xl font-bold">
          {availableCount}
          <span className="text-sm text-zinc-400 font-normal ml-1">
            available
          </span>
        </p>
        {exhaustedCount > 0 && (
          <p className="text-sm text-red-400">
            {exhaustedCount} exhausted
          </p>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Max {max} uses per {title === "Drivers" ? "driver" : "constructor"}
      </p>
      {usedItems.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-zinc-500 mb-1.5">Used so far:</p>
          <div className="flex flex-wrap gap-1.5">
            {usedItems
              .sort(
                (a, b) =>
                  (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0),
              )
              .map((i) => {
                const used = uses.get(i.id) ?? 0;
                const exhausted = used >= max;

                if (showTeamColors) {
                  return (
                    <span
                      key={i.id}
                      className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                        exhausted ? "opacity-40 line-through" : ""
                      }`}
                      style={{
                        backgroundColor: teamColor(i.id),
                        color: teamTextColor(i.id),
                      }}
                      title={`${i.label}: ${used}/${max}`}
                    >
                      {teamShort(i.id)} {used}/{max}
                    </span>
                  );
                }

                return (
                  <span
                    key={i.id}
                    className={`text-[11px] px-2 py-0.5 rounded border ${
                      exhausted
                        ? "bg-red-900/40 text-red-300 border-red-800"
                        : "bg-amber-900/30 text-amber-200 border-amber-800"
                    }`}
                    title={`${i.label}: ${used}/${max}`}
                  >
                    {i.label} {used}/{max}
                  </span>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
