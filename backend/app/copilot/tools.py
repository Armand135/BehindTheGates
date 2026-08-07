"""Anthropic tool-use definitions wrapping `retrieval.py`, plus a dispatcher
used both by the LLM tool-use loop and (indirectly) by the retrieval-only
fallback mode.
"""
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.copilot import retrieval

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": "get_kpis",
        "description": "Get the current/latest KPIs for a simulation run: berth occupancy, "
                        "crane utilization, yard utilization, gate queue length, ships waiting.",
        "input_schema": {
            "type": "object",
            "properties": {"run_id": {"type": "string", "description": "Simulation run ID"}},
            "required": ["run_id"],
        },
    },
    {
        "name": "get_recent_events",
        "description": "Get the most recent events (ship arrivals/departures, berth assignments, "
                        "crane starts/completions, truck arrivals/departures) for a simulation run.",
        "input_schema": {
            "type": "object",
            "properties": {
                "run_id": {"type": "string"},
                "limit": {"type": "integer", "default": 15},
                "event_type": {"type": "string", "description": "Optional filter, e.g. 'ship_arrival'"},
            },
            "required": ["run_id"],
        },
    },
    {
        "name": "get_optimization_comparison",
        "description": "Get the latest baseline-vs-optimized berth allocation comparison "
                        "(waiting hours, makespan) computed for a simulation run.",
        "input_schema": {
            "type": "object",
            "properties": {"run_id": {"type": "string"}},
            "required": ["run_id"],
        },
    },
    {
        "name": "list_simulation_runs",
        "description": "List recent simulation runs with their status and configuration.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "default": 10}},
        },
    },
]

# org_id is deliberately not part of any tool's input_schema -- it must come
# from the authenticated session (passed explicitly to call_tool), never
# from the LLM's tool-call arguments, or a compromised/confused model could
# ask for another tenant's data by supplying a different org_id.
_DISPATCH: dict[str, Callable[..., dict]] = {
    "get_kpis": lambda db, org_id, **kw: retrieval.get_kpis(db, kw["run_id"], org_id),
    "get_recent_events": lambda db, org_id, **kw: retrieval.get_recent_events(
        db, kw["run_id"], org_id, kw.get("limit", 15), kw.get("event_type")
    ),
    "get_optimization_comparison": lambda db, org_id, **kw: retrieval.get_optimization_comparison(db, kw["run_id"], org_id),
    "list_simulation_runs": lambda db, org_id, **kw: retrieval.list_simulation_runs(db, org_id, kw.get("limit", 10)),
}


def call_tool(db: Session, name: str, tool_input: dict, org_id: str) -> dict:
    handler = _DISPATCH.get(name)
    if handler is None:
        return {"error": f"Unknown tool '{name}'"}
    return handler(db, org_id, **tool_input)
