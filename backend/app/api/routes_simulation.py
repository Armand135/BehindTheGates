import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Event, SimulationRun
from app.schemas.simulation import EventOut, SimulationRunCreate, SimulationRunOut, TerminalStateOut
from app.simulation import service
from app.simulation.layout import list_layouts

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.get("/layouts")
def get_layouts() -> list[str]:
    return list_layouts()


@router.post("/runs", response_model=SimulationRunOut)
def create_run(req: SimulationRunCreate, db: Session = Depends(get_db)):
    """Runs the simulation synchronously (batch mode) and persists the full
    event log + final entity state. For a paced, WebSocket-streamed run use
    POST /simulation/runs/live instead."""
    try:
        run = service.create_and_run(db, req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return run


@router.post("/runs/live", response_model=SimulationRunOut, status_code=202)
def create_live_run(req: SimulationRunCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Starts a simulation paced in real time by `acceleration`, streaming
    state snapshots over Redis pub/sub -> WebSocket at /ws/simulation/{run_id}."""
    from datetime import datetime

    from app.models.entities import RunStatus

    run = SimulationRun(
        name=req.name, layout_name=req.layout_name, acceleration=req.acceleration, seed=req.seed,
        sim_duration_hours=req.sim_duration_hours, status=RunStatus.running, started_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    async def _runner():
        await service.run_live(run.id, req)

    background_tasks.add_task(lambda: asyncio.run(_runner()))
    return run


@router.get("/runs", response_model=list[SimulationRunOut])
def list_runs(limit: int = 20, db: Session = Depends(get_db)):
    return db.execute(select(SimulationRun).order_by(desc(SimulationRun.created_at)).limit(limit)).scalars().all()


@router.get("/runs/{run_id}", response_model=SimulationRunOut)
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return run


@router.get("/runs/{run_id}/events", response_model=list[EventOut])
def get_run_events(run_id: str, limit: int = 500, event_type: str | None = None, db: Session = Depends(get_db)):
    query = select(Event).where(Event.run_id == run_id)
    if event_type:
        query = query.where(Event.event_type == event_type)
    query = query.order_by(Event.sim_time_hours).limit(limit)
    return db.execute(query).scalars().all()


@router.get("/runs/{run_id}/state", response_model=TerminalStateOut)
def get_run_state(run_id: str, at_hours: float | None = None, db: Session = Depends(get_db)):
    """Reconstructs terminal state at a point in time by replaying persisted
    events -- powers digital-twin playback scrubbing."""
    try:
        return service.get_state_at(db, run_id, at_hours)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
