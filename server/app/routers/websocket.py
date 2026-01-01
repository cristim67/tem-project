import json
import base64
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..models.room import Room, Participant, ChatMessage
from ..ws.manager import manager
from ..utils.video import latest_frames
from ..utils.room_utils import broadcast_participants

router = APIRouter(tags=["websocket"])

@router.websocket("/ws/{room_id}/{user_name}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_name: str, db: Session = Depends(get_db)):
    await manager.connect(websocket, room_id)
    
    # Check if participant exists, if not add as guest
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if room:
        participant = db.query(Participant).filter(Participant.room_id == room.id, Participant.name == user_name).first()
        if not participant:
            new_p = Participant(
                name=user_name,
                role='guest',
                avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_name}",
                room_id=room.id
            )
            db.add(new_p)
            db.commit()
        
        # Broadcast updated participant list to everyone in the room
        await broadcast_participants(room_id, db)
    
    try:
        # Heartbeat Logic
        async def heartbeat(ws: WebSocket):
            try:
                 while True:
                    await asyncio.sleep(5)
                    await ws.send_json({"type": "ping"})
            except Exception:
                pass
        
        heartbeat_task = asyncio.create_task(heartbeat(websocket))

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Add timestamp/metadata if it's a chat message
            if message.get("type") == "chat":
                # Save to DB
                db_msg = ChatMessage(
                    room_id=room_id,
                    user_name=user_name,
                    text=message["text"],
                    color=message.get("color", "#ffffff")
                )
                db.add(db_msg)
                db.commit()
                db.refresh(db_msg)
                
                # Broadcast back with ID and timestamp
                await manager.broadcast({
                    "type": "chat",
                    "id": db_msg.id,
                    "user_name": user_name,
                    "text": message["text"],
                    "color": message.get("color", "#ffffff"),
                    "created_at": str(db_msg.created_at)
                }, room_id)
            
            elif message.get("type") == "media_toggle":
                # Update DB
                if room:
                    participant = db.query(Participant).filter(Participant.room_id == room.id, Participant.name == user_name).first()
                    if participant:
                        if "is_muted" in message:
                            participant.is_muted = message["is_muted"]
                        if "is_video_off" in message:
                            participant.is_video_off = message["is_video_off"]
                        db.commit()
                
                # Broadcast to others
                await manager.broadcast({
                    "type": "media_state",
                    "user_name": user_name,
                    "is_muted": message.get("is_muted"),
                    "is_video_off": message.get("is_video_off")
                }, room_id)
            
            elif message.get("type") == "audio_activity":
                # Relay speaking state to all participants
                await manager.broadcast({
                    "type": "audio_activity",
                    "user_name": user_name,
                    "is_speaking": message.get("is_speaking", False)
                }, room_id)
            
            elif message.get("type") == "video_frame":
                # Save frame per user in the room
                frame_data = message.get("data")
                if frame_data:
                    # Remove base64 header if exists
                    if "," in frame_data:
                        frame_data = frame_data.split(",")[1]
                    
                    if room_id not in latest_frames:
                        latest_frames[room_id] = {}
                    
                    latest_frames[room_id][user_name] = base64.b64decode(frame_data)

            elif message.get("type") == "pong":
                pass
                
    except WebSocketDisconnect:
        heartbeat_task.cancel()
        manager.disconnect(websocket, room_id)
        # Remove participant on disconnect
        room = db.query(Room).filter(Room.room_id == room_id).first()
        if room:
            db.query(Participant).filter(Participant.room_id == room.id, Participant.name == user_name).delete()
            db.commit()
        await broadcast_participants(room_id, db)
    except Exception as e:
        heartbeat_task.cancel()
        print(f"WS Error: {e}")
        manager.disconnect(websocket, room_id)
    finally:
        heartbeat_task.cancel()
