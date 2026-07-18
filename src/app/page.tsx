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
    { href: "/grid", label: "Season Grid", description: "Full season standings grid", objectImage: "/images/zones/tv.png", top: "4%", left: "1%", width: "17.5%", height: "27%" },
    { href: "/standings", label: "Standings", description: "League leaderboard", objectImage: "/images/zones/trophy-shelf.png", top: "2%", left: "15%", width: "20%", height: "33%" },
    { href: "/races", label: "Races", description: "Schedule, results & picks", objectImage: "/images/zones/whiteboard.png", top: "2%", left: "27%", width: "28.5%", height: "35.5%", badge: !hasPicked ? "PICK NOW" : undefined },
    { href: "/stats", label: "Stats", description: "Season statistics", objectImage: "/images/zones/corkboard.png", top: "3%", left: "57%", width: "18%", height: "31%" },
    { href: "/game", label: "F1 Dodge", description: "Mini arcade game", objectImage: "/images/zones/arcade.png", top: "7%", left: "76%", width: "14.5%", height: "49%" },
    { href: "/picks", label: "My Picks", description: "Your picks & budget", objectImage: "/images/zones/clipboard.png", top: "44%", left: "24%", width: "9%", height: "18.5%" },
    { href: "/rules", label: "Rules", description: "How to play", objectImage: "/images/zones/toolbox.png", top: "42%", left: "35%", width: "14.5%", height: "19%" },
    { href: "/predictions", label: "Predictions", description: "Predict the top 10", objectImage: "/images/zones/notebook.png", top: "48%", left: "50%", width: "14.5%", height: "11.5%" },
    { objectImage: "/images/zones/tire-stack.png", top: "32%", left: "14%", width: "10%", height: "25.5%" },
    { objectImage: "/images/zones/tool-cart.png", top: "22%", left: "1%", width: "14%", height: "35%" },
  ];
}

export default async function HomePage() {
  const { season, totalRaces, racesScored, playerCount, nextRace, hasPicked } =
    await getGarageData();

  const zones = buildGarageZones(hasPicked);

  return (
    <div className="space-y-6 max-w-7xl mx-auto -mt-6 -mx-4 px-4 md:px-8">
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
