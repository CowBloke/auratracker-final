import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
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
import auraCoinRoutes, { startPriceEngine as startAuraCoinEngine, stopPriceEngine as stopAuraCoinEngine } from './routes/auracoin.js';
import solarisRoutes, { startPriceEngine as startSolarisEngine, stopPriceEngine as stopSolarisEngine } from './routes/solaris.js';
import zenithRoutes, { startPriceEngine as startZenithEngine, stopPriceEngine as stopZenithEngine } from './routes/zenith.js';
import riftRoutes, { startPriceEngine as startRiftEngine, stopPriceEngine as stopRiftEngine } from './routes/rift.js';
import suggestionsRoutes from './routes/suggestions.js';
import bombpartyRoutes from './routes/bombparty.js';
import uploadsRoutes from './routes/uploads.js';
import maintenanceRoutes from './routes/maintenance.js';
import clansRoutes from './routes/clans.js';
import polymarketRoutes from './routes/polymarket.js';
import passRoutes from './routes/pass.js';
import questsRoutes from './routes/quests.js';
import solitaireRoutes from './routes/solitaire.js';

// Socket handlers
import { setupChatHandlers } from './socket/chat.js';
import { setupPartyHandlers } from './socket/party.js';
import { setupGameHandlers } from './socket/games.js';
import { setupBombPartyHandlers, startBombPartyCleanup } from './socket/bombparty.js';
import { setupPokerHandlers } from './socket/poker.js';
import { setupPetitBacHandlers } from './socket/petitbac.js';
import { setupBattleshipHandlers } from './socket/battleship.js';
import { setupRussianRouletteHandlers, startRussianRouletteCleanup } from './socket/russianroulette.js';

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
app.use('/api/solaris', solarisRoutes);
app.use('/api/zenith', zenithRoutes);
app.use('/api/rift', riftRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/bombparty', bombpartyRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/clans', clansRoutes);
app.use('/api/polymarket', polymarketRoutes);
app.use('/api/pass', passRoutes);
app.use('/api/quests', questsRoutes);
app.use('/api/solitaire', solitaireRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.use(async (socket, next) => {
  try {
    const authHeader = socket.handshake.headers.authorization;
    const authToken = socket.handshake.auth?.token;
    const token = authToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined);

    if (!token) {
      return next(new Error('unauthorized'));
    }

    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
      },
    });

    if (!user) {
      return next(new Error('unauthorized'));
    }

    const activeBan = await prisma.ban.findFirst({
      where: {
        userId: user.id,
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
      return next(new Error('banned'));
    }

    socket.data.userId = user.id;
    socket.data.username = user.username;
    socket.data.isAdmin = user.isAdmin;
    return next();
  } catch (error) {
    return next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.use(async (packet, next) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      return next(new Error('unauthorized'));
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
  setupBattleshipHandlers(socket, io);
  setupRussianRouletteHandlers(socket, io);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const start = async () => {
  try {
    await prisma.$connect();
    console.log('Connected to database');
    
    // Start price engines for all coins
    startAuraCoinEngine();
    startSolarisEngine();
    startZenithEngine();
    startRiftEngine();

    // Start bomb party game cleanup
    startBombPartyCleanup(io);
    // Start russian roulette game cleanup
    startRussianRouletteCleanup(io);

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
  stopAuraCoinEngine();
  stopSolarisEngine();
  stopZenithEngine();
  stopRiftEngine();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  stopAuraCoinEngine();
  stopSolarisEngine();
  stopZenithEngine();
  stopRiftEngine();
  await prisma.$disconnect();
  process.exit(0);
});
