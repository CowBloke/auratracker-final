import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { emitSharedBalanceUpdates } from '../utils/sharedBalance.js';

const router = Router();

const MIN_FEE = 1;
const MAX_CHART_POINTS = 250;

type CoinKey = 'stable-coin' | 'chaos-coin';

type CoinConfig = {
  key: CoinKey;
  name: string;
  symbol: string;
  description: string;
  personality: 'STABLE' | 'VOLATILE';
  initialPrice: number;
  defaultFeePercentage: number;
  feeSettingKey: string;
  priceUpdateIntervalMin: number;
  priceUpdateIntervalMax: number;
  maxLeverage: number;
  liquidationThreshold: number;
  baseSpreadPercentage: number;
  maxSpreadPercentage: number;
  maxSlippagePercentage: number;
  baseVolatility: number;
  midVolatility: number;
  highVolatility: number;
  extremeVolatility: number;
  shockChance: number;
  shockAmplitude: number;
  meanReversionStrength: number;
  color: string;
  pagePath: string;
};

type CoinRuntime = {
  currentPrice: number;
  lastMoveMagnitude: number;
  timer: NodeJS.Timeout | null;
};

const COIN_CONFIGS: Record<CoinKey, CoinConfig> = {
  'stable-coin': {
    key: 'stable-coin',
    name: 'Aura Stable',
    symbol: 'AUST',
    description: 'Stable coin avec volatilite tres faible, spreads serres et mouvements lisses autour de son prix cible.',
    personality: 'STABLE',
    initialPrice: 100,
    defaultFeePercentage: 0.01,
    feeSettingKey: 'stable_coin_buy_fee_percentage',
    priceUpdateIntervalMin: 4000,
    priceUpdateIntervalMax: 9000,
    maxLeverage: 5,
    liquidationThreshold: 0.88,
    baseSpreadPercentage: 0.0015,
    maxSpreadPercentage: 0.008,
    maxSlippagePercentage: 0.007,
    baseVolatility: 0.0012,
    midVolatility: 0.0024,
    highVolatility: 0.004,
    extremeVolatility: 0.0075,
    shockChance: 0.008,
    shockAmplitude: 0.012,
    meanReversionStrength: 0.08,
    color: '#22c55e',
    pagePath: '/games/stable-coin',
  },
  'chaos-coin': {
    key: 'chaos-coin',
    name: 'Chaos Coin',
    symbol: 'CHAO',
    description: 'Jeton ultra instable avec secousses frequentes, spreads larges et opportunites plus agressives.',
    personality: 'VOLATILE',
    initialPrice: 45,
    defaultFeePercentage: 0.035,
    feeSettingKey: 'chaos_coin_buy_fee_percentage',
    priceUpdateIntervalMin: 1800,
    priceUpdateIntervalMax: 4200,
    maxLeverage: 12,
    liquidationThreshold: 0.76,
    baseSpreadPercentage: 0.007,
    maxSpreadPercentage: 0.055,
    maxSlippagePercentage: 0.04,
    baseVolatility: 0.018,
    midVolatility: 0.035,
    highVolatility: 0.06,
    extremeVolatility: 0.1,
    shockChance: 0.05,
    shockAmplitude: 0.18,
    meanReversionStrength: 0.018,
    color: '#ef4444',
    pagePath: '/games/chaos-coin',
  },
};

const RUNTIME_STATE: Record<CoinKey, CoinRuntime> = {
  'stable-coin': { currentPrice: COIN_CONFIGS['stable-coin'].initialPrice, lastMoveMagnitude: 0, timer: null },
  'chaos-coin': { currentPrice: COIN_CONFIGS['chaos-coin'].initialPrice, lastMoveMagnitude: 0, timer: null },
};

const secureRandomUnit = () => {
  const value = randomBytes(4).readUInt32BE(0);
  return value / 0xffffffff;
};

const secureRandomRange = (min: number, max: number) => min + (max - min) * secureRandomUnit();

