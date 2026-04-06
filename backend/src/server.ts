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
import adminRoutes from './routes/admin.js';
import { prismaStudioRouter, createPrismaStudioProxy } from './routes/prismaStudio.js';
import { authMiddleware, adminMiddleware } from './middleware/auth.js';
import auraCoinRoutes, { startPriceEngine as startAuraCoinEngine, stopPriceEngine as stopAuraCoinEngine } from './routes/auracoin.js';
import marketRoomRoutes, { startMarketRoomEngines, stopMarketRoomEngines } from './routes/marketRoom.js';
import suggestionsRoutes from './routes/suggestions.js';
import bombpartyRoutes from './routes/bombparty.js';
import uploadsRoutes from './routes/uploads.js';
import maintenanceRoutes from './routes/maintenance.js';
import clansRoutes, { advanceClanWarsState } from './routes/clans.js';
import polymarketRoutes from './routes/polymarket.js';
import passRoutes from './routes/pass.js';
import questsRoutes from './routes/quests.js';
import solitaireRoutes from './routes/solitaire.js';
import notificationsRoutes from './routes/notifications.js';
import badgesRoutes from './routes/badges.js';
import customBadgesRoutes from './routes/customBadges.js';
import supportRoutes from './routes/support.js';
import clashRoutes from './routes/clash.js';
import polytrackRoutes from './routes/polytrack.js';
import changelogRoutes from './routes/changelog.js';
import youRoutes from './routes/you.js';
import messagesRoutes from './routes/messages.js';
import justiceRoutes from './routes/justice.js';

// Socket handlers
import { setupChatHandlers, startOnlineCountBroadcast, startOnlineSnapshotRecording } from './socket/chat.js';
import { setupPartyHandlers } from './socket/party.js';
import { setupGameHandlers } from './socket/games.js';
import { setupBombPartyHandlers, startBombPartyCleanup } from './socket/bombparty.js';
import { setupPokerHandlers } from './socket/poker.js';
import { setupPetitBacHandlers } from './socket/petitbac.js';
import { setupBattleshipHandlers } from './socket/battleship.js';
import { setupPuissanceQuatreHandlers } from './socket/puissancequatre.js';
import { setupChessHandlers } from './socket/chess.js';
import { setupDuelHandlers } from './socket/duel.js';
import { setupAIDuelHandlers } from './socket/aiDuel.js';
import { setupRussianRouletteHandlers } from './socket/russianroulette.js';
import { setupBallArenaHandlers } from './socket/ballarena.js';
import { setupUnoHandlers } from './socket/uno.js';
import { setupMorpionHandlers } from './socket/morpion.js';

// Logger
import { initLogger } from './utils/logger.js';
import { startAutoBadgeScheduler, stopAutoBadgeScheduler, autoEquipDefaultBadges, awardBadgeByKey } from './utils/badgeAwards.js';
import { ensureDefaultBadges } from './utils/seedBadges.js';
import { recomputeOverallClassement, startOverallClassementScheduler, stopOverallClassementScheduler } from './utils/overallClassement.js';
import { startDailyBankRevenueScheduler, stopDailyBankRevenueScheduler } from './utils/dailyBankRevenue.js';
import { startDailyBusinessSalaryScheduler, stopDailyBusinessSalaryScheduler } from './utils/dailyBusinessSalaries.js';
import { runDailyTax, startDailyTaxScheduler, stopDailyTaxScheduler } from './utils/dailyTax.js';
import { advanceClanEventsState } from './utils/clanEvents.js';
import {
  runDailyRacerRewards,
  startDailyRacerRewardsScheduler,
  stopDailyRacerRewardsScheduler,
} from './utils/dailyRacerRewards.js';

// Initialize Prisma
export const prisma = new PrismaClient();
let clanEventsTimer: ReturnType<typeof setInterval> | null = null;

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

