"use client";

import { useState } from "react";

interface PredictionSlot {
  position: number;
  driverId: string;
  driverName: string;
  driverCode: string | null;
}

interface PlayerPrediction {
  userId: string;
  userName: string;
  predictions: PredictionSlot[];
  totalPoints: number | null;
  exactMatches: number | null;
  closeMatches: number | null;
}

interface ResultEntry {
  driverId: string;
  position: number;
  driverName?: string;
  driverCode?: string | null;
}

interface Props {
  players: PlayerPrediction[];
  results: ResultEntry[];
  currentUserId: string;
  hasScores: boolean;
}

function scoreColor(predicted: number, actual: number | undefined): string {
  if (actual === undefined) return "text-red-700 bg-red-100";
  const diff = Math.abs(predicted - actual);
  if (diff === 0) return "text-emerald-700 bg-emerald-100";
  if (diff === 1) return "text-yellow-700 bg-yellow-100";
  if (diff === 2) return "text-orange-700 bg-orange-100";
  return "text-red-700 bg-red-100";
}

function scoreLabel(predicted: number, actual: number | undefined): string {
  if (actual === undefined) return "0";
  const diff = Math.abs(predicted - actual);
  if (diff === 0) return "5";
  if (diff === 1) return "2";
  if (diff === 2) return "1";
  return "0";
}

