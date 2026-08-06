"""WebSocket endpoint for the digital twin: subscribes to the Redis channel
a live simulation run publishes state snapshots to (see
`app.simulation.service.run_live`) and forwards each snapshot to the
connected client verbatim.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis import asyncio as aioredis

from app.config import get_settings

router = APIRouter()


@router.websocket("/ws/simulation/{run_id}")
async def simulation_state_ws(websocket: WebSocket, run_id: str) -> None:
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
