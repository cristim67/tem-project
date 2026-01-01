import asyncio
from fastapi.responses import StreamingResponse

# Global storage for latest frames: room_id -> {user_name: jpeg_bytes}
latest_frames: dict[str, dict[str, bytes]] = {}

async def generate_frames(room_id: str, user_name: str):
    while True:
        # Safely get frame from nested dict
        room_frames = latest_frames.get(room_id, {})
        frame = room_frames.get(user_name)
        
        if frame:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        else:
            # No signal placeholder
            black_frame = b'\xff\xd8\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x03\x01"\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x15\x00\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00?\x00\x10\xfc\x00\xff\xd9'
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + black_frame + b'\r\n')
        await asyncio.sleep(0.01)

def get_video_response(room_id: str, user_name: str):
    return StreamingResponse(generate_frames(room_id, user_name), media_type="multipart/x-mixed-replace; boundary=frame")
