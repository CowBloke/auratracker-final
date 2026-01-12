import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Configuration
const INITIAL_PRICE = 100;
const FEE_PERCENTAGE = 0.02; // 2% fee
const PRICE_IMPACT_PER_100 = 0.001; // 0.1% per 100$ traded
const RANDOM_VARIATION_PERCENTAGE = 0.005; // +/- 0.5%
const PRICE_UPDATE_INTERVAL = 5000; // 5 seconds

// Current price in memory (will be persisted to DB)
let currentPrice = INITIAL_PRICE;

// Initialize price from database or create initial price
const initializePrice = async () => {
  try {
    const latestPrice = await prisma.auraCoinPrice.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    
    if (latestPrice) {
      currentPrice = latestPrice.price;
    } else {
      // Create initial price record
      await prisma.auraCoinPrice.create({
        data: { price: INITIAL_PRICE, volume: 0 },
      });
    }
    console.log(`AuraCoin initialized at price: $${currentPrice.toFixed(2)}`);
  } catch (error) {
    console.error('Failed to initialize AuraCoin price:', error);
  }
};

// Random price variation
const applyRandomVariation = () => {
  const variation = (Math.random() - 0.5) * 2 * RANDOM_VARIATION_PERCENTAGE;
  currentPrice = currentPrice * (1 + variation);
  // Ensure price doesn't go below 1
  currentPrice = Math.max(1, currentPrice);
};

// Save price to database and broadcast
const savePriceAndBroadcast = async (volume: number = 0) => {
  try {
    await prisma.auraCoinPrice.create({
      data: { price: currentPrice, volume },
    });
    
    io.emit('auracoin:price-update', {
      price: currentPrice,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to save price:', error);
  }
};

// Start price variation interval
let priceInterval: NodeJS.Timeout | null = null;

export const startPriceEngine = () => {
  initializePrice();
  
  priceInterval = setInterval(async () => {
    applyRandomVariation();
    await savePriceAndBroadcast();
  }, PRICE_UPDATE_INTERVAL);
  
  console.log('AuraCoin price engine started');
};

export const stopPriceEngine = () => {
  if (priceInterval) {
    clearInterval(priceInterval);
    priceInterval = null;
    console.log('AuraCoin price engine stopped');
  }
};

// Get current price and history
router.get('/price', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);
    
    const history = await prisma.auraCoinPrice.findMany({
      where: {
        createdAt: { gte: hoursAgo },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        price: true,
        volume: true,
        createdAt: true,
      },
    });
    
    // Get user's balance
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { auraCoinBalance: true, money: true },
    });
    
    res.json({
      currentPrice,
      feePercentage: FEE_PERCENTAGE,
      history,
      userBalance: {
        auraCoin: user?.auraCoinBalance || 0,
        money: user?.money || 0,
      },
    });
  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({ error: 'Failed to get price' });
  }
});

// Buy AuraCoin
router.post('/buy', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { moneyAmount } = req.body;
    
    if (!moneyAmount || moneyAmount <= 0) {
      return res.status(400).json({ error: 'Invalid money amount' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.money < moneyAmount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    
    // Calculate fee and coins received
    const fee = Math.floor(moneyAmount * FEE_PERCENTAGE);
    const netAmount = moneyAmount - fee;
    const coinsReceived = netAmount / currentPrice;
    
    // Apply price impact (buying increases price)
    const priceImpact = (moneyAmount / 100) * PRICE_IMPACT_PER_100;
    currentPrice = currentPrice * (1 + priceImpact);
    
    // Update user balance and create transaction
    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { decrement: moneyAmount },
          auraCoinBalance: { increment: coinsReceived },
        },
      }),
      prisma.auraCoinTransaction.create({
        data: {
          userId: req.user.id,
          type: 'BUY',
          coinAmount: coinsReceived,
          moneyAmount,
          price: currentPrice,
          fee,
        },
      }),
    ]);
    
    // Save new price and broadcast
    await savePriceAndBroadcast(moneyAmount);
    
    // Broadcast balance update
    io.emit('economy:balance-update', {
      userId: req.user.id,
      money: updatedUser.money,
      aura: updatedUser.aura,
    });
    
    res.json({
      success: true,
      transaction: {
        type: 'BUY',
        coinsReceived,
        moneySpent: moneyAmount,
        fee,
        newPrice: currentPrice,
      },
      newBalance: {
        money: updatedUser.money,
        auraCoin: updatedUser.auraCoinBalance,
      },
    });
  } catch (error) {
    console.error('Buy error:', error);
    res.status(500).json({ error: 'Failed to buy AuraCoin' });
  }
});

// Sell AuraCoin
router.post('/sell', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { coinAmount } = req.body;
    
    if (!coinAmount || coinAmount <= 0) {
      return res.status(400).json({ error: 'Invalid coin amount' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.auraCoinBalance < coinAmount) {
      return res.status(400).json({ error: 'Insufficient AuraCoin balance' });
    }
    
    // Calculate money received (before fee)
    const grossAmount = Math.floor(coinAmount * currentPrice);
    const fee = Math.floor(grossAmount * FEE_PERCENTAGE);
    const netAmount = grossAmount - fee;
    
    // Apply price impact (selling decreases price)
    const priceImpact = (grossAmount / 100) * PRICE_IMPACT_PER_100;
    currentPrice = Math.max(1, currentPrice * (1 - priceImpact));
    
    // Update user balance and create transaction
    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { increment: netAmount },
          auraCoinBalance: { decrement: coinAmount },
        },
      }),
      prisma.auraCoinTransaction.create({
        data: {
          userId: req.user.id,
          type: 'SELL',
          coinAmount,
          moneyAmount: netAmount,
          price: currentPrice,
          fee,
        },
      }),
    ]);
    
    // Save new price and broadcast
    await savePriceAndBroadcast(grossAmount);
    
    // Broadcast balance update
    io.emit('economy:balance-update', {
      userId: req.user.id,
      money: updatedUser.money,
      aura: updatedUser.aura,
    });
    
    res.json({
      success: true,
      transaction: {
        type: 'SELL',
        coinsSold: coinAmount,
        moneyReceived: netAmount,
        fee,
        newPrice: currentPrice,
      },
      newBalance: {
        money: updatedUser.money,
        auraCoin: updatedUser.auraCoinBalance,
      },
    });
  } catch (error) {
    console.error('Sell error:', error);
    res.status(500).json({ error: 'Failed to sell AuraCoin' });
  }
});

// Get user's transaction history
router.get('/transactions/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { limit = '50', offset = '0' } = req.query;
    
    const transactions = await prisma.auraCoinTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true },
        },
      },
    });
    
    res.json({ transactions });
  } catch (error) {
    console.error('Get my transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Get all transactions (global history)
router.get('/transactions/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    
    const transactions = await prisma.auraCoinTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true },
        },
      },
    });
    
    res.json({ transactions });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

export default router;
