import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FIRST_ACTIVE_ROUND } from "@/lib/season";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const league = await prisma.league.findFirst();
  const maxDriver = league?.maxDriverPicks ?? 2;
  const maxConstructor = league?.maxConstructorPicks ?? 3;
  const season = league?.season ?? 2026;

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-3xl font-bold">
          How to Play <span className="text-red-500">F1 Fantasy</span>
        </h1>
        <p className="text-zinc-400 mt-1 text-sm">
          {season} season rules
        </p>
      </header>

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">The Basics</h2>
        <ul className="space-y-3 text-zinc-300">
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">1.</span>
            <span>
              Before each race, pick <strong>one driver</strong> and{" "}
              <strong>one constructor</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">2.</span>
            <span>
              Your driver earns standard F1 points based on finishing position
              (25 for P1, 18 for P2, down to 1 for P10).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">3.</span>
            <span>
              Your constructor earns the combined points of both their drivers
              in the race.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">4.</span>
            <span>Highest total points at the end of the season wins.</span>
          </li>
        </ul>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Usage Caps</h2>
        <p className="text-zinc-300">
          You can&rsquo;t just pick the same driver every week. There are caps
          on how many times you can use each pick:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="text-3xl font-bold text-red-400">{maxDriver}x</div>
            <div className="text-sm text-zinc-400 mt-1">
              per driver, per season
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Once you&rsquo;ve used a driver {maxDriver} times, they&rsquo;re
              locked out for the rest of the season.
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="text-3xl font-bold text-red-400">
              {maxConstructor}x
            </div>
            <div className="text-sm text-zinc-400 mt-1">
              per constructor, per season
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Constructors have a slightly higher cap, but choose wisely across
              24 races.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Points Table</h2>
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          {[
            { pos: "P1", pts: 25 },
            { pos: "P2", pts: 18 },
            { pos: "P3", pts: 15 },
            { pos: "P4", pts: 12 },
            { pos: "P5", pts: 10 },
            { pos: "P6", pts: 8 },
            { pos: "P7", pts: 6 },
            { pos: "P8", pts: 4 },
            { pos: "P9", pts: 2 },
            { pos: "P10", pts: 1 },
          ].map(({ pos, pts }) => (
            <div
              key={pos}
              className="bg-zinc-800/50 rounded px-2 py-2 border border-zinc-700"
            >
              <div className="text-zinc-400 text-xs">{pos}</div>
              <div className="font-bold text-lg tabular-nums">{pts}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          P11 and below score 0 points. Sprint races and fastest lap bonuses
          are not included.
        </p>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Deadlines</h2>
        <p className="text-zinc-300">
          Your picks must be submitted before the race start time. You can
          change your pick as many times as you want before the deadline.
          Once the race begins, your pick is locked.
        </p>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Prediction Challenge</h2>
        <p className="text-zinc-300">
          A separate competition: predict the top 10 finishing order before
          each race.
        </p>
        <ul className="space-y-3 text-zinc-300">
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">1.</span>
            <span>
              Select 10 drivers and rank them P1 through P10 before the race
              deadline (same as picks).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">2.</span>
            <span>
              After the race, each predicted position is scored based on accuracy:
            </span>
          </li>
        </ul>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div className="bg-emerald-900/20 border border-emerald-800 rounded px-2 py-3">
            <div className="text-emerald-400 text-xs">Exact</div>
            <div className="font-bold text-2xl text-emerald-400 tabular-nums">5</div>
            <div className="text-zinc-500 text-xs">points</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-800 rounded px-2 py-3">
            <div className="text-yellow-400 text-xs">Off by 1</div>
            <div className="font-bold text-2xl text-yellow-400 tabular-nums">2</div>
            <div className="text-zinc-500 text-xs">points</div>
          </div>
          <div className="bg-orange-900/20 border border-orange-800 rounded px-2 py-3">
            <div className="text-orange-400 text-xs">Off by 2</div>
            <div className="font-bold text-2xl text-orange-400 tabular-nums">1</div>
            <div className="text-zinc-500 text-xs">point</div>
          </div>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded px-2 py-3">
            <div className="text-zinc-500 text-xs">Off by 3+</div>
            <div className="font-bold text-2xl text-zinc-500 tabular-nums">0</div>
            <div className="text-zinc-500 text-xs">points</div>
          </div>
        </div>
        <ul className="space-y-3 text-zinc-300">
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">3.</span>
            <span>
              If a predicted driver finishes outside the top 10, that slot
              scores 0 points.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">4.</span>
            <span>
              Maximum 50 points per race (10 exact matches &times; 5 pts).
              Predictions are tracked on a separate leaderboard.
            </span>
          </li>
        </ul>
        <p className="text-xs text-zinc-500">
          Predictions are hidden from other players until after the deadline.
        </p>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Mid-Season Start</h2>
        <p className="text-zinc-300">
          Our league starts at <strong>Round {FIRST_ACTIVE_ROUND}</strong>.
          Earlier races are not shown. Everyone starts on equal footing
          from Round {FIRST_ACTIVE_ROUND} onward.
        </p>
      </section>

      <div className="flex gap-3 text-sm">
        <Link
          href="/races"
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
        >
          View race calendar
        </Link>
        <Link
          href="/"
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded"
        >
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
