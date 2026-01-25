# Aura Tracker - Technical Specification Document

**Version:** 1.0  
**Date:** January 2026  
**Project Type:** Private Social Gaming Platform

---

## 1. Executive Summary

Aura Tracker is a web-based social gaming platform designed for a closed community of approximately 40 users. The platform combines real-time chat, multiple mini-games, and a Clash of Clans-style base-building PvP game with an economy system centered around two currencies: Aura (prestige) and Money.

**Core Features:**
- Global real-time chat
- Party system for multiplayer gaming
- Multiple mini-games (Doodle Jump, etc.)
- Clash of Clans-style base-building PvP
- Dual currency economy (Aura + Money)
- Global leaderboards with multiple categories
- In-app marketplace for items, cosmetics, and upgrades

---

## 2. Tech Stack

### Frontend
- **Framework:** Vite + React
- **Styling:** Tailwind CSS
- **Real-time:** Socket.io-client
- **Game Engine:** Phaser.js (Clash game), Canvas/React (mini-games)
- **State Management:** React Context/Zustand
- **HTTP Client:** Axios/Fetch

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-time:** Socket.io
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT + bcrypt
- **Caching:** Redis (for leaderboards)

### Hosting
- **Development:** localhost
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Railway/Render (with PostgreSQL)
- **Version Control:** Git/GitHub

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Chat UI    │  │ Games UI │  │ Leaderboards UI  │   │
│  └────────────┘  └──────────┘  └──────────────────┘   │
│         │              │                  │             │
│         └──────────────┴──────────────────┘             │
│                        │                                │
└────────────────────────┼────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   Socket.io + REST  │
              └──────────┬──────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│                   Backend Server                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Express.js REST API                   │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐  │   │
│  │  │ Auth       │  │ Economy    │  │ Games    │  │   │
│  │  │ Routes     │  │ Routes     │  │ Routes   │  │   │
│  │  └────────────┘  └────────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Socket.io Event Handlers              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐  │   │
│  │  │ Chat       │  │ Parties    │  │ Game     │  │   │
│  │  │ Events     │  │ Events     │  │ Events   │  │   │
│  │  └────────────┘  └────────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│              ┌──────────┴──────────┐                    │
│              │   Business Logic    │                    │
│              └──────────┬──────────┘                    │
└─────────────────────────┼──────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
    ┌─────────┴─────────┐   ┌────────┴────────┐
    │   PostgreSQL      │   │     Redis       │
    │   (via Prisma)    │   │   (Caching)     │
    └───────────────────┘   └─────────────────┘
```

### Database Schema (Prisma)

```prisma
// User Model
model User {
  id            String    @id @default(uuid())
  username      String    @unique
  email         String    @unique
  passwordHash  String
  aura          Int       @default(0)
  money         Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  ownedItems    UserItem[]
  sentTransfers Transfer[] @relation("SentTransfers")
  receivedTransfers Transfer[] @relation("ReceivedTransfers")
  clashBase     ClashBase?
  attacks       Attack[]   @relation("Attacker")
  defenses      Attack[]   @relation("Defender")
  gameStats     GameStats[]
  partyMemberships PartyMember[]
  
  @@index([aura])
  @@index([money])
}

// Item Model
model Item {
  id          String    @id @default(uuid())
  name        String
  description String
  type        ItemType  // CONSUMABLE, COSMETIC, UPGRADE
  price       Int
  auraCost    Int       @default(0)
  imageUrl    String?
  expiresAt   DateTime? // Optional expiration
  createdAt   DateTime  @default(now())
  
  userItems   UserItem[]
}

enum ItemType {
  CONSUMABLE
  COSMETIC
  UPGRADE
}

// User Inventory
model UserItem {
  id          String    @id @default(uuid())
  userId      String
  itemId      String
  quantity    Int       @default(1)
  acquiredAt  DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id])
  item        Item      @relation(fields: [itemId], references: [id])
  
  @@unique([userId, itemId])
}

