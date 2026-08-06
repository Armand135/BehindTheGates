"use client";

import type { TerminalState } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  empty: "#223049",
  occupied: "#f2b84b",
  maintenance: "#e0607a",
  idle: "#223049",
  active: "#3fd0c9",
  open: "#3fd0c9",
  closed: "#e0607a",
  congested: "#e0607a",
};

export default function TerminalMap({ state }: { state: TerminalState }) {
  const shipById: Record<string, any> = Object.fromEntries(state.ships.map((s) => [s.id, s]));

  return (
    <svg viewBox="0 0 640 460" width="100%" height="520" style={{ background: "#0e1626", borderRadius: 12 }}>
      <text x="20" y="24" fill="#8fa2c0" fontSize="11">
        WATERSIDE
      </text>
      <line x1="10" y1="34" x2="10" y2="420" stroke="#223049" strokeWidth="2" />

      {state.berths.map((b) => {
        const ship = b.current_ship_id ? shipById[b.current_ship_id] : null;
        return (
          <g key={b.code} transform={`translate(${b.position.x},${b.position.y})`}>
            <rect
              x={-40}
              y={-24}
              width={160}
              height={48}
              rx={8}
              fill={STATUS_COLORS[b.status] || "#223049"}
              opacity={b.status === "occupied" ? 0.85 : 0.4}
              stroke="#3fd0c9"
              strokeWidth={1}
            />
            <text x={-32} y={-6} fontSize="11" fill="#e6ecf5" fontWeight={700}>
              {b.code}
            </text>
            {ship && (
              <text x={-32} y={12} fontSize="10" fill="#e6ecf5">
                {ship.name} ({ship.status})
              </text>
            )}
          </g>
        );
      })}

      {Object.entries(
        state.cranes.reduce<Record<string, any[]>>((acc, c) => {
          (acc[c.berth_code] ||= []).push(c);
          return acc;
        }, {})
      ).map(([berthCode, cranes]) =>
        cranes.map((c, i) => (
          <g key={c.code} transform={`translate(${c.position.x},${c.position.y})`}>
            <circle r={6} fill={STATUS_COLORS[c.status] || "#223049"} stroke="#0e1626" strokeWidth={1.5} />
            <text x={-6} y={-10 - (i % 3) * 10} fontSize="8" fill="#8fa2c0" textAnchor="middle">
              {c.code}
              {c.utilization_pct ? ` ${c.utilization_pct.toFixed(0)}%` : ""}
            </text>
          </g>
        ))
      )}

      <text x="290" y="24" fill="#8fa2c0" fontSize="11">
        YARD
      </text>
      {state.yard_blocks.map((y) => {
        const pct = Math.min((y.occupied_teu / Math.max(y.capacity_teu, 1)) * 100, 100);
        return (
          <g key={y.code} transform={`translate(${y.position.x},${y.position.y})`}>
            <rect x={-30} y={-20} width={100} height={40} rx={6} fill="#16223a" stroke="#223049" />
            <rect x={-28} y={16 - 34} width={Math.max((pct / 100) * 96, 0)} height={6} fill="#3fd0c9" />
            <text x={-26} y={-4} fontSize="10" fill="#e6ecf5">
              {y.code}
            </text>
            <text x={-26} y={10} fontSize="9" fill="#8fa2c0">
              {pct.toFixed(0)}% full
            </text>
          </g>
        );
      })}

      <text x="480" y="24" fill="#8fa2c0" fontSize="11">
        GATES
      </text>
      {state.gates.map((g) => (
        <g key={g.code} transform={`translate(${g.position.x},${g.position.y})`}>
          <rect
            x={-30}
            y={-20}
            width={90}
            height={40}
            rx={6}
            fill="#16223a"
            stroke={STATUS_COLORS[g.status] || "#223049"}
            strokeWidth={2}
          />
          <text x={-24} y={-4} fontSize="10" fill="#e6ecf5">
            {g.code}
          </text>
          <text x={-24} y={10} fontSize="9" fill="#8fa2c0">
            queue: {g.queue ? g.queue.length : 0}
          </text>
        </g>
      ))}
    </svg>
  );
}
