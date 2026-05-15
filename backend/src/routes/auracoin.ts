import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logAuraCoin } from '../utils/logger.js';
import { createNotification } from '../utils/notifications.js';
import { emitSharedBalanceUpdates } from '../utils/shared-balance.js';

const router = Router();

// Configuration
const INITIAL_PRICE = 100;
const DEFAULT_FEE_PERCENTAGE = 0.02; // 2% fee
const MIN_FEE = 1; // Minimum fee in money units
const AURACOIN_BUY_FEE_PERCENTAGE_KEY = 'auracoin_buy_fee_percentage';
const PRICE_UPDATE_INTERVAL_MIN = 3500; // 3.5 seconds
const PRICE_UPDATE_INTERVAL_MAX = 8500; // 8.5 seconds
const MAX_LEVERAGE = 10; // Maximum leverage (x10)
const LIQUIDATION_THRESHOLD = 0.8; // Liquidate when margin drops to 80% of initial
const BASE_SPREAD_PERCENTAGE = 0.004; // 0.4%
const MAX_SPREAD_PERCENTAGE = 0.03; // 3%
const MAX_SLIPPAGE_PERCENTAGE = 0.02; // 2%

const parseAuraCoinFeePercentage = (rawValue: string | null | undefined): number => {
  if (!rawValue) return DEFAULT_FEE_PERCENTAGE;
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_FEE_PERCENTAGE;
  // Clamp to a safe [0, 50%] range.
  return Math.min(0.5, Math.max(0, parsed));
};

const getAuraCoinBuyFeePercentage = async (): Promise<number> => {
  const setting = await prisma.gameSettings.findUnique({
    where: { key: AURACOIN_BUY_FEE_PERCENTAGE_KEY },
    select: { value: true },
  });
  return parseAuraCoinFeePercentage(setting?.value);
};

// Current price in memory (will be persisted to DB)
let currentPrice = INITIAL_PRICE;
let lastMoveMagnitude = 0;

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

const secureRandomUnit = () => {
  const value = randomBytes(4).readUInt32BE(0);
  return value / 0xffffffff;
};

const secureRandomRange = (min: number, max: number) => {
  return min + (max - min) * secureRandomUnit();
};

