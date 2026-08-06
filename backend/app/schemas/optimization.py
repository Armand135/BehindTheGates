from pydantic import BaseModel, Field


class ShipRequest(BaseModel):
    id: str
    name: str
    size_teu: int
    eta_hours: float
    service_hours: float = Field(..., description="Estimated hours of berth occupancy needed")


class BerthSpec(BaseModel):
    code: str
    length_m: float
    max_draft_m: float = 16.0
    crane_slots: int = 2


class CraneSpec(BaseModel):
    code: str
    moves_per_hour: float = 25.0


class BerthAllocationRequest(BaseModel):
    ships: list[ShipRequest]
    berths: list[BerthSpec]
    horizon_hours: float = 96.0
    simulation_run_id: str | None = None


class BerthAssignment(BaseModel):
    ship_id: str
    ship_name: str
    berth_code: str
    start_hours: float
    end_hours: float
    waiting_hours: float


class BerthAllocationResult(BaseModel):
    strategy: str
    solver_status: str
    solve_time_seconds: float
    total_waiting_hours: float
    makespan_hours: float
    assignments: list[BerthAssignment]


class BerthComparisonResult(BaseModel):
    baseline: BerthAllocationResult
    optimized: BerthAllocationResult
    waiting_hours_reduction_pct: float
    makespan_reduction_pct: float


class CraneScheduleRequest(BaseModel):
    berth_code: str
    cranes: list[CraneSpec]
    containers_to_move: int
    available_from_hours: float = 0.0


class CraneTask(BaseModel):
    crane_code: str
    start_hours: float
    end_hours: float
    moves: int


class CraneScheduleResult(BaseModel):
    solver_status: str
    solve_time_seconds: float
    makespan_hours: float
    tasks: list[CraneTask]