// Transfer/Trade Model
model Transfer {
  id          String    @id @default(uuid())
  senderId    String
  receiverId  String
  auraAmount  Int       @default(0)
  moneyAmount Int       @default(0)
  createdAt   DateTime  @default(now())
  
  sender      User      @relation("SentTransfers", fields: [senderId], references: [id])
  receiver    User      @relation("ReceivedTransfers", fields: [receiverId], references: [id])
  
  @@index([senderId])
  @@index([receiverId])
}

// Clash of Clans Base
model ClashBase {
  id              String    @id @default(uuid())
  userId          String    @unique
  baseLayout      Json      // Stores building positions/levels
  defenseRating   Int       @default(0)
  lastAttackedAt  DateTime?
  shieldUntil     DateTime?
  
  user            User      @relation(fields: [userId], references: [id])
}

// Attack Log
model Attack {
  id          String    @id @default(uuid())
  attackerId  String
  defenderId  String
  success     Boolean
  auraTaken   Int
  moneyTaken  Int
  attackedAt  DateTime  @default(now())
  
  attacker    User      @relation("Attacker", fields: [attackerId], references: [id])
  defender    User      @relation("Defender", fields: [defenderId], references: [id])
  
  @@index([attackerId])
  @@index([defenderId])
  @@index([attackedAt])
}

// Game Statistics
model GameStats {
  id          String    @id @default(uuid())
  userId      String
  gameType    String    // "doodle_jump", "clash"
  wins        Int       @default(0)
  losses      Int       @default(0)
  highScore   Int       @default(0)
  totalPlayed Int       @default(0)
  
  user        User      @relation(fields: [userId], references: [id])
  
  @@unique([userId, gameType])
}

// Party System
model Party {
  id          String        @id @default(uuid())
  name        String?
  isPublic    Boolean       @default(false)
  maxSize     Int           @default(8)
  createdAt   DateTime      @default(now())
  lastActivity DateTime     @default(now())
  
  members     PartyMember[]
}

