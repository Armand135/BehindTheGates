"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import TerminalMap from "@/components/TerminalMap";
import { api, WS_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { SimulationRun, TerminalState } from "@/lib/types";

export default function TwinPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [state, setState] = useState<TerminalState | null>(null);
  const [atHours, setAtHours] = useState<number>(0);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api.getRun(runId).then(setRun).catch(() => setNotFound(true));
  }, [runId]);

  useEffect(() => {
    if (!run) return;
    if (live) return;
    const target = atHours || run.sim_duration_hours;
    api.getState(runId, target).then(setState).catch(() => {});
  }, [runId, atHours, run, live]);

  useEffect(() => {
    if (!live) {
      wsRef.current?.close();
      return;
    }
    const token = getToken();
    const ws = new WebSocket(`${WS_URL}/ws/simulation/${runId}?token=${encodeURIComponent(token || "")}`);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.event === "completed") {
        setLive(false);
        return;
      }
      setState(data);
    };
    return () => ws.close();
  }, [live, runId]);

  if (notFound) {
    return (
      <div className="page">
        <p className="muted">
          This simulation run doesn&apos;t exist, or doesn&apos;t belong to your organization.
        </p>
      </div>
    );
  }
  if (!run) return <div className="page">Loading run...</div>;

  return (
    <div className="page">
      <h1>{run.name}</h1>
      <p className="muted">
        {run.status} · layout {run.layout_name} · {run.sim_duration_hours}h simulated
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <button className={live ? "" : "secondary"} onClick={() => setLive((v) => !v)}>
            {live ? "Streaming live (click to stop)" : "Connect live WebSocket"}
          </button>
          {!live && (
            <>
              <label>
                Playback time: {atHours.toFixed(1)}h
                <div>
                  <input
                    type="range"
                    min={0}
                    max={run.sim_duration_hours}
                    step={0.5}
                    value={atHours}
                    onChange={(e) => setAtHours(Number(e.target.value))}
                    style={{ width: 320 }}
                  />
                </div>
              </label>
            </>
          )}
          {state && <span className="muted">rendered at sim time {state.sim_time_hours.toFixed(2)}h</span>}
        </div>
      </div>

      {state && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            {Object.entries(state.kpis).map(([k, v]) => (
              <div className="kpi-tile" key={k}>
                <div className="value">{typeof v === "number" ? v.toFixed(1) : String(v)}</div>
                <div className="label">{k.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
          <TerminalMap state={state} />
        </>
      )}
      {!state && <p className="muted">No state yet.</p>}
    </div>
  );
}
