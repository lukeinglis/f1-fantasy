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
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold">Season {props.season}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy !== null}
            onClick={syncSeason}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium disabled:opacity-50"
          >
            {busy === "season" ? "Syncing..." : "Sync season (calendar + grid)"}
          </button>
          <button
            disabled={busy !== null}
            onClick={recomputeAll}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded font-medium disabled:opacity-50"
          >
            {busy === "recompute" ? "Recomputing..." : "Recompute all scores"}
          </button>
        </div>
        {message && <p className="text-emerald-400 text-sm">{message}</p>}
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b border-zinc-800">
          Races
        </h2>
        {props.races.length === 0 ? (
          <p className="p-4 text-zinc-400">
            No races yet. Click &quot;Sync season&quot; above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/40 text-zinc-400 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Round</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.races.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-800 hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-2 tabular-nums">{r.round}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-zinc-400">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    {r.resultsLocked ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700">
                        Scored
                      </span>
                    ) : r.hasResults ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700">
                        Results entered
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={busy !== null}
                      onClick={() => syncRoundResults(r.round)}
                      className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded disabled:opacity-50"
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

      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-3">Manual results entry</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Use this only if the API is delayed. Pick a race, then enter finishing positions.
        </p>
        <select
          value={selectedRaceId}
          onChange={(e) => setSelectedRaceId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 mb-3"
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
        <thead className="text-zinc-400 text-xs uppercase">
          <tr>
            <th className="text-left py-1 w-12">Pos</th>
            <th className="text-left py-1">Driver</th>
            <th className="text-left py-1">Constructor</th>
            <th className="text-left py-1 w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-zinc-800">
              <td className="py-1 tabular-nums text-zinc-400">{r.position}</td>
              <td className="py-1">
                <select
                  value={r.driverId}
                  onChange={(e) => update(i, { driverId: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        disabled={saving}
        onClick={submit}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save results & score"}
      </button>
    </div>
  );
}