function DeltaBadge({
  predicted,
  actual,
}: {
  predicted: number;
  actual: number | undefined;
}) {
  if (actual === undefined) {
    return (
      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-red-700 bg-red-100 min-w-[2rem]">
        OUT
      </span>
    );
  }
  const diff = predicted - actual;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-100 min-w-[2rem]">
        =
      </span>
    );
  }
  const absDiff = Math.abs(diff);
  const arrow = diff > 0 ? "↑" : "↓";
  const colors =
    absDiff === 1
      ? "text-yellow-700 bg-yellow-100"
      : absDiff === 2
        ? "text-orange-700 bg-orange-100"
        : "text-red-700 bg-red-100";
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${colors} min-w-[2rem]`}
    >
      {arrow}
      {absDiff}
    </span>
  );
}

function ComparisonView({
  player,
  actualTop10,
  driverPos,
  hasScores,
}: {
  player: PlayerPrediction;
  actualTop10: ResultEntry[];
  driverPos: Record<string, number>;
  hasScores: boolean;
}) {
  const exactCount = player.exactMatches ?? 0;
  const closeCount = player.closeMatches ?? 0;
  const missCount = Math.max(0, 10 - exactCount - closeCount);

  return (
    <div className="garage-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-garage-metal)]/20">
        <h4 className="text-sm font-semibold">
          {player.userName}&rsquo;s predictions
        </h4>
        {hasScores && player.totalPoints != null && (
          <span className="text-sm font-bold text-[var(--color-racing-red)] tabular-nums">
            {player.totalPoints} pts
          </span>
        )}
      </div>

      {/* Desktop: dual-column comparison (md+) */}
      {hasScores && (
        <div className="hidden md:block p-4">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_3rem_1fr] gap-x-2 mb-2 px-1">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-garage-metal)] font-semibold">
              Predicted
            </div>
            <div />
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-garage-metal)] font-semibold">
              Actual
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((pos) => {
              const pred = player.predictions.find((p) => p.position === pos);
              const actualEntry = actualTop10.find(
                (r) => r.position === pos,
              );
              const actualPos = pred
                ? driverPos[pred.driverId]
                : undefined;
              const colors = pred ? scoreColor(pos, actualPos) : "";
              const pts = pred ? scoreLabel(pos, actualPos) : null;

              return (
                <div
                  key={pos}
                  className="grid grid-cols-[1fr_3rem_1fr] gap-x-2 items-center"
                >
                  {/* Predicted */}
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${colors || "bg-[var(--color-garage-wall)]/30"}`}
                  >
                    <span className="font-bold w-7 text-right tabular-nums text-xs">
                      P{pos}
                    </span>
                    {pred ? (
                      <>
                        <span className="flex-1 truncate">
                          {pred.driverName}
                        </span>
                        {pred.driverCode && (
                          <span className="text-[var(--color-garage-metal)] text-xs shrink-0">
                            {pred.driverCode}
                          </span>
                        )}
                        {pts !== null && (
                          <span className="font-bold text-xs tabular-nums w-5 text-right shrink-0">
                            +{pts}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[var(--color-garage-metal)]/60 italic text-xs">
                        not predicted
                      </span>
                    )}
                  </div>

                  {/* Delta badge */}
                  <div className="flex justify-center">
                    {pred ? (
                      <DeltaBadge predicted={pos} actual={actualPos} />
                    ) : (
                      <span className="text-[var(--color-garage-metal)] text-xs">&mdash;</span>
                    )}
                  </div>

                  {/* Actual */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-[var(--color-garage-wall)]/30">
                    <span
                      className={`font-bold w-7 text-right tabular-nums text-xs ${
                        pos === 1
                          ? "text-[var(--color-racing-yellow)]"
                          : pos === 2
                            ? "text-[var(--color-oil-stain)]/70"
                            : pos === 3
                              ? "text-amber-700"
                              : "text-[var(--color-garage-metal)]"
                      }`}
                    >
                      P{pos}
                    </span>
                    {actualEntry ? (
                      <>
                        <span className="flex-1 truncate text-[var(--color-oil-stain)]/70">
                          {actualEntry.driverName ?? actualEntry.driverId}
                        </span>
                        {actualEntry.driverCode && (
                          <span className="text-[var(--color-garage-metal)] text-xs shrink-0">
                            {actualEntry.driverCode}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[var(--color-garage-metal)]/60 italic text-xs">
                        no data
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile: stacked cards (<md) */}
      {hasScores && (
        <div className="md:hidden p-3 space-y-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((pos) => {
            const pred = player.predictions.find((p) => p.position === pos);
            const actualEntry = actualTop10.find((r) => r.position === pos);
            const actualPos = pred ? driverPos[pred.driverId] : undefined;
            const colors = pred ? scoreColor(pos, actualPos) : "";
            const pts = pred ? scoreLabel(pos, actualPos) : null;

            return (
              <div key={pos} className={`rounded px-3 py-2 text-sm ${colors || "bg-[var(--color-garage-wall)]/30"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-bold tabular-nums text-xs ${
                      pos <= 3 ? "text-[var(--color-racing-yellow)]" : ""
                    }`}
                  >
                    P{pos}
                  </span>
                  <div className="flex items-center gap-2">
                    {pred && <DeltaBadge predicted={pos} actual={actualPos} />}
                    {pts !== null && (
                      <span className="font-bold text-xs tabular-nums w-5 text-right">
                        +{pts}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs">
                  <div>
                    <span className="text-[var(--color-garage-metal)]">Pred: </span>
                    {pred ? (
                      <span>
                        {pred.driverCode ?? pred.driverName}
                      </span>
                    ) : (
                      <span className="text-[var(--color-garage-metal)]/60 italic">none</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[var(--color-garage-metal)]">Real: </span>
                    {actualEntry ? (
                      <span className="text-[var(--color-oil-stain)]/70">
                        {actualEntry.driverCode ??
                          actualEntry.driverName ??
                          actualEntry.driverId}
                      </span>
                    ) : (
                      <span className="text-[var(--color-garage-metal)]/60 italic">no data</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pre-scored: show predictions only */}
      {!hasScores && (
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((pos) => {
              const pred = player.predictions.find((p) => p.position === pos);
              return (
                <div
                  key={pos}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-[var(--color-garage-wall)]/30"
                >
                  <span className="font-bold text-[var(--color-garage-metal)] w-8 text-right tabular-nums">
                    P{pos}
                  </span>
                  {pred ? (
                    <span className="truncate">
                      {pred.driverName}
                      {pred.driverCode && (
                        <span className="text-[var(--color-garage-metal)] text-xs ml-1">
                          {pred.driverCode}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[var(--color-garage-metal)]/60 italic">not predicted</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats strip */}
      {hasScores && (
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--color-garage-metal)]/20 text-xs">
          <span className="text-emerald-600 tabular-nums">
            {exactCount} exact
          </span>
          <span className="text-yellow-600 tabular-nums">
            {closeCount} close
          </span>
          <span className="text-[var(--color-racing-red)] tabular-nums">
            {missCount} miss
          </span>
          <span className="ml-auto font-bold text-[var(--color-oil-stain)] tabular-nums">
            {player.totalPoints ?? 0} pts
          </span>
        </div>
      )}
    </div>
  );
}

export default function PredictionResults({
  players,
  results,
  currentUserId,
  hasScores,
}: Props) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  if (players.length === 0) return null;

  const driverPos: Record<string, number> = {};
  for (const r of results) {
    driverPos[r.driverId] = r.position;
  }

  const actualTop10 = [...results]
    .filter((r) => r.position >= 1 && r.position <= 10)
    .sort((a, b) => a.position - b.position);

  const sorted = [...players].sort((a, b) => {
    if (a.totalPoints != null && b.totalPoints != null) {
      return b.totalPoints - a.totalPoints;
    }
    return a.userName.localeCompare(b.userName);
  });

  return (
    <div className="space-y-3">
      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-xs tracking-wide">
            <tr>
              {hasScores && <th className="text-left px-4 py-2 w-10">#</th>}
              <th className="text-left px-4 py-2">Player</th>
              {hasScores && (
                <>
                  <th className="text-right px-4 py-2">Exact</th>
                  <th className="text-right px-4 py-2">Close</th>
                  <th className="text-right px-4 py-2">Points</th>
                </>
              )}
              <th className="text-right px-4 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isMe = p.userId === currentUserId;
              const isWinner = i === 0 && hasScores && (p.totalPoints ?? 0) > 0;
              const isExpanded = expandedUser === p.userId;

              return (
                <tr
                  key={p.userId}
                  className={`border-t border-[var(--color-garage-metal)]/20 cursor-pointer transition-colors ${
                    isWinner
                      ? "bg-[var(--color-racing-yellow)]/10"
                      : isMe
                        ? "bg-[var(--color-racing-red)]/5"
                        : "hover:bg-[var(--color-garage-wall)]/50"
                  }`}
                  onClick={() =>
                    setExpandedUser(isExpanded ? null : p.userId)
                  }
                >
                  {hasScores && (
                    <td className="px-4 py-3 tabular-nums">
                      {isWinner ? (
                        <span className="text-[var(--color-racing-yellow)] font-bold">{i + 1}</span>
                      ) : (
                        <span className="text-[var(--color-garage-metal)]">{i + 1}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {p.userName}
                    {isMe && (
                      <span className="text-[var(--color-garage-metal)] text-xs ml-1.5">(you)</span>
                    )}
                  </td>
                  {hasScores && (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                        {p.exactMatches ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-yellow-600">
                        {p.closeMatches ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-[var(--color-racing-red)]">
                        {p.totalPoints ?? 0}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-[var(--color-garage-metal)]">
                      {isExpanded ? "hide" : "show"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded comparison view */}
      {expandedUser &&
        (() => {
          const player = sorted.find((p) => p.userId === expandedUser);
          if (!player) return null;
          return (
            <ComparisonView
              player={player}
              actualTop10={actualTop10}
              driverPos={driverPos}
              hasScores={hasScores}
            />
          );
        })()}
    </div>
  );
}
