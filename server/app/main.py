from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import engine, Base
from .routers import rooms, messages, websocket
from .models.room import Room, Participant, ChatMessage # Ensure models are loaded

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Room-Based Streaming API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(rooms.router)
app.include_router(messages.router)
app.include_router(websocket.router)

@app.get("/")
def read_root():
    return {"status": "Server is running", "service": "Room-Based Streaming API"}
