from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ParticipantBase(BaseModel):
    name: str
    role: str
    avatar: str
    is_muted: bool = False
    is_video_off: bool = False

class ParticipantUpdate(BaseModel):
    is_muted: Optional[bool] = None
    is_video_off: Optional[bool] = None

class RoomCreate(BaseModel):
    title: str
    host_name: str

class ChatMessageCreate(BaseModel):
    user_name: str
    text: str
    color: Optional[str] = "#ffffff"

class ChatMessageResponse(BaseModel):
    id: int
    user_name: str
    text: str
    color: str
    created_at: datetime

    class Config:
        from_attributes = True

class RoomResponse(BaseModel):
    id: int
    room_id: str
    title: str
    host_name: str
    host_avatar: str
    viewers: int
    thumbnail: str
    is_active: bool
    participants: List[ParticipantBase]

    class Config:
        from_attributes = True
