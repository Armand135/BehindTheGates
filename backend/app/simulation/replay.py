"""Reconstructs `TerminalState` by re-applying a persisted event stream.

This is what powers digital-twin playback/scrubbing: rather than storing a
full state snapshot per event (expensive), the API replays events up to the
requested `sim_time_hours` against a fresh state built from the run's
layout. The mutations here intentionally mirror `runner.py`'s process
handlers, minus the parts that only matter for driving the simulation
forward (arrival scheduling, RNG).
"""
from app.simulation.layout import PortLayout
from app.simulation.state import ShipState, TerminalState, TruckState


def apply_event(state: TerminalState, event_type: str, entity_type: str, entity_id: str, payload: dict, sim_time_hours: float) -> None:
    if event_type == "ship_arrival":
        state.ships[entity_id] = ShipState(
            id=entity_id, name=payload.get("name", entity_id), imo="",
            size_teu=payload.get("size_teu", 0),
            containers_to_discharge=payload.get("containers_to_discharge", 0),
            containers_to_load=payload.get("containers_to_load", 0),
            eta_hours=payload.get("eta_hours", 0.0), ata_hours=payload.get("ata_hours"),
            status="anchored",
        )
        state.anchorage_queue.append(entity_id)

    elif event_type == "berth_assigned":
        berth_code = payload["berth_code"]
        ship = state.ships.get(entity_id)
        berth = state.berths.get(berth_code)
        if ship and berth:
            berth.status = "occupied"
            berth.current_ship_id = entity_id
            ship.assigned_berth_code = berth_code
            ship.berthed_hours = payload.get("berthed_hours")
            ship.status = "berthed"
        if entity_id in state.anchorage_queue:
            state.anchorage_queue.remove(entity_id)

    elif event_type == "crane_started":
        berth_code = entity_id
        for code in payload.get("cranes", []):
            if code in state.cranes:
                state.cranes[code].status = "active"
        berth = state.berths.get(berth_code)
        if berth and berth.current_ship_id and berth.current_ship_id in state.ships:
            state.ships[berth.current_ship_id].status = "working"

    elif event_type == "crane_completed":
        berth_code = payload["berth_code"]
        work_hours = payload.get("work_hours", 0.0)
        for c in state.cranes.values():
            if c.berth_code == berth_code:
                c.status = "idle"
                c.busy_hours += work_hours
                c.utilization_pct = round(min(c.busy_hours / max(sim_time_hours, 0.01) * 100, 100), 1)
        ship = state.ships.get(entity_id)
        if ship:
            ship.containers_to_discharge = 0
            ship.containers_to_load = 0

    elif event_type == "ship_departed":
        berth_code = payload["berth_code"]
        berth = state.berths.get(berth_code)
        if berth:
            berth.status = "empty"
            berth.current_ship_id = None
        ship = state.ships.get(entity_id)
        if ship:
            ship.status = "departed"
            ship.atd_hours = payload.get("atd_hours")

    elif event_type == "truck_arrival":
        gate_code = payload["gate_code"]
        state.trucks[entity_id] = TruckState(
            id=entity_id, plate="", arrival_hours=sim_time_hours, gate_code=gate_code, status="queued",
        )
        if gate_code in state.gates:
            state.gates[gate_code].queue.append(entity_id)

    elif event_type == "yard_block_updated":
        block = state.yard_blocks.get(entity_id)
        if block:
            block.occupied_teu = payload.get("occupied_teu", block.occupied_teu)

    elif event_type == "truck_departed":
        gate_code = payload["gate_code"]
        gate = state.gates.get(gate_code)
        if gate and entity_id in gate.queue:
            gate.queue.remove(entity_id)
        truck = state.trucks.get(entity_id)
        if truck:
            truck.status = "departed"
            truck.queue_wait_hours = payload.get("queue_wait_hours")


def replay_state(layout: PortLayout, events: list, run_id: str, up_to_hours: float | None = None) -> TerminalState:
    state = TerminalState.from_layout(layout)
    last_time = 0.0
    for ev in events:
        if up_to_hours is not None and ev.sim_time_hours > up_to_hours:
            break
        apply_event(state, ev.event_type, ev.entity_type, ev.entity_id, ev.payload, ev.sim_time_hours)
        last_time = ev.sim_time_hours
    return state, last_time
