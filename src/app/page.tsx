import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import Countdown from "@/components/Countdown";
import { ensureSeasonSynced } from "@/lib/autoSync";
import { auth } from "@/lib/auth";
import { getCurrentSeason } from "@/lib/data";
import GarageScene from "@/components/GarageScene";
import GarageZone from "@/components/GarageZone";

export const dynamic = "force-dynamic";

async function getGarageData() {
  await ensureSeasonSynced();
  const season = await getCurrentSeason();
  const session = await auth();
  const userId = session?.user?.id as string | undefined;

  const races = await prisma.race.findMany({
    where: { season },
    orderBy: { round: "asc" },
    select: {
      id: true,
      round: true,
      name: true,
      pickDeadline: true,
      resultsLocked: true,
    },
  });

  const totalRaces = races.length;
  const activeRaces = races.filter((r) => !isPreSeasonRound(r.round));
  const racesScored = activeRaces.filter((r) => r.resultsLocked).length;

  const playerCount = await prisma.user.count();

  const now = new Date();
  const nextRace = races.find(
    (r) => r.pickDeadline > now && !isPreSeasonRound(r.round),
  );

  let hasPicked = true;
  if (nextRace && userId) {
    const pick = await prisma.pick.findUnique({
      where: { userId_raceId: { userId, raceId: nextRace.id } },
      select: { driverId: true, teamId: true },
    });
    hasPicked = !!(pick?.driverId || pick?.teamId);
  } else if (!userId) {
    hasPicked = true;
  }

  return {
    season,
    totalRaces,
    racesScored,
    playerCount,
    nextRace: nextRace
      ? {
          id: nextRace.id,
          name: nextRace.name,
          round: nextRace.round,
          deadline: nextRace.pickDeadline.toISOString(),
        }
      : null,
    hasPicked,
  };
}

export default async function HomePage() {
  const { season, totalRaces, racesScored, playerCount, nextRace, hasPicked } =
    await getGarageData();

  return (
    <div className="space-y-6">
      {/* Countdown banner */}
      {nextRace && (
        <div className="bg-[var(--color-garage-metal-dark)] text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border-2 border-[var(--color-garage-metal)]">
          <div className="flex items-center gap-3">
            <div>
              <span
                className="text-xs uppercase tracking-wider text-[var(--color-racing-yellow)]"
                style={{ fontFamily: "var(--font-russo-one)" }}
              >
                Next Race
              </span>
              <span className="ml-2 text-sm">
                R{nextRace.round}: {nextRace.name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Countdown targetDate={nextRace.deadline} label="Pick deadline" />
            {!hasPicked && (
              <Link
                href={`/races/${nextRace.id}`}
                className="garage-button-primary text-sm py-1.5 px-4 whitespace-nowrap"
              >
                Make your pick &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Garage scene */}
      <GarageScene>
        <GarageZone
          href="/standings"
          icon="trophy"
          label="Standings"
          description="League leaderboard & season grid"
        />
        <GarageZone
          href="/races"
          icon="clipboard"
          label="Race Calendar"
          description="Schedule & results"
          badge={!hasPicked ? "PICK NOW" : undefined}
        />
        <GarageZone
          href="/picks"
          icon="toolbox"
          label="My Garage"
          description="Your picks & driver budget"
        />
        <GarageZone
          href="/predictions"
          icon="notebook"
          label="Predictions"
          description="Predict the top 10"
        />
        <GarageZone
          href="/stats"
          icon="corkboard"
          label="Stats & Records"
          description="Season statistics"
        />
        <GarageZone
          href="/rules"
          icon="document"
          label="House Rules"
          description="How to play"
        />
        <GarageZone
          href="/game"
          icon="arcade"
          label="F1 Dodge"
          description="Mini arcade game"
        />
      </GarageScene>

      {/* Season info footer */}
      <div className="text-center text-sm text-[var(--color-garage-metal)]">
        {season} Season &middot; {racesScored}/{totalRaces} races scored &middot;{" "}
        {playerCount} players
      </div>
    </div>
  );
}
