from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.auth import User
from app.optimization import berth_allocation, service
from app.optimization.crane_scheduling import solve_crane_schedule
from app.schemas.optimization import (
    BerthAllocationRequest,
    BerthAllocationResult,
    BerthComparisonResult,
    CraneScheduleRequest,
    CraneScheduleResult,
)

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.post("/berth-allocation/baseline", response_model=BerthAllocationResult)
def baseline(req: BerthAllocationRequest, current_user: User = Depends(get_current_user)):
    return berth_allocation.solve_baseline(req)


@router.post("/berth-allocation/optimized", response_model=BerthAllocationResult)
def optimized(req: BerthAllocationRequest, current_user: User = Depends(get_current_user)):
    return berth_allocation.solve_optimized(req)


@router.post("/berth-allocation/compare", response_model=BerthComparisonResult)
def compare(req: BerthAllocationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.compare_and_persist(db, req, org_id=current_user.org_id)


@router.post("/berth-allocation/compare/{simulation_run_id}", response_model=BerthComparisonResult)
def compare_from_run(
    simulation_run_id: str, horizon_hours: float = 96.0,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Builds a berth-allocation scenario from a completed simulation run's
    ships/berths and compares baseline vs. optimized assignment."""
    try:
        scenario = service.build_scenario_from_run(db, simulation_run_id, org_id=current_user.org_id, horizon_hours=horizon_hours)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return service.compare_and_persist(db, scenario, org_id=current_user.org_id)


@router.post("/crane-schedule", response_model=CraneScheduleResult)
def crane_schedule(req: CraneScheduleRequest, current_user: User = Depends(get_current_user)):
    return solve_crane_schedule(req)
