# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scribbl is a real-time multiplayer drawing and guessing game (like Skribbl.io). Players take turns drawing words while others guess in chat to earn points.

## Commands

### Frontend (`scribbl_frontend/`)
```bash
npm install          # Install dependencies
npm run dev          # Dev server on :3000
npm run build        # Production build
npm run lint         # ESLint
```

### Backend (`scribbl_backend/`)
```bash
mix setup            # Install dependencies (alias for deps.get)
mix phx.server       # Dev server on :4000
mix test             # Run tests
mix format           # Format code
```

### Docker (full stack)
```bash
cd deployment && cp sample.env .env   # Configure env vars
docker-compose up -d                  # Start all services
```

## Architecture

### Tech Stack
- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Zustand (state), Phoenix JS client (WebSocket)
- **Backend:** Elixir 1.14+, Phoenix 1.7, Phoenix Channels (WebSocket), Redis (all game state), Bandit (HTTP)
- **Infra:** Docker, Caddy (reverse proxy/load balancer), GitHub Actions CI

### Real-time Communication
The frontend connects via Phoenix Channels (not Socket.IO despite the dependency listing — the actual client is `phoenix` JS). The socket connects to `NEXT_PUBLIC_BACKEND_URL/socket` with a `user_id` param. Players join channel topic `room:<room_id>`.

### Game State — Redis Only
All game state is stored in Redis, not PostgreSQL. There are no Ecto schemas or database migrations in use. Redis keys are managed centrally through `KeyManager` module with a structured naming convention (e.g., `room_info:<room_id>`, `players:<room_id>`, `scores:<room_id>:<user_id>`).

### Backend Module Responsibilities
- **`RoomChannel`** — Main WebSocket channel handler; routes all real-time events (join, drawing, guesses, game control)
- **`GameFlow`** — Game lifecycle: start, turn progression, round management
- **`GameState`** — Room CRUD, status tracking (`waiting` → `active` → `finished`), admin management
- **`PlayerManager`** — Player tracking, scoring (base + speed bonus + rank bonus), kick voting
- **`WordManager`** — Word selection by difficulty, hint/reveal system, skip functionality
- **`CanvasManager`** — Drawing data persistence in Redis
- **`TimeoutWatcher`** — GenServer managing game timers (turn timeouts, auto-select)
- **`RedisHelper`** — Wrapper around Redix commands with error handling
- **`VoiceRoomManager`** — WebRTC voice chat state in Redis

### Frontend Structure
- **Pages:** `/join` (room creation/joining), `/game` (active game) — Next.js App Router in `src/app/`
- **State:** Single Zustand store (`usePlayerStore`) holds user session, socket/channel, room state, game state
- **Key components:** `Canvas.tsx` (drawing via react-sketch-canvas), `Chat.tsx`, `VoiceChat.tsx` (WebRTC)
- **Hooks:** `useRoomChannel` (Phoenix Channel lifecycle), `useWebRTCVoice` (peer connections)
- **Socket:** Created in `src/lib/socket.ts`, uses Phoenix JS client

### Multi-node Deployment
Production runs 4 backend instances behind Caddy load balancer. Redis PubSub (`phoenix_pubsub_redis`) synchronizes channel broadcasts across nodes.

### Environment Variables
Backend requires: `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `SECRET_KEY_BASE`, `CORS_ALLOWED_ORIGINS`
Frontend requires: `NEXT_PUBLIC_BACKEND_URL`
