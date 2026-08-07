from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.auth import User
from app.simulation import service

router = APIRouter(prefix="/kpi", tags=["kpi"])


@router.get("/runs/{run_id}")
def get_run_kpis(run_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        snapshot = service.get_state_at(db, run_id, at_hours=None, org_id=current_user.org_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"run_id": run_id, "sim_time_hours": snapshot["sim_time_hours"], "kpis": snapshot["kpis"]}
