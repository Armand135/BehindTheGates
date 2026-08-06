"""Loads a port layout definition (berths, cranes, yard blocks, gates) from
YAML. Swapping in a real layout later (e.g. pulled from a TOS) just means
implementing another `load_layout`-shaped function -- nothing downstream
cares where the layout came from.
"""
from dataclasses import dataclass, field
from pathlib import Path

import yaml

LAYOUTS_DIR = Path(__file__).resolve().parent.parent / "core" / "layouts"


@dataclass
class BerthDef:
    code: str
    length_m: float
    max_draft_m: float
    crane_slots: int
    position: dict


@dataclass
class CraneDef:
    code: str
    berth_code: str
    moves_per_hour: float
    position: dict


@dataclass
class YardBlockDef:
    code: str
    capacity_teu: int
    position: dict


@dataclass
class GateDef:
    code: str
    lanes: int
    position: dict


@dataclass
class PortLayout:
    name: str
    description: str
    berths: list[BerthDef]
    cranes: list[CraneDef]
    yard_blocks: list[YardBlockDef]
    gates: list[GateDef]
    arrival_model: dict = field(default_factory=dict)


def list_layouts() -> list[str]:
    return sorted(p.stem for p in LAYOUTS_DIR.glob("*.yaml"))


def load_layout(name: str = "default_port") -> PortLayout:
    path = LAYOUTS_DIR / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Unknown port layout '{name}'. Available: {list_layouts()}")
    raw = yaml.safe_load(path.read_text())
    return PortLayout(
        name=raw["name"],
        description=raw.get("description", ""),
        berths=[BerthDef(**b) for b in raw.get("berths", [])],
        cranes=[CraneDef(**c) for c in raw.get("cranes", [])],
        yard_blocks=[YardBlockDef(**y) for y in raw.get("yard_blocks", [])],
        gates=[GateDef(**g) for g in raw.get("gates", [])],
        arrival_model=raw.get("arrival_model", {}),
    )
