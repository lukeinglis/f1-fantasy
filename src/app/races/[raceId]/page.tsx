import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import { teamColor, teamShort, teamTextColor } from "@/lib/f1-meta";
import PickForm from "@/components/PickForm";
import PredictionForm from "@/components/PredictionForm";
import PredictionResults from "@/components/PredictionResults";
import Countdown from "@/components/Countdown";
import { DriverAvatar } from "@/components/DriverAvatar";
import { getPickUsage } from "@/lib/data";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function RaceDetailPage(props: {
  params: Promise<{ raceId: string }>;
}) {
  const { raceId } = await props.params;
  const session = await auth();
  const userId = session?.user?.id;

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      results: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!race) {
    return (
      <div className="card-paper border-2 border-stone-400 rounded-xl p-6 cartoon-shadow">
        <h1 className="text-xl font-semibold text-stone-800">Race not found</h1>
        <Link
          href="/races"
          className="text-red-700 hover:underline mt-2 inline-block font-bold"
        >
          Back to calendar
        </Link>
      </div>
    );
  }
  const league = await prisma.league.findFirst();
  const season = league?.season ?? race.season;
  const preSeason = isPreSeasonRound(race.round);

  const [activeDriverIds, allDrivers, constructors, allPicks] = await Promise.all([
    prisma.raceResult.findMany({
      where: { race: { season } },
      select: { driverId: true },
      distinct: ['driverId'],
    }),
    prisma.driver.findMany({ orderBy: { familyName: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.pick.findMany({
      where: { raceId },
      include: {
        user: { select: { id: true, name: true } },
        driver: {
          select: { id: true, familyName: true, givenName: true, code: true },
        },
        team: { select: { id: true, name: true } },
      },
    }),
  ]);
  const activeIds = new Set(activeDriverIds.map(r => r.driverId));
  const drivers = activeIds.size > 0
    ? allDrivers.filter(d => activeIds.has(d.id))
    : allDrivers;

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const consById = new Map(constructors.map((c) => [c.id, c]));

  // Fetch user-specific data only when authenticated
  let myPick: { driverId: string | null; teamId: string | null } | null = null;
  let myPredictions: { position: number; driverId: string }[] = [];
  let driverUses: Record<string, number> = {};
  let consUses: Record<string, number> = {};

  if (userId) {
    const [fetchedPick, fetchedPredictions, pickUsage] = await Promise.all([
      prisma.pick.findUnique({
        where: { userId_raceId: { userId, raceId } },
      }),
      prisma.prediction.findMany({
        where: { userId, raceId },
        orderBy: { position: "asc" },
      }),
      getPickUsage(userId, season, raceId),
    ]);
    myPick = fetchedPick;
    myPredictions = fetchedPredictions;
    driverUses = pickUsage.driverUses;
    consUses = pickUsage.constructorUses;
  }

  const maxDriver = league?.maxDriverPicks ?? 2;
  const maxConstructor = league?.maxConstructorPicks ?? 3;

  const now = new Date();
  const deadlinePassed = now >= race.pickDeadline;
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  // Prediction data
  const [allPredictions, predictionScores] = await Promise.all([
    deadlinePassed
      ? prisma.prediction.findMany({
          where: { raceId },
          include: {
            user: { select: { id: true, name: true } },
            driver: {
              select: { id: true, givenName: true, familyName: true, code: true },
            },
          },
          orderBy: { position: "asc" },
        })
      : Promise.resolve([]),
    prisma.predictionScore.findMany({
      where: { raceId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  // Build player prediction data for PredictionResults
  const predScoreByUser = new Map(
    predictionScores.map((s) => [s.userId, s]),
  );
  const predictionsByUser = new Map<
    string,
    {
      userId: string;
      userName: string;
      predictions: {
        position: number;
        driverId: string;
        driverName: string;
        driverCode: string | null;
      }[];
      totalPoints: number | null;
      exactMatches: number | null;
      closeMatches: number | null;
    }
  >();

  for (const pred of allPredictions) {
    const user = pred.user;
    if (!predictionsByUser.has(user.id)) {
      const score = predScoreByUser.get(user.id);
      predictionsByUser.set(user.id, {
        userId: user.id,
        userName: user.name,
        predictions: [],
        totalPoints: score?.totalPoints ?? null,
        exactMatches: score?.exactMatches ?? null,
        closeMatches: score?.closeMatches ?? null,
      });
    }
    const entry = predictionsByUser.get(user.id)!;
    entry.predictions.push({
      position: pred.position,
      driverId: pred.driverId,
      driverName: `${pred.driver.givenName} ${pred.driver.familyName}`,
      driverCode: pred.driver.code,
    });
  }

  const predictionPlayers = Array.from(predictionsByUser.values());
  const hasPredictionScores = predictionScores.length > 0;

  const scores = await prisma.score.findMany({
    where: { raceId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { totalPoints: "desc" },
  });

  const scoreByUser = new Map(scores.map((s) => [s.userId, s]));

  // Build enriched picks for the "all picks" view
  const enrichedPicks = allPicks.map((p) => {
    const score = scoreByUser.get(p.userId);
    return {
      ...p,
      driverPoints: score?.driverPoints ?? null,
      constructorPoints: score?.constructorPoints ?? null,
      totalPoints: score?.totalPoints ?? null,
    };
  });

  // Sort: by total points desc if scored, otherwise by name
  const sortedPicks = [...enrichedPicks].sort((a, b) => {
    if (a.totalPoints != null && b.totalPoints != null) {
      return b.totalPoints - a.totalPoints;
    }
    return a.user.name.localeCompare(b.user.name);
  });

  const hasScores = scores.length > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/races"
        className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900 transition-colors font-medium"
      >
        &larr; Back to calendar
      </Link>

      {/* Pre-season banner */}
      {preSeason && (
        <div className="card-paper border-2 border-amber-400 rounded-xl px-4 py-3 text-sm text-stone-600 flex items-center gap-3 cartoon-shadow">
          <span className="text-amber-600 text-lg">&#9432;</span>
          <span>
            This race happened before the league started. Results are shown
            for reference but don&apos;t count toward fantasy scores.
          </span>
        </div>
      )}

      {/* Race header */}
      <header className="card-paper border-2 border-stone-400 rounded-xl p-6 cartoon-shadow">
        <div className="flex items-baseline gap-2 text-stone-500 text-sm">
          Round {race.round} &middot; {season}
        </div>
        <h1
          className="text-3xl mt-1 text-stone-800"
          style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.1)" }}
        >
          {race.name}
        </h1>
        {race.circuitName && (
          <div className="text-stone-500 mt-1">
            {race.circuitName}
            {race.locality && ` / ${race.locality}`}
            {race.country && `, ${race.country}`}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="text-sm text-stone-600">{fmtDate(race.date)}</div>
          {race.resultsLocked && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold sticker">
              Results final
            </span>
          )}
          {!race.resultsLocked && deadlinePassed && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-bold sticker">
              Picks closed
            </span>
          )}
          {!deadlinePassed && !preSeason && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-600 text-white font-bold sticker">
              Picks open
            </span>
          )}
          {preSeason && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-stone-400 text-white font-bold sticker">
              Pre-season
            </span>
          )}
        </div>

        {/* Countdown for upcoming races */}
        {!deadlinePassed && !preSeason && (
          <div className="mt-4">
            <Countdown
              targetDate={race.pickDeadline.toISOString()}
              label="Pick deadline"
            />
          </div>
        )}
      </header>

      {/* Pick form (only before deadline, not pre-season, authenticated only) */}
      {userId && !deadlinePassed && !preSeason && (
        <section className="card-paper border-2 border-stone-400 rounded-xl p-5 cartoon-shadow">
          <h2
            className="text-lg mb-1 text-stone-800"
            style={{ fontFamily: "var(--font-bangers)" }}
          >
            Make your pick
          </h2>
          <p className="text-xs text-stone-500 mb-3">Pick one driver and one constructor — score points based on their race finish.</p>
          <PickForm
            raceId={race.id}
            drivers={drivers.map((d) => ({
              id: d.id,
              code: d.code,
              givenName: d.givenName,
              familyName: d.familyName,
            }))}
            constructors={constructors.map((c) => ({
              id: c.id,
              name: c.name,
            }))}
            currentDriverId={myPick?.driverId ?? null}
            currentConstructorId={myPick?.teamId ?? null}
            driverUses={driverUses}
            constructorUses={consUses}
            maxDriverPicks={maxDriver}
            maxConstructorPicks={maxConstructor}
          />
        </section>
      )}

      {/* Prediction form (only before deadline, not pre-season, authenticated only) */}
      {userId && !deadlinePassed && !preSeason && (
        <section className="card-paper border-2 border-stone-400 rounded-xl p-5 cartoon-shadow">
          <p className="text-xs text-stone-500 mb-3">Predict the top 10 finishers for bonus points in a separate challenge.</p>
          <PredictionForm
            raceId={race.id}
            drivers={drivers.map((d) => ({
              id: d.id,
              code: d.code,
              givenName: d.givenName,
              familyName: d.familyName,
            }))}
            existing={myPredictions.map((p) => ({
              position: p.position,
              driverId: p.driverId,
            }))}
          />
        </section>
      )}

      {/* Prediction results (shown after deadline) */}
      {deadlinePassed && predictionPlayers.length > 0 && (
        <section className="card-paper border-2 border-stone-400 rounded-xl overflow-hidden cartoon-shadow">
          <h2
            className="text-lg p-4 border-b border-stone-300 text-stone-800"
            style={{ fontFamily: "var(--font-bangers)" }}
          >
            {hasPredictionScores ? "Prediction scoreboard" : "All predictions"}
          </h2>
          <div className="p-4">
            <PredictionResults
              players={predictionPlayers}
              results={race.results.map((r) => ({
                driverId: r.driverId,
                position: r.position,
              }))}
              currentUserId={userId ?? ""}
              hasScores={hasPredictionScores}
            />
          </div>
        </section>
      )}

      {/* All picks with scores (shown after deadline) */}
      {deadlinePassed && sortedPicks.length > 0 && (
        <section className="wood-panel border-4 border-[#2a1f15] rounded-2xl overflow-hidden cartoon-shadow">
          <h2
            className="text-lg p-4 border-b border-[#2a1f15]/50 text-amber-100"
            style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.03em" }}
          >
            {hasScores ? "Fantasy scoreboard" : "All picks"}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2a1f15] text-amber-300/70 uppercase text-xs tracking-wide">
                  {hasScores && (
                    <th className="text-left px-4 py-2 w-10" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>#</th>
                  )}
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Player</th>
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Driver</th>
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Constructor</th>
                  {hasScores && (
                    <>
                      <th className="text-right px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Drv pts</th>
                      <th className="text-right px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Con pts</th>
                      <th className="text-right px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedPicks.map((p, i) => {
                  const isWinner =
                    i === 0 && hasScores && (p.totalPoints ?? 0) > 0;
                  const isMe = p.userId === userId;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-[#2a1f15]/50 ${
                        isWinner
                          ? "bg-amber-900/20"
                          : isMe
                            ? "bg-red-900/10"
                            : "hover:bg-white/5"
                      }`}
                    >
                      {hasScores && (
                        <td className="px-4 py-3 tabular-nums">
                          {isWinner ? (
                            <span className="text-amber-300 font-bold">
                              🏆 {i + 1}
                            </span>
                          ) : (
                            <span className="text-amber-100/50">{i + 1}</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-amber-50">
                        {p.user.name}
                        {isMe && (
                          <span className="text-amber-100/50 text-xs ml-1.5">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-amber-100/80">
                        <span className="inline-flex items-center gap-1.5">
                          {p.driver && (
                            <DriverAvatar driverId={p.driver.id} size={28} className="shrink-0" />
                          )}
                          {p.driver
                            ? `${p.driver.givenName} ${p.driver.familyName}`
                            : "—"}
                          {p.driver?.code && (
                            <span className="text-amber-100/50 text-xs ml-1">
                              {p.driver.code}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
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
                      {hasScores && (
                        <>
                          <td className="px-4 py-3 text-right tabular-nums text-amber-100/60">
                            {p.driverPoints ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-amber-100/60">
                            {p.constructorPoints ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-white text-base">
                            {p.totalPoints ?? 0}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {deadlinePassed && sortedPicks.length === 0 && (
        <section className="card-paper border-2 border-stone-400 rounded-xl p-5 cartoon-shadow">
          <h2
            className="text-lg mb-2 text-stone-800"
            style={{ fontFamily: "var(--font-bangers)" }}
          >
            All picks
          </h2>
          <p className="text-stone-500">
            No picks were submitted for this race.
          </p>
        </section>
      )}

      {/* Race results */}
      {race.results.length > 0 && (
        <section className="wood-panel border-4 border-[#2a1f15] rounded-2xl overflow-hidden cartoon-shadow">
          <h2
            className="text-lg p-4 border-b border-[#2a1f15]/50 text-amber-100"
            style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.03em" }}
          >
            Race results
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2a1f15] text-amber-300/70 uppercase text-xs tracking-wide">
                  <th className="text-left px-4 py-2 w-12" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Pos</th>
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Driver</th>
                  <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Constructor</th>
                  <th className="text-left px-4 py-2 w-20" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Status</th>
                  <th className="text-right px-4 py-2 w-16" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {race.results.map((r, i) => {
                  const d = driverById.get(r.driverId);
                  const c = consById.get(r.teamId);
                  const isTop3 = r.position >= 1 && r.position <= 3;
                  return (
                    <tr
                      key={r.driverId}
                      className={`border-t border-[#2a1f15]/50 hover:bg-white/5 ${
                        i % 2 === 0 ? "bg-white/[0.03]" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 tabular-nums">
                        {isTop3 ? (
                          <span
                            className={
                              r.position === 1
                                ? "text-amber-300 font-bold"
                                : r.position === 2
                                  ? "text-stone-300 font-bold"
                                  : "text-amber-700 font-bold"
                            }
                          >
                            {r.positionText ?? r.position}
                          </span>
                        ) : (
                          <span className="text-amber-100/50">
                            {r.positionText ?? r.position}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-amber-100/80">
                        <span className="inline-flex items-center gap-1.5">
                          <DriverAvatar driverId={r.driverId} size={24} className="shrink-0" />
                          {d ? `${d.givenName} ${d.familyName}` : r.driverId}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {c ? (
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-bold"
                            style={{
                              backgroundColor: teamColor(c.id),
                              color: teamTextColor(c.id),
                            }}
                          >
                            {teamShort(c.id)}
                          </span>
                        ) : (
                          <span className="text-amber-100/50">{r.teamId}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-amber-100/40 text-xs">
                        {r.status && r.status !== "Finished" ? r.status : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-100/80">
                        {r.points > 0 ? r.points : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Admin link */}
      {isAdmin && !race.resultsLocked && (
        <section className="card-paper border-2 border-amber-400 rounded-xl p-5 cartoon-shadow">
          <h2
            className="text-lg mb-2 text-amber-700"
            style={{ fontFamily: "var(--font-bangers)" }}
          >
            Admin tools
          </h2>
          <p className="text-sm text-stone-600">
            Go to{" "}
            <Link href="/admin" className="text-amber-700 underline font-bold">
              Admin
            </Link>{" "}
            to sync results from the API or enter them manually.
          </p>
        </section>
      )}
    </div>
  );
}
