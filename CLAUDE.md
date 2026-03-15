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
mix test path/to/test.exs          # Run a single test file
mix test path/to/test.exs:42      # Run a specific test by line number
mix format           # Format code
mix format --check-formatted      # Check formatting without changing files
```

### Docker (full stack)
```bash
cd deployment && cp sample.env .env   # Configure env vars
docker-compose up -d                  # Start all services (4 backend instances)
```

There is also a local dev docker-compose in `scribbl_backend/docker-compose.yaml` that runs 2 backend instances, Redis, PostgreSQL, and Caddy for multi-node testing.

## Architecture

### Tech Stack
- **Frontend:** Next.js 15 (App Router, standalone output), React 19, TypeScript, Tailwind CSS 4, Zustand 5, Phoenix JS client (WebSocket)
- **Backend:** Elixir 1.14+, Phoenix 1.7, Phoenix Channels (WebSocket), Redis (all game state), Bandit (HTTP)
- **Infra:** Docker, Caddy (reverse proxy/load balancer), Pulumi (Azure IaC), GitHub Actions CI

### Real-time Communication
The frontend connects via Phoenix Channels (not Socket.IO despite the dependency listing — the actual client is `phoenix` JS). The socket connects to `NEXT_PUBLIC_BACKEND_URL/socket` with a `user_id` param. Players join channel topic `room:<room_id>`.

### Game State — Redis Only
All game state is stored in Redis, not PostgreSQL. There are no Ecto schemas or database migrations in use. Redis keys are managed centrally through `KeyManager` module with a structured naming convention: `room:{room_id}:info`, `room:{room_id}:players`, `room:{room_id}:player:{player_id}:score`, etc. All key generation must go through `KeyManager`.

### Timer System — Redis Key Expiration
`TimeoutWatcher` is a GenServer that subscribes to Redis keyspace expiration events (`__keyevent@{db}__:expired`). Game timers (turn timeout, letter reveal, word selection, turn transition) are implemented as Redis keys with TTLs. When they expire, `TimeoutWatcher` triggers the corresponding game logic. **Redis must have keyspace notifications enabled:** `notify-keyspace-events Ex`. Distributed locks (NX SET with 5s TTL) prevent duplicate handling across nodes.

### REST API Routes
- `GET /api/rooms/join-random` — Join a random public room
- `GET /api/rooms/generate-id` — Generate a new room ID
- `POST /api/images/game-over` — Generate game-over image
- `/dev/dashboard` — Phoenix LiveDashboard (dev only)

### Backend Module Responsibilities
- **`RoomChannel`** — Main WebSocket channel handler (~850 LOC); routes all real-time events (join, drawing, guesses, game control, WebRTC signaling)
- **`GameFlow`** — Game lifecycle: start, turn progression, round management
- **`GameState`** — Room CRUD, status tracking (`waiting` → `active` → `finished`), admin management
- **`PlayerManager`** — Player tracking, scoring (base + speed bonus + rank bonus), kick voting
- **`WordManager`** — Word selection by difficulty, hint/reveal system, skip functionality
- **`CanvasManager`** — Drawing data persistence in Redis
- **`TimeoutWatcher`** — GenServer managing game timers via Redis key expiration
- **`RedisHelper`** — Wrapper around Redix commands with error handling
- **`VoiceRoomManager`** — WebRTC voice chat state in Redis
- **`KeyManager`** — Centralized Redis key generation (all Redis keys defined here)

### Frontend Structure
- **Pages:** `/join` (room creation/joining), `/game` (active game) — Next.js App Router in `src/app/`
- **State:** Single Zustand store (`usePlayerStore`) with localStorage persistence for player info. Transient state (socket, channel, players map) is not persisted. Uses `_hasHydrated` flag to prevent SSR/redirect flash.
- **Key components:** `Canvas.tsx` (drawing via react-sketch-canvas, ~1070 LOC), `Chat.tsx`, `VoiceChat.tsx` (WebRTC)
- **Hooks:** `useRoomChannel` (Phoenix Channel lifecycle), `useWebRTCVoice` (peer connections), `useSoundEffects`
- **Socket:** Created in `src/lib/socket.ts`, initialized in `SocketInitializer` component (root layout)
- **Path alias:** `@/*` maps to `./src/*` — all imports use `@/` prefix

### Supervision Tree (application.ex)
Telemetry → DNSCluster → PubSub (Redis adapter) → Redix → TimeoutWatcher → Presence → Endpoint

### Multi-node Deployment
Production runs 4 backend instances behind Caddy load balancer. Redis PubSub (`phoenix_pubsub_redis`) synchronizes channel broadcasts across nodes. Each node needs a unique `NODE_NAME` env var. DNS clustering via `DNS_CLUSTER_QUERY` for node discovery.

### Environment Variables
Backend requires: `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `SECRET_KEY_BASE`, `CORS_ALLOWED_ORIGINS`
Backend optional: `REDIS_PASSWORD`, `NODE_NAME`, `DNS_CLUSTER_QUERY`, `PHX_HOST`, `PORT`
Frontend requires: `NEXT_PUBLIC_BACKEND_URL` (build-time — baked into the compiled Next.js app)
