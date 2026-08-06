"""High-level entry points used by the API layer: create+run a simulation,
persist it, replay historical state, and drive a live/paced run that
publishes snapshots to Redis for the digital twin WebSocket.
"""
import asyncio
import time
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_redis, session_scope
from app.models.entities import (
    Berth,
    Crane,
    Event,
    Gate,
    RunStatus,
    Ship,
    SimulationRun,
    Truck,
    YardBlock,
)
from app.simulation.layout import load_layout
from app.simulation.replay import replay_state
from app.simulation.runner import PortSimulation
from app.schemas.simulation import SimulationRunCreate


def create_and_run(db: Session, req: SimulationRunCreate) -> SimulationRun:
    layout = load_layout(req.layout_name)
    run = SimulationRun(
        name=req.name,
        layout_name=req.layout_name,
        acceleration=req.acceleration,
        seed=req.seed,
        sim_duration_hours=req.sim_duration_hours,
        status=RunStatus.running,
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.flush()

    sim = PortSimulation(
        layout=layout,
        seed=req.seed,
        ship_arrival_rate_per_day=req.ship_arrival_rate_per_day,
        truck_arrival_rate_per_hour=req.truck_arrival_rate_per_hour,
        run_id=run.id,
    )
    sim.run_batch(req.sim_duration_hours)
    _persist_results(db, run, sim)

    run.status = RunStatus.completed
    run.ended_at = datetime.utcnow()
    run.sim_clock_seconds = sim.clock * 3600
    db.commit()
    db.refresh(run)
    return run


def _persist_results(db: Session, run: SimulationRun, sim: PortSimulation) -> None:
    for ev in sim.event_log:
        db.add(Event(
            run_id=run.id, sim_time_hours=ev.sim_time_hours, event_type=ev.event_type,
            entity_type=ev.entity_type, entity_id=ev.entity_id, payload=ev.payload,
        ))

    for s in sim.state.ships.values():
        db.add(Ship(
            sim_ref=s.id, run_id=run.id, name=s.name, imo=s.imo, size_teu=s.size_teu,
            containers_to_discharge=s.containers_to_discharge, containers_to_load=s.containers_to_load,
            eta_hours=s.eta_hours, ata_hours=s.ata_hours, berthed_hours=s.berthed_hours,
            etd_hours=s.etd_hours, atd_hours=s.atd_hours, assigned_berth_code=s.assigned_berth_code,
            status=s.status,
        ))
    for b in sim.state.berths.values():
        db.add(Berth(
            run_id=run.id, code=b.code, length_m=b.length_m, max_draft_m=b.max_draft_m,
            crane_slots=b.crane_slots, status=b.status, current_ship_id=b.current_ship_id,
        ))
    for c in sim.state.cranes.values():
        db.add(Crane(
            run_id=run.id, code=c.code, berth_code=c.berth_code, moves_per_hour=c.moves_per_hour,
            status=c.status, utilization_pct=c.utilization_pct,
        ))
    for y in sim.state.yard_blocks.values():
        db.add(YardBlock(run_id=run.id, code=y.code, capacity_teu=y.capacity_teu, occupied_teu=y.occupied_teu))
    for g in sim.state.gates.values():
        db.add(Gate(run_id=run.id, code=g.code, lanes=g.lanes, status=g.status, queue_length=len(g.queue)))
    for t in sim.state.trucks.values():
        db.add(Truck(
            run_id=run.id, plate=t.plate, gate_code=t.gate_code, status=t.status,
            arrival_hours=t.arrival_hours, queue_wait_hours=t.queue_wait_hours,
        ))


def get_state_at(db: Session, run_id: str, at_hours: float | None) -> dict:
    run = db.get(SimulationRun, run_id)
    if run is None:
        raise ValueError(f"Unknown simulation run {run_id}")
    layout = load_layout(run.layout_name)
    events = db.execute(
        select(Event).where(Event.run_id == run_id).order_by(Event.sim_time_hours)
    ).scalars().all()
    state, last_time = replay_state(layout, events, run_id, up_to_hours=at_hours)
    return state.snapshot(at_hours if at_hours is not None else last_time, run_id)


async def run_live(run_id: str, req: SimulationRunCreate) -> None:
    """Runs a simulation paced in real time (per `req.acceleration`),
    publishing a state snapshot to Redis after every event so the
    WebSocket layer can push live updates to the digital twin."""
    layout = load_layout(req.layout_name)
    sim = PortSimulation(
        layout=layout, seed=req.seed, ship_arrival_rate_per_day=req.ship_arrival_rate_per_day,
        truck_arrival_rate_per_hour=req.truck_arrival_rate_per_hour, run_id=run_id,
    )
    r = get_redis()
    channel = f"sim:{run_id}:state"
    last_real_time = time.monotonic()
    last_sim_time = 0.0

    for logged in sim.iter_live(req.sim_duration_hours):
        dt_sim_hours = sim.clock - last_sim_time
        if dt_sim_hours > 0:
            real_seconds_needed = dt_sim_hours * 3600 / max(req.acceleration, 0.001)
            elapsed_real = time.monotonic() - last_real_time
            sleep_for = max(0.0, real_seconds_needed - elapsed_real)
            if sleep_for > 0:
                await asyncio.sleep(min(sleep_for, 2.0))
            last_real_time = time.monotonic()
            last_sim_time = sim.clock

        snapshot = sim.state.snapshot(sim.clock, run_id)
        r.publish(channel, _to_json(snapshot))

    with session_scope() as db:
        run = db.get(SimulationRun, run_id)
        if run:
            run.status = RunStatus.completed
            run.ended_at = datetime.utcnow()
            run.sim_clock_seconds = sim.clock * 3600
        _persist_results(db, run, sim)
    r.publish(channel, _to_json({"run_id": run_id, "event": "completed"}))


def _to_json(obj: dict) -> str:
    import json
    return json.dumps(obj, default=str)
