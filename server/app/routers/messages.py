from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..models.room import ChatMessage
from ..schemas.room_schemas import ChatMessageResponse, ChatMessageCreate

router = APIRouter(prefix="/rooms/{room_id}/messages", tags=["messages"])

@router.get("", response_model=List[ChatMessageResponse])
def get_messages(room_id: str, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.room_id == room_id).order_by(ChatMessage.created_at.asc()).all()
    return messages

@router.post("", response_model=ChatMessageResponse)
def send_message(room_id: str, message: ChatMessageCreate, db: Session = Depends(get_db)):
    db_message = ChatMessage(
        room_id=room_id,
        user_name=message.user_name,
        text=message.text,
        color=message.color
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message
