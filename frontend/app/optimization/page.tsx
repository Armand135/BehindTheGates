"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { BerthComparisonResult, SimulationRun } from "@/lib/types";

export default function OptimizationPage() {
  return (
    <Suspense fallback={<div className="page">Loading...</div>}>
      <OptimizationView />
    </Suspense>
  );
}

function OptimizationView() {
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [runId, setRunId] = useState(searchParams.get("run") || "");
  const [result, setResult] = useState<BerthComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listRuns().then((rs) => {
      setRuns(rs);
      if (!runId && rs.length) setRunId(rs[0].id);
    });
  }, []);

  const run = async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.compareOptimization(runId);
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Berth Allocation: Baseline vs. Optimized</h1>
      <p className="muted">
        Builds a scenario from the selected run's ships and berths, then compares the simulation's default
        first-come-first-served policy against an OR-Tools CP-SAT optimized assignment.
      </p>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <select value={runId} onChange={(e) => setRunId(e.target.value)}>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button onClick={run} disabled={loading || !runId}>
          {loading ? "Solving..." : "Run comparison"}
        </button>
        {error && <span style={{ color: "var(--danger)" }}>{error}</span>}
      </div>

      {result && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-tile">
              <div className="value">{result.waiting_hours_reduction_pct.toFixed(1)}%</div>
              <div className="label">Waiting time reduction</div>
            </div>
            <div className="kpi-tile">
              <div className="value">{result.makespan_reduction_pct.toFixed(1)}%</div>
              <div className="label">Makespan reduction</div>
            </div>
            <div className="kpi-tile">
              <div className="value">{result.optimized.solver_status}</div>
              <div className="label">Solver status</div>
            </div>
            <div className="kpi-tile">
              <div className="value">{result.optimized.solve_time_seconds.toFixed(2)}s</div>
              <div className="label">Solve time</div>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[result.baseline, result.optimized].map((r) => (
              <div className="card" key={r.strategy}>
                <h3 style={{ marginTop: 0, textTransform: "capitalize" }}>{r.strategy}</h3>
                <p className="muted">
                  Total waiting: {r.total_waiting_hours}h · Makespan: {r.makespan_hours}h
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Ship</th>
                      <th>Berth</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Wait</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.assignments.slice(0, 12).map((a) => (
                      <tr key={a.ship_id}>
                        <td>{a.ship_name}</td>
                        <td>{a.berth_code}</td>
                        <td>{a.start_hours}h</td>
                        <td>{a.end_hours}h</td>
                        <td style={{ color: a.waiting_hours > 0 ? "var(--accent-2)" : "var(--ok)" }}>
                          {a.waiting_hours}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
