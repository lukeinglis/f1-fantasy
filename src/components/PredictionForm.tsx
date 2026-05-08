"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DriverOpt {
  id: string;
  code: string | null;
  givenName: string;
  familyName: string;
}

interface ExistingPrediction {
  position: number;
  driverId: string;
}

interface Props {
  raceId: string;
  drivers: DriverOpt[];
  existing: ExistingPrediction[];
}

export default function PredictionForm({ raceId, drivers, existing }: Props) {
  const router = useRouter();
  const initialSlots: (string | "")[] = Array.from({ length: 10 }, (_, i) => {
    const pred = existing.find((p) => p.position === i + 1);
    return pred?.driverId ?? "";
  });

  const [slots, setSlots] = useState<(string | "")[]>(initialSlots);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(existing.length > 0);

  const selectedSet = new Set(slots.filter(Boolean));
  const filledCount = selectedSet.size;
  const isUpdate = existing.length > 0;

  function setSlot(index: number, driverId: string) {
    const next = [...slots];
    next[index] = driverId;
    setSlots(next);
    setSavedAt(null);
  }

  function clearAll() {
    setSlots(Array(10).fill(""));
    setSavedAt(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const predictions = slots
      .map((driverId, i) => (driverId ? { position: i + 1, driverId } : null))
      .filter(Boolean);

    if (predictions.length === 0) {
      setError("Select at least one driver");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId, predictions }),
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

  const posLabels = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];
  const posColors = [
    "text-amber-400", "text-zinc-300", "text-amber-700",
    "text-zinc-400", "text-zinc-400", "text-zinc-400",
    "text-zinc-400", "text-zinc-400", "text-zinc-400", "text-zinc-400",
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">
          Predict the top 10
        </h2>
        {existing.length > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            {collapsed ? "Edit prediction" : "Collapse"}
          </button>
        )}
      </div>

      {collapsed && existing.length > 0 ? (
        <div className="text-sm text-zinc-400 flex items-center gap-2">
          <span className="text-emerald-400">&#10003;</span>
          Prediction submitted ({existing.length} drivers).
          Click &ldquo;Edit prediction&rdquo; to change.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {/* Scoring rules */}
          <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
            <div className="font-medium text-zinc-300 text-sm mb-1">Scoring</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><span className="text-emerald-400 font-bold">5 pts</span> exact position</span>
              <span><span className="text-yellow-400 font-bold">2 pts</span> off by 1</span>
              <span><span className="text-orange-400 font-bold">1 pt</span> off by 2</span>
              <span><span className="text-zinc-500 font-bold">0 pts</span> off by 3+</span>
            </div>
            <div className="text-zinc-500">Max 50 pts per race (10 exact matches)</div>
          </div>

          {/* Position selects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {posLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-sm font-bold w-8 text-right tabular-nums ${posColors[i]}`}>
                  {label}
                </span>
                <select
                  value={slots[i]}
                  onChange={(e) => setSlot(i, e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                >
                  <option value="">Select driver...</option>
                  {drivers.map((d) => {
                    const taken = selectedSet.has(d.id) && slots[i] !== d.id;
                    return (
                      <option key={d.id} value={d.id} disabled={taken}>
                        {d.familyName}, {d.givenName}
                        {d.code ? ` (${d.code})` : ""}
                        {taken ? " [already selected]" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
          {savedAt && !error && (
            <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg px-4 py-2.5 text-sm text-emerald-300 flex items-center gap-2">
              <span>&#10003;</span>
              Prediction saved at {savedAt.toLocaleTimeString()}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={saving || filledCount === 0}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors"
            >
              {saving
                ? "Saving..."
                : isUpdate
                  ? "Update prediction"
                  : `Save prediction (${filledCount}/10)`}
            </button>
            {filledCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Clear all
              </button>
            )}
            <span className="text-xs text-zinc-500">
              You can change your prediction any time before the deadline.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
