import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..models.room import Room, Participant
from ..schemas.room_schemas import RoomResponse, RoomCreate
from ..ws.manager import manager
from ..utils.video import get_video_response

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.get("", response_model=List[RoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(Room).filter(Room.is_active == True).all()
    return rooms

@router.post("", response_model=RoomResponse)
def create_room(room_data: RoomCreate, db: Session = Depends(get_db)):
    new_room_id = str(uuid.uuid4())[:8]
    db_room = Room(
        room_id=new_room_id,
        title=room_data.title,
        host_name=room_data.host_name,
        host_avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={room_data.host_name}",
        thumbnail="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80",
        viewers=0
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    # Add host as first participant
    host = Participant(
        name=room_data.host_name,
        role='host',
        avatar=db_room.host_avatar,
        room_id=db_room.id
    )
    db.add(host)
    db.commit()
    db.refresh(db_room)
    return db_room

@router.get("/{room_id}", response_model=RoomResponse)
def get_room(room_id: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

@router.post("/{room_id}/close")
async def deactivate_room(room_id: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room.is_active = False
    db.commit()
    
    # Notify all participants via WebSocket
    await manager.broadcast({
        "type": "room_closed",
        "room_id": room_id
    }, room_id)
    
    return {"status": "deactivated"}

@router.get("/{room_id}/video_feed")
async def stream_video_host(room_id: str, db: Session = Depends(get_db)):
    """Legacy/Convenience endpoint that defaults to the room host's video"""
    room = db.query(Room).filter(Room.room_id == room_id).first()
    host_name = room.host_name if room else "host"
    return get_video_response(room_id, host_name)

@router.get("/{room_id}/video_feed/{user_name}")
async def stream_video_user(room_id: str, user_name: str):
    return get_video_response(room_id, user_name)
