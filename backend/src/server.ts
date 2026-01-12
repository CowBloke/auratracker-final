import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config/index.js';
import { PrismaClient } from '@prisma/client';

// Routes
import authRoutes from './routes/auth.js';
import economyRoutes from './routes/economy.js';
import marketplaceRoutes from './routes/marketplace.js';
import gamesRoutes from './routes/games.js';
import leaderboardsRoutes from './routes/leaderboards.js';
import usersRoutes from './routes/users.js';

// Socket handlers
import { setupChatHandlers } from './socket/chat.js';
import { setupPartyHandlers } from './socket/party.js';
import { setupGameHandlers } from './socket/games.js';

// Initialize Prisma
export const prisma = new PrismaClient();

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
app.use(express.json());

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  setupChatHandlers(socket, io);
  setupPartyHandlers(socket, io);
  setupGameHandlers(socket, io);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const start = async () => {
  try {
    await prisma.$connect();
    console.log('Connected to database');
    
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
