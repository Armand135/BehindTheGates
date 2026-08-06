"""Inference layer for the prediction API. Lazily loads XGBoost model
artifacts produced by `train.py`; if a model hasn't been trained yet
(fresh checkout, artifacts wiped), falls back to the same closed-form
formulas used to synthesize training data, so the API never hard-fails.
"""
from functools import lru_cache
from pathlib import Path

import numpy as np
import xgboost as xgb

from app.prediction.train import ARTIFACTS_DIR, MODEL_VERSION
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


@lru_cache(maxsize=None)
def _load_model(model_name: str) -> xgb.XGBRegressor | None:
    path = ARTIFACTS_DIR / f"{model_name}.json"
    if not path.exists():
        return None
    model = xgb.XGBRegressor()
    model.load_model(str(path))
    return model


def _predict(model_name: str, features: list[float], fallback: float) -> tuple[float, str]:
    model = _load_model(model_name)
    if model is None:
        return fallback, "formula-fallback"
    value = float(model.predict(np.array([features]))[0])
    return value, MODEL_VERSION


def predict_eta(req: EtaPredictionRequest) -> EtaPredictionResponse:
    fallback = (req.distance_nm / max(req.reported_speed_knots, 1)) * req.weather_delay_factor \
        * (1 + 0.15 * req.port_congestion_index)
    value, version = _predict(
        "eta", [req.distance_nm, req.reported_speed_knots, req.weather_delay_factor, req.port_congestion_index],
        fallback,
    )
    return EtaPredictionResponse(predicted_eta_hours=round(max(value, 0), 2), model_version=version)


def predict_berth_congestion(req: BerthCongestionRequest) -> BerthCongestionResponse:
    pressure = (req.ships_in_queue * req.avg_service_hours) / (req.berths_available * 24)
    fallback_index = 1 - np.exp(-pressure)
    fallback_wait = fallback_index * req.avg_service_hours * max(req.ships_in_queue / req.berths_available, 0.1)

    features = [req.ships_in_queue, req.avg_service_hours, req.berths_available, req.hour_of_day]
    index_value, version = _predict("congestion_index", features, float(fallback_index))
    wait_value, _ = _predict("congestion_wait", features, float(fallback_wait))
    return BerthCongestionResponse(
        congestion_index=round(min(max(index_value, 0), 1), 3),
        expected_wait_hours=round(max(wait_value, 0), 2),
        model_version=version,
    )


def predict_truck_queue(req: TruckQueueRequest) -> TruckQueueResponse:
    service_rate = req.gate_lanes * (60 / max(req.avg_processing_minutes, 0.1))
    rho = min(max(req.trucks_per_hour / max(service_rate, 0.01), 0.01), 0.98)
    fallback_queue = rho ** 2 / (1 - rho) * req.gate_lanes
    fallback_wait = (fallback_queue / max(req.trucks_per_hour, 0.1)) * 60

    features = [req.trucks_per_hour, req.gate_lanes, req.avg_processing_minutes, req.hour_of_day]
    queue_value, version = _predict("truck_queue_length", features, float(fallback_queue))
    wait_value, _ = _predict("truck_wait_minutes", features, float(fallback_wait))
    return TruckQueueResponse(
        expected_queue_length=round(max(queue_value, 0), 2),
        expected_wait_minutes=round(max(wait_value, 0), 2),
        model_version=version,
    )


def predict_crane_utilization(req: CraneUtilizationRequest) -> CraneUtilizationResponse:
    fallback_util = min(max(60 + (req.containers_to_move / (req.ship_size_teu + 1)) * 100, 10), 100)
    fallback_completion = req.containers_to_move / max(req.cranes_assigned * 26, 1)

    features = [req.containers_to_move, req.cranes_assigned, req.ship_size_teu]
    util_value, version = _predict("crane_utilization", features, float(fallback_util))
    completion_value, _ = _predict("crane_completion", features, float(fallback_completion))
    return CraneUtilizationResponse(
        predicted_utilization_pct=round(min(max(util_value, 0), 100), 1),
        predicted_completion_hours=round(max(completion_value, 0), 2),
        model_version=version,
    )
