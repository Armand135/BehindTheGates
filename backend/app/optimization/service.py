"""Bridges optimization requests to persisted data: builds a berth
allocation scenario from a completed simulation run's ships, and stores
comparison results so the copilot / UI can retrieve them without
recomputing.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Berth, OptimizationRun, Ship, SimulationRun
from app.optimization import berth_allocation
from app.schemas.optimization import (
    BerthAllocationRequest,
    BerthComparisonResult,
    BerthSpec,
    ShipRequest,
)


def build_scenario_from_run(db: Session, run_id: str, org_id: str, horizon_hours: float = 96.0) -> BerthAllocationRequest:
    run = db.get(SimulationRun, run_id)
    if run is None or run.org_id != org_id:
        raise ValueError(f"Unknown simulation run {run_id}")

    ships = db.execute(select(Ship).where(Ship.run_id == run_id)).scalars().all()
    berths = db.execute(select(Berth).where(Berth.run_id == run_id)).scalars().all()

    def _service_hours(s: Ship) -> float:
        # Prefer the actually observed berth-occupancy duration; fall back
        # to a moves/throughput estimate for ships that hadn't departed
        # (or hadn't berthed at all) when the run ended.
        if s.berthed_hours is not None and s.atd_hours is not None:
            return max(s.atd_hours - s.berthed_hours, 1.0)
        return max((s.containers_to_discharge + s.containers_to_load) / 25.0, 1.0)

    ship_reqs = [
        ShipRequest(id=s.id, name=s.name, size_teu=s.size_teu, eta_hours=s.eta_hours, service_hours=_service_hours(s))
        for s in ships
    ]
    berth_specs = [
        BerthSpec(code=b.code, length_m=b.length_m, max_draft_m=b.max_draft_m, crane_slots=b.crane_slots)
        for b in berths
    ]
    return BerthAllocationRequest(ships=ship_reqs, berths=berth_specs, horizon_hours=horizon_hours, simulation_run_id=run_id)


def compare_and_persist(db: Session, req: BerthAllocationRequest, org_id: str) -> BerthComparisonResult:
    result = berth_allocation.compare(req)

    for r in (result.baseline, result.optimized):
        db.add(OptimizationRun(
            org_id=org_id, simulation_run_id=req.simulation_run_id, strategy=r.strategy, objective="berth_allocation",
            total_waiting_hours=r.total_waiting_hours, makespan_hours=r.makespan_hours,
            solver_status=r.solver_status, solve_time_seconds=r.solve_time_seconds,
            assignments={"assignments": [a.model_dump() for a in r.assignments]},
        ))
    db.commit()
    return result
