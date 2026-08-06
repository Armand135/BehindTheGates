import type { BerthComparisonResult, ChatMessage, ChatResponse, SimulationRun, TerminalState } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  return res.json();
}

export const api = {
  listRuns: () => request<SimulationRun[]>("/simulation/runs"),
  getRun: (id: string) => request<SimulationRun>(`/simulation/runs/${id}`),
  createRun: (body: {
    name: string;
    sim_duration_hours: number;
    ship_arrival_rate_per_day: number;
    truck_arrival_rate_per_hour: number;
    seed?: number;
  }) => request<SimulationRun>("/simulation/runs", { method: "POST", body: JSON.stringify(body) }),
  createLiveRun: (body: {
    name: string;
    sim_duration_hours: number;
    acceleration: number;
    ship_arrival_rate_per_day: number;
    truck_arrival_rate_per_hour: number;
    seed?: number;
  }) => request<SimulationRun>("/simulation/runs/live", { method: "POST", body: JSON.stringify(body) }),
  getState: (runId: string, atHours?: number) =>
    request<TerminalState>(`/simulation/runs/${runId}/state${atHours !== undefined ? `?at_hours=${atHours}` : ""}`),
  compareOptimization: (runId: string, horizonHours = 120) =>
    request<BerthComparisonResult>(`/optimization/berth-allocation/compare/${runId}?horizon_hours=${horizonHours}`, {
      method: "POST",
    }),
  chat: (messages: ChatMessage[], simulationRunId?: string) =>
    request<ChatResponse>("/copilot/chat", {
      method: "POST",
      body: JSON.stringify({ messages, simulation_run_id: simulationRunId }),
    }),
};