const secureGaussian = () => {
  const u1 = Math.max(secureRandomUnit(), 1e-12);
  const u2 = secureRandomUnit();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const isCoinKey = (value: string): value is CoinKey => value in COIN_CONFIGS;

const getCoinConfig = (coinKey: string): CoinConfig | null => (isCoinKey(coinKey) ? COIN_CONFIGS[coinKey] : null);

const parseFeePercentage = (rawValue: string | null | undefined, fallback: number) => {
  if (!rawValue) return fallback;
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(0.5, Math.max(0, parsed));
};

const getCoinFeePercentage = async (config: CoinConfig) => {
  const setting = await prisma.gameSettings.findUnique({
    where: { key: config.feeSettingKey },
    select: { value: true },
  });
  return parseFeePercentage(setting?.value, config.defaultFeePercentage);
};

const getDynamicSpread = (config: CoinConfig, state: CoinRuntime) => {
  const premium = Math.min(
    state.lastMoveMagnitude * (config.personality === 'VOLATILE' ? 1.4 : 0.8),
    config.maxSpreadPercentage - config.baseSpreadPercentage,
  );
  return Math.min(config.baseSpreadPercentage + premium, config.maxSpreadPercentage);
};

const getExecutionPrice = (config: CoinConfig, state: CoinRuntime, side: 'BUY' | 'SELL', referencePrice: number, tradeNotional: number) => {
  const spread = getDynamicSpread(config, state);
  const halfSpread = spread / 2;
  const sizeImpact = Math.min(tradeNotional / (config.personality === 'VOLATILE' ? 30000 : 80000), 1) * config.maxSlippagePercentage * 0.55;
  const randomImpact = secureRandomRange(0, config.maxSlippagePercentage * 0.25);
  const slippage = Math.min(sizeImpact + randomImpact, config.maxSlippagePercentage);

  if (side === 'BUY') {
    return referencePrice * (1 + halfSpread + slippage);
  }

  return Math.max(1, referencePrice * (1 - halfSpread - slippage));
};

const applyRandomVariation = (config: CoinConfig, state: CoinRuntime) => {
  const regimeRoll = secureRandomUnit();
  const meanReversion = (config.initialPrice - state.currentPrice) / config.initialPrice;

  let volatility = config.baseVolatility;
  if (regimeRoll > 0.72 && regimeRoll <= 0.92) {
    volatility = config.midVolatility;
  } else if (regimeRoll > 0.92 && regimeRoll <= 0.985) {
    volatility = config.highVolatility;
  } else if (regimeRoll > 0.985) {
    volatility = config.extremeVolatility;
  }

  let shock = 0;
  if (secureRandomUnit() <= config.shockChance) {
    shock = secureRandomRange(-config.shockAmplitude, config.shockAmplitude);
  }

  const randomMove = secureGaussian() * volatility;
  const reversionMove = meanReversion * config.meanReversionStrength;
  const totalMove = randomMove + reversionMove + shock;

  state.currentPrice = Math.max(1, state.currentPrice * (1 + totalMove));
  state.lastMoveMagnitude = Math.abs(totalMove);
};

const ensurePriceHistoryInitialized = async (config: CoinConfig) => {
  const latestPrice = await prisma.cryptoPrice.findFirst({
    where: { coinKey: config.key },
    orderBy: { createdAt: 'desc' },
  });

  if (latestPrice) {
    RUNTIME_STATE[config.key].currentPrice = latestPrice.price;
    return;
  }

  await prisma.cryptoPrice.create({
    data: {
      coinKey: config.key,
      price: config.initialPrice,
      volume: 0,
    },
  });
  RUNTIME_STATE[config.key].currentPrice = config.initialPrice;
};

const savePriceAndBroadcast = async (config: CoinConfig, volume = 0) => {
  const state = RUNTIME_STATE[config.key];
  await prisma.cryptoPrice.create({
    data: {
      coinKey: config.key,
      price: state.currentPrice,
      volume,
    },
  });

  io.emit(`market-room:${config.key}:price-update`, {
    coinKey: config.key,
    price: state.currentPrice,
    timestamp: new Date().toISOString(),
  });
};

const calculatePnL = (position: { type: string; entryPrice: number; coinAmount: number }, currentPrice: number) => {
  if (position.type === 'LONG') {
    return Math.floor((currentPrice - position.entryPrice) * position.coinAmount);
  }
  return Math.floor((position.entryPrice - currentPrice) * position.coinAmount);
};

const ensureBalanceRow = async (userId: string, coinKey: CoinKey) => {
  return prisma.userCryptoBalance.upsert({
    where: { userId_coinKey: { userId, coinKey } },
    create: { userId, coinKey, balance: 0 },
    update: {},
  });
};

const checkLiquidations = async (config: CoinConfig) => {
  const state = RUNTIME_STATE[config.key];
  const openPositions = await prisma.cryptoPosition.findMany({
    where: {
      coinKey: config.key,
      isOpen: true,
    },
  });

  for (const position of openPositions) {
    const pnl = calculatePnL(position, state.currentPrice);
    const currentMargin = position.marginAmount + pnl;
    const marginRatio = currentMargin / position.marginAmount;

    if (marginRatio > config.liquidationThreshold) continue;

    await prisma.$transaction(async (tx) => {
      await tx.cryptoPosition.update({
        where: { id: position.id },
        data: {
          isOpen: false,
          closedAt: new Date(),
          exitPrice: state.currentPrice,
          pnl,
          liquidated: true,
        },
      });

      await tx.user.update({
        where: { id: position.userId },
        data: {
          money: { increment: Math.max(0, currentMargin) },
        },
      });
    });

    io.emit(`market-room:${config.key}:position-liquidated`, {
      coinKey: config.key,
      userId: position.userId,
      positionId: position.id,
    });

    createNotification({
      userId: position.userId,
      type: 'SYSTEM',
      title: `${config.name} liquidé`,
      body: `Ta position ${position.type} x${position.leverage} sur ${config.name} a ete liquidee.`,
      data: {
        coinKey: config.key,
        positionId: position.id,
        pnl,
        exitPrice: state.currentPrice,
      },
      link: config.pagePath,
      icon: 'triangle-alert',
    }).catch(() => {});
  }
};

const scheduleNextTick = (config: CoinConfig) => {
  const state = RUNTIME_STATE[config.key];
  const delay = Math.floor(secureRandomRange(config.priceUpdateIntervalMin, config.priceUpdateIntervalMax));
  state.timer = setTimeout(async () => {
    try {
      applyRandomVariation(config, state);
      await savePriceAndBroadcast(config);
      await checkLiquidations(config);
    } catch (error) {
      console.error(`Failed ${config.key} tick:`, error);
    } finally {
      if (state.timer) {
        scheduleNextTick(config);
      }
    }
  }, delay);
};

export const startMarketRoomEngines = async () => {
  for (const config of Object.values(COIN_CONFIGS)) {
    await ensurePriceHistoryInitialized(config);
    if (RUNTIME_STATE[config.key].timer) {
      clearTimeout(RUNTIME_STATE[config.key].timer!);
      RUNTIME_STATE[config.key].timer = null;
    }
    scheduleNextTick(config);
  }
};

export const stopMarketRoomEngines = () => {
  for (const state of Object.values(RUNTIME_STATE)) {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }
};

router.get('/coins', authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.json({
    coins: Object.values(COIN_CONFIGS).map((config) => ({
      key: config.key,
      name: config.name,
      symbol: config.symbol,
      description: config.description,
      personality: config.personality,
      color: config.color,
    })),
  });
});

