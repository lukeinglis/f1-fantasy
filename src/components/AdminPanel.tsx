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
      <section className="card-paper border-2 border-stone-400 rounded-xl p-5 space-y-3 cartoon-shadow">
        <h2
          className="text-lg text-stone-800"
          style={{ fontFamily: "var(--font-bangers)" }}
        >
          Season {props.season}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy !== null}
            onClick={syncSeason}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white disabled:opacity-50 sticker"
          >
            {busy === "season" ? "Syncing..." : "Sync season (calendar + grid)"}
          </button>
          <button
            disabled={busy !== null}
            onClick={recomputeAll}
            className="px-4 py-2 bg-stone-600 hover:bg-stone-500 rounded-lg font-bold text-white disabled:opacity-50 sticker"
          >
            {busy === "recompute" ? "Recomputing..." : "Recompute all scores"}
          </button>
        </div>
        {message && <p className="text-emerald-700 text-sm font-medium">{message}</p>}
        {err && <p className="text-red-700 text-sm font-medium">{err}</p>}
      </section>

      <section className="wood-panel border-4 border-[#2a1f15] rounded-2xl overflow-hidden cartoon-shadow">
        <h2
          className="text-lg p-4 border-b border-[#2a1f15]/50 text-amber-100"
          style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.03em" }}
        >
          Races
        </h2>
        {props.races.length === 0 ? (
          <p className="p-4 text-amber-100/60">
            No races yet. Click &quot;Sync season&quot; above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2a1f15] text-amber-300/70 uppercase text-xs tracking-wide">
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Round</th>
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Name</th>
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Date</th>
                <th className="text-left px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Status</th>
                <th className="text-right px-4 py-2" style={{ fontFamily: "var(--font-bangers)", letterSpacing: "0.05em" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.races.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-t border-[#2a1f15]/50 hover:bg-white/5 ${
                    i % 2 === 0 ? "bg-white/[0.03]" : ""
                  }`}
                >
                  <td className="px-4 py-2 tabular-nums text-amber-100/70">{r.round}</td>
                  <td className="px-4 py-2 text-amber-50">{r.name}</td>
                  <td className="px-4 py-2 text-amber-100/50">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    {r.resultsLocked ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold sticker">
                        Scored
                      </span>
                    ) : r.hasResults ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-bold sticker">
                        Results entered
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-stone-500 text-white font-bold sticker">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={busy !== null}
                      onClick={() => syncRoundResults(r.round)}
                      className="text-xs px-3 py-1 bg-stone-600 hover:bg-stone-500 rounded-lg text-white font-bold disabled:opacity-50"
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

      <section className="card-paper border-2 border-stone-400 rounded-xl p-5 cartoon-shadow">
        <h2
          className="text-lg mb-3 text-stone-800"
          style={{ fontFamily: "var(--font-bangers)" }}
        >
          Manual results entry
        </h2>
        <p className="text-sm text-stone-500 mb-3">
          Use this only if the API is delayed. Pick a race, then enter finishing positions.
        </p>
        <select
          value={selectedRaceId}
          onChange={(e) => setSelectedRaceId(e.target.value)}
          className="w-full bg-stone-100 border border-stone-400 rounded-lg px-3 py-2 mb-3 text-stone-800"
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
        <thead className="text-stone-500 text-xs uppercase">
          <tr>
            <th className="text-left py-1 w-12">Pos</th>
            <th className="text-left py-1">Driver</th>
            <th className="text-left py-1">Constructor</th>
            <th className="text-left py-1 w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-stone-300">
              <td className="py-1 tabular-nums text-stone-500">{r.position}</td>
              <td className="py-1">
                <select
                  value={r.driverId}
                  onChange={(e) => update(i, { driverId: e.target.value })}
                  className="w-full bg-stone-100 border border-stone-400 rounded-lg px-2 py-1 text-stone-800"
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
                  className="w-full bg-stone-100 border border-stone-400 rounded-lg px-2 py-1 text-stone-800"
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
                  className="w-full bg-stone-100 border border-stone-400 rounded-lg px-2 py-1 text-stone-800"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        disabled={saving}
        onClick={submit}
        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white disabled:opacity-50 sticker"
      >
        {saving ? "Saving..." : "Save results & score"}
      </button>
    </div>
  );
}
