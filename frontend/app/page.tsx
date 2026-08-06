"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SimulationRun } from "@/lib/types";

export default function DashboardPage() {
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Terminal run",
    sim_duration_hours: 72,
    ship_arrival_rate_per_day: 4,
    truck_arrival_rate_per_hour: 15,
  });

  const load = () => {
    api.listRuns().then(setRuns).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    load();
  }, []);

  const createRun = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.createRun({ ...form, seed: Math.floor(Math.random() * 100000) });
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Simulation Runs</h1>
      <p className="muted">
        Run the event-driven port simulation to generate history, then explore it in the Digital Twin, compare
        berth-allocation strategies in Optimization, or ask the Copilot about it.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "1fr", marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Start a new run (batch)</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", alignItems: "end" }}>
            <label>
              Name
              <div>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </label>
            <label>
              Duration (h)
              <div>
                <input
                  type="number"
                  value={form.sim_duration_hours}
                  onChange={(e) => setForm({ ...form, sim_duration_hours: Number(e.target.value) })}
                />
              </div>
            </label>
            <label>
              Ships/day
              <div>
                <input
                  type="number"
                  value={form.ship_arrival_rate_per_day}
                  onChange={(e) => setForm({ ...form, ship_arrival_rate_per_day: Number(e.target.value) })}
                />
              </div>
            </label>
            <label>
              Trucks/hour
              <div>
                <input
                  type="number"
                  value={form.truck_arrival_rate_per_hour}
                  onChange={(e) => setForm({ ...form, truck_arrival_rate_per_hour: Number(e.target.value) })}
                />
              </div>
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={createRun} disabled={loading}>
              {loading ? "Running simulation..." : "Run simulation"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Layout</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>
                <span className={`badge ${r.status}`}>{r.status}</span>
              </td>
              <td>{r.sim_duration_hours}h</td>
              <td>{r.layout_name}</td>
              <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
              <td>
                <Link href={`/twin/${r.id}`}>Twin</Link>
                {"  ·  "}
                <Link href={`/optimization?run=${r.id}`}>Optimize</Link>
                {"  ·  "}
                <Link href={`/copilot?run=${r.id}`}>Ask copilot</Link>
              </td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No runs yet -- start one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
