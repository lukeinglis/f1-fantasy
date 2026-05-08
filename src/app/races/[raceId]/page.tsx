import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import { teamColor, teamShort, teamTextColor } from "@/lib/f1-meta";
import PickForm from "@/components/PickForm";
import PredictionForm from "@/components/PredictionForm";
import PredictionResults from "@/components/PredictionResults";
import Countdown from "@/components/Countdown";

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
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h1 className="text-xl font-semibold">Race not found</h1>
        <Link
          href="/races"
          className="text-red-400 hover:underline mt-2 inline-block"
        >
          Back to calendar
        </Link>
      </div>
    );
  }
  if (!userId) {
    redirect(`/login?callbackUrl=/races/${raceId}`);
  }

  const league = await prisma.league.findFirst();
  const season = league?.season ?? race.season;
  const preSeason = isPreSeasonRound(race.round);

  const [drivers, constructors, myPicks, allPicks] = await Promise.all([
    prisma.driver.findMany({ orderBy: { familyName: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.pick.findMany({
      where: { userId },
      select: { driverId: true, teamId: true, raceId: true },
    }),
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

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const consById = new Map(constructors.map((c) => [c.id, c]));

  const myPick = await prisma.pick.findUnique({
    where: { userId_raceId: { userId, raceId } },
  });

  // Driver/constructor usage *excluding* this race
  const driverUses: Record<string, number> = {};
  const consUses: Record<string, number> = {};
  for (const p of myPicks) {
    if (p.raceId === raceId) continue;
    if (p.driverId) driverUses[p.driverId] = (driverUses[p.driverId] ?? 0) + 1;
    if (p.teamId) consUses[p.teamId] = (consUses[p.teamId] ?? 0) + 1;
  }
  const maxDriver = league?.maxDriverPicks ?? 2;
  const maxConstructor = league?.maxConstructorPicks ?? 3;

  const now = new Date();
  const deadlinePassed = now >= race.pickDeadline;
  const role = (session?.user as { role?: string }).role;
  const isAdmin = role === "admin";

  // Prediction data
  const [myPredictions, allPredictions, predictionScores] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId, raceId },
      orderBy: { position: "asc" },
    }),
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
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        &larr; Back to calendar
      </Link>

      {/* Pre-season banner */}
      {preSeason && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-400 flex items-center gap-3">
          <span className="text-zinc-500 text-lg">&#9432;</span>
          <span>
            This race happened before the league started. Results are shown
            for reference but don&apos;t count toward fantasy scores.
          </span>
        </div>
      )}

      {/* Race header */}
      <header className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-baseline gap-2 text-zinc-500 text-sm">
          Round {race.round} &middot; {season}
        </div>
        <h1 className="text-3xl font-bold mt-1">{race.name}</h1>
        {race.circuitName && (
          <div className="text-zinc-400 mt-1">
            {race.circuitName}
            {race.locality && ` / ${race.locality}`}
            {race.country && `, ${race.country}`}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="text-sm text-zinc-300">{fmtDate(race.date)}</div>
          {race.resultsLocked && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800">
              Results final
            </span>
          )}
          {!race.resultsLocked && deadlinePassed && (
            <span className="text-xs px-2 py-1 rounded bg-amber-900/40 text-amber-300 border border-amber-800">
              Picks closed
            </span>
          )}
          {!deadlinePassed && !preSeason && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              Picks open
            </span>
          )}
          {preSeason && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
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

      {/* Pick form (only before deadline, not pre-season) */}
      {!deadlinePassed && !preSeason && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-3">Make your pick</h2>
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

      {/* Prediction form (only before deadline, not pre-season) */}
      {!deadlinePassed && !preSeason && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
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
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold p-4 border-b border-zinc-800">
            {hasPredictionScores ? "Prediction scoreboard" : "All predictions"}
          </h2>
          <div className="p-4">
            <PredictionResults
              players={predictionPlayers}
              results={race.results.map((r) => ({
                driverId: r.driverId,
                position: r.position,
              }))}
              currentUserId={userId}
              hasScores={hasPredictionScores}
            />
          </div>
        </section>
      )}

      {/* All picks with scores (shown after deadline) */}
      {deadlinePassed && sortedPicks.length > 0 && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold p-4 border-b border-zinc-800">
            {hasScores ? "Fantasy scoreboard" : "All picks"}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/40 text-zinc-400 uppercase text-xs tracking-wide">
                <tr>
                  {hasScores && (
                    <th className="text-left px-4 py-2 w-10">#</th>
                  )}
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-left px-4 py-2">Driver</th>
                  <th className="text-left px-4 py-2">Constructor</th>
                  {hasScores && (
                    <>
                      <th className="text-right px-4 py-2">Drv pts</th>
                      <th className="text-right px-4 py-2">Con pts</th>
                      <th className="text-right px-4 py-2">Total</th>
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
                      className={`border-t border-zinc-800 ${
                        isWinner
                          ? "bg-amber-900/10"
                          : isMe
                            ? "bg-red-900/5"
                            : "hover:bg-zinc-800/30"
                      }`}
                    >
                      {hasScores && (
                        <td className="px-4 py-3 tabular-nums">
                          {isWinner ? (
                            <span className="text-amber-400 font-bold">
                              {i + 1}
                            </span>
                          ) : (
                            <span className="text-zinc-500">{i + 1}</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {p.user.name}
                        {isMe && (
                          <span className="text-zinc-500 text-xs ml-1.5">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.driver
                          ? `${p.driver.givenName} ${p.driver.familyName}`
                          : "—"}
                        {p.driver?.code && (
                          <span className="text-zinc-500 text-xs ml-1">
                            {p.driver.code}
                          </span>
                        )}
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
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                            {p.driverPoints ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                            {p.constructorPoints ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-red-400">
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
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-2">All picks</h2>
          <p className="text-zinc-400">
            No picks were submitted for this race.
          </p>
        </section>
      )}

      {/* Race results */}
      {race.results.length > 0 && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold p-4 border-b border-zinc-800">
            Race results
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/40 text-zinc-400 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 w-12">Pos</th>
                  <th className="text-left px-4 py-2">Driver</th>
                  <th className="text-left px-4 py-2">Constructor</th>
                  <th className="text-left px-4 py-2 w-20">Status</th>
                  <th className="text-right px-4 py-2 w-16">Pts</th>
                </tr>
              </thead>
              <tbody>
                {race.results.map((r) => {
                  const d = driverById.get(r.driverId);
                  const c = consById.get(r.teamId);
                  const isTop3 = r.position >= 1 && r.position <= 3;
                  return (
                    <tr
                      key={r.driverId}
                      className="border-t border-zinc-800 hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-2.5 tabular-nums">
                        {isTop3 ? (
                          <span
                            className={
                              r.position === 1
                                ? "text-amber-400 font-bold"
                                : r.position === 2
                                  ? "text-zinc-300 font-bold"
                                  : "text-amber-700 font-bold"
                            }
                          >
                            {r.positionText ?? r.position}
                          </span>
                        ) : (
                          <span className="text-zinc-400">
                            {r.positionText ?? r.position}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {d ? `${d.givenName} ${d.familyName}` : r.driverId}
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
                          <span className="text-zinc-400">{r.teamId}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">
                        {r.status && r.status !== "Finished" ? r.status : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
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
        <section className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-2 text-amber-300">
            Admin tools
          </h2>
          <p className="text-sm text-zinc-300">
            Go to{" "}
            <Link href="/admin" className="text-amber-300 underline">
              Admin
            </Link>{" "}
            to sync results from the API or enter them manually.
          </p>
        </section>
      )}
    </div>
  );
}
