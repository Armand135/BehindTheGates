from fastapi import APIRouter

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
def predict_eta(req: EtaPredictionRequest):
    return service.predict_eta(req)


@router.post("/berth-congestion", response_model=BerthCongestionResponse)
def predict_berth_congestion(req: BerthCongestionRequest):
    return service.predict_berth_congestion(req)


@router.post("/truck-queue", response_model=TruckQueueResponse)
def predict_truck_queue(req: TruckQueueRequest):
    return service.predict_truck_queue(req)


@router.post("/crane-utilization", response_model=CraneUtilizationResponse)
def predict_crane_utilization(req: CraneUtilizationRequest):
    return service.predict_crane_utilization(req)


@router.post("/train")
def train():
    """(Re)trains all prediction models from synthetic data and saves
    artifacts. Call after replacing `data_generation.py` with real
    historical-data loaders."""
    metadata = train_all()
    return {"trained": [m["model_name"] for m in metadata["models"]], "version": metadata["version"]}
