"""ORM models for the terminal domain entities and the event log.

Every runtime entity (Ship, Berth, Crane, YardBlock, Container, Truck, Gate)
belongs to a `SimulationRun`. Static layout definitions (how many berths,
their length, how many cranes, etc.) live in YAML under
`app/core/layouts/` and are materialized into rows here when a run starts.
This keeps "what a port looks like" (layout) separate from "what happened
during a run" (state + events) -- the same split a real deployment would
need once a layout comes from a TOS integration instead of a YAML file.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class RunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    layout_name: Mapped[str] = mapped_column(String(80), default="default_port")
    acceleration: Mapped[float] = mapped_column(Float, default=60.0)
    seed: Mapped[int] = mapped_column(Integer, default=42)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.pending)
    sim_duration_hours: Mapped[float] = mapped_column(Float, default=24.0)
    sim_clock_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    ships: Mapped[list["Ship"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    berths: Mapped[list["Berth"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    cranes: Mapped[list["Crane"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    yard_blocks: Mapped[list["YardBlock"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    trucks: Mapped[list["Truck"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    gates: Mapped[list["Gate"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class ShipStatus(str, enum.Enum):
    inbound = "inbound"
    anchored = "anchored"
    berthed = "berthed"
    working = "working"
    departed = "departed"


class Ship(Base):
    __tablename__ = "ships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    # The simulation's own short-lived identifier (e.g. "ship-1"), unique only
    # within a run -- used to cross-reference this row against Event rows and
    # Berth.current_ship_id, which are keyed by this value rather than `id`.
    sim_ref: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(80))
    imo: Mapped[str] = mapped_column(String(20))
    size_teu: Mapped[int] = mapped_column(Integer)
    containers_to_discharge: Mapped[int] = mapped_column(Integer, default=0)
    containers_to_load: Mapped[int] = mapped_column(Integer, default=0)
    eta_hours: Mapped[float] = mapped_column(Float)
    ata_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    berthed_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    etd_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    atd_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    assigned_berth_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[ShipStatus] = mapped_column(Enum(ShipStatus), default=ShipStatus.inbound)

    run: Mapped[SimulationRun] = relationship(back_populates="ships")


class BerthStatus(str, enum.Enum):
    empty = "empty"
    occupied = "occupied"
    maintenance = "maintenance"


class Berth(Base):
    __tablename__ = "berths"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    code: Mapped[str] = mapped_column(String(20))
    length_m: Mapped[float] = mapped_column(Float)
    max_draft_m: Mapped[float] = mapped_column(Float)
    crane_slots: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[BerthStatus] = mapped_column(Enum(BerthStatus), default=BerthStatus.empty)
    current_ship_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    run: Mapped[SimulationRun] = relationship(back_populates="berths")


class CraneStatus(str, enum.Enum):
    idle = "idle"
    active = "active"
    maintenance = "maintenance"


class Crane(Base):
    __tablename__ = "cranes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    code: Mapped[str] = mapped_column(String(20))
    berth_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    moves_per_hour: Mapped[float] = mapped_column(Float, default=25.0)
    status: Mapped[CraneStatus] = mapped_column(Enum(CraneStatus), default=CraneStatus.idle)
    utilization_pct: Mapped[float] = mapped_column(Float, default=0.0)

    run: Mapped[SimulationRun] = relationship(back_populates="cranes")


class YardBlock(Base):
    __tablename__ = "yard_blocks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    code: Mapped[str] = mapped_column(String(20))
    capacity_teu: Mapped[int] = mapped_column(Integer)
    occupied_teu: Mapped[int] = mapped_column(Integer, default=0)

    run: Mapped[SimulationRun] = relationship(back_populates="yard_blocks")


class ContainerStatus(str, enum.Enum):
    on_vessel = "on_vessel"
    in_yard = "in_yard"
    on_truck = "on_truck"
    gate_out = "gate_out"


class Container(Base):
    __tablename__ = "containers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    container_no: Mapped[str] = mapped_column(String(20))
    ship_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    yard_block_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[ContainerStatus] = mapped_column(Enum(ContainerStatus), default=ContainerStatus.on_vessel)


class TruckStatus(str, enum.Enum):
    en_route = "en_route"
    queued = "queued"
    at_gate = "at_gate"
    in_yard = "in_yard"
    departed = "departed"


class Truck(Base):
    __tablename__ = "trucks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    plate: Mapped[str] = mapped_column(String(20))
    gate_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[TruckStatus] = mapped_column(Enum(TruckStatus), default=TruckStatus.en_route)
    arrival_hours: Mapped[float] = mapped_column(Float)
    queue_wait_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    run: Mapped[SimulationRun] = relationship(back_populates="trucks")


class GateStatus(str, enum.Enum):
    open = "open"
    closed = "closed"
    congested = "congested"


class Gate(Base):
    __tablename__ = "gates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    code: Mapped[str] = mapped_column(String(20))
    lanes: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[GateStatus] = mapped_column(Enum(GateStatus), default=GateStatus.open)
    queue_length: Mapped[int] = mapped_column(Integer, default=0)

    run: Mapped[SimulationRun] = relationship(back_populates="gates")


class Event(Base):
    """Append-only log of every simulation event, used for replay and analytics."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("simulation_runs.id"))
    sim_time_hours: Mapped[float] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    event_type: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

    run: Mapped[SimulationRun] = relationship(back_populates="events")


class OptimizationRun(Base):
    """Stores a berth/crane optimization result so the copilot and UI can
    compare baseline vs. optimized scenarios without recomputing them."""

    __tablename__ = "optimization_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    simulation_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    strategy: Mapped[str] = mapped_column(String(20))  # "baseline" | "optimized"
    objective: Mapped[str] = mapped_column(String(40), default="berth_allocation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    total_waiting_hours: Mapped[float] = mapped_column(Float, default=0.0)
    makespan_hours: Mapped[float] = mapped_column(Float, default=0.0)
    solver_status: Mapped[str] = mapped_column(String(20), default="")
    solve_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    assignments: Mapped[dict] = mapped_column(JSON, default=dict)
