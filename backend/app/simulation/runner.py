"""Orchestrates a full port simulation run: seeds arrival processes from the
layout's `arrival_model`, drives the event queue, mutates `TerminalState`,
and appends a structured, replayable event to `event_log` for every state
change. `run_batch` drains the queue as fast as possible (used to generate
history for training/analytics); `iter_live` yields after each event so a
caller can pace it in real time using `acceleration` and push snapshots to
Redis for the digital twin.
"""
import itertools
import uuid
from dataclasses import dataclass, field
from typing import Callable, Iterator

import numpy as np

from app.simulation.engine import EventQueue
from app.simulation.layout import PortLayout
from app.simulation.state import ShipState, TerminalState, TruckState


@dataclass
class LoggedEvent:
    sim_time_hours: float
    event_type: str
    entity_type: str
    entity_id: str
    payload: dict = field(default_factory=dict)


class PortSimulation:
    def __init__(
        self,
        layout: PortLayout,
        seed: int = 42,
        ship_arrival_rate_per_day: float = 4.0,
        truck_arrival_rate_per_hour: float = 15.0,
        run_id: str | None = None,
    ) -> None:
        self.layout = layout
        self.rng = np.random.default_rng(seed)
        self.state = TerminalState.from_layout(layout)
        self.queue = EventQueue()
        self.event_log: list[LoggedEvent] = []
        self.clock = 0.0
        self.run_id = run_id or str(uuid.uuid4())
        self.ship_arrival_rate_per_day = ship_arrival_rate_per_day
        self.truck_arrival_rate_per_hour = truck_arrival_rate_per_hour
        self._gate_lane_free_at: dict[str, list[float]] = {
            g.code: [0.0] * g.lanes for g in layout.gates
        }
        self._ship_counter = itertools.count(1)
        self._truck_counter = itertools.count(1)

    # ------------------------------------------------------------------ #
    # Setup / scheduling
    # ------------------------------------------------------------------ #
    def seed_arrivals(self, duration_hours: float) -> None:
        rate_per_hour = self.ship_arrival_rate_per_day / 24.0
        t = 0.0
        while True:
            t += self.rng.exponential(1.0 / rate_per_hour)
            if t > duration_hours:
                break
            self.queue.schedule(t, lambda t=t: self._on_ship_arrival(t), name="ship_arrival")

        t = 0.0
        while True:
            t += self.rng.exponential(1.0 / self.truck_arrival_rate_per_hour)
            if t > duration_hours:
                break
            self.queue.schedule(t, lambda t=t: self._on_truck_arrival(t), name="truck_arrival")

    def _log(self, event_type: str, entity_type: str, entity_id: str, payload: dict) -> None:
        self.event_log.append(
            LoggedEvent(round(self.clock, 4), event_type, entity_type, entity_id, payload)
        )

    # ------------------------------------------------------------------ #
    # Ship lifecycle
    # ------------------------------------------------------------------ #
    def _on_ship_arrival(self, arrival_time: float) -> None:
        am = self.layout.arrival_model
        size_teu = int(self.rng.integers(am.get("ship_size_teu", {}).get("min", 800),
                                          am.get("ship_size_teu", {}).get("max", 14000)))
        moves_ratio_cfg = am.get("ship_moves_ratio", {"min": 0.12, "max": 0.30})
        ratio = self.rng.uniform(moves_ratio_cfg["min"], moves_ratio_cfg["max"])
        moves = int(size_teu * ratio)
        ship_id = f"ship-{next(self._ship_counter)}"
        ship = ShipState(
            id=ship_id,
            name=f"MV Simulated {ship_id.split('-')[1]}",
            imo=f"IMO{9000000 + self.rng.integers(0, 999999)}",
            size_teu=size_teu,
            containers_to_discharge=moves // 2,
            containers_to_load=moves - moves // 2,
            eta_hours=round(arrival_time - self.rng.uniform(0, 1.5), 3),
            ata_hours=arrival_time,
            status="anchored",
        )
        self.state.ships[ship_id] = ship
        self._log("ship_arrival", "ship", ship_id, {
            "name": ship.name, "size_teu": size_teu, "eta_hours": ship.eta_hours,
            "ata_hours": ship.ata_hours, "containers_to_discharge": ship.containers_to_discharge,
            "containers_to_load": ship.containers_to_load,
        })
        self.state.anchorage_queue.append(ship_id)
        self._try_assign_berths()

    def _compatible_berth(self, ship: ShipState) -> str | None:
        # Baseline policy: first-come-first-served + first available berth
        # long enough for the ship. This is intentionally simple -- the
        # optimization service offers a CP-SAT alternative over the same
        # kind of ship/berth data for what-if comparison.
        required_length = 80 + ship.size_teu * 0.02
        for berth in self.state.berths.values():
            if berth.status == "empty" and berth.length_m >= required_length:
                return berth.code
        return None

    def _try_assign_berths(self) -> None:
        still_waiting = []
        for ship_id in self.state.anchorage_queue:
            ship = self.state.ships[ship_id]
            berth_code = self._compatible_berth(ship)
            if berth_code:
                self._assign_berth(ship_id, berth_code)
            else:
                still_waiting.append(ship_id)
        self.state.anchorage_queue = still_waiting

    def _assign_berth(self, ship_id: str, berth_code: str) -> None:
        ship = self.state.ships[ship_id]
        berth = self.state.berths[berth_code]
        berth.status = "occupied"
        berth.current_ship_id = ship_id
        ship.assigned_berth_code = berth_code
        ship.berthed_hours = self.clock
        ship.status = "berthed"
        self._log("berth_assigned", "ship", ship_id, {
            "berth_code": berth_code, "berthed_hours": self.clock,
            "waiting_hours": round(self.clock - ship.ata_hours, 3),
        })
        self._start_crane_work(ship_id, berth_code)

    def _start_crane_work(self, ship_id: str, berth_code: str) -> None:
        ship = self.state.ships[ship_id]
        berth = self.state.berths[berth_code]
        cranes = [c for c in self.state.cranes.values() if c.berth_code == berth_code][: berth.crane_slots]
        combined_rate = sum(c.moves_per_hour for c in cranes) or 1.0
        total_moves = ship.containers_to_discharge + ship.containers_to_load
        work_hours = max(total_moves / combined_rate, 0.25)
        for c in cranes:
            c.status = "active"
        ship.status = "working"
        self._log("crane_started", "berth", berth_code, {
            "cranes": [c.code for c in cranes], "total_moves": total_moves,
            "estimated_hours": round(work_hours, 3),
        })
        self.queue.schedule(
            self.clock + work_hours,
            lambda: self._on_crane_complete(ship_id, berth_code, cranes, work_hours),
            name="crane_complete",
        )

    def _on_crane_complete(self, ship_id: str, berth_code: str, cranes, work_hours: float) -> None:
        for c in cranes:
            c.status = "idle"
            c.busy_hours += work_hours
            c.utilization_pct = round(min(c.busy_hours / max(self.clock, 0.01) * 100, 100), 1)
        ship = self.state.ships[ship_id]
        # Note: container counts are deliberately left as-is (not zeroed) so
        # persisted/replayed state and optimization scenarios built from a
        # completed run can still see how much work this call involved.
        self._log("crane_completed", "ship", ship_id, {"berth_code": berth_code, "work_hours": round(work_hours, 3)})

        yard_block = min(self.state.yard_blocks.values(), key=lambda y: y.occupied_teu / max(y.capacity_teu, 1))
        moved = min(ship.size_teu // 2, max(yard_block.capacity_teu - yard_block.occupied_teu, 0))
        yard_block.occupied_teu += moved
        self._log("yard_block_updated", "yard_block", yard_block.code, {
            "occupied_teu": yard_block.occupied_teu, "delta_teu": moved,
        })

        departure_buffer = 0.5
        self.queue.schedule(
            self.clock + departure_buffer,
            lambda: self._on_ship_depart(ship_id, berth_code),
            name="ship_depart",
        )

    def _on_ship_depart(self, ship_id: str, berth_code: str) -> None:
        ship = self.state.ships[ship_id]
        berth = self.state.berths[berth_code]
        ship.etd_hours = self.clock
        ship.atd_hours = self.clock
        ship.status = "departed"
        berth.status = "empty"
        berth.current_ship_id = None
        self._log("ship_departed", "ship", ship_id, {"berth_code": berth_code, "atd_hours": self.clock})
        self._try_assign_berths()

    # ------------------------------------------------------------------ #
    # Truck / gate lifecycle
    # ------------------------------------------------------------------ #
    def _on_truck_arrival(self, arrival_time: float) -> None:
        truck_id = f"truck-{next(self._truck_counter)}"
        gate_code = min(self.state.gates, key=lambda g: len(self.state.gates[g].queue))
        gate = self.state.gates[gate_code]
        truck = TruckState(id=truck_id, plate=f"PLT-{1000 + self.rng.integers(0, 8999)}",
                            arrival_hours=arrival_time, gate_code=gate_code, status="queued")
        self.state.trucks[truck_id] = truck
        gate.queue.append(truck_id)
        self._log("truck_arrival", "truck", truck_id, {"gate_code": gate_code})

        lanes = self._gate_lane_free_at[gate_code]
        lane_idx = min(range(len(lanes)), key=lambda i: lanes[i])
        start = max(self.clock, lanes[lane_idx])
        am = self.layout.arrival_model.get("truck_processing_minutes", {"min": 6, "max": 18})
        processing_hours = self.rng.uniform(am["min"], am["max"]) / 60.0
        lanes[lane_idx] = start + processing_hours
        truck.queue_wait_hours = round(start - arrival_time, 3)
        if len(gate.status) and gate.status == "open" and len(gate.queue) > gate.lanes * 3:
            gate.status = "congested"
        self.queue.schedule(
            start + processing_hours,
            lambda: self._on_truck_processed(truck_id, gate_code),
            name="truck_processed",
        )

    def _on_truck_processed(self, truck_id: str, gate_code: str) -> None:
        truck = self.state.trucks[truck_id]
        gate = self.state.gates[gate_code]
        if truck_id in gate.queue:
            gate.queue.remove(truck_id)
        truck.status = "departed"
        if len(gate.queue) <= gate.lanes * 3:
            gate.status = "open"
        self._log("truck_departed", "truck", truck_id, {
            "gate_code": gate_code, "queue_wait_hours": truck.queue_wait_hours,
        })

    # ------------------------------------------------------------------ #
    # Drivers
    # ------------------------------------------------------------------ #
    def run_batch(self, duration_hours: float) -> None:
        self.seed_arrivals(duration_hours)
        while True:
            ev = self.queue.pop()
            if ev is None or ev.time > duration_hours:
                break
            self.clock = ev.time
            ev.callback()

    def iter_live(self, duration_hours: float) -> Iterator[LoggedEvent]:
        """Drains the queue while yielding the most recently logged event(s)
        after each processed callback, so a caller can pace playback and
        publish state without duplicating the process logic."""
        self.seed_arrivals(duration_hours)
        while True:
            ev = self.queue.pop()
            if ev is None or ev.time > duration_hours:
                break
            self.clock = ev.time
            before = len(self.event_log)
            ev.callback()
            for logged in self.event_log[before:]:
                yield logged
