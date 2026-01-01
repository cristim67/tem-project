from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, unique=True, index=True)
    title = Column(String)
    host_name = Column(String)
    host_avatar = Column(String)
    viewers = Column(Integer, default=0)
    thumbnail = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    participants = relationship("Participant", back_populates="room")

class Participant(Base):
    __tablename__ = "participants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    role = Column(String) # 'host' or 'guest'
    avatar = Column(String)
    is_muted = Column(Boolean, default=False)
    is_video_off = Column(Boolean, default=False)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    
    room = relationship("Room", back_populates="participants")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, index=True)
    user_name = Column(String)
    text = Column(String)
    color = Column(String, default="#ffffff")
    created_at = Column(DateTime, default=datetime.utcnow)
