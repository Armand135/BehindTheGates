"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SimulationRun } from "@/lib/types";

export default function TwinIndexPage() {
  const [runs, setRuns] = useState<SimulationRun[]>([]);

  useEffect(() => {
    api.listRuns().then(setRuns).catch(() => {});
  }, []);

  return (
    <div className="page">
      <h1>Digital Twin</h1>
      <p className="muted">Pick a simulation run to open its terminal map.</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {runs.map((r) => (
          <Link key={r.id} href={`/twin/${r.id}`} className="card" style={{ textDecoration: "none" }}>
            <strong>{r.name}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {r.status} · {r.sim_duration_hours}h · {r.layout_name}
            </div>
          </Link>
        ))}
        {runs.length === 0 && <p className="muted">No runs yet. Create one from the Dashboard.</p>}
      </div>
    </div>
  );
}
