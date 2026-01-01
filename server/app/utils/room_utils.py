from sqlalchemy.orm import Session
from ..models.room import Room, Participant
from ..ws.manager import manager

async def broadcast_participants(room_id: str, db: Session):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if room:
        all_participants = db.query(Participant).filter(Participant.room_id == room.id).all()
        p_list = [
            {
                "id": p.id,
                "name": p.name,
                "role": p.role,
                "avatar": p.avatar,
                "is_muted": p.is_muted,
                "is_video_off": p.is_video_off
            } for p in all_participants
        ]
        await manager.broadcast({
            "type": "participant_list",
            "participants": p_list
        }, room_id)
