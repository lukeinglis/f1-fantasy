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
        <h1
          className="text-3xl text-stone-900"
          style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          My Picks
        </h1>
        <p className="text-stone-700 mt-1 text-sm">
          Track everything you&rsquo;ve used and what you have left.
          {seasonTotal > 0 && (
            <span className="text-red-700 font-medium ml-2">
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
        <section className="wood-panel border-4 border-[#2a1f15] rounded-2xl overflow-hidden cartoon-shadow">
          <h2
            className="text-lg font-semibold p-4 border-b border-[#2a1f15]/50 text-amber-100"
            style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.03em" }}
          >
            <Link
              href={`/races/${currentRace.id}`}
              className="hover:text-red-400 transition-colors"
            >
              R{currentRace.round} / {currentRace.name}
            </Link>
            <span className="text-sm text-amber-300/60 font-normal ml-2">
              League picks
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2a1f15] text-amber-300/70 uppercase text-xs tracking-wide">
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Player</th>
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Driver</th>
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Constructor</th>
                </tr>
              </thead>
              <tbody>
                {currentRacePicks.map((p) => {
                  const isMe = p.userId === userId;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-[#2a1f15]/50 ${
                        isMe ? "bg-amber-900/20" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap text-amber-50">
                        {p.user.name}
                        {isMe && (
                          <span className="text-amber-100/50 text-xs ml-1.5">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-amber-100/80">
                        {p.driver ? (
                          <span className="inline-flex items-center gap-1.5">
                            <DriverAvatar driverId={p.driver.id} size={24} />
                            {p.driver.givenName} {p.driver.familyName}
                            {p.driver.code && (
                              <span className="text-amber-100/50 text-xs">
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
        <h2
          className="text-lg mb-4 text-stone-900"
          style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.15)" }}
        >
          By race
        </h2>
        {picks.length === 0 ? (
          <p className="text-stone-700">
            No picks yet.{" "}
            <Link href="/races" className="text-red-700 hover:text-red-800 hover:underline">
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
                  className="group relative card-paper rounded-xl overflow-hidden border-2 border-stone-400 hover:border-stone-500 transition-colors cartoon-shadow"
                  style={{
                    background: `linear-gradient(135deg, ${color}15 0%, #f5f0e8 60%)`,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: color }}
                  />

                  {p.team && (
                    <span
                      className="absolute right-[-0.25rem] top-1/2 -translate-y-1/2 text-4xl font-black uppercase pointer-events-none select-none leading-none"
                      style={{ color: `${color}20` }}
                    >
                      {teamShort(p.team.id)}
                    </span>
                  )}

                  <div className="p-3 pl-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${color}30`, color }}
                        >
                          R{p.race.round}
                        </span>
                        <span className="text-[11px] text-stone-500 truncate max-w-[80px]">
                          {p.race.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums">
                        {s ? (
                          <span className="text-red-700">
                            {s.totalPoints}
                          </span>
                        ) : (
                          <span className="text-stone-400">&mdash;</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {p.driver ? (
                        <DriverAvatar
                          driverId={p.driver.id}
                          size={56}
                          className="shrink-0 ring-2 ring-stone-400 group-hover:ring-stone-500 transition-all"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-stone-300 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-stone-800">
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
                          <span className="text-xs text-stone-500 mt-1">
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
    <div className="card-paper border-2 border-stone-400 rounded-xl p-4 cartoon-shadow">
      <h3
        className="text-sm font-semibold uppercase tracking-wide text-stone-600"
        style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.08em" }}
      >
        {title}
      </h3>
      <div className="flex items-baseline gap-3 mt-1">
        <p className="text-2xl font-bold text-stone-900">
          {availableCount}
          <span className="text-sm text-stone-500 font-normal ml-1">
            available
          </span>
        </p>
        {exhaustedCount > 0 && (
          <p className="text-sm text-red-700">
            {exhaustedCount} exhausted
          </p>
        )}
      </div>
      <p className="text-xs text-stone-500">
        Max {max} uses per {title === "Drivers" ? "driver" : "constructor"}
      </p>
      {usedItems.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-stone-500 mb-1.5">Used so far:</p>
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
                        ? "bg-red-100 text-red-700 border-red-400"
                        : "bg-amber-100 text-amber-800 border-amber-400"
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
