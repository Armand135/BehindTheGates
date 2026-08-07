"""WebSocket endpoint for the digital twin: subscribes to the Redis channel
a live simulation run publishes state snapshots to (see
`app.simulation.service.run_live`) and forwards each snapshot to the
connected client verbatim.

Browsers can't set an `Authorization` header on a WebSocket handshake, so
auth here comes from a `?token=` query param instead -- verified the same
way as the `Authorization: Bearer` header everywhere else, then checked
against the target run's `org_id` so one tenant can't stream another
tenant's live simulation just by guessing/enumerating run IDs.
"""
import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from redis import asyncio as aioredis

from app.auth.deps import get_user_from_token
from app.config import get_settings
from app.database import SessionLocal
from app.models.entities import SimulationRun

router = APIRouter()


@router.websocket("/ws/simulation/{run_id}")
async def simulation_state_ws(websocket: WebSocket, run_id: str, token: str | None = None) -> None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    db = SessionLocal()
    try:
        try:
            user = get_user_from_token(token, db)
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return

        run = db.get(SimulationRun, run_id)
        if run is None or run.org_id != user.org_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Not found")
            return
    finally:
        db.close()

    await websocket.accept()
    settings = get_settings()
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = f"sim:{run_id}:state"
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await redis_client.close()
