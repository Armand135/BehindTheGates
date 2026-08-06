from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.simulation import service

router = APIRouter(prefix="/kpi", tags=["kpi"])


@router.get("/runs/{run_id}")
def get_run_kpis(run_id: str, db: Session = Depends(get_db)):
    try:
        snapshot = service.get_state_at(db, run_id, at_hours=None)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"run_id": run_id, "sim_time_hours": snapshot["sim_time_hours"], "kpis": snapshot["kpis"]}
