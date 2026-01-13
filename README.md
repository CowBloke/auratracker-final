# Aura Tracker

A web-based social gaming platform for a private community with real-time chat, mini-games, and a dual currency economy.

## Features

- **Real-time Global Chat** - Chat with all online users with typing indicators
- **Party System** - Create public/private parties, invite friends
- **Economy System** - Dual currency (Aura prestige + Money)
- **Marketplace** - Buy items, cosmetics, and upgrades
- **Mini-Games**:
  - 🦘 **Doodle Jump** - Platformer game with high score tracking
  - 🃏 **Solitaire** - Classic Klondike with fast completion rewards
- **Leaderboards** - Multiple categories with rankings
- **User Profiles** - Stats, rankings, and currency transfers

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Socket.io Client
- React Router
- React Hook Form
- Zustand (state management)

### Backend
- Node.js + Express
- Socket.io
- PostgreSQL + Prisma ORM
- JWT Authentication
- bcrypt password hashing

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis (optional, for caching)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env.example` if available):
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aura_tracker"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   JWT_EXPIRES_IN="7d"
   REDIS_URL="redis://localhost:6379"
   PORT=3000
   NODE_ENV="development"
   CORS_ORIGIN="http://localhost:5173"
   ADMIN_EMAIL="admin@auratracker.com"
   ```

4. Generate Prisma client and push schema:
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The frontend automatically uses environment-based URLs:
   - Development: `npm run dev` uses localhost
   - Production: `npm run build` uses auratracker.xyz

   URLs are configured in `.env.development` and `.env.production`

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:5173 in your browser

## Project Structure

```
aura-tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration
│   │   ├── middleware/      # Auth & validation middleware
│   │   ├── routes/          # REST API routes
│   │   ├── socket/          # Socket.io event handlers
│   │   └── server.ts        # Main server file
│   └── prisma/
│       └── schema.prisma    # Database schema
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── chat/
│   │   │   ├── layout/
│   │   │   └── ...
│   │   ├── contexts/        # React contexts
│   │   ├── pages/           # Page components
│   │   └── services/        # API & Socket services
│   └── public/
│
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Economy
- `POST /api/economy/transfer` - Transfer currency
- `GET /api/economy/transfers` - Get transfer history
- `GET /api/economy/balance/:userId` - Get user balance

### Marketplace
- `GET /api/marketplace/items` - List items
- `POST /api/marketplace/purchase` - Purchase item
- `GET /api/marketplace/inventory/:userId` - Get inventory
- `POST /api/marketplace/use-item` - Use consumable item

### Games
- `GET /api/games/:gameType/stats/:userId` - Get game stats
- `POST /api/games/:gameType/complete` - Submit game result
- `GET /api/games/:gameType/leaderboard` - Get game leaderboard

### Leaderboards
- `GET /api/leaderboards/:category` - Get leaderboard
- `GET /api/leaderboards/user/:userId` - Get user rankings

## Socket Events

### Chat
- `chat:join` - Join global chat
- `chat:message` - Send/receive messages
- `chat:typing` - Typing indicators

### Party
- `party:create` - Create party
- `party:join` - Join party
- `party:leave` - Leave party
- `party:invite` - Invite user
- `party:kick` - Kick user

### Economy
- `economy:balance-update` - Balance update notification
- `economy:transfer` - Transfer notification

## Game Rewards

### Doodle Jump
- Money: 1 per 10 score (minimum 100 score)
- Aura: 50 for new high score

### Solitaire
- Money: 100 per win
- Aura: 25 for fast win (under 3 minutes)

## Admin Features

Users registered with the `ADMIN_EMAIL` get admin privileges:
- Create marketplace items
- Update/delete items

## Development

### Running in Development

Both servers need to be running:

Terminal 1 (Backend):
```bash
cd backend && npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend && npm run dev
```

### Building for Production

Backend:
```bash
cd backend
npm run build
# Make sure to set NODE_ENV=production and use .env.production values
```

Frontend:
```bash
cd frontend
npm run build
# Automatically uses .env.production for auratracker.xyz URLs
```

### Environment Configuration

The project uses environment-specific configuration:

**Backend:**
- `.env.development` - Localhost configuration
- `.env.production` - Production configuration (auratracker.xyz)
- `.env` - Active config (gitignored, copy from `.env.example`)

**Frontend:**
- `.env.development` - Points to `http://localhost:3000`
- `.env.production` - Points to `https://auratracker.xyz`

Vite automatically loads the correct `.env` file based on the build mode

## License

Private project - All rights reserved
