from typing import Any

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    simulation_run_id: str | None = None


class ChatToolCall(BaseModel):
    tool: str
    input: dict[str, Any]
    output: Any


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[ChatToolCall] = []
    mode: str  # "llm" | "retrieval_only"
