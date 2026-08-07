export interface UserOut {
  id: string;
  email: string;
  role: "owner" | "member";
  org_id: string;
  organization_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

export interface SimulationRun {
  id: string;
  name: string;
  layout_name: string;
  acceleration: number;
  seed: number;
  status: "pending" | "running" | "completed" | "failed";
  sim_duration_hours: number;
  sim_clock_seconds: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface Kpis {
  berth_occupancy_pct: number;
  avg_crane_utilization_pct: number;
  yard_utilization_pct: number;
  trucks_in_gate_queue: number;
  ships_waiting_at_anchorage: number;
  ships_in_port: number;
}

export interface TerminalState {
  run_id: string;
  sim_time_hours: number;
  ships: Record<string, any>[];
  berths: Record<string, any>[];
  cranes: Record<string, any>[];
  yard_blocks: Record<string, any>[];
  trucks: Record<string, any>[];
  gates: Record<string, any>[];
  kpis: Kpis;
}

export interface BerthAssignment {
  ship_id: string;
  ship_name: string;
  berth_code: string;
  start_hours: number;
  end_hours: number;
  waiting_hours: number;
}

export interface BerthAllocationResult {
  strategy: string;
  solver_status: string;
  solve_time_seconds: number;
  total_waiting_hours: number;
  makespan_hours: number;
  assignments: BerthAssignment[];
}

export interface BerthComparisonResult {
  baseline: BerthAllocationResult;
  optimized: BerthAllocationResult;
  waiting_hours_reduction_pct: number;
  makespan_reduction_pct: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatToolCall {
  tool: string;
  input: Record<string, any>;
  output: any;
}

export interface ChatResponse {
  reply: string;
  tool_calls: ChatToolCall[];
  mode: "llm" | "retrieval_only";
}
