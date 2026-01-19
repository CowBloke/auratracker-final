import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config/index.js';
import { PrismaClient } from '@prisma/client';

// BigInt JSON serialization support (needed for aura field which is BigInt)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Routes
import authRoutes from './routes/auth.js';
import economyRoutes from './routes/economy.js';
import marketplaceRoutes from './routes/marketplace.js';
import gamesRoutes from './routes/games.js';
import leaderboardsRoutes from './routes/leaderboards.js';
import usersRoutes from './routes/users.js';
import clashRoutes from './routes/clash.js';
import adminRoutes from './routes/admin.js';
import auraCoinRoutes, { startPriceEngine, stopPriceEngine } from './routes/auracoin.js';
import suggestionsRoutes from './routes/suggestions.js';
import bombpartyRoutes from './routes/bombparty.js';
import uploadsRoutes from './routes/uploads.js';
import maintenanceRoutes from './routes/maintenance.js';
import clansRoutes from './routes/clans.js';
import polymarketRoutes from './routes/polymarket.js';
import passRoutes from './routes/pass.js';

// Socket handlers
import { setupChatHandlers } from './socket/chat.js';
import { setupPartyHandlers } from './socket/party.js';
import { setupGameHandlers } from './socket/games.js';
import { setupBombPartyHandlers, startBombPartyCleanup } from './socket/bombparty.js';
import { setupPokerHandlers } from './socket/poker.js';
import { setupPetitBacHandlers } from './socket/petitbac.js';
import { setupMonopolyHandlers } from './socket/monopoly.js';

// Logger
import { initLogger } from './utils/logger.js';

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize logger with Prisma client
initLogger(prisma);

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
export const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/api/uploads', express.static(path.resolve('uploads')));

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clash', clashRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auracoin', auraCoinRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/bombparty', bombpartyRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/clans', clansRoutes);
app.use('/api/polymarket', polymarketRoutes);
app.use('/api/pass', passRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.use(async (packet, next) => {
    const data = packet[1] as { userId?: string } | undefined;
    const userId = data?.userId;
    if (!userId) {
      return next();
    }

    const activeBan = await prisma.ban.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        reason: true,
        type: true,
        expiresAt: true,
      },
    });

    if (activeBan) {
      const message = activeBan.type === 'PERMANENT'
        ? `Your account has been permanently banned. Reason: ${activeBan.reason}`
        : `Your account is temporarily banned until ${activeBan.expiresAt?.toISOString()}. Reason: ${activeBan.reason}`;
      socket.emit('ban:enforced', {
        message,
        banned: true,
        ban: {
          reason: activeBan.reason,
          type: activeBan.type,
          expiresAt: activeBan.expiresAt ? activeBan.expiresAt.toISOString() : null,
        },
      });
      socket.disconnect(true);
      return;
    }

    next();
  });
  
  setupChatHandlers(socket, io);
  setupPartyHandlers(socket, io);
  setupGameHandlers(socket, io);
  setupBombPartyHandlers(socket, io);
  setupPokerHandlers(socket, io);
  setupPetitBacHandlers(socket, io);
  setupMonopolyHandlers(socket, io);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const start = async () => {
  try {
    await prisma.$connect();
    console.log('Connected to database');
    
    // Start AuraCoin price engine
    startPriceEngine();

    // Start bomb party game cleanup
    startBombPartyCleanup(io);

    httpServer.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on('SIGINT', async () => {
  stopPriceEngine();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  stopPriceEngine();
  await prisma.$disconnect();
  process.exit(0);
});
