"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      <div className="grid sm:grid-cols-2 gap-5">
        {/* Driver selector */}
        <div>
          <label className="block text-sm font-medium mb-2 text-zinc-300">
            Driver
          </label>
          <select
            value={driverId}
            onChange={(e) => {
              setDriverId(e.target.value);
              setSavedAt(null);
            }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
          >
            <option value="">Select a driver...</option>
            {props.drivers.map((d) => {
              const used = props.driverUses[d.id] ?? 0;
              const exhausted =
                used >= props.maxDriverPicks && d.id !== props.currentDriverId;
              return (
                <option key={d.id} value={d.id} disabled={exhausted}>
                  {d.familyName}, {d.givenName}
                  {d.code ? ` (${d.code})` : ""}
                  {used > 0 ? ` [${used}/${props.maxDriverPicks}]` : ""}
                  {exhausted ? " EXHAUSTED" : ""}
                </option>
              );
            })}
          </select>
          <UsageSummary
            uses={props.driverUses}
            max={props.maxDriverPicks}
            items={props.drivers.map((d) => ({
              id: d.id,
              label: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
            }))}
          />
        </div>

        {/* Constructor selector */}
        <div>
          <label className="block text-sm font-medium mb-2 text-zinc-300">
            Constructor
          </label>
          <select
            value={consId}
            onChange={(e) => {
              setConsId(e.target.value);
              setSavedAt(null);
            }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
          >
            <option value="">Select a constructor...</option>
            {props.constructors.map((c) => {
              const used = props.constructorUses[c.id] ?? 0;
              const exhausted =
                used >= props.maxConstructorPicks &&
                c.id !== props.currentConstructorId;
              return (
                <option key={c.id} value={c.id} disabled={exhausted}>
                  {c.name}
                  {used > 0 ? ` [${used}/${props.maxConstructorPicks}]` : ""}
                  {exhausted ? " EXHAUSTED" : ""}
                </option>
              );
            })}
          </select>
          <UsageSummary
            uses={props.constructorUses}
            max={props.maxConstructorPicks}
            items={props.constructors.map((c) => ({
              id: c.id,
              label: c.name,
            }))}
          />
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

function UsageSummary({
  uses,
  max,
  items,
}: {
  uses: Record<string, number>;
  max: number;
  items: { id: string; label: string }[];
}) {
  const usedItems = items.filter((i) => (uses[i.id] ?? 0) > 0);
  if (usedItems.length === 0) {
    return (
      <p className="text-xs text-zinc-600 mt-2">
        No uses yet. Max {max} per selection.
      </p>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {usedItems
        .sort((a, b) => (uses[b.id] ?? 0) - (uses[a.id] ?? 0))
        .map((i) => {
          const used = uses[i.id] ?? 0;
          const exhausted = used >= max;
          return (
            <span
              key={i.id}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide ${
                exhausted
                  ? "bg-red-900/40 text-red-400 border border-red-800 line-through"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
              }`}
            >
              {i.label} {used}/{max}
            </span>
          );
        })}
    </div>
  );
}
