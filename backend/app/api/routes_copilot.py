from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.copilot.chat import handle_chat
from app.database import get_db
from app.models.auth import User
from app.schemas.copilot import ChatRequest, ChatResponse

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return handle_chat(db, req.messages, req.simulation_run_id, org_id=current_user.org_id)
