"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { DriverAvatar } from "@/components/DriverAvatar";

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

const posLabels = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];
const posColors = [
  "text-amber-400", "text-zinc-300", "text-amber-700",
  "text-zinc-400", "text-zinc-400", "text-zinc-400",
  "text-zinc-400", "text-zinc-400", "text-zinc-400", "text-zinc-400",
];
const posBorderColors = [
  "border-amber-400/40", "border-zinc-300/40", "border-amber-700/40",
  "border-zinc-600", "border-zinc-600", "border-zinc-600",
  "border-zinc-600", "border-zinc-600", "border-zinc-600", "border-zinc-600",
];

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

  // Drag state
  const [dragSource, setDragSource] = useState<{ type: "pool" | "slot"; driverId: string; slotIndex?: number } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragOverPool, setDragOverPool] = useState(false);

  // Tap-to-select state for mobile
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const selectedSet = new Set(slots.filter(Boolean));
  const filledCount = selectedSet.size;
  const isUpdate = existing.length > 0;

  const driverMap = new Map(drivers.map((d) => [d.id, d]));

  const setSlot = useCallback((index: number, driverId: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = driverId;
      return next;
    });
    setSavedAt(null);
  }, []);

  function clearAll() {
    setSlots(Array(10).fill(""));
    setSavedAt(null);
    setSelectedDriver(null);
  }

  function removeFromSlot(index: number) {
    setSlot(index, "");
  }

  function swapSlots(fromIndex: number, toIndex: number) {
    setSlots((prev) => {
      const next = [...prev];
      const temp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = temp;
      return next;
    });
    setSavedAt(null);
  }

  // Drag handlers for pool cards
  function onPoolDragStart(e: React.DragEvent, driverId: string) {
    setDragSource({ type: "pool", driverId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", driverId);
  }

  // Drag handlers for slot cards
  function onSlotDragStart(e: React.DragEvent, driverId: string, slotIndex: number) {
    setDragSource({ type: "slot", driverId, slotIndex });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", driverId);
  }

  function onSlotDragOver(e: React.DragEvent, slotIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slotIndex);
  }

  function onSlotDragLeave() {
    setDragOverSlot(null);
  }

  function onSlotDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    setDragOverSlot(null);

    if (!dragSource) return;

    if (dragSource.type === "pool") {
      // From pool to slot - place driver, displacing any existing
      const existing = slots[targetIndex];
      if (existing) {
        // If there's already a driver in this slot, just replace
      }
      setSlot(targetIndex, dragSource.driverId);
    } else if (dragSource.type === "slot" && dragSource.slotIndex !== undefined) {
      // From slot to slot - swap
      swapSlots(dragSource.slotIndex, targetIndex);
    }

    setDragSource(null);
  }

  function onPoolDragOver(e: React.DragEvent) {
    if (dragSource?.type === "slot") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverPool(true);
    }
  }

  function onPoolDragLeave() {
    setDragOverPool(false);
  }

  function onPoolDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOverPool(false);

    if (dragSource?.type === "slot" && dragSource.slotIndex !== undefined) {
      removeFromSlot(dragSource.slotIndex);
    }

    setDragSource(null);
  }

  function onDragEnd() {
    setDragSource(null);
    setDragOverSlot(null);
    setDragOverPool(false);
  }

  // Tap-to-select for mobile
  function onPoolTap(driverId: string) {
    if (selectedDriver === driverId) {
      setSelectedDriver(null);
    } else {
      setSelectedDriver(driverId);
    }
  }

  function onSlotTap(slotIndex: number) {
    if (selectedDriver) {
      // Place selected driver in this slot
      setSlot(slotIndex, selectedDriver);
      setSelectedDriver(null);
    }
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
        <form onSubmit={onSubmit} className="space-y-4">
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

          {/* Driver pool */}
          <div>
            <div className="text-xs text-zinc-400 font-medium mb-2 uppercase tracking-wide">
              Driver pool
              {selectedDriver && (
                <span className="ml-2 text-red-400 normal-case tracking-normal">
                  — Tap a slot to place driver
                </span>
              )}
            </div>
            <div
              className={`flex flex-wrap gap-2 p-3 rounded-lg border transition-colors min-h-[60px] ${
                dragOverPool
                  ? "border-red-500 bg-red-900/10"
                  : "border-zinc-700 bg-zinc-800/30"
              }`}
              onDragOver={onPoolDragOver}
              onDragLeave={onPoolDragLeave}
              onDrop={onPoolDrop}
            >
              {drivers.map((d) => {
                const isUsed = selectedSet.has(d.id);
                const isSelected = selectedDriver === d.id;
                return (
                  <div
                    key={d.id}
                    draggable={!isUsed}
                    onDragStart={(e) => !isUsed && onPoolDragStart(e, d.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => !isUsed && onPoolTap(d.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all select-none ${
                      isUsed
                        ? "opacity-30 cursor-default border-zinc-700 bg-zinc-800/50"
                        : isSelected
                          ? "border-red-500 bg-red-900/20 ring-1 ring-red-500 cursor-pointer"
                          : "border-zinc-600 bg-zinc-800 hover:border-zinc-500 cursor-grab active:cursor-grabbing"
                    }`}
                  >
                    <DriverAvatar driverId={d.id} size={28} className="shrink-0" />
                    <div className="leading-tight">
                      <div className="font-bold text-zinc-200">{d.code ?? d.id.substring(0, 3).toUpperCase()}</div>
                      <div className="text-zinc-500 text-[10px] truncate max-w-[60px]">{d.familyName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prediction slots */}
          <div>
            <div className="text-xs text-zinc-400 font-medium mb-2 uppercase tracking-wide">Your prediction</div>
            <div className="space-y-1.5">
              {posLabels.map((label, i) => {
                const driverId = slots[i];
                const driver = driverId ? driverMap.get(driverId) : null;
                const isDragOver = dragOverSlot === i;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                      isDragOver
                        ? "border-red-500 bg-red-900/15 scale-[1.01]"
                        : driver
                          ? `${posBorderColors[i]} bg-zinc-800/60`
                          : "border-zinc-700 border-dashed bg-zinc-800/20"
                    }`}
                    onDragOver={(e) => onSlotDragOver(e, i)}
                    onDragLeave={onSlotDragLeave}
                    onDrop={(e) => onSlotDrop(e, i)}
                    onClick={() => !driver && onSlotTap(i)}
                  >
                    <span className={`text-sm font-bold w-8 text-right tabular-nums ${posColors[i]}`}>
                      {label}
                    </span>

                    {driver ? (
                      <div
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => onSlotDragStart(e, driverId, i)}
                        onDragEnd={onDragEnd}
                      >
                        <DriverAvatar driverId={driver.id} size={28} className="shrink-0" />
                        <span className="font-bold text-sm text-zinc-200">
                          {driver.code ?? driver.id.substring(0, 3).toUpperCase()}
                        </span>
                        <span className="text-zinc-400 text-sm truncate">
                          {driver.familyName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-sm flex-1 italic">
                        {selectedDriver ? "Tap to place here" : "Drop driver here"}
                      </span>
                    )}

                    {driver && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromSlot(i);
                        }}
                        className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 shrink-0"
                        aria-label={`Remove ${driver.familyName}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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
