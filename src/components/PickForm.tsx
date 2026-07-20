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

  const hasSelection = driverId !== "" && consId !== "";
  const hasPartialSelection = (driverId !== "" || consId !== "") && !hasSelection;
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
        <p className="text-sm font-medium text-stone-700 mb-2">Driver</p>
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
                className={`flex flex-col items-center garage-card rounded-lg px-2 py-2 min-h-[44px] min-w-[44px] text-center transition-all ${
                  exhausted
                    ? "opacity-30 cursor-not-allowed border-stone-300"
                    : selected
                      ? "ring-2 ring-[var(--color-racing-red)] border-[var(--color-racing-red)] cursor-pointer"
                      : "border-stone-400 hover:border-stone-500 cursor-pointer"
                }`}
              >
                <DriverAvatar driverId={d.id} size={32} className="shrink-0" />
                <span className="text-xs font-bold text-stone-800 mt-1">
                  {d.code ?? d.id.substring(0, 3).toUpperCase()}
                </span>
                <span className="text-[10px] text-stone-500 truncate w-full">
                  {d.familyName}
                </span>
                <span className="text-[9px] text-stone-400 mt-0.5">
                  {used}/{props.maxDriverPicks}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Constructor card grid */}
      <div>
        <p className="text-sm font-medium text-stone-700 mb-2">Constructor</p>
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
                className={`flex items-center gap-2 garage-card rounded-lg px-2 py-2 min-h-[44px] min-w-[44px] text-left transition-all border-l-4 ${
                  exhausted
                    ? "opacity-30 cursor-not-allowed border-stone-300"
                    : selected
                      ? "ring-2 ring-[var(--color-racing-red)] border-[var(--color-racing-red)] cursor-pointer"
                      : "border-stone-400 hover:border-stone-500 cursor-pointer"
                }`}
                style={{ borderLeftColor: exhausted ? '#a8a29e' : selected ? '#ef4444' : color }}
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
                  <span className="text-xs font-medium text-stone-800 block truncate">
                    {c.name}
                  </span>
                  <span className="text-[9px] text-stone-400">
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
        <div className="bg-red-50 border-2 border-red-400 rounded-lg px-4 py-2.5 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg px-4 py-2.5 text-sm text-emerald-700 font-medium flex items-center gap-2">
          <span>&#10003;</span>
          Pick saved at {savedAt.toLocaleTimeString()}
        </div>
      )}

      {hasPartialSelection && (
        <div className="text-sm text-amber-700 font-medium">
          Select both a driver and a constructor
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={saving || !hasSelection}
          className="garage-button-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : hasPartialSelection ? "Pick both to save" : isUpdate ? "Update pick" : "Save pick"}
        </button>
        <span className="text-xs text-stone-500">
          You can change your pick any time before the race starts.
        </span>
      </div>
    </form>
  );
}
