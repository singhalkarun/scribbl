# 🎨 Scribbl - Multiplayer Drawing Game

A real-time multiplayer drawing and guessing game inspired by Skribbl.io. Players take turns drawing words while others compete to guess correctly and earn points.

## ✨ Features

- **Real-time Multiplayer** - Play with friends in shared game rooms
- **Interactive Canvas** - Smooth drawing with multiple brushes and colors  
- **Voice Chat** - Built-in voice communication
- **Smart Scoring** - Points based on speed and accuracy
- **Mobile Responsive** - Works on desktop and mobile devices

## 🏗️ Tech Stack

**Frontend:** Next.js 15, TypeScript, Tailwind CSS, Zustand, React Sketch Canvas  
**Backend:** Elixir, Phoenix Framework, Phoenix Channels, Redis  
**Infrastructure:** Docker, Caddy, GitHub Actions

## 🚀 Quick Start

1. **Clone and setup**
   ```bash
   git clone https://github.com/singhalkarun/scribbl.git
   cd scribbl/deployment
   cp sample.env .env
   ```

2. **Run with Docker**
   ```bash
   docker-compose up -d
   ```

3. **Access the game**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000

## 📁 Structure

```
scribbl/
├── scribbl_frontend/    # Next.js React app
├── scribbl_backend/     # Elixir Phoenix API
├── deployment/          # Docker setup
└── .github/            # CI/CD workflows
```

## 🎮 How to Play

1. Create or join a room with friends
2. Take turns drawing assigned words
3. Guess others' drawings in chat
4. Earn points for speed and accuracy
5. Win with the highest score!

## 🛠️ Local Development

**Backend:**
```bash
cd scribbl_backend && mix deps.get && mix phx.server
```

**Frontend:**
```bash
cd scribbl_frontend && npm install && npm run dev
```

## 👥 Maintainers

- **Karun Agarwal** - [singhalkarun@gmail.com](mailto:singhalkarun@gmail.com)
- **Prateek Jakhar** - [prtkjakhar@gmail.com](mailto:prtkjakhar@gmail.com)
- **Issues:** [GitHub Issues](https://github.com/singhalkarun/scribbl/issues)

---

**Ready to draw and guess?** 🎨 Built with ❤️ using Elixir Phoenix + React
