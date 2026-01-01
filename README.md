# 📺 Live Streaming Platform

## 🚀 Key Features

- **Mutual Live Streaming**: Both hosts and guests can broadcast their video feeds simultaneously.
- **Real-time Audio Indicators**: Visual pulsing effects and animated microphones synchronized across all participants using the Web Audio API and WebSockets.
- **Interactive Live Chat**: A sleek, gradient-driven chat interface with unique user identities and colors.
- **Dynamic Lobby**: Seed-based dynamic thumbnails and live participant counts for an immersive browsing experience.
- **Modular Backend**: A production-ready architecture using FastAPI, split into core configurations, models, schemas, and specialized routers.
- **Cloud Persistence**: Integrated with Neon PostgreSQL for reliable data management.
- **High-End UI**: Dark-mode logic with glassmorphism, vibrant accents, and smooth animations powered by TailwindCSS.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: TailwindCSS (v4 @theme logic)
- **Icons**: Lucide React
- **Real-time**: WebSockets + Web Audio API

### Backend
- **Framework**: FastAPI (Python 3.13)
- **Database**: PostgreSQL (via SQLAlchemy)
- **Streaming**: MJPEG over HTTP + Base64 over WebSockets for frame distribution.
- **Task Management**: Asyncio for non-blocking I/O.

## 📂 Project Structure

```text
tem-project/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI Components (VideoPlayer, Chat, etc.)
│   │   ├── hooks/          # Custom hooks (Audio detection)
│   │   └── types/          # Shared TS interfaces
│   └──  ...
├── server/                 # FastAPI Backend
│   ├── app/
│   │   ├── core/           # DB Config & Engine
│   │   ├── models/         # SQLALchemy Models
│   │   ├── schemas/        # Pydantic Schemas
│   │   ├── routers/        # API & WebSocket Endpoints
│   │   ├── utils/          # Video/Room Logic
│   │   └── ws/             # Connection Management
│   ├── app.py              # Launch Script
│   └── ...
└── report/                 # LaTeX Documentation
```

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (Neon.tech or local)

### Backend Setup
1. Navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   python3 app.py
   ```
   *The server will start at `http://localhost:8000`*

### Frontend Setup
1. Navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The app will be available at `http://localhost:5173`*

## Docker Usage

1. Navigate to the root directory:
   ```bash
   cd tem-project
   ```
2. Build and run the containers:
   ```bash
   docker-compose up --build
   ```
   *The app will be available at `http://localhost:5173`*
   *The server will start at `http://localhost:8000`*

## 📜 Documentation
For a detailed technical analysis of video streaming principles, formats, and implementation challenges, please refer to the scientific paper located in the `report/` directory:
- [Scientific Paper (LaTeX)](./report/paper.tex)