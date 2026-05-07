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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">
            Driver
          </label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
          >
            <option value="">— Select a driver —</option>
            {props.drivers.map((d) => {
              const used = props.driverUses[d.id] ?? 0;
              const exhausted =
                used >= props.maxDriverPicks && d.id !== props.currentDriverId;
              return (
                <option key={d.id} value={d.id} disabled={exhausted}>
                  {d.familyName}, {d.givenName}
                  {d.code ? ` (${d.code})` : ""}
                  {used > 0 ? ` — used ${used}/${props.maxDriverPicks}` : ""}
                  {exhausted ? " — exhausted" : ""}
                </option>
              );
            })}
          </select>
          <UsageBar uses={props.driverUses} drivers={props.drivers} max={props.maxDriverPicks} kind="driver" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-zinc-300">
            Constructor
          </label>
          <select
            value={consId}
            onChange={(e) => setConsId(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
          >
            <option value="">— Select a constructor —</option>
            {props.constructors.map((c) => {
              const used = props.constructorUses[c.id] ?? 0;
              const exhausted =
                used >= props.maxConstructorPicks &&
                c.id !== props.currentConstructorId;
              return (
                <option key={c.id} value={c.id} disabled={exhausted}>
                  {c.name}
                  {used > 0
                    ? ` — used ${used}/${props.maxConstructorPicks}`
                    : ""}
                  {exhausted ? " — exhausted" : ""}
                </option>
              );
            })}
          </select>
          <UsageBar
            uses={props.constructorUses}
            constructors={props.constructors}
            max={props.maxConstructorPicks}
            kind="constructor"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {savedAt && !error && (
        <p className="text-emerald-400 text-sm">
          Saved at {savedAt.toLocaleTimeString()}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={saving}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded font-medium"
        >
          {saving ? "Saving..." : "Save pick"}
        </button>
        <span className="text-sm text-zinc-400">
          You can change your pick any time before the race start.
        </span>
      </div>
    </form>
  );
}

interface UsageProps {
  uses: Record<string, number>;
  max: number;
  kind: "driver" | "constructor";
  drivers?: DriverOpt[];
  constructors?: ConsOpt[];
}

function UsageBar(props: UsageProps) {
  const items =
    props.kind === "driver"
      ? (props.drivers ?? []).map((d) => ({
          id: d.id,
          label: d.code ?? d.familyName.slice(0, 3).toUpperCase(),
        }))
      : (props.constructors ?? []).map((c) => ({
          id: c.id,
          label: c.name,
        }));
  const usedItems = items.filter((i) => (props.uses[i.id] ?? 0) > 0);
  if (usedItems.length === 0) {
    return (
      <p className="text-xs text-zinc-500 mt-2">
        Used: none yet. Cap: {props.max}.
      </p>
    );
  }
  return (
    <p className="text-xs text-zinc-400 mt-2 flex flex-wrap gap-1">
      <span className="text-zinc-500">Used:</span>
      {usedItems.map((i) => {
        const used = props.uses[i.id] ?? 0;
        const exhausted = used >= props.max;
        return (
          <span
            key={i.id}
            className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
              exhausted
                ? "bg-red-900/40 text-red-300 border border-red-800"
                : "bg-zinc-800 border border-zinc-700"
            }`}
            title={`${i.label} used ${used}/${props.max}`}
          >
            {i.label} ({used}/{props.max})
          </span>
        );
      })}
    </p>
  );
}
