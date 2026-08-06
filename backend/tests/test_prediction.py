from app.prediction import service
from app.schemas.prediction import (
    BerthCongestionRequest,
    CraneUtilizationRequest,
    EtaPredictionRequest,
    TruckQueueRequest,
)


def test_eta_prediction_uses_formula_fallback_without_trained_model():
    resp = service.predict_eta(EtaPredictionRequest(distance_nm=1000, reported_speed_knots=20))
    assert resp.predicted_eta_hours > 0
    assert resp.model_version in ("formula-fallback", "xgb-v1")


def test_berth_congestion_bounds():
    resp = service.predict_berth_congestion(
        BerthCongestionRequest(ships_in_queue=5, avg_service_hours=20, berths_available=3)
    )
    assert 0 <= resp.congestion_index <= 1
    assert resp.expected_wait_hours >= 0


def test_truck_queue_non_negative():
    resp = service.predict_truck_queue(
        TruckQueueRequest(trucks_per_hour=20, gate_lanes=3, avg_processing_minutes=10)
    )
    assert resp.expected_queue_length >= 0
    assert resp.expected_wait_minutes >= 0


def test_crane_utilization_bounds():
    resp = service.predict_crane_utilization(
        CraneUtilizationRequest(containers_to_move=1000, cranes_assigned=2, ship_size_teu=6000)
    )
    assert 0 <= resp.predicted_utilization_pct <= 100
    assert resp.predicted_completion_hours > 0
