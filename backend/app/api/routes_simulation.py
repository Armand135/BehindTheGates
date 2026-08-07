import asyncio
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.auth import User
from app.models.entities import Event, RunStatus, SimulationRun
from app.schemas.simulation import EventOut, SimulationRunCreate, SimulationRunOut, TerminalStateOut
from app.simulation import service
from app.simulation.layout import list_layouts

router = APIRouter(prefix="/simulation", tags=["simulation"])


def _get_owned_run(db: Session, run_id: str, current_user: User) -> SimulationRun:
    run = db.get(SimulationRun, run_id)
    if run is None or run.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return run


@router.get("/layouts")
def get_layouts(current_user: User = Depends(get_current_user)) -> list[str]:
    return list_layouts()


@router.post("/runs", response_model=SimulationRunOut)
def create_run(req: SimulationRunCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Runs the simulation synchronously (batch mode) and persists the full
    event log + final entity state. For a paced, WebSocket-streamed run use
    POST /simulation/runs/live instead."""
    try:
        run = service.create_and_run(db, req, org_id=current_user.org_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return run


@router.post("/runs/live", response_model=SimulationRunOut, status_code=202)
def create_live_run(
    req: SimulationRunCreate, background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Starts a simulation paced in real time by `acceleration`, streaming
    state snapshots over Redis pub/sub -> WebSocket at /ws/simulation/{run_id}."""
    run = SimulationRun(
        org_id=current_user.org_id, name=req.name, layout_name=req.layout_name, acceleration=req.acceleration,
        seed=req.seed, sim_duration_hours=req.sim_duration_hours, status=RunStatus.running,
        started_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    async def _runner():
        await service.run_live(run.id, req)

    background_tasks.add_task(lambda: asyncio.run(_runner()))
    return run


@router.get("/runs", response_model=list[SimulationRunOut])
def list_runs(limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.execute(
        select(SimulationRun)
        .where(SimulationRun.org_id == current_user.org_id)
        .order_by(desc(SimulationRun.created_at))
        .limit(limit)
    ).scalars().all()


@router.get("/runs/{run_id}", response_model=SimulationRunOut)
def get_run(run_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_owned_run(db, run_id, current_user)


@router.get("/runs/{run_id}/events", response_model=list[EventOut])
def get_run_events(
    run_id: str, limit: int = 500, event_type: str | None = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    _get_owned_run(db, run_id, current_user)
    query = select(Event).where(Event.run_id == run_id)
    if event_type:
        query = query.where(Event.event_type == event_type)
    query = query.order_by(Event.sim_time_hours).limit(limit)
    return db.execute(query).scalars().all()


@router.get("/runs/{run_id}/state", response_model=TerminalStateOut)
def get_run_state(
    run_id: str, at_hours: float | None = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Reconstructs terminal state at a point in time by replaying persisted
    events -- powers digital-twin playback scrubbing."""
    try:
        return service.get_state_at(db, run_id, at_hours, org_id=current_user.org_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
