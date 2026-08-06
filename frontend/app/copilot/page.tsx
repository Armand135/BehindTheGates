"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { ChatMessage, SimulationRun } from "@/lib/types";

export default function CopilotPage() {
  return (
    <Suspense fallback={<div className="page">Loading...</div>}>
      <CopilotChat />
    </Suspense>
  );
}

function CopilotChat() {
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [runId, setRunId] = useState(searchParams.get("run") || "");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me about berth occupancy, congestion, recent events, or whether it's worth re-optimizing berth allocation for a given run." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listRuns().then((rs) => {
      setRuns(rs);
      if (!runId && rs.length) setRunId(rs[0].id);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const next = [...messages, { role: "user" as const, content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await api.chat(next, runId || undefined);
      setMode(res.mode);
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Error: ${e}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>AI Copilot</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label className="muted">
          Context run:{" "}
          <select value={runId} onChange={(e) => setRunId(e.target.value)}>
            <option value="">(most recent)</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {mode && <span className="badge pending">{mode === "llm" ? "LLM + tools" : "retrieval-only"}</span>}
      </div>

      <div className="card" style={{ height: 480, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "#1a2740" : "#16223a",
                border: "1px solid var(--panel-border)",
                borderRadius: 10,
                padding: "8px 12px",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            style={{ flex: 1 }}
            value={input}
            placeholder="e.g. What's the current berth occupancy and should we re-optimize?"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button onClick={send} disabled={loading}>
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