model PartyMember {
  id        String   @id @default(uuid())
  partyId   String
  userId    String
  isLeader  Boolean  @default(false)
  joinedAt  DateTime @default(now())
  
  party     Party    @relation(fields: [partyId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([partyId, userId])
}

// Season System
model Season {
  id          String    @id @default(uuid())
  name        String
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean   @default(true)
  
  @@index([isActive])
}
```

---

## 4. Core Features Specification

### 4.1 Authentication System

**Requirements:**
- Email/password registration and login
- JWT-based session management
- Password hashing with bcrypt (salt rounds: 10)
- Token expiration: 7 days
- Refresh token mechanism

**API Endpoints:**
```
POST /api/auth/register
  Body: { username, email, password }
  Returns: { user, token }

POST /api/auth/login
  Body: { email, password }
  Returns: { user, token }

POST /api/auth/refresh
  Headers: { Authorization: Bearer <token> }
  Returns: { token }

GET /api/auth/me
  Headers: { Authorization: Bearer <token> }
  Returns: { user }
```

---

### 4.2 Real-Time Chat System

**Requirements:**
- Single global chat room for all 40 users
- Real-time message delivery via Socket.io
- Message history stored in database
- Typing indicators
- Online user presence
- Message persistence (last 1000 messages loaded on join)

**Socket Events:**
```javascript
// Client -> Server
socket.emit('chat:join', { userId, username })
socket.emit('chat:message', { message, userId })
socket.emit('chat:typing', { userId, isTyping })

// Server -> Client
socket.on('chat:message', { id, userId, username, message, timestamp })
socket.on('chat:history', { messages[] })
socket.on('chat:typing', { userId, username, isTyping })
socket.on('user:online', { userId, username })
socket.on('user:offline', { userId, username })
```

**Chat UI Components:**
- Persistent chat window (collapsible, always visible)
- Message list with auto-scroll
- Input field with typing indicator
- Online user list
- Message timestamps

---

### 4.3 Economy System

**Currencies:**

1. **Aura (Prestige Score)**
   - Earned through: Winning games, successful attacks
   - Lost through: Losing attacks (defender loses some)
   - Transferable between players (no limits)
   - Primary leaderboard metric

2. **Money**
   - Earned through: Winning games, successful attacks
   - Used for: Purchasing items, upgrades, cosmetics
   - Transferable between players (no limits)
   - Cannot convert to/from Aura

**Transfer System:**

**API Endpoints:**
```
POST /api/economy/transfer
  Body: { 
    receiverId, 
    auraAmount?: number, 
    moneyAmount?: number 
  }
  Returns: { success, newBalances }

GET /api/economy/transfers
  Query: { userId?, limit?, offset? }
  Returns: { transfers[] }

GET /api/economy/balance/:userId
  Returns: { aura, money }
```

**Transfer Rules:**
- No daily limits
- Minimum transfer: 1 (for either currency)
- Must have sufficient balance
- Both currencies can be transferred simultaneously
- Transaction history is logged

---

### 4.4 Marketplace System

**Item Types:**

1. **Consumables**
   - One-time use items
   - Examples: Attack boosts, defense shields, resource doublers
   - Can have optional expiration dates (admin-controlled)

2. **Cosmetics**
   - Permanent visual customization
   - Examples: Profile themes, chat badges, base decorations
   - No expiration

3. **Upgrades**
   - Permanent stat improvements
   - Examples: Base building slots, faster resource generation
   - No expiration

**API Endpoints:**
```
GET /api/marketplace/items
  Query: { type?, page?, limit? }
  Returns: { items[], total }

POST /api/marketplace/purchase
  Body: { itemId, quantity? }
  Returns: { success, item, newBalance }

GET /api/marketplace/inventory/:userId
  Returns: { items[] }

POST /api/marketplace/use-item
  Body: { userItemId }
  Returns: { success, effect }

// Admin only
POST /api/admin/marketplace/item
  Body: { name, description, type, price, auraCost?, expiresAt? }
  Returns: { item }
```

---

### 4.5 Party System

**Requirements:**
- Persistent parties across games
- Auto-disband after 30 minutes of inactivity
- Public/private party options
- Party browser to find public parties
- Party leader controls (invite, kick)
- Maximum 8 players per party

**Socket Events:**
```javascript
// Client -> Server
socket.emit('party:create', { name?, isPublic })
socket.emit('party:join', { partyId })
socket.emit('party:leave')
socket.emit('party:invite', { userId })
socket.emit('party:kick', { userId })

// Server -> Client
socket.on('party:created', { party })
socket.on('party:joined', { party, members[] })
socket.on('party:member-joined', { userId, username })
socket.on('party:member-left', { userId, username })
socket.on('party:disbanded')
socket.on('party:list', { parties[] })
```

**Party Browser UI:**
- List of public parties
- Party name, member count, game status
- Join button
- Create new party button

---

### 4.6 Leaderboard System

**Leaderboard Categories:**
1. **Total Aura** (primary)
2. **Total Money**
3. **Best at Doodle Jump** (high score)
4. **Best at Clash** (defense rating + attack success)
5. **Most Games Played**

**API Endpoints:**
```
GET /api/leaderboards/:category
  Query: { limit?, offset?, seasonId? }
  Returns: { rankings[], userRank? }

GET /api/leaderboards/user/:userId
  Returns: { allRankings }
```

**Caching Strategy:**
- Redis cache for leaderboard data
- Update frequency: Every 5 minutes
- Cache invalidation on significant events (attack, game win)

**Season System:**
- Optional seasonal leaderboard resets
- Admin-controlled season start/end dates
- Historical season data preserved
- Rewards for top players at season end (future feature)

---

### 4.7 Game Integration

#### 4.7.1 Clash of Clans-Style Game

**Core Mechanics:**

**Base Building:**
- Grid-based layout system (e.g., 20x20 grid)
- Building types: Resource generators, defenses, walls, decorations
- Upgrade system for buildings
- Building placement restrictions (distance, terrain)

**Attack System:**
- Asynchronous attacks (attack offline bases)
- Attack cooldown: 1 hour per player
- Shield system: 12-hour shield after being attacked
- Troop deployment mechanics
- Win conditions: Destroy X% of base or eliminate Town Hall

**Resources & Rewards:**
- Successful attack: Steal 10-30% of defender's money + 5-15% of aura
- Failed attack: Lose 5% of your aura
- Base defense rating affects attacker's difficulty

**API Endpoints:**
```
GET /api/clash/base/:userId
  Returns: { base }

PUT /api/clash/base
  Body: { baseLayout }
  Returns: { success }

POST /api/clash/attack
  Body: { defenderId }
  Returns: { canAttack, cooldownRemaining?, shieldRemaining? }

POST /api/clash/attack/execute
  Body: { defenderId, attackData }
  Returns: { result, auraTaken, moneyTaken }

GET /api/clash/available-targets
  Returns: { users[] } // Users not on cooldown/shield
```

**Game State Management:**
- Phaser.js for rendering
- Client-side simulation, server validation
- Replay system for attack logs

#### 4.7.2 Mini-Games (Doodle Jump, etc.)

**General Mini-Game Structure:**

**Doodle Jump:**
- Solo game
- High score tracking
- Rewards: Money based on score, Aura for personal bests
- Leaderboard integration

**Future Mini-Games:**
- Multiplayer support via party system
- Turn-based and real-time options
- Spectator mode for party members

**API Endpoints:**
```
GET /api/games/:gameType/stats/:userId
  Returns: { stats }

POST /api/games/:gameType/complete
  Body: { score, won, duration }
  Returns: { auraReward, moneyReward, newStats }

GET /api/games/:gameType/leaderboard
  Returns: { rankings[] }
```

**Game Invite System:**
- In-game invite buttons
- Notifications via Socket.io
- Party members auto-invited for multiplayer games

---

## 5. UI/UX Layout

### 5.1 Main Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | Aura: 1234 | Money: $5678 | Profile Btn    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │   Sidebar        │  │   Main Content Area          │    │
│  │                  │  │                              │    │
│  │ • Dashboard      │  │  [Current View Content]      │    │
│  │ • Games          │  │                              │    │
│  │   - Clash        │  │                              │    │
│  │   - Doodle Jump  │  │                              │    │
│  │ • Leaderboards   │  │                              │    │
│  │ • Marketplace    │  │                              │    │
│  │ • Party          │  │                              │    │
│  │ • Inventory      │  │                              │    │
│  │                  │  │                              │    │
│  └──────────────────┘  └──────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Global Chat (Collapsible)                           │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ User1: Hey! Anyone want to play?               │  │  │
│  │  │ User2: Sure, let's do Clash                    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  [Message Input Field]                  [Send Btn]   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Key Views

**Dashboard:**
- Welcome message
- Personal stats overview (Aura, Money, Games Won)
- Recent activity feed
- Quick access to popular games
- Online friends list

**Games View:**
- Game selection grid
- Currently active parties/lobbies
- Quick play buttons
- Game statistics

**Clash Base View:**
- Base editor mode / View mode toggle
- Building palette
- Resource counters
- Attack button with available targets
- Attack history log

**Leaderboards:**
- Category tabs
- Sortable rankings table
- Your rank highlight
- Season selector (if active)

**Marketplace:**
- Item grid with filters (type, price)
- Purchase modal
- Your balance display
- Transaction history

**Party View:**
- Current party members
- Party chat (separate from global)
- Game invite buttons
- Party browser (if not in party)

---

## 6. Real-Time Features & Socket.io Events

### 6.1 Event Categories

**Chat Events:**
- `chat:message`
- `chat:history`
- `chat:typing`

**User Presence:**
- `user:online`
- `user:offline`
- `user:status-change`

**Party Events:**
- `party:created`
- `party:joined`
- `party:left`
- `party:member-joined`
- `party:member-left`
- `party:disbanded`
- `party:invite`

**Game Events:**
- `game:invite`
- `game:start`
- `game:end`
- `game:update` (for real-time multiplayer)

**Economy Events:**
- `economy:transfer` (notify receiver)
- `economy:balance-update`

**Clash Events:**
- `clash:under-attack`
- `clash:attack-complete`
- `clash:shield-expired`

---

## 7. Security Considerations

### 7.1 Authentication & Authorization
- JWT tokens with short expiration
- Secure password hashing (bcrypt, 10 rounds)
- Rate limiting on auth endpoints
- HTTPS only in production

### 7.2 Data Validation
- Input sanitization on all endpoints
- Prisma parameterized queries (SQL injection prevention)
- File upload validation (if images are uploaded)
- Request size limits

### 7.3 Game Security
- Server-side validation of all game actions
- Anti-cheat measures (score validation, time checks)
- Cooldown enforcement on server
- Attack simulation validation

### 7.4 Economy Security
- Transaction validation (sufficient funds)
- Prevent negative balances
- Audit trail for all transfers
- Admin-only marketplace item creation

---

## 8. Performance Optimization

### 8.1 Database
- Proper indexing on frequently queried fields
- Connection pooling
- Query optimization
- Pagination for large datasets

### 8.2 Caching
- Redis for leaderboards
- Session caching
- Static asset caching

### 8.3 Frontend
- Code splitting (lazy load games)
- Image optimization
- Debouncing/throttling for real-time events
- Virtual scrolling for long lists

### 8.4 Real-Time
- Socket.io room-based broadcasting
- Message throttling for chat
- Graceful reconnection handling

---

## 9. Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up project structure (Vite + React, Express)
- [ ] Database schema & Prisma setup
- [ ] Authentication system
- [ ] Basic UI layout with routing
- [ ] Deploy to Vercel + Railway

### Phase 2: Core Social (Week 3-4)
- [ ] Real-time chat system
- [ ] User profiles
- [ ] Party system
- [ ] Online presence indicators

### Phase 3: Economy (Week 5)
- [ ] Aura & Money system
- [ ] Transfer/trade functionality
- [ ] Basic leaderboards
- [ ] Transaction history

### Phase 4: Marketplace (Week 6)
- [ ] Item creation system (admin)
- [ ] Marketplace UI
- [ ] Purchase flow
- [ ] Inventory management
- [ ] Item usage system

### Phase 5: Mini-Games (Week 7-8)
- [ ] Doodle Jump implementation
- [ ] Game statistics tracking
- [ ] Rewards integration

### Phase 6: Clash Game (Week 9-12)
- [ ] Base building system
- [ ] Attack mechanics
- [ ] Defense simulation
- [ ] Cooldown & shield system
- [ ] Attack history & replays

### Phase 7: Polish & Features (Week 13-14)
- [ ] Season system
- [ ] Multiple leaderboard categories
- [ ] Party auto-disbanding
- [ ] Item expiration system
- [ ] Mobile responsiveness

### Phase 8: Testing & Launch (Week 15-16)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Bug fixes
- [ ] User onboarding flow
- [ ] Launch to 40-user group

---

## 10. API Documentation Summary

### Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-backend.railway.app/api`

### Authentication
All protected endpoints require:
```
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}
```

### Core Endpoints

**Auth:**
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`

**Users:**
- `GET /users/:id`
- `GET /users` (list all, for 40-user group)
- `PUT /users/:id` (update profile)

**Economy:**
- `POST /economy/transfer`
- `GET /economy/transfers`
- `GET /economy/balance/:userId`

**Marketplace:**
- `GET /marketplace/items`
- `POST /marketplace/purchase`
- `GET /marketplace/inventory/:userId`
- `POST /marketplace/use-item`

**Clash:**
- `GET /clash/base/:userId`
- `PUT /clash/base`
- `POST /clash/attack`
- `POST /clash/attack/execute`
- `GET /clash/available-targets`

**Games:**
- `GET /games/:gameType/stats/:userId`
- `POST /games/:gameType/complete`
- `GET /games/:gameType/leaderboard`

**Leaderboards:**
- `GET /leaderboards/:category`
- `GET /leaderboards/user/:userId`

**Party:**
- Socket.io events (see section 4.5)

---

## 11. Testing Strategy

### 11.1 Unit Tests
- Backend: Jest + Supertest
- Frontend: Vitest + React Testing Library
- Coverage target: 70%+

### 11.2 Integration Tests
- API endpoint testing
- Socket.io event testing
- Database transaction testing

### 11.3 E2E Tests
- Playwright for critical user flows
- Login → Game → Transfer → Leaderboard

### 11.4 Load Testing
- Simulate 40 concurrent users
- Chat message throughput
- Game server stress testing

---

## 12. Monitoring & Maintenance

### 12.1 Logging
- Winston for structured logging
- Error tracking (Sentry or similar)
- Audit logs for economy transactions

### 12.2 Analytics
- User activity tracking
- Game popularity metrics
- Economy health monitoring (inflation, deflation)

### 12.3 Backups
- Daily PostgreSQL backups
- Backup retention: 30 days
- Database migration history

---

## 13. Future Enhancements

### Post-Launch Features
1. **Guild System** (if expanding beyond 40 users)
2. **Achievements & Badges**
3. **Daily Quests**
4. **More Mini-Games** (trivia, card games, etc.)
5. **Clash Clans Features:**
   - Defensive troops
   - Multiple attack strategies
   - Base templates
6. **Social Features:**
   - Private DMs
   - Friend requests
   - Profile customization
7. **Mobile App** (React Native or PWA)
8. **Replay System** for all games
9. **Tournament Mode**

---

## 14. Project File Structure

```
aura-tracker/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   ├── games/
│   │   │   ├── layout/
│   │   │   ├── marketplace/
│   │   │   ├── party/
│   │   │   └── leaderboard/
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── SocketContext.jsx
│   │   │   └── PartyContext.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Clash.jsx
│   │   │   ├── Games.jsx
│   │   │   ├── Marketplace.jsx
│   │   │   └── Leaderboards.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── economy.js
│   │   │   ├── marketplace.js
│   │   │   ├── clash.js
│   │   │   ├── games.js
│   │   │   └── leaderboards.js
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── validation.js
│   │   ├── socket/
│   │   │   ├── chat.js
│   │   │   ├── party.js
│   │   │   └── games.js
│   │   ├── utils/
│   │   ├── config/
│   │   └── server.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── tests/
│   ├── package.json
│   └── .env
│
├── docs/
│   ├── API.md
│   ├── SETUP.md
│   └── DEPLOYMENT.md
│
└── README.md
```

---

## 15. Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aura_tracker"

# JWT
JWT_SECRET="your-secret-key-here"
JWT_EXPIRES_IN="7d"

# Redis (optional for caching)
REDIS_URL="redis://localhost:6379"

# Server
PORT=3000
NODE_ENV="development"

# CORS
CORS_ORIGIN="http://localhost:5173"

# Admin
ADMIN_EMAIL="admin@auratracker.com"
```

### Frontend (.env)
```env
VITE_API_URL="http://localhost:3000"
VITE_SOCKET_URL="http://localhost:3000"
```

---

## 16. Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Build errors resolved
- [ ] Security audit completed

### Deployment Steps
1. **Frontend (Vercel):**
   - Connect GitHub repository
   - Set environment variables
   - Deploy

2. **Backend (Railway):**
   - Connect GitHub repository
   - Add PostgreSQL addon
   - Set environment variables
   - Deploy

3. **Post-Deployment:**
   - Verify all endpoints work
   - Test Socket.io connections
   - Run smoke tests
   - Monitor error logs

---

## 17. Maintenance Schedule

### Daily
- Monitor error logs
- Check server performance

### Weekly
- Database backup verification
- Security updates
- Bug fixes

### Monthly
- Performance optimization review
- Feature requests review
- Economy balance adjustments

### Seasonal
- Leaderboard resets
- Major feature releases
- User feedback incorporation

---

## Conclusion

This specification document provides a comprehensive blueprint for building Aura Tracker. The modular architecture and phased development approach allow for iterative development and testing. The tech stack chosen prioritizes developer experience, performance, and ease of deployment while maintaining the flexibility to scale if needed.

**Next Steps:**
1. Review and approve this specification
2. Set up development environment
3. Initialize Git repository
4. Begin Phase 1 development
5. Establish regular check-ins for progress updates

**Estimated Total Development Time:** 16 weeks (with AI assistance)

**Key Success Metrics:**
- All 40 users actively engaged
- <100ms average response time for API calls
- 99.9% uptime
- Zero critical security vulnerabilities
- Positive user feedback on core features

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*Author: Claude (AI Assistant)*
