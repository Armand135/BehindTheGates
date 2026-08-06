"""Read-only data access the copilot uses to ground its answers: live/replayed
KPIs, recent event history, and stored optimization comparisons. Each
function returns plain dicts so they can be used directly as both Anthropic
tool results and the deterministic fallback's data source.
"""
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.entities import Event, OptimizationRun, SimulationRun
from app.simulation import service as simulation_service


def resolve_run_id(db: Session, run_id: str | None) -> str | None:
    if run_id:
        return run_id
    latest = db.execute(
        select(SimulationRun).order_by(desc(SimulationRun.created_at)).limit(1)
    ).scalar_one_or_none()
    return latest.id if latest else None


def get_kpis(db: Session, run_id: str) -> dict:
    try:
        snapshot = simulation_service.get_state_at(db, run_id, at_hours=None)
    except ValueError as e:
        return {"error": str(e)}
    return {
        "run_id": run_id,
        "sim_time_hours": snapshot["sim_time_hours"],
        "kpis": snapshot["kpis"],
    }


def get_recent_events(db: Session, run_id: str, limit: int = 15, event_type: str | None = None) -> dict:
    query = select(Event).where(Event.run_id == run_id)
    if event_type:
        query = query.where(Event.event_type == event_type)
    query = query.order_by(desc(Event.sim_time_hours)).limit(limit)
    events = db.execute(query).scalars().all()
    return {
        "run_id": run_id,
        "events": [
            {
                "sim_time_hours": e.sim_time_hours, "event_type": e.event_type,
                "entity_type": e.entity_type, "entity_id": e.entity_id, "payload": e.payload,
            }
            for e in reversed(events)
        ],
    }


def get_optimization_comparison(db: Session, run_id: str) -> dict:
    runs = db.execute(
        select(OptimizationRun)
        .where(OptimizationRun.simulation_run_id == run_id)
        .order_by(desc(OptimizationRun.created_at))
        .limit(2)
    ).scalars().all()
    if not runs:
        return {"run_id": run_id, "message": "No optimization comparison has been run for this simulation yet."}
    return {
        "run_id": run_id,
        "results": [
            {
                "strategy": r.strategy, "total_waiting_hours": r.total_waiting_hours,
                "makespan_hours": r.makespan_hours, "solver_status": r.solver_status,
            }
            for r in runs
        ],
    }


def list_simulation_runs(db: Session, limit: int = 10) -> dict:
    runs = db.execute(
        select(SimulationRun).order_by(desc(SimulationRun.created_at)).limit(limit)
    ).scalars().all()
    return {
        "runs": [
            {
                "id": r.id, "name": r.name, "status": r.status.value if hasattr(r.status, "value") else r.status,
                "layout_name": r.layout_name, "sim_duration_hours": r.sim_duration_hours,
                "created_at": r.created_at.isoformat(),
            }
            for r in runs
        ]
    }
