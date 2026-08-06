# AI Port Operations Copilot -- Technical Documentation (MVP)

A cloud-native platform that simulates a container terminal and uses
optimization plus machine learning to recommend operational decisions. It
runs entirely on simulated data today, but is architected so that real
integrations (AIS feeds, Terminal Operating Systems, ERP, IoT sensors) can
be added later without a redesign -- see [Extending to real data](#extending-to-real-data-sources).

## Architecture

```
backend/app/
  simulation/     event-driven port simulation engine
  optimization/   OR-Tools berth allocation + crane scheduling
  prediction/     XGBoost ETA / congestion / queue / utilization models
  copilot/        LLM chat with tool-use retrieval over live data
  api/            FastAPI routers + WebSocket wiring everything together
  models/         SQLAlchemy ORM (Postgres)
  core/layouts/   YAML port layout definitions

frontend/app/     Next.js (App Router) UI: dashboard, digital twin,
                  optimization comparison, copilot chat
```

Each backend module (`simulation`, `optimization`, `prediction`, `copilot`)
is self-contained with its own service layer and could be split into a
separate deployable service later; for the MVP they run in-process inside
one FastAPI app (`backend/app/main.py`) behind Docker Compose, fronted by
Postgres (persistent state) and Redis (pub/sub for live digital-twin
updates).

## 1. Simulation engine (`app/simulation/`)

- `engine.py` -- a minimal discrete-event core: a binary heap of
  `(time, callback)` pairs. Time is simulated hours, independent of
  wall-clock time.
- `layout.py` -- loads a port layout (berths, cranes, yard blocks, gates,
  arrival-rate distributions) from YAML (`app/core/layouts/*.yaml`). New
  layouts are just new YAML files -- no code changes.
- `runner.py` (`PortSimulation`) -- seeds Poisson ship/truck arrival
  processes from the layout's `arrival_model`, and drives berth assignment
  (FCFS baseline), crane work, yard placement, and gate/truck processing.
  Every state change is appended to `event_log` as a structured
  `LoggedEvent(sim_time_hours, event_type, entity_type, entity_id, payload)`.
- `run_batch(duration_hours)` drains the event queue as fast as possible
  (used to generate history for training/analytics). `iter_live(...)`
  yields after each event so a caller can pace playback in real time.
- `replay.py` -- reconstructs `TerminalState` at any point in time by
  re-applying persisted events against a fresh layout-derived state. This
  is what powers digital-twin playback/scrubbing without storing a full
  snapshot per event.
- `service.py` -- API-facing entry points: `create_and_run` (batch, used by
  `POST /simulation/runs`), `run_live` (paced by `acceleration`, publishes
  snapshots to Redis channel `sim:{run_id}:state`, used by
  `POST /simulation/runs/live`), and `get_state_at` (replay-based).

Every event is persisted to the `events` table (Postgres) for replay and
analytics, alongside the final state of every entity table (`ships`,
`berths`, `cranes`, `yard_blocks`, `trucks`, `gates`).

## 2. Optimization engine (`app/optimization/`)

Google OR-Tools CP-SAT models:

- `berth_allocation.py` -- `solve_baseline` (greedy FCFS, mirrors the
  simulation's default policy) vs. `solve_optimized` (CP-SAT minimizing
  total waiting time, using optional intervals + `AddNoOverlap` per berth).
  `compare(...)` runs both and returns the delta.
- `crane_scheduling.py` -- splits a berth's container moves across its
  assigned cranes to minimize completion time (makespan).

Both are exposed as REST endpoints and can run over an arbitrary
ships/berths payload, or be built directly from a completed simulation run
via `POST /optimization/berth-allocation/compare/{simulation_run_id}`
(`optimization/service.py::build_scenario_from_run`), which reads that
run's actual ships and berths back out of Postgres.

Time is modeled in whole seconds internally (not the raw floats) so the
integer CP-SAT solver's results don't drift from the continuous baseline
by more than sub-minute rounding noise.

## 3. Prediction service (`app/prediction/`)

XGBoost regressors for four tasks: ETA prediction, berth congestion
(index + expected wait), truck queue length/wait, and crane utilization
(+ completion time). Since there's no historical data yet, `data_generation.py`
synthesizes labeled training sets from closed-form domain formulas (travel
time, M/M/c-style queueing approximations) plus noise -- swap those
functions for real historical loaders once AIS/TOS/gate data is available,
and everything downstream (training, inference, API) keeps working as-is.

- `train.py` -- trains and saves one model per target under
  `app/prediction/artifacts/*.json` (+ `metadata.json` with MAE per model).
  Run via `python -m app.prediction.train` or `POST /prediction/train`.
- `service.py` -- inference layer. If a model artifact hasn't been trained
  yet, each endpoint falls back to the same closed-form formula used to
  generate that model's training data, so the API never hard-fails on a
  fresh checkout.

## 4. Digital twin

- `GET /simulation/runs/{id}/state?at_hours=X` replays events up to `X` and
  returns a full terminal snapshot (ships, berths, cranes, yard blocks,
  gates, trucks, KPIs) -- powers playback scrubbing in the frontend
  (`frontend/app/twin/[runId]/page.tsx`).
- `POST /simulation/runs/live` starts a simulation paced in real time by
  `acceleration` (e.g. `60` = 1 simulated hour per real minute), publishing
  a snapshot to Redis after every event.
- `WS /ws/simulation/{run_id}` subscribes to that Redis channel and streams
  snapshots straight to the browser -- see `app/api/ws.py`.
- `frontend/components/TerminalMap.tsx` renders an SVG terminal map (berths,
  cranes with live utilization, yard block fill %, gate queue lengths) from
  whichever snapshot (replayed or live) the page currently holds.

## 5. AI Copilot (`app/copilot/`)

- `retrieval.py` / `tools.py` -- read-only functions (get_kpis,
  get_recent_events, get_optimization_comparison, list_simulation_runs)
  exposed both as Anthropic tool-use definitions and as the data source for
  the fallback mode below.
- `chat.py` -- if `ANTHROPIC_API_KEY` is set, runs a standard Claude
  tool-use loop: the model calls retrieval tools to ground its answer in
  live KPIs/events/optimization results, then explains what they mean and
  recommends a concrete next action (not just a KPI dump). Without a key,
  falls back to a deterministic retrieval-only mode that still returns a
  useful, data-backed answer (see `POST /copilot/chat`, `mode` field in the
  response: `"llm"` vs `"retrieval_only"`).

## 6. Platform

- **Backend**: FastAPI + SQLAlchemy 2.0 + Postgres + Redis. `backend/app/main.py`
  calls `Base.metadata.create_all` on startup for convenience; Alembic
  (`backend/alembic/`) is the source of truth for schema migrations --
  run `alembic upgrade head` in front of a real deployment.
- **Frontend**: Next.js (App Router) + React + TypeScript, no UI framework
  dependency -- plain CSS in `app/globals.css` for a small, auditable
  bundle.
- **Local dev**: `docker compose up --build` runs Postgres, Redis, backend
  (`:8000`, hot-reload), and frontend (`:3000`, hot-reload).

### Environment variables

See `.env.example` at the repo root. Notably:

- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` -- optional; copilot runs in
  retrieval-only mode without a key.
- `SIMULATION_DEFAULT_ACCELERATION` -- default pacing for live runs.
- `BACKEND_CORS_ORIGINS` -- must include whatever origin the frontend is
  served from (defaults to `http://localhost:3000`).

## API reference (selected)

| Method | Path | Purpose |
|---|---|---|
| GET | `/simulation/layouts` | List available port layouts |
| POST | `/simulation/runs` | Run a simulation synchronously (batch) |
| POST | `/simulation/runs/live` | Start a real-time-paced run, streamed over WebSocket |
| GET | `/simulation/runs/{id}/state?at_hours=` | Replay terminal state at a point in time |
| GET | `/simulation/runs/{id}/events` | Raw event log |
| WS | `/ws/simulation/{id}` | Live state snapshots for a live run |
| POST | `/optimization/berth-allocation/compare` | Baseline vs. optimized over an arbitrary scenario |
| POST | `/optimization/berth-allocation/compare/{run_id}` | Same, built from a completed simulation run |
| POST | `/optimization/crane-schedule` | Crane-to-berth work scheduling |
| POST | `/prediction/{eta,berth-congestion,truck-queue,crane-utilization}` | ML predictions |
| POST | `/prediction/train` | (Re)train all prediction models |
| POST | `/copilot/chat` | AI copilot chat |
| GET | `/kpi/runs/{id}` | Latest KPIs for a run |

Full interactive docs at `/docs` (Swagger UI) once the backend is running.

## Testing

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m pytest tests/ -v
```

Tests cover: simulation determinism (same seed -> same event stream), berth
no-double-booking invariants (both in the simulation and in both
optimization strategies), non-negative waiting times, replay/live KPI
parity, and prediction endpoint sanity bounds.

## Extending to real data sources

The MVP intentionally isolates "where does the data come from" behind a
few seams so real integrations slot in without touching the simulation,
optimization, prediction, or copilot logic itself:

- **AIS feeds** -> replace the synthetic Poisson ship-arrival process in
  `runner.py::seed_arrivals` with a feed listener that schedules
  `_on_ship_arrival` from real position/ETA reports.
- **Terminal Operating System (TOS)** -> replace `layout.py::load_layout`
  with a loader that pulls berth/crane/yard configuration from the TOS API
  instead of YAML; the rest of the simulation is layout-agnostic.
- **ERP** -> feed real vessel schedules / cargo manifests into the same
  `ShipRequest`/`BerthSpec` shapes the optimization endpoints already
  accept, no model changes required.
- **IoT sensors** (crane telemetry, gate cameras) -> publish directly to
  the same Redis channel convention (`sim:{run_id}:state`) the live
  simulation uses, so the existing WebSocket/digital-twin frontend keeps
  working unchanged.
- **Historical data for ML** -> swap the `generate_*` functions in
  `app/prediction/data_generation.py` for loaders reading real historical
  ETAs/congestion/queues/utilization; `train.py` and the inference API are
  unchanged.
