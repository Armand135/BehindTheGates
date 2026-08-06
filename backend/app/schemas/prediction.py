from pydantic import BaseModel, ConfigDict


class PredictionResponseBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())


class EtaPredictionRequest(BaseModel):
    distance_nm: float
    reported_speed_knots: float
    weather_delay_factor: float = 1.0
    port_congestion_index: float = 0.5


class EtaPredictionResponse(PredictionResponseBase):
    predicted_eta_hours: float
    model_version: str


class BerthCongestionRequest(BaseModel):
    ships_in_queue: int
    avg_service_hours: float
    berths_available: int
    hour_of_day: int = 12


class BerthCongestionResponse(PredictionResponseBase):
    congestion_index: float
    expected_wait_hours: float
    model_version: str


class TruckQueueRequest(BaseModel):
    trucks_per_hour: float
    gate_lanes: int
    avg_processing_minutes: float
    hour_of_day: int = 12


class TruckQueueResponse(PredictionResponseBase):
    expected_queue_length: float
    expected_wait_minutes: float
    model_version: str


class CraneUtilizationRequest(BaseModel):
    containers_to_move: int
    cranes_assigned: int
    ship_size_teu: int


class CraneUtilizationResponse(PredictionResponseBase):
    predicted_utilization_pct: float
    predicted_completion_hours: float
    model_version: str
