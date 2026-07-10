"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DriverAvatar } from "@/components/DriverAvatar";
import { teamColor, teamTextColor, teamShort } from "@/lib/f1-meta";

interface DriverOpt {
  id: string;
  code: string | null;
  givenName: string;
  familyName: string;
}
interface ConsOpt {
  id: string;
  name: string;
}

interface Props {
  raceId: string;
  drivers: DriverOpt[];
  constructors: ConsOpt[];
  currentDriverId: string | null;
  currentConstructorId: string | null;
  driverUses: Record<string, number>;
  constructorUses: Record<string, number>;
  maxDriverPicks: number;
  maxConstructorPicks: number;
}

export default function PickForm(props: Props) {
  const router = useRouter();
  const [driverId, setDriverId] = useState<string | "">(
    props.currentDriverId ?? "",
  );
  const [consId, setConsId] = useState<string | "">(
    props.currentConstructorId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const hasSelection = driverId !== "" || consId !== "";
  const isUpdate = !!(props.currentDriverId || props.currentConstructorId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raceId: props.raceId,
        driverId: driverId || null,
        constructorId: consId || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error || "Failed to save");
      return;
    }
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Driver card grid */}
      <div>
        <p className="text-sm font-medium text-zinc-300 mb-2">Driver</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {props.drivers.map((d) => {
            const used = props.driverUses[d.id] ?? 0;
            const exhausted =
              used >= props.maxDriverPicks && d.id !== props.currentDriverId;
            const selected = driverId === d.id;
            return (
              <button
                type="button"
                key={d.id}
                disabled={exhausted}
                onClick={() => {
                  if (exhausted) return;
                  setDriverId(selected ? "" : d.id);
                  setSavedAt(null);
                }}
                className={`flex flex-col items-center bg-zinc-800 border rounded-lg px-2 py-2 text-center transition-all ${
                  exhausted
                    ? "opacity-30 cursor-not-allowed border-zinc-600"
                    : selected
                      ? "ring-2 ring-red-500 border-red-500 bg-red-900/10 cursor-pointer"
                      : "border-zinc-600 hover:border-zinc-500 cursor-pointer"
                }`}
              >
                <DriverAvatar driverId={d.id} size={32} className="shrink-0" />
                <span className="text-xs font-bold text-zinc-200 mt-1">
                  {d.code ?? d.id.substring(0, 3).toUpperCase()}
                </span>
                <span className="text-[10px] text-zinc-500 truncate w-full">
                  {d.familyName}
                </span>
                <span className="text-[9px] text-zinc-600 mt-0.5">
                  {used}/{props.maxDriverPicks}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Constructor card grid */}
      <div>
        <p className="text-sm font-medium text-zinc-300 mb-2">Constructor</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {props.constructors.map((c) => {
            const used = props.constructorUses[c.id] ?? 0;
            const exhausted =
              used >= props.maxConstructorPicks &&
              c.id !== props.currentConstructorId;
            const selected = consId === c.id;
            const color = teamColor(c.id);
            return (
              <button
                type="button"
                key={c.id}
                disabled={exhausted}
                onClick={() => {
                  if (exhausted) return;
                  setConsId(selected ? "" : c.id);
                  setSavedAt(null);
                }}
                className={`flex items-center gap-2 bg-zinc-800 border rounded-lg px-2 py-2 text-left transition-all border-l-4 ${
                  exhausted
                    ? "opacity-30 cursor-not-allowed border-zinc-600"
                    : selected
                      ? "ring-2 ring-red-500 border-red-500 cursor-pointer"
                      : "border-zinc-600 hover:border-zinc-500 cursor-pointer"
                }`}
                style={{ borderLeftColor: exhausted ? '#52525b' : selected ? '#ef4444' : color }}
              >
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: color,
                    color: teamTextColor(c.id),
                  }}
                >
                  <span className="text-[10px] font-bold">
                    {teamShort(c.id)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-zinc-200 block truncate">
                    {c.name}
                  </span>
                  <span className="text-[9px] text-zinc-600">
                    {used}/{props.maxConstructorPicks}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg px-4 py-2.5 text-sm text-emerald-300 flex items-center gap-2">
          <span>&#10003;</span>
          Pick saved at {savedAt.toLocaleTimeString()}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={saving || !hasSelection}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors"
        >
          {saving ? "Saving..." : isUpdate ? "Update pick" : "Save pick"}
        </button>
        <span className="text-xs text-zinc-500">
          You can change your pick any time before the race starts.
        </span>
      </div>
    </form>
  );
}
