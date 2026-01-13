# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aura Tracker is a full-stack TypeScript social gaming platform for a private community (~40 users). It features real-time chat, mini-games (Doodle Jump, Solitaire, Clash PvP base-building), a dual-currency economy (Aura prestige + Money), marketplace, and leaderboards.

## Development Commands

### Backend (from `/backend`)
```bash
npm run dev           # Start dev server with hot reload (tsx watch)
npm run build         # Compile TypeScript
npm run start         # Run production build
npm run db:generate   # Generate Prisma client after schema changes
npm run db:push       # Sync schema to database
npm run db:migrate    # Run database migrations
npm run db:studio     # Open Prisma visual database admin
npm run db:seed       # Seed database with test data
```

### Frontend (from `/frontend`)
```bash
npm run dev           # Start Vite dev server on :5173
npm run build         # Type-check and build for production
npm run lint          # Run ESLint
npm run preview       # Preview production build
```

### Running Both Servers
Both servers must run simultaneously for development:
- Backend: `cd backend && npm run dev` (runs on :3000)
- Frontend: `cd frontend && npm run dev` (runs on :5173, proxies API to backend)

## Architecture

### Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Radix UI + Socket.io Client
- **Backend:** Express.js + TypeScript + Prisma ORM + Socket.io + JWT auth
- **Database:** SQLite (dev) / PostgreSQL (production)

### Key Directories
```
backend/
├── src/server.ts          # Entry point (Express + Socket.io setup)
├── src/routes/            # REST API endpoints (auth, economy, games, etc.)
├── src/socket/            # Real-time event handlers (chat, party, games)
├── src/middleware/        # Auth (JWT) and validation middleware
├── src/config/            # Configuration (JWT, CORS, etc.)
└── prisma/schema.prisma   # Database schema (14 models)

frontend/
├── src/App.tsx            # Route definitions with ProtectedRoute
├── src/pages/             # Page components (17 routes)
├── src/components/ui/     # Radix UI component library (30+ components)
├── src/contexts/          # Auth, Socket, Theme contexts
├── src/services/api.ts    # Axios HTTP client
└── src/services/socket.ts # Socket.io utilities
```

### Communication Pattern
- REST API for CRUD operations (auth, marketplace, user data)
- Socket.io for real-time features (chat, party system, live balance updates)
- Frontend proxies `/api` to backend via Vite config in development

### Authentication
- JWT-based auth with bcrypt password hashing
- Protected routes use auth middleware
- Admin privileges determined by ADMIN_EMAIL env var match
- Tokens stored client-side, refreshed via `/api/auth/refresh`

### Database Models (Prisma)
Core models: User, Item, UserItem (inventory), Transfer, GameStats, Party, PartyMember, ChatMessage, ClashBase, Attack, AuraCoinPrice, AuraCoinTransaction, Suggestion, SuggestionVote, BugReport

### Path Aliases
Frontend uses `@/*` to resolve to `src/*` (configured in tsconfig and vite.config)

## Environment Variables

Backend `.env` requires:
```
DATABASE_URL="postgresql://..." (or file:./dev.db for SQLite)
JWT_SECRET="..."
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
ADMIN_EMAIL="admin@auratracker.com"
PORT=3000
```

## Game Reward Logic
- Doodle Jump: 1 money per 10 score (min 100 score), 50 aura for new high score
- Solitaire: 100 money per win, 25 aura bonus for completion under 3 minutes