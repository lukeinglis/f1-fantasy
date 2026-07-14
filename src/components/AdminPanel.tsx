"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RaceRow {
  id: string;
  round: number;
  name: string;
  date: string;
  resultsLocked: boolean;
  hasResults: boolean;
}
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
  season: number;
  races: RaceRow[];
  drivers: DriverOpt[];
  constructors: ConsOpt[];
}

export default function AdminPanel(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string>(
    props.races[0]?.id ?? "",
  );

  function setStatus(ok: string | null, bad: string | null) {
    setMessage(ok);
    setErr(bad);
  }

  async function syncSeason() {
    setBusy("season");
    setStatus(null, null);
    const res = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "season" }),
    });
    setBusy(null);
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setStatus(null, j?.error || "Sync failed");
      return;
    }
    setStatus(
      `Synced ${j.races} races, ${j.drivers} drivers, ${j.constructors} constructors`,
      null,
    );
    router.refresh();
  }

  async function syncRoundResults(round: number) {
    setBusy(`results-${round}`);
    setStatus(null, null);
    const res = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "results", round }),
    });
    setBusy(null);
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setStatus(null, j?.error || "Sync failed");
      return;
    }
    if (j.ok === false) {
      setStatus(null, j.message || "No results yet");
      return;
    }
    setStatus(
      `Round ${round}: wrote ${j.resultsWritten} results, scored ${j.scoresUpdated} players`,
      null,
    );
    router.refresh();
  }

  async function recomputeAll() {
    setBusy("recompute");
    setStatus(null, null);
    const res = await fetch("/api/admin/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(null);
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setStatus(null, j?.error || "Recompute failed");
      return;
    }
    setStatus(
      `Recomputed ${j.totalScores} scores across ${j.racesProcessed} races`,
      null,
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="garage-card p-5 space-y-3">
        <h2
          className="text-lg text-stone-800"
          style={{ fontFamily: "var(--font-f1-bold)" }}
        >
          Season {props.season}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy !== null}
            onClick={syncSeason}
            className="garage-button-primary disabled:opacity-50"
          >
            {busy === "season" ? "Syncing..." : "Sync season (calendar + grid)"}
          </button>
          <button
            disabled={busy !== null}
            onClick={recomputeAll}
            className="garage-button-secondary disabled:opacity-50"
          >
            {busy === "recompute" ? "Recomputing..." : "Recompute all scores"}
          </button>
        </div>
        {message && <p className="text-emerald-700 text-sm font-medium">{message}</p>}
        {err && <p className="text-red-700 text-sm font-medium">{err}</p>}
      </section>

      <section className="whiteboard rounded-2xl overflow-hidden">
        <h2
          className="text-lg p-4 border-b border-[var(--color-garage-metal)]/20 text-[var(--color-oil-stain)]"
          style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.03em" }}
        >
          Races
        </h2>
        {props.races.length === 0 ? (
          <p className="p-4 text-[var(--color-garage-metal)]">
            No races yet. Click &quot;Sync season&quot; above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-garage-metal-dark)] text-white uppercase text-xs tracking-wide">
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Round</th>
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Name</th>
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Date</th>
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Status</th>
                <th className="text-right px-4 py-2" style={{ fontFamily: "var(--font-f1-bold)", letterSpacing: "0.05em" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.races.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-t border-[var(--color-garage-metal)]/20 hover:bg-[var(--color-garage-wall)]/50`}
                >
                  <td className="px-4 py-2 tabular-nums text-[var(--color-oil-stain)]/70">{r.round}</td>
                  <td className="px-4 py-2 text-[var(--color-oil-stain)]">{r.name}</td>
                  <td className="px-4 py-2 text-[var(--color-garage-metal)]">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    {r.resultsLocked ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold garage-badge">
                        Scored
                      </span>
                    ) : r.hasResults ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-bold garage-badge">
                        Results entered
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-stone-500 text-white font-bold garage-badge">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={busy !== null}
                      onClick={() => syncRoundResults(r.round)}
                      className="garage-button-secondary text-xs px-3 py-1 disabled:opacity-50"
                    >
                      {busy === `results-${r.round}` ? "..." : "Sync results"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="garage-card p-5">
        <h2
          className="text-lg mb-3 text-stone-800"
          style={{ fontFamily: "var(--font-f1-bold)" }}
        >
          Manual results entry
        </h2>
        <p className="text-sm text-stone-500 mb-3">
          Use this only if the API is delayed. Pick a race, then enter finishing positions.
        </p>
        <select
          value={selectedRaceId}
          onChange={(e) => setSelectedRaceId(e.target.value)}
          className="w-full bg-[var(--color-whiteboard)] border-[var(--color-garage-metal)] rounded-lg px-3 py-2 mb-3 text-[var(--color-oil-stain)]"
        >
          {props.races.map((r) => (
            <option key={r.id} value={r.id}>
              R{r.round} · {r.name}
            </option>
          ))}
        </select>
        {selectedRaceId && (
          <ManualResultsForm
            raceId={selectedRaceId}
            drivers={props.drivers}
            constructors={props.constructors}
            onSaved={(msg) => {
              setStatus(msg, null);
              router.refresh();
            }}
            onError={(msg) => setStatus(null, msg)}
          />
        )}
      </section>
    </div>
  );
}

interface ManualRow {
  driverId: string;
  constructorId: string;
  position: number;
  status: string;
}

function ManualResultsForm({
  raceId,
  drivers,
  constructors,
  onSaved,
  onError,
}: {
  raceId: string;
  drivers: DriverOpt[];
  constructors: ConsOpt[];
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  // 20 rows by default
  const [rows, setRows] = useState<ManualRow[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({
      driverId: "",
      constructorId: "",
      position: i + 1,
      status: "Finished",
    })),
  );
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<ManualRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    setSaving(true);
    const filled = rows.filter((r) => r.driverId && r.constructorId);
    if (filled.length === 0) {
      onError("Add at least one row");
      setSaving(false);
      return;
    }
    const res = await fetch("/api/admin/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId, results: filled }),
    });
    setSaving(false);
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      onError(j?.error || "Save failed");
      return;
    }
    onSaved(`Saved ${j.resultsWritten} results, scored ${j.scoresUpdated} players`);
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead className="text-[var(--color-garage-metal)] text-xs uppercase">
          <tr>
            <th className="text-left py-1 w-12">Pos</th>
            <th className="text-left py-1">Driver</th>
            <th className="text-left py-1">Constructor</th>
            <th className="text-left py-1 w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--color-garage-metal)]/20">
              <td className="py-1 tabular-nums text-stone-500">{r.position}</td>
              <td className="py-1">
                <select
                  value={r.driverId}
                  onChange={(e) => update(i, { driverId: e.target.value })}
                  className="w-full bg-[var(--color-whiteboard)] border-[var(--color-garage-metal)] rounded-lg px-2 py-1 text-[var(--color-oil-stain)]"
                >
                  <option value="">—</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.familyName}, {d.givenName}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1">
                <select
                  value={r.constructorId}
                  onChange={(e) =>
                    update(i, { constructorId: e.target.value })
                  }
                  className="w-full bg-[var(--color-whiteboard)] border-[var(--color-garage-metal)] rounded-lg px-2 py-1 text-[var(--color-oil-stain)]"
                >
                  <option value="">—</option>
                  {constructors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1">
                <input
                  value={r.status}
                  onChange={(e) => update(i, { status: e.target.value })}
                  className="w-full bg-[var(--color-whiteboard)] border-[var(--color-garage-metal)] rounded-lg px-2 py-1 text-[var(--color-oil-stain)]"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        disabled={saving}
        onClick={submit}
        className="garage-button-primary disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save results & score"}
      </button>
    </div>
  );
}
