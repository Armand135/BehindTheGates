from fastapi import APIRouter, Depends

from app.auth.deps import get_current_user
from app.models.auth import User
from app.prediction import service
from app.prediction.train import train_all
from app.schemas.prediction import (
    BerthCongestionRequest,
    BerthCongestionResponse,
    CraneUtilizationRequest,
    CraneUtilizationResponse,
    EtaPredictionRequest,
    EtaPredictionResponse,
    TruckQueueRequest,
    TruckQueueResponse,
)

router = APIRouter(prefix="/prediction", tags=["prediction"])


@router.post("/eta", response_model=EtaPredictionResponse)
def predict_eta(req: EtaPredictionRequest, current_user: User = Depends(get_current_user)):
    return service.predict_eta(req)


@router.post("/berth-congestion", response_model=BerthCongestionResponse)
def predict_berth_congestion(req: BerthCongestionRequest, current_user: User = Depends(get_current_user)):
    return service.predict_berth_congestion(req)


@router.post("/truck-queue", response_model=TruckQueueResponse)
def predict_truck_queue(req: TruckQueueRequest, current_user: User = Depends(get_current_user)):
    return service.predict_truck_queue(req)


@router.post("/crane-utilization", response_model=CraneUtilizationResponse)
def predict_crane_utilization(req: CraneUtilizationRequest, current_user: User = Depends(get_current_user)):
    return service.predict_crane_utilization(req)


@router.post("/train")
def train(current_user: User = Depends(get_current_user)):
    """(Re)trains all prediction models from synthetic data and saves
    artifacts. Models are shared across every tenant (not org-scoped), so
    this is a global, relatively expensive operation -- any authenticated
    user can trigger it for the MVP, but a real deployment should restrict
    this to an admin role."""
    metadata = train_all()
    return {"trained": [m["model_name"] for m in metadata["models"]], "version": metadata["version"]}