router.get('/:coinKey/price', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }

    const { hours = '24' } = req.query;
    const feePercentage = await getCoinFeePercentage(config);
    const state = RUNTIME_STATE[config.key];
    const hoursAgo = new Date(Date.now() - Number.parseInt(hours as string, 10) * 60 * 60 * 1000);

    const allHistory = await prisma.cryptoPrice.findMany({
      where: {
        coinKey: config.key,
        createdAt: { gte: hoursAgo },
      },
      orderBy: { createdAt: 'asc' },
      select: { price: true, volume: true, createdAt: true },
    });

    const history = allHistory.length > MAX_CHART_POINTS
      ? allHistory.filter((_, index) => index % Math.ceil(allHistory.length / MAX_CHART_POINTS) === 0)
      : allHistory;

    const [user, balance] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { money: true },
      }),
      ensureBalanceRow(req.user!.id, config.key),
    ]);

    res.json({
      currentPrice: state.currentPrice,
      feePercentage,
      history,
      userBalance: {
        coin: balance.balance,
        money: user?.money ?? 0,
      },
    });
  } catch (error) {
    console.error('Market room get price error:', error);
    res.status(500).json({ error: 'Failed to get price' });
  }
});

router.post('/:coinKey/buy', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { moneyAmount } = req.body;
    if (!moneyAmount || moneyAmount <= 0) {
      return res.status(400).json({ error: 'Invalid money amount' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, money: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.money < moneyAmount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const feePercentage = await getCoinFeePercentage(config);
    const fee = Math.max(MIN_FEE, Math.floor(moneyAmount * feePercentage));
    const netAmount = moneyAmount - fee;
    if (netAmount <= 0) {
      return res.status(400).json({ error: 'Amount too low to cover minimum fee' });
    }

    const state = RUNTIME_STATE[config.key];
    const tradePrice = getExecutionPrice(config, state, 'BUY', state.currentPrice, moneyAmount);
    const coinsReceived = netAmount / tradePrice;

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: req.user!.id },
        data: { money: { decrement: moneyAmount } },
        select: { money: true },
      });

      const updatedBalance = await tx.userCryptoBalance.upsert({
        where: { userId_coinKey: { userId: req.user!.id, coinKey: config.key } },
        create: {
          userId: req.user!.id,
          coinKey: config.key,
          balance: coinsReceived,
        },
        update: {
          balance: { increment: coinsReceived },
        },
        select: { balance: true },
      });

      await tx.cryptoTransaction.create({
        data: {
          userId: req.user!.id,
          coinKey: config.key,
          type: 'BUY',
          coinAmount: coinsReceived,
          moneyAmount,
          price: tradePrice,
          fee,
        },
      });

      return { updatedUser, updatedBalance };
    });

    await savePriceAndBroadcast(config, moneyAmount);
    await emitSharedBalanceUpdates(prisma, req.user.id);

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: `Achat ${config.name}`,
      body: `Tu as achete ${coinsReceived.toFixed(4)} ${config.symbol} pour $${moneyAmount}.`,
      data: { coinKey: config.key, coinsReceived, moneySpent: moneyAmount, fee, price: tradePrice },
      link: config.pagePath,
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
        money: result.updatedUser.money,
        coin: result.updatedBalance.balance,
      },
    });
  } catch (error) {
    console.error('Market room buy error:', error);
    res.status(500).json({ error: 'Failed to buy coin' });
  }
});