// Remove or reset Permissions-Policy header to prevent invalid features from being sent
app.use((req, res, next) => {
  res.removeHeader('Permissions-Policy');
  res.setHeader('Permissions-Policy', '');
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/api/uploads', express.static(path.resolve('uploads')));
app.use('/polytrack', express.static(path.resolve('../frontend/public/polytrack')));
app.use('/eaglercraft', express.static(path.resolve('../frontend/public/eaglercraft')));
app.use('/watermelon', express.static(path.resolve('../frontend/public/watermelon')));

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);

// Prisma Studio Proxy (Admin Only)
app.use('/api/admin/prisma-studio-api', authMiddleware, adminMiddleware, prismaStudioRouter);
app.use('/api/admin/prisma-studio', authMiddleware, adminMiddleware, createPrismaStudioProxy());

app.use('/api/auracoin', auraCoinRoutes);
app.use('/api/market-room', marketRoomRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/bombparty', bombpartyRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/clans', clansRoutes);
app.use('/api/polymarket', polymarketRoutes);
app.use('/api/pass', passRoutes);
app.use('/api/quests', questsRoutes);
app.use('/api/solitaire', solitaireRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/custom-badges', customBadgesRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/clash', clashRoutes);
app.use('/api/polytrack', polytrackRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/you', youRoutes);
app.use('/api/justice', justiceRoutes);

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

  // Join personal room for targeted notifications
  if (socket.data.userId) {
    socket.join(`user:${socket.data.userId}`);
    // Admins also join the support room so they receive support:message events
    if (socket.data.isAdmin) {
      socket.join('admin:support');
    }

    // NUIT_BLANCHE: award badge if connected between 3:00 and 4:00 AM (local server time)
    const hour = new Date().getHours();
    if (hour === 3) {
      void (async () => {
        const userId = socket.data.userId as string;
        await prisma.gameStats.upsert({
          where: { userId_gameType: { userId, gameType: 'nuit_blanche' } },
          create: { userId, gameType: 'nuit_blanche', wins: 1, losses: 0, highScore: 0, totalPlayed: 1 },
          update: { wins: { increment: 1 }, totalPlayed: { increment: 1 } },
        });
        void awardBadgeByKey(userId, 'NUIT_BLANCHE', 'Connecté à 3h du matin');
      })();
    }
  }

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
  setupPuissanceQuatreHandlers(socket, io);
  setupChessHandlers(socket, io);
  setupDuelHandlers(socket, io);
  setupAIDuelHandlers(socket, io);
  setupRussianRouletteHandlers(socket, io);
  setupBallArenaHandlers(socket, io);
  setupUnoHandlers(socket, io);
  setupMorpionHandlers(socket, io);
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const start = async () => {
  try {
    await prisma.$connect();
    console.log('Connected to database');
    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        httpServer.off('listening', onListening);
        reject(error);
      };

      const onListening = () => {
        httpServer.off('error', onError);
        resolve();
      };

      httpServer.once('error', onError);
      httpServer.once('listening', onListening);
      httpServer.listen(config.port);
    });

    console.log(`Server running on port ${config.port}`);

    // Start background jobs only after the HTTP server is actually bound.
    startAuraCoinEngine();
    await startMarketRoomEngines();
    startOnlineCountBroadcast(io);
    startOnlineSnapshotRecording();
    startBombPartyCleanup(io);
    await ensureDefaultBadges();
    startAutoBadgeScheduler(); // first run: awards + auto-equip immediately
    await recomputeOverallClassement(prisma);
    startOverallClassementScheduler(prisma);
    startDailyBankRevenueScheduler(prisma);
    startDailyBusinessSalaryScheduler(prisma);
    await runDailyTax(prisma);
    startDailyTaxScheduler(prisma);
    await runDailyRacerRewards(prisma);
    startDailyRacerRewardsScheduler(prisma);
    await advanceClanWarsState(); // activate any PREPARING wars immediately on startup
    await advanceClanEventsState();
    if (!clanEventsTimer) {
      clanEventsTimer = setInterval(() => {
        void advanceClanEventsState();
      }, 60_000);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(`Failed to start server: port ${config.port} is already in use`);
    } else {
      console.error('Failed to start server:', error);
    }
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on('SIGINT', async () => {
  stopAuraCoinEngine();
  stopMarketRoomEngines();
  stopAutoBadgeScheduler();
  stopOverallClassementScheduler();
  stopDailyBankRevenueScheduler();
  stopDailyBusinessSalaryScheduler();
  stopDailyTaxScheduler();
  stopDailyRacerRewardsScheduler();
  if (clanEventsTimer) clearInterval(clanEventsTimer);
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  stopAuraCoinEngine();
  stopMarketRoomEngines();
  stopAutoBadgeScheduler();
  stopOverallClassementScheduler();
  stopDailyBankRevenueScheduler();
  stopDailyBusinessSalaryScheduler();
  stopDailyTaxScheduler();
  stopDailyRacerRewardsScheduler();
  if (clanEventsTimer) clearInterval(clanEventsTimer);
  await prisma.$disconnect();
  process.exit(0);
});
