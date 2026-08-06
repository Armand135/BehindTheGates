"""In-memory runtime state for a simulation run.

These are plain dataclasses (not ORM rows) so the event loop can mutate
them cheaply at thousands of events/sec; `runner.py` snapshots and persists
them to Postgres/Redis at whatever cadence the caller needs.
"""
from dataclasses import dataclass, field

from app.simulation.layout import PortLayout


@dataclass
class ShipState:
    id: str
    name: str
    imo: str
    size_teu: int
    containers_to_discharge: int
    containers_to_load: int
    eta_hours: float
    ata_hours: float | None = None
    berthed_hours: float | None = None
    etd_hours: float | None = None
    atd_hours: float | None = None
    assigned_berth_code: str | None = None
    status: str = "inbound"


@dataclass
class BerthState:
    code: str
    length_m: float
    max_draft_m: float
    crane_slots: int
    position: dict
    status: str = "empty"
    current_ship_id: str | None = None
    queue: list[str] = field(default_factory=list)


@dataclass
class CraneState:
    code: str
    berth_code: str
    moves_per_hour: float
    position: dict
    status: str = "idle"
    utilization_pct: float = 0.0
    busy_hours: float = 0.0


@dataclass
class YardBlockState:
    code: str
    capacity_teu: int
    position: dict
    occupied_teu: int = 0


@dataclass
class GateState:
    code: str
    lanes: int
    position: dict
    status: str = "open"
    queue: list[str] = field(default_factory=list)


@dataclass
class TruckState:
    id: str
    plate: str
    arrival_hours: float
    gate_code: str | None = None
    status: str = "en_route"
    queue_wait_hours: float | None = None


@dataclass
class TerminalState:
    ships: dict[str, ShipState] = field(default_factory=dict)
    berths: dict[str, BerthState] = field(default_factory=dict)
    cranes: dict[str, CraneState] = field(default_factory=dict)
    yard_blocks: dict[str, YardBlockState] = field(default_factory=dict)
    gates: dict[str, GateState] = field(default_factory=dict)
    trucks: dict[str, TruckState] = field(default_factory=dict)
    anchorage_queue: list[str] = field(default_factory=list)

    @classmethod
    def from_layout(cls, layout: PortLayout) -> "TerminalState":
        state = cls()
        for b in layout.berths:
            state.berths[b.code] = BerthState(b.code, b.length_m, b.max_draft_m, b.crane_slots, b.position)
        for c in layout.cranes:
            state.cranes[c.code] = CraneState(c.code, c.berth_code, c.moves_per_hour, c.position)
        for y in layout.yard_blocks:
            state.yard_blocks[y.code] = YardBlockState(y.code, y.capacity_teu, y.position)
        for g in layout.gates:
            state.gates[g.code] = GateState(g.code, g.lanes, g.position)
        return state

    def snapshot(self, sim_time_hours: float, run_id: str) -> dict:
        kpis = self.compute_kpis()
        return {
            "run_id": run_id,
            "sim_time_hours": round(sim_time_hours, 3),
            "ships": [vars(s) for s in self.ships.values()],
            "berths": [vars(b) | {"queue": list(b.queue)} for b in self.berths.values()],
            "cranes": [vars(c) for c in self.cranes.values()],
            "yard_blocks": [vars(y) for y in self.yard_blocks.values()],
            "gates": [vars(g) | {"queue": list(g.queue)} for g in self.gates.values()],
            "trucks": [vars(t) for t in list(self.trucks.values())[-50:]],
            "kpis": kpis,
        }

    def compute_kpis(self) -> dict:
        berths_occupied = sum(1 for b in self.berths.values() if b.status == "occupied")
        total_berths = max(len(self.berths), 1)
        crane_util = (
            sum(c.utilization_pct for c in self.cranes.values()) / max(len(self.cranes), 1)
        )
        yard_util = (
            sum(y.occupied_teu for y in self.yard_blocks.values())
            / max(sum(y.capacity_teu for y in self.yard_blocks.values()), 1)
            * 100
        )
        gate_queue = sum(len(g.queue) for g in self.gates.values())
        ships_waiting = len(self.anchorage_queue)
        return {
            "berth_occupancy_pct": round(berths_occupied / total_berths * 100, 1),
            "avg_crane_utilization_pct": round(crane_util, 1),
            "yard_utilization_pct": round(yard_util, 1),
            "trucks_in_gate_queue": gate_queue,
            "ships_waiting_at_anchorage": ships_waiting,
            "ships_in_port": sum(1 for s in self.ships.values() if s.status in ("berthed", "working")),
        }
