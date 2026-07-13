"use client";

import { useState } from "react";
import { DriverAvatar } from "@/components/DriverAvatar";

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
}

interface Props {
  players: PlayerPrediction[];
  results: ResultEntry[];
  currentUserId: string;
  hasScores: boolean;
}

function scoreColor(predicted: number, actual: number | undefined): string {
  if (actual === undefined) return "text-red-700 bg-red-100/50";
  const diff = Math.abs(predicted - actual);
  if (diff === 0) return "text-emerald-700 bg-emerald-100/50";
  if (diff === 1) return "text-yellow-700 bg-yellow-100/50";
  if (diff === 2) return "text-orange-700 bg-orange-100/50";
  return "text-red-700 bg-red-100/50";
}

function scoreLabel(predicted: number, actual: number | undefined): string {
  if (actual === undefined) return "0";
  const diff = Math.abs(predicted - actual);
  if (diff === 0) return "5";
  if (diff === 1) return "2";
  if (diff === 2) return "1";
  return "0";
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

  // Sort by total points descending, then by name
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
          <thead className="bg-[#3d2b1f] text-amber-100 uppercase text-xs tracking-wide">
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
                  className={`border-t border-stone-300 cursor-pointer transition-colors card-paper ${
                    isWinner
                      ? "bg-amber-100/60"
                      : isMe
                        ? "bg-red-50/60"
                        : "hover:bg-amber-50"
                  }`}
                  onClick={() =>
                    setExpandedUser(isExpanded ? null : p.userId)
                  }
                >
                  {hasScores && (
                    <td className="px-4 py-3 tabular-nums">
                      {isWinner ? (
                        <span className="text-amber-700 font-bold">{i + 1}</span>
                      ) : (
                        <span className="text-stone-500">{i + 1}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-stone-800">
                    {p.userName}
                    {isMe && (
                      <span className="text-stone-500 text-xs ml-1.5">(you)</span>
                    )}
                  </td>
                  {hasScores && (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                        {p.exactMatches ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-yellow-700">
                        {p.closeMatches ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-red-700">
                        {p.totalPoints ?? 0}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-stone-500">
                      {isExpanded ? "hide" : "show"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded detail for selected user */}
      {expandedUser && (() => {
        const player = sorted.find((p) => p.userId === expandedUser);
        if (!player) return null;

        return (
          <div className="bg-[#f5f0e8] border-2 border-stone-400 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 text-stone-800">
              {player.userName}&rsquo;s predictions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((pos) => {
                const pred = player.predictions.find(
                  (p) => p.position === pos,
                );
                if (!pred) {
                  return (
                    <div
                      key={pos}
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-stone-200/50"
                    >
                      <span className="font-bold text-stone-500 w-8 text-right tabular-nums">
                        P{pos}
                      </span>
                      <span className="text-stone-400 italic">not predicted</span>
                    </div>
                  );
                }

                const actualPos = driverPos[pred.driverId];
                const colors = hasScores
                  ? scoreColor(pred.position, actualPos)
                  : "";
                const pts = hasScores
                  ? scoreLabel(pred.position, actualPos)
                  : null;

                return (
                  <div
                    key={pos}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${colors || "bg-stone-200/50"}`}
                  >
                    <span className="font-bold w-8 text-right tabular-nums">
                      P{pos}
                    </span>
                    <DriverAvatar driverId={pred.driverId} size={24} className="shrink-0" />
                    <span className="flex-1 truncate">
                      {pred.driverName}
                      {pred.driverCode && (
                        <span className="text-stone-500 text-xs ml-1">
                          {pred.driverCode}
                        </span>
                      )}
                    </span>
                    {hasScores && actualPos !== undefined && (
                      <span className="text-xs text-stone-500">
                        (finished P{actualPos})
                      </span>
                    )}
                    {hasScores && actualPos === undefined && (
                      <span className="text-xs text-stone-500">
                        (outside top 10)
                      </span>
                    )}
                    {pts !== null && (
                      <span className="font-bold text-xs tabular-nums w-6 text-right">
                        +{pts}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