router.post('/:coinKey/sell', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { coinAmount } = req.body;
    if (!coinAmount || coinAmount <= 0) {
      return res.status(400).json({ error: 'Invalid coin amount' });
    }

    const [user, balance] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, money: true },
      }),
      ensureBalanceRow(req.user.id, config.key),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (balance.balance < coinAmount) {
      return res.status(400).json({ error: `Insufficient ${config.symbol} balance` });
    }

    const feePercentage = await getCoinFeePercentage(config);
    const state = RUNTIME_STATE[config.key];
    const tradePrice = getExecutionPrice(config, state, 'SELL', state.currentPrice, coinAmount * state.currentPrice);
    const grossAmount = Math.floor(coinAmount * tradePrice);
    const fee = Math.max(MIN_FEE, Math.floor(grossAmount * feePercentage));
    const netAmount = grossAmount - fee;
    if (netAmount <= 0) {
      return res.status(400).json({ error: 'Amount too low to cover minimum fee' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: req.user!.id },
        data: { money: { increment: netAmount } },
        select: { money: true },
      });

      const updatedBalance = await tx.userCryptoBalance.update({
        where: { userId_coinKey: { userId: req.user!.id, coinKey: config.key } },
        data: {
          balance: { decrement: coinAmount },
        },
        select: { balance: true },
      });

      await tx.cryptoTransaction.create({
        data: {
          userId: req.user!.id,
          coinKey: config.key,
          type: 'SELL',
          coinAmount,
          moneyAmount: netAmount,
          price: tradePrice,
          fee,
        },
      });

      return { updatedUser, updatedBalance };
    });

    await savePriceAndBroadcast(config, grossAmount);
    await emitSharedBalanceUpdates(prisma, req.user.id);

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: `Vente ${config.name}`,
      body: `Tu as vendu ${coinAmount.toFixed(4)} ${config.symbol} pour $${netAmount}.`,
      data: { coinKey: config.key, coinsSold: coinAmount, moneyReceived: netAmount, fee, price: tradePrice },
      link: config.pagePath,
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
        money: result.updatedUser.money,
        coin: result.updatedBalance.balance,
      },
    });
  } catch (error) {
    console.error('Market room sell error:', error);
    res.status(500).json({ error: 'Failed to sell coin' });
  }
});

