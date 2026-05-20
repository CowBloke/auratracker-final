# Aura Tracker

Aura Tracker is a private social gaming platform with real-time chat, party play, a shared economy, leaderboards, profiles, quests, and a large collection of browser games.

## Overview

The repository is split into a Vite React frontend and an Express + Socket.io backend. Prisma is used for data access, and the app runs locally with the frontend proxying API and websocket traffic to the backend.

## What It Includes

- Real-time chat and party systems
- Shared economy and marketplace flows
- Game hub with embedded browser games and multiplayer titles
- Player profiles, inventories, quests, pass rewards, inbox, and support tools
- Admin and moderation surfaces, including maintenance controls

## Stack

- Frontend: React 18, TypeScript, Vite, React Router, Socket.io client, Tailwind CSS
- Backend: Node.js, Express, Socket.io, Prisma, JWT authentication
- Data layer: Prisma with SQLite
- Tooling: npm, concurrently, tsx, Vitest, TypeScript

## Quick Start

### Prerequisites

- Node.js 18 or newer
- npm

### Install

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Run Locally

```bash
npm run dev
```

That starts the backend on port 3000 and the frontend on port 5173.

### Build

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

### Test

```bash
npm test
```

## Configuration

The backend reads `PORT`, `NODE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `REDIS_URL`, and `ADMIN_EMAIL` from environment variables in `backend/src/config/index.ts`. Prisma uses the SQLite database defined in `backend/prisma/schema.prisma`.

The frontend uses Vite mode-specific environment files and proxies `/api` and `/socket.io` to the backend during development.

## Repository Layout

- `backend/src/server.ts` is the main backend entry point and route registry
- `backend/src/routes/` contains the REST route modules
- `backend/src/socket/` contains the websocket handlers
- `backend/src/utils/` contains schedulers, shared business logic, and background jobs
- `backend/prisma/` contains the schema, migrations, and seed scripts
- `frontend/src/App.tsx` defines the client-side routes
- `frontend/src/pages/` contains page-level screens
- `frontend/src/components/` contains shared UI and feature components
- `frontend/src/contexts/` contains application state and socket providers
- `frontend/src/services/` contains API and socket clients
- `frontend/public/` contains static assets and embedded game bundles
- `md files/` contains product notes, specs, and internal documentation

## Documentation

For a detailed map of routes, pages, files, and build flow, see [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md).
For a complete mechanics and content reference (systems, progression, economy, social, and game rules), see [AURATRACKER_COMPLETE_MECHANICS.md](AURATRACKER_COMPLETE_MECHANICS.md).

## License

Private project. All rights reserved.


aalkjldskjlsfkdjmqlkjmlqfdkqslkdfjmqdsfkjmdslk