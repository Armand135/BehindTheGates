from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SimulationRunCreate(BaseModel):
    name: str = "Untitled run"
    layout_name: str = "default_port"
    acceleration: float = Field(default=60.0, gt=0, description="1 sim-hour per (3600/acceleration) real seconds")
    seed: int = 42
    sim_duration_hours: float = Field(default=24.0, gt=0, le=24 * 30)
    ship_arrival_rate_per_day: float = Field(default=4.0, gt=0)
    truck_arrival_rate_per_hour: float = Field(default=15.0, gt=0)


class SimulationRunOut(BaseModel):
    id: str
    name: str
    layout_name: str
    acceleration: float
    seed: int
    status: str
    sim_duration_hours: float
    sim_clock_seconds: float
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None

    class Config:
        from_attributes = True


class EventOut(BaseModel):
    id: str
    run_id: str
    sim_time_hours: float
    recorded_at: datetime
    event_type: str
    entity_type: str
    entity_id: str
    payload: dict[str, Any]

    class Config:
        from_attributes = True


class TerminalStateOut(BaseModel):
    """Full point-in-time snapshot used by the digital twin map."""

    run_id: str
    sim_time_hours: float
    ships: list[dict[str, Any]]
    berths: list[dict[str, Any]]
    cranes: list[dict[str, Any]]
    yard_blocks: list[dict[str, Any]]
    trucks: list[dict[str, Any]]
    gates: list[dict[str, Any]]
    kpis: dict[str, Any]