router.get('/:coinKey/transactions/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    const { limit = '50', offset = '0' } = req.query;

    const transactions = await prisma.cryptoTransaction.findMany({
      where: {
        coinKey: config.key,
        userId: req.user!.id,
      },
      orderBy: { createdAt: 'desc' },
      take: Number.parseInt(limit as string, 10),
      skip: Number.parseInt(offset as string, 10),
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true },
        },
      },
    });

    res.json({ transactions });
  } catch (error) {
    console.error('Market room my transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

router.get('/:coinKey/transactions/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    const { limit = '50', offset = '0' } = req.query;

    const transactions = await prisma.cryptoTransaction.findMany({
      where: { coinKey: config.key },
      orderBy: { createdAt: 'desc' },
      take: Number.parseInt(limit as string, 10),
      skip: Number.parseInt(offset as string, 10),
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true },
        },
      },
    });

    res.json({ transactions });
  } catch (error) {
    console.error('Market room all transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

router.get('/:coinKey/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    const { limit = '10' } = req.query;
    const take = Math.max(1, Math.min(Number.parseInt(limit as string, 10) || 10, 100));

    const balances = await prisma.userCryptoBalance.findMany({
      where: {
        coinKey: config.key,
        balance: { gt: 0 },
        user: { isSuperAdmin: false },
      },
      orderBy: { balance: 'desc' },
      take,
      include: {
        user: {
          select: { id: true, username: true, usernameColor: true },
        },
      },
    });

    const leaderboard = balances.map((entry) => ({
      id: entry.user.id,
      username: entry.user.username,
      usernameColor: entry.user.usernameColor,
      coinBalance: entry.balance,
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Market room leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

router.post('/:coinKey/position/open', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { type, leverage, marginAmount } = req.body;

    if (!type || !['LONG', 'SHORT'].includes(type)) {
      return res.status(400).json({ error: 'Invalid position type. Must be LONG or SHORT' });
    }
    if (!leverage || leverage < 1 || leverage > config.maxLeverage) {
      return res.status(400).json({ error: `Leverage must be between 1 and ${config.maxLeverage}` });
    }
    if (!marginAmount || marginAmount <= 0) {
      return res.status(400).json({ error: 'Invalid margin amount' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { money: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.money < marginAmount) {
      return res.status(400).json({ error: 'Insufficient funds for margin' });
    }

    const state = RUNTIME_STATE[config.key];
    const notionalValue = marginAmount * leverage;
    const entrySide = type === 'LONG' ? 'BUY' : 'SELL';
    const entryPrice = getExecutionPrice(config, state, entrySide, state.currentPrice, notionalValue);
    const coinAmount = notionalValue / entryPrice;

    const [updatedUser, position] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { money: { decrement: marginAmount } },
        select: { money: true },
      }),
      prisma.cryptoPosition.create({
        data: {
          userId: req.user.id,
          coinKey: config.key,
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
      title: `Position ${config.name}`,
      body: `Position ${type} x${leverage} ouverte sur ${config.name}.`,
      data: { coinKey: config.key, positionId: position.id, leverage, marginAmount, entryPrice },
      link: config.pagePath,
      icon: 'chart-candlestick',
    }).catch(() => {});

    res.json({
      success: true,
      position: {
        id: position.id,
        type: position.type,
        leverage: position.leverage,
        entryPrice: position.entryPrice,
        coinAmount: position.coinAmount,
        marginAmount: position.marginAmount,
        createdAt: position.createdAt,
      },
      newBalance: {
        money: updatedUser.money,
      },
    });
  } catch (error) {
    console.error('Market room open position error:', error);
    res.status(500).json({ error: 'Failed to open position' });
  }
});

router.post('/:coinKey/position/close/:positionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const position = await prisma.cryptoPosition.findUnique({
      where: { id: req.params.positionId },
    });

    if (!position || position.coinKey !== config.key) {
      return res.status(404).json({ error: 'Position not found' });
    }
    if (position.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (!position.isOpen) {
      return res.status(400).json({ error: 'Position is already closed' });
    }

    const state = RUNTIME_STATE[config.key];
    const closeSide = position.type === 'LONG' ? 'SELL' : 'BUY';
    const closePrice = getExecutionPrice(config, state, closeSide, state.currentPrice, position.coinAmount * state.currentPrice);
    const pnl = calculatePnL(position, closePrice);
    const totalReturn = position.marginAmount + pnl;

    const [updatedPosition, updatedUser] = await prisma.$transaction([
      prisma.cryptoPosition.update({
        where: { id: position.id },
        data: {
          isOpen: false,
          closedAt: new Date(),
          exitPrice: closePrice,
          pnl,
        },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: { money: { increment: Math.max(0, totalReturn) } },
        select: { money: true },
      }),
    ]);

    await emitSharedBalanceUpdates(prisma, req.user.id);

    createNotification({
      userId: req.user.id,
      type: 'SYSTEM',
      title: `Position fermee ${config.name}`,
      body: `Position ${config.name} fermee avec un P&L de $${pnl}.`,
      data: { coinKey: config.key, positionId: position.id, pnl, exitPrice: closePrice },
      link: config.pagePath,
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
    console.error('Market room close position error:', error);
    res.status(500).json({ error: 'Failed to close position' });
  }
});

router.get('/:coinKey/positions/open', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }

    const state = RUNTIME_STATE[config.key];
    const positions = await prisma.cryptoPosition.findMany({
      where: {
        coinKey: config.key,
        userId: req.user!.id,
        isOpen: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      positions: positions.map((position) => {
        const pnl = calculatePnL(position, state.currentPrice);
        const currentMargin = position.marginAmount + pnl;
        const marginRatio = currentMargin / position.marginAmount;
        const pnlPercentage = (pnl / position.marginAmount) * 100;

        return {
          ...position,
          currentPrice: state.currentPrice,
          pnl,
          currentMargin,
          marginRatio,
          pnlPercentage,
        };
      }),
    });
  } catch (error) {
    console.error('Market room open positions error:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

router.get('/:coinKey/positions/closed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const config = getCoinConfig(req.params.coinKey);
    if (!config) {
      return res.status(404).json({ error: 'Unknown coin' });
    }
    const { limit = '50', offset = '0' } = req.query;

    const positions = await prisma.cryptoPosition.findMany({
      where: {
        coinKey: config.key,
        userId: req.user!.id,
        isOpen: false,
      },
      orderBy: { closedAt: 'desc' },
      take: Number.parseInt(limit as string, 10),
      skip: Number.parseInt(offset as string, 10),
    });

    res.json({ positions });
  } catch (error) {
    console.error('Market room closed positions error:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

export default router;
