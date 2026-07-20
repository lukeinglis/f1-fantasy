"use client";

import { useState } from "react";
import { TEAM_COLORS, teamTextColor, teamShort } from "@/lib/f1-meta";

interface RacePickData {
  raceId: string;
  raceName: string;
  round: number;
  driverCode: string | null;
  driverName: string | null;
  constructorId: string | null;
  constructorName: string | null;
  totalPoints: number | null;
}

interface MobileGridUser {
  id: string;
  name: string;
  total: number;
  latestRace: RacePickData | null;
  picks: RacePickData[];
}

interface MobileGridViewProps {
  users: MobileGridUser[];
}

export default function MobileGridView({ users }: MobileGridViewProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  function toggle(userId: string) {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  }

  return (
    <div className="block md:hidden">
      <div className="whiteboard overflow-hidden rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-[10px] tracking-wide">
              <th
                className="text-left px-3 py-2.5 w-8"
                style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}
              >
                #
              </th>
              <th
                className="text-left px-2 py-2.5"
                style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}
              >
                Player
              </th>
              <th
                className="text-right px-2 py-2.5 hidden sm:table-cell"
                style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}
              >
                Latest
              </th>
              <th
                className="text-right px-3 py-2.5"
                style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => {
              const isExpanded = expandedUserId === user.id;
              const isLeader = idx === 0 && user.total > 0;

              return (
                <MobileGridRow
                  key={user.id}
                  user={user}
                  rank={idx + 1}
                  isLeader={isLeader}
                  isExpanded={isExpanded}
                  onToggle={() => toggle(user.id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileGridRow({
  user,
  rank,
  isLeader,
  isExpanded,
  onToggle,
}: {
  user: MobileGridUser;
  rank: number;
  isLeader: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const rowBg = isLeader
    ? "bg-[var(--color-racing-yellow)]/10"
    : rank % 2 === 0
      ? "bg-[var(--color-garage-wall)]"
      : "bg-[var(--color-whiteboard)]";

  const latestBgColor = user.latestRace?.constructorId
    ? (TEAM_COLORS[user.latestRace.constructorId] ?? "#555")
    : undefined;
  const latestTxtColor = user.latestRace?.constructorId
    ? teamTextColor(user.latestRace.constructorId)
    : undefined;

  return (
    <>
      <tr
        className={`${rowBg} cursor-pointer active:bg-[var(--color-racing-yellow)]/20 transition-colors select-none`}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <td className="px-3 py-3 tabular-nums text-[var(--color-oil-stain)]">
          {isLeader ? (
            <span className="text-[var(--color-racing-yellow)] font-bold">
              <span aria-hidden="true" className="text-xs">&#9733;</span>{" "}
              {rank}
            </span>
          ) : (
            <span className="text-[var(--color-garage-metal)]">{rank}</span>
          )}
        </td>
        <td className="px-2 py-3 text-[var(--color-oil-stain)]">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate max-w-[120px]">{user.name}</span>
            <span
              className={`text-[var(--color-garage-metal)] text-xs transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </div>
        </td>
        <td className="px-2 py-3 text-right hidden sm:table-cell">
          {user.latestRace ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={
                latestBgColor
                  ? { backgroundColor: latestBgColor, color: latestTxtColor }
                  : undefined
              }
            >
              <span>{user.latestRace.driverCode ?? "—"}</span>
              {user.latestRace.totalPoints != null && (
                <span className="opacity-80">{user.latestRace.totalPoints}</span>
              )}
            </span>
          ) : (
            <span className="text-[var(--color-garage-metal)] text-xs">—</span>
          )}
        </td>
        <td className="px-3 py-3 text-right font-bold tabular-nums text-[var(--color-oil-stain)] text-base">
          {user.total || "—"}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={4} className="p-0">
            <div className="bg-[var(--color-garage-metal-dark)]/5 border-t border-b border-[var(--color-garage-metal)]/20 px-3 py-3">
              <div className="grid grid-cols-2 gap-2">
                {user.picks.map((pick) => (
                  <RaceCard key={pick.raceId} pick={pick} />
                ))}
              </div>
              {user.picks.length === 0 && (
                <p className="text-xs text-[var(--color-garage-metal)] text-center py-2">
                  No picks yet
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RaceCard({ pick }: { pick: RacePickData }) {
  const bgColor = pick.constructorId
    ? (TEAM_COLORS[pick.constructorId] ?? "#555")
    : "#888";
  const txtColor = pick.constructorId
    ? teamTextColor(pick.constructorId)
    : "#fff";
  const shortTeam = pick.constructorId ? teamShort(pick.constructorId) : "—";

  const hasData = pick.driverCode || pick.constructorId;

  return (
    <div
      className="rounded-lg overflow-hidden text-xs"
      style={hasData ? { backgroundColor: bgColor, color: txtColor } : undefined}
    >
      <div className="px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold text-[10px] uppercase tracking-wide opacity-70">
            R{pick.round}
          </span>
          {pick.totalPoints != null && (
            <span className="font-bold tabular-nums">
              {pick.totalPoints}pts
            </span>
          )}
        </div>
        {hasData ? (
          <>
            <div className="font-bold text-sm leading-tight mt-0.5">
              {pick.driverCode ?? "—"}
            </div>
            <div className="text-[10px] opacity-70 font-semibold leading-tight">
              {shortTeam}
            </div>
          </>
        ) : (
          <div className="text-xs opacity-50 mt-0.5 italic">No pick</div>
        )}
      </div>
    </div>
  );
}