const secureGaussian = () => {
  const u1 = Math.max(secureRandomUnit(), 1e-12);
  const u2 = secureRandomUnit();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const getDynamicSpread = () => {
  const volatilityPremium = Math.min(lastMoveMagnitude * 1.2, MAX_SPREAD_PERCENTAGE - BASE_SPREAD_PERCENTAGE);
  return Math.min(BASE_SPREAD_PERCENTAGE + volatilityPremium, MAX_SPREAD_PERCENTAGE);
};

const getExecutionPrice = (side: 'BUY' | 'SELL', referencePrice: number, tradeNotional: number) => {
  const spread = getDynamicSpread();
  const halfSpread = spread / 2;
  const sizeImpact = Math.min(tradeNotional / 50000, 1) * 0.01;
  const randomImpact = secureRandomRange(0, 0.003);
  const slippage = Math.min(sizeImpact + randomImpact, MAX_SLIPPAGE_PERCENTAGE);

  if (side === 'BUY') {
    return referencePrice * (1 + halfSpread + slippage);
  }

  return Math.max(1, referencePrice * (1 - halfSpread - slippage));
};

// Stochastic price engine with random regimes and occasional shocks.
const applyRandomVariation = () => {
  const regimeRoll = secureRandomUnit();
  const meanReversion = (INITIAL_PRICE - currentPrice) / INITIAL_PRICE;

  let volatility = 0.01;
  if (regimeRoll > 0.75 && regimeRoll <= 0.93) {
    volatility = 0.02;
  } else if (regimeRoll > 0.93 && regimeRoll <= 0.99) {
    volatility = 0.035;
  } else if (regimeRoll > 0.99) {
    volatility = 0.06;
  }

  const shockRoll = secureRandomUnit();
  let shock = 0;
  if (shockRoll > 0.985) {
    shock = secureRandomRange(-0.08, 0.08);
  }

  const randomMove = secureGaussian() * volatility;
  const reversionMove = meanReversion * 0.02;
  const totalMove = randomMove + reversionMove + shock;

  currentPrice = currentPrice * (1 + totalMove);
  currentPrice = Math.max(1, currentPrice);
  lastMoveMagnitude = Math.abs(totalMove);
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

const scheduleNextTick = () => {
  const nextDelay = Math.floor(secureRandomRange(PRICE_UPDATE_INTERVAL_MIN, PRICE_UPDATE_INTERVAL_MAX));
  priceInterval = setTimeout(async () => {
    applyRandomVariation();
    await savePriceAndBroadcast();
    await checkLiquidations(); // Check for liquidations on each price update

    if (priceInterval) {
      scheduleNextTick();
    }
  }, nextDelay);
};

export const stopPriceEngine = () => {
  if (priceInterval) {
    clearTimeout(priceInterval);
    priceInterval = null;
    console.log('AuraCoin price engine stopped');
  }
};

const MAX_CHART_POINTS = 250;

// Get current price and history
router.get('/price', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const feePercentage = await getAuraCoinBuyFeePercentage();
    const { hours = '24' } = req.query;
    const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);

    const allHistory = await prisma.auraCoinPrice.findMany({
      where: { createdAt: { gte: hoursAgo } },
      orderBy: { createdAt: 'asc' },
      select: { price: true, volume: true, createdAt: true },
    });

    let history: { price: number; volume: number; createdAt: Date | string }[];
    if (allHistory.length > MAX_CHART_POINTS) {
      const step = Math.ceil(allHistory.length / MAX_CHART_POINTS);
      history = allHistory.filter((_, i) => i % step === 0);
    } else {
      history = allHistory;
    }
    
    // Get user's balance
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { auraCoinBalance: true, money: true },
    });
    
    res.json({
      currentPrice,
      feePercentage,
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
    
    const feePercentage = await getAuraCoinBuyFeePercentage();

    // Calculate fee and coins received
    const fee = Math.max(MIN_FEE, Math.floor(moneyAmount * feePercentage));
    const netAmount = moneyAmount - fee;
    if (netAmount <= 0) {
      return res.status(400).json({ error: 'Amount too low to cover minimum fee' });
    }
    const tradePrice = getExecutionPrice('BUY', currentPrice, moneyAmount);
    const coinsReceived = netAmount / tradePrice;
    
    // Update user balance and create transaction
    const [updatedUser] = await prisma.$transaction([
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
          price: tradePrice,
          fee,
        },
      }),
    ]);
    
    // Save new price and broadcast
    await savePriceAndBroadcast(moneyAmount);
    
    await emitSharedBalanceUpdates(prisma, req.user.id);

    // Log buy
    logAuraCoin('auracoin_buy', req.user.id, user.username, {
      moneySpent: moneyAmount,
      coinsReceived,
      fee,
      priceAtPurchase: tradePrice,
    });

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: 'Achat AuraCoin',
      body: `Tu as achete ${coinsReceived.toFixed(4)} AuraCoin pour $${moneyAmount}.`,
      data: {
        type: 'BUY',
        moneySpent: moneyAmount,
        coinsReceived,
        fee,
        price: tradePrice,
      },
      link: '/games/aura-coin',
      icon: 'coins',
    }).catch(() => {});

    res.json({
      success: true,
      transaction: {
        type: 'BUY',
        coinsReceived,
        moneySpent: moneyAmount,
        fee,
        newPrice: tradePrice,
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
    
    const feePercentage = await getAuraCoinBuyFeePercentage();

    // Calculate money received (before fee)
    const tradePrice = getExecutionPrice('SELL', currentPrice, coinAmount * currentPrice);
    const grossAmount = Math.floor(coinAmount * tradePrice);
    const fee = Math.max(MIN_FEE, Math.floor(grossAmount * feePercentage));
    const netAmount = grossAmount - fee;
    if (netAmount <= 0) {
      return res.status(400).json({ error: 'Amount too low to cover minimum fee' });
    }
    
    // Update user balance and create transaction
    const [updatedUser] = await prisma.$transaction([
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
          price: tradePrice,
          fee,
        },
      }),
    ]);
    
    // Save new price and broadcast
    await savePriceAndBroadcast(grossAmount);
    
    await emitSharedBalanceUpdates(prisma, req.user.id);

    // Log sell
    logAuraCoin('auracoin_sell', req.user.id, user.username, {
      coinsSold: coinAmount,
      moneyReceived: netAmount,
      fee,
      priceAtSale: tradePrice,
    });

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: 'Vente AuraCoin',
      body: `Tu as vendu ${coinAmount.toFixed(4)} AuraCoin pour $${netAmount}.`,
      data: {
        type: 'SELL',
        coinsSold: coinAmount,
        moneyReceived: netAmount,
        fee,
        price: tradePrice,
      },
      link: '/games/aura-coin',
      icon: 'coins',
    }).catch(() => {});

    res.json({
      success: true,
      transaction: {
        type: 'SELL',
        coinsSold: coinAmount,
        moneyReceived: netAmount,
        fee,
        newPrice: tradePrice,
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

// Get AuraCoin leaderboard (top holders)
router.get('/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const take = Math.max(1, Math.min(parseInt(limit as string, 10) || 10, 100));

    const leaderboard = await prisma.user.findMany({
      where: { 
        auraCoinBalance: { gt: 0 },
        isSuperAdmin: false,
      },
      orderBy: { auraCoinBalance: 'desc' },
      take,
      select: {
        id: true,
        username: true,
        usernameColor: true,
        auraCoinBalance: true,
      },
    });

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get AuraCoin leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Calculate P&L for a position
const calculatePnL = (position: any, currentPrice: number): number => {
  if (position.type === 'LONG') {
    // coinAmount already represents notional exposure in coins.
    const priceChange = currentPrice - position.entryPrice;
    return Math.floor(priceChange * position.coinAmount);
  } else {
    // SHORT: Profit = (entryPrice - currentPrice) * coinAmount
    const priceChange = position.entryPrice - currentPrice;
    return Math.floor(priceChange * position.coinAmount);
  }
};

// Check and liquidate positions if needed
const checkLiquidations = async () => {
  try {
    const openPositions = await prisma.auraCoinPosition.findMany({
      where: { isOpen: true },
      include: { user: true },
    });

    for (const position of openPositions) {
      const pnlAmount = calculatePnL(position, currentPrice);
      const pnl = BigInt(pnlAmount);
      const currentMargin = position.marginAmount + pnl;
      const marginRatio = Number(currentMargin) / Number(position.marginAmount);

      // Liquidate if margin drops below threshold
      if (marginRatio <= LIQUIDATION_THRESHOLD) {
        await prisma.$transaction([
          prisma.auraCoinPosition.update({
            where: { id: position.id },
            data: {
              isOpen: false,
              closedAt: new Date(),
              exitPrice: currentPrice,
              pnl,
              liquidated: true,
            },
          }),
          prisma.user.update({
            where: { id: position.userId },
            data: {
              money: { increment: currentMargin > 0n ? currentMargin : 0n }, // Return remaining margin
            },
          }),
        ]);

        io.emit('auracoin:position-liquidated', {
          userId: position.userId,
          positionId: position.id,
        });

        createNotification({
          userId: position.userId,
          type: 'SYSTEM',
          title: 'Position liquidée',
          body: `Ta position ${position.type} x${position.leverage} a été liquidée.`,
          data: {
            positionId: position.id,
            type: position.type,
            leverage: position.leverage,
            exitPrice: currentPrice,
            pnl,
          },
          link: '/games/aura-coin',
          icon: 'triangle-alert',
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Liquidation check error:', error);
  }
};

// Open a leveraged position (LONG or SHORT)
router.post('/position/open', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { type, leverage, marginAmount } = req.body;

    if (!type || !['LONG', 'SHORT'].includes(type)) {
      return res.status(400).json({ error: 'Invalid position type. Must be LONG or SHORT' });
    }

    if (!leverage || leverage < 1 || leverage > MAX_LEVERAGE) {
      return res.status(400).json({ error: `Leverage must be between 1 and ${MAX_LEVERAGE}` });
    }

    if (!marginAmount || marginAmount <= 0) {
      return res.status(400).json({ error: 'Invalid margin amount' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.money < marginAmount) {
      return res.status(400).json({ error: 'Insufficient funds for margin' });
    }

    // Calculate notional value (position size)
    const notionalValue = marginAmount * leverage;
    const entrySide = type === 'LONG' ? 'BUY' : 'SELL';
    const entryPrice = getExecutionPrice(entrySide, currentPrice, notionalValue);
    const coinAmount = notionalValue / entryPrice;

    // Create position
    const position = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { money: { decrement: marginAmount } },
      }),
      prisma.auraCoinPosition.create({
        data: {
          userId: req.user.id,
          type,
          leverage,
          entryPrice,
          coinAmount,
          marginAmount,
        },
      }),
    ]);

    await emitSharedBalanceUpdates(prisma, req.user.id);

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: 'Position ouverte',
      body: `Position ${type} x${leverage} ouverte avec une marge de $${marginAmount}.`,
      data: {
        positionId: position[1].id,
        type,
        leverage,
        marginAmount,
        entryPrice,
      },
      link: '/games/aura-coin',
      icon: 'chart-candlestick',
    }).catch(() => {});

    res.json({
      success: true,
      position: {
        id: position[1].id,
        type: position[1].type,
        leverage: position[1].leverage,
        entryPrice: position[1].entryPrice,
        coinAmount: position[1].coinAmount,
        marginAmount: position[1].marginAmount,
        createdAt: position[1].createdAt,
      },
      newBalance: {
        money: position[0].money,
      },
    });
  } catch (error) {
    console.error('Open position error:', error);
    res.status(500).json({ error: 'Failed to open position' });
  }
});

// Close a position
router.post('/position/close/:positionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { positionId } = req.params;

    const position = await prisma.auraCoinPosition.findUnique({
      where: { id: positionId },
      include: { user: true },
    });

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    if (position.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!position.isOpen) {
      return res.status(400).json({ error: 'Position is already closed' });
    }

    const closeSide = position.type === 'LONG' ? 'SELL' : 'BUY';
    const closePrice = getExecutionPrice(closeSide, currentPrice, position.coinAmount * currentPrice);

    // Calculate P&L
    const pnlAmount = calculatePnL(position, closePrice);
    const pnl = BigInt(pnlAmount);
    const totalReturn = position.marginAmount + pnl;

    // Close position and return funds
    const [updatedPosition, updatedUser] = await prisma.$transaction([
      prisma.auraCoinPosition.update({
        where: { id: positionId },
        data: {
          isOpen: false,
          closedAt: new Date(),
          exitPrice: closePrice,
          pnl,
        },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          money: { increment: totalReturn > 0n ? totalReturn : 0n }, // Ensure non-negative
        },
      }),
    ]);

    await emitSharedBalanceUpdates(prisma, req.user.id);

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: 'Position fermee',
      body: `Position fermee avec un P&L de $${pnl}.`,
      data: {
        positionId: updatedPosition.id,
        pnl,
        exitPrice: closePrice,
        totalReturn,
      },
      link: '/games/aura-coin',
      icon: 'chart-no-axes-column',
    }).catch(() => {});

    res.json({
      success: true,
      position: {
        id: updatedPosition.id,
        pnl: updatedPosition.pnl,
        exitPrice: updatedPosition.exitPrice,
        closedAt: updatedPosition.closedAt,
      },
      newBalance: {
        money: updatedUser.money,
      },
    });
  } catch (error) {
    console.error('Close position error:', error);
    res.status(500).json({ error: 'Failed to close position' });
  }
});

