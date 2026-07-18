import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPreSeasonRound } from "@/lib/season";
import Countdown from "@/components/Countdown";
import { ensureSeasonSynced } from "@/lib/autoSync";
import { auth } from "@/lib/auth";
import { getCurrentSeason } from "@/lib/data";
import GarageScene, { type GarageZoneConfig } from "@/components/GarageScene";

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

function buildGarageZones(hasPicked: boolean): GarageZoneConfig[] {
  return [
    { href: "/grid", label: "Season Grid", description: "Full season standings grid", objectImage: "/images/zones/tv.png", top: "10.6%", left: "5.1%", width: "11.4%", height: "23.9%" },
    { href: "/standings", label: "Standings", description: "League leaderboard", objectImage: "/images/zones/trophy-shelf.png", top: "8%", left: "24.8%", width: "15%", height: "30.8%" },
    { href: "/races", label: "Races", description: "Schedule, results & picks", objectImage: "/images/zones/whiteboard.png", top: "5.3%", left: "35.3%", width: "28.4%", height: "32.9%", badge: !hasPicked ? "PICK NOW" : undefined },
    { href: "/stats", label: "Stats", description: "Season statistics", objectImage: "/images/zones/corkboard.png", top: "8%", left: "63.7%", width: "16.1%", height: "28.2%" },
    { href: "/game", label: "F1 Dodge", description: "Mini arcade game", objectImage: "/images/zones/arcade.png", top: "12.2%", left: "81.6%", width: "13.5%", height: "47.8%" },
    { href: "/picks", label: "My Picks", description: "Your picks & budget", objectImage: "/images/zones/clipboard.png", top: "51%", left: "35.3%", width: "8.4%", height: "17%" },
    { href: "/rules", label: "Rules", description: "How to play", objectImage: "/images/zones/toolbox.png", top: "47.8%", left: "45.5%", width: "12.6%", height: "15.9%" },
    { href: "/predictions", label: "Predictions", description: "Predict the top 10", objectImage: "/images/zones/notebook.png", top: "49.9%", left: "58.6%", width: "14.1%", height: "13.8%" },
    { objectImage: "/images/zones/tire-stack.png", top: "37.2%", left: "20.3%", width: "10.5%", height: "26.6%" },
    { objectImage: "/images/zones/tool-cart.png", top: "30.8%", left: "2.4%", width: "12%", height: "34.5%" },
  ];
}

export default async function HomePage() {
  const { season, totalRaces, racesScored, playerCount, nextRace, hasPicked } =
    await getGarageData();

  const zones = buildGarageZones(hasPicked);

  return (
    <div className="space-y-4 -mt-6 -mx-4 px-2 md:px-4">
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
      <GarageScene zones={zones} />

      {/* Season info footer */}
      <div className="text-center text-sm text-[var(--color-garage-metal)]">
        {season} Season &middot; {racesScored}/{totalRaces} races scored &middot;{" "}
        {playerCount} players
      </div>
    </div>
  );
}
