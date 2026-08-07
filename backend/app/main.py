from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_copilot, routes_kpi, routes_optimization, routes_prediction, routes_simulation, ws
from app.auth import routes as routes_auth
from app.config import get_settings
from app.database import Base, engine
from app.models import auth, entities  # noqa: F401  (ensures models are registered before create_all)

settings = get_settings()

app = FastAPI(
    title="AI Port Operations Copilot",
    description="Simulation, optimization, prediction, and AI copilot services for a container terminal digital twin.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_auth.router)
app.include_router(routes_simulation.router)
app.include_router(routes_optimization.router)
app.include_router(routes_prediction.router)
app.include_router(routes_copilot.router)
app.include_router(routes_kpi.router)
app.include_router(ws.router)


@app.on_event("startup")
def on_startup() -> None:
    # MVP convenience: create tables directly instead of requiring an
    # Alembic migration run before first boot. `alembic upgrade head` (see
    # backend/alembic/) is still the source of truth for schema changes.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