// Get user's open positions
router.get('/positions/open', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const positions = await prisma.auraCoinPosition.findMany({
      where: {
        userId: req.user.id,
        isOpen: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate current P&L for each position
    const positionsWithPnL = positions.map(pos => {
      const pnlAmount = calculatePnL(pos, currentPrice);
      const marginNum = Number(pos.marginAmount);
      const currentMargin = marginNum + pnlAmount;
      const marginRatio = currentMargin / marginNum;
      const pnlPercentage = (pnlAmount / marginNum) * 100;

      return {
        ...pos,
        currentPrice,
        pnl: pnlAmount,
        currentMargin,
        marginRatio,
        pnlPercentage,
        marginAmount: marginNum,
      };
    });

    res.json({ positions: positionsWithPnL });
  } catch (error) {
    console.error('Get open positions error:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

// Get user's closed positions
router.get('/positions/closed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { limit = '50', offset = '0' } = req.query;

    const positions = await prisma.auraCoinPosition.findMany({
      where: {
        userId: req.user.id,
        isOpen: false,
      },
      orderBy: { closedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({ positions });
  } catch (error) {
    console.error('Get closed positions error:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

// Update price engine to check liquidations
export const startPriceEngine = () => {
  initializePrice();

  if (priceInterval) {
    clearTimeout(priceInterval);
    priceInterval = null;
  }

  scheduleNextTick();
  
  console.log('AuraCoin price engine started');
};

export default router;
