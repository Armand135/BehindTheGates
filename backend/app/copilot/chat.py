"""Chat orchestration for the AI Copilot.

When `ANTHROPIC_API_KEY` is configured, runs a standard tool-use loop:
the model can call the retrieval tools in `tools.py` to ground its answer
in live KPIs, event history, and optimization results before replying.
Without a key (e.g. a fresh local checkout with no secrets configured),
falls back to a deterministic retrieval-only mode so the endpoint still
returns a useful, data-backed answer instead of failing.
"""
import re

from sqlalchemy.orm import Session

from app.config import get_settings
from app.copilot import retrieval, tools
from app.schemas.copilot import ChatMessage, ChatResponse, ChatToolCall

SYSTEM_PROMPT = """You are the AI Port Operations Copilot, embedded in a container \
terminal digital twin platform. You have tools to fetch live KPIs, recent \
event history, and berth-allocation optimization comparisons for a given \
simulation run.

When asked about port status, congestion, or performance, use the tools to \
fetch current data before answering. Don't just restate numbers -- explain \
what they mean operationally and recommend a concrete next action (e.g. \
"berth occupancy is at 100% with 3 ships waiting; run the optimization \
comparison to see if reallocating berths would reduce waiting time"). Keep \
answers concise and operational, suitable for a terminal operations manager."""


def _get_client():
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None, settings
    import anthropic
    return anthropic.Anthropic(api_key=settings.anthropic_api_key), settings


def handle_chat(db: Session, messages: list[ChatMessage], simulation_run_id: str | None, org_id: str) -> ChatResponse:
    run_id = retrieval.resolve_run_id(db, simulation_run_id, org_id)
    client, settings = _get_client()

    if client is None:
        return _retrieval_only_reply(db, messages, run_id, org_id)

    anthropic_messages = [{"role": m.role, "content": m.content} for m in messages]
    tool_calls: list[ChatToolCall] = []

    for _ in range(5):
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=tools.TOOL_SPECS,
            messages=anthropic_messages,
        )

        if response.stop_reason != "tool_use":
            reply_text = "".join(b.text for b in response.content if b.type == "text")
            return ChatResponse(reply=reply_text, tool_calls=tool_calls, mode="llm")

        anthropic_messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            output = tools.call_tool(db, block.name, block.input, org_id)
            tool_calls.append(ChatToolCall(tool=block.name, input=block.input, output=output))
            tool_results.append({
                "type": "tool_result", "tool_use_id": block.id, "content": str(output),
            })
        anthropic_messages.append({"role": "user", "content": tool_results})

    return ChatResponse(
        reply="I gathered data but couldn't finish reasoning in time -- please rephrase or narrow the question.",
        tool_calls=tool_calls, mode="llm",
    )


def _retrieval_only_reply(db: Session, messages: list[ChatMessage], run_id: str | None, org_id: str) -> ChatResponse:
    question = messages[-1].content.lower() if messages else ""
    tool_calls: list[ChatToolCall] = []

    if run_id is None:
        return ChatResponse(
            reply="No simulation runs found yet. Start one via POST /simulation/runs, then ask me about "
                  "its KPIs, events, or optimization opportunities.",
            tool_calls=[], mode="retrieval_only",
        )

    kpis = retrieval.get_kpis(db, run_id, org_id)
    tool_calls.append(ChatToolCall(tool="get_kpis", input={"run_id": run_id}, output=kpis))
    lines = [f"Status for simulation run {run_id} (sim time {kpis.get('sim_time_hours', '?')}h):"]
    for k, v in kpis.get("kpis", {}).items():
        lines.append(f"  - {k.replace('_', ' ')}: {v}")

    if re.search(r"\b(optimiz|compar|berth alloc)", question) or not question:
        opt = retrieval.get_optimization_comparison(db, run_id, org_id)
        tool_calls.append(ChatToolCall(tool="get_optimization_comparison", input={"run_id": run_id}, output=opt))
        if "results" in opt:
            lines.append("\nLatest berth allocation comparison:")
            for r in opt["results"]:
                lines.append(
                    f"  - {r['strategy']}: {r['total_waiting_hours']}h total waiting, "
                    f"{r['makespan_hours']}h makespan ({r['solver_status']})"
                )
        else:
            lines.append(f"\n{opt.get('message', '')} Try POST /optimization/compare/{run_id}.")

    if re.search(r"\b(event|recent|history|happen)", question):
        events = retrieval.get_recent_events(db, run_id, org_id, limit=8)
        tool_calls.append(ChatToolCall(tool="get_recent_events", input={"run_id": run_id, "limit": 8}, output=events))
        lines.append("\nMost recent events:")
        for e in events["events"]:
            lines.append(f"  - t={e['sim_time_hours']}h {e['event_type']} ({e['entity_id']})")

    kpi_values = kpis.get("kpis", {})
    if kpi_values.get("berth_occupancy_pct", 0) >= 90 and kpi_values.get("ships_waiting_at_anchorage", 0) > 0:
        lines.append(
            "\nRecommendation: berths are near saturation with ships waiting at anchorage. "
            f"Run POST /optimization/compare/{run_id} to check whether reallocating berths "
            "would reduce total waiting time."
        )

    lines.append(
        "\n(Running in retrieval-only mode -- set ANTHROPIC_API_KEY to enable free-form "
        "reasoning over this data.)"
    )
    return ChatResponse(reply="\n".join(lines), tool_calls=tool_calls, mode="retrieval_only")
