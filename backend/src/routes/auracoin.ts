import { Router, Response } from 'express';
import { prisma, io } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logAuraCoin } from '../utils/logger.js';
import { createNotification } from '../utils/notifications.js';
import { emitSharedBalanceUpdates } from '../utils/shared-balance.js';

const router = Router();

// =====================================================================
// CONSTANTS
// =====================================================================
const GPU_BASE = 5;
const BLOCK_TARGET_MS = 3 * 60 * 1000; // 3 minutes
const INITIAL_REWARD = 2; // AuraCoin per block
const HALVING_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
const GPU_PRICE_BASE = 2500;
const GPU_PRICE_RATIO = 1.16;
const GPU_MAX = 250;
const GPU_DAILY_FEE = 250; // $ per GPU per day
const WHALE_THRESHOLD = 50_000_000; // $50M wealth → extra tax
const WHALE_EXTRA_FEE = 0.01; // +1% for whales
const AMM_FEE = 0.02; // 2% base fee
const HYPE_FACTOR = 0.015;
const SYSTEM_START_KEY = 'auracoin_system_start';
const INITIAL_COIN_X = 10_000;
const INITIAL_MONEY_Y = 20_000_000;
const MAX_HISTORY_POINTS = 300;
const MAX_LEVERAGE = 10;
const LIQUIDATION_THRESHOLD = 0.2;

// =====================================================================
// SYSTEM START DATE (stored in GameSettings so it persists)
// =====================================================================
let systemStartDate: Date | null = null;

const getSystemStartDate = async (): Promise<Date> => {
  if (systemStartDate) return systemStartDate;
  const setting = await prisma.gameSettings.findUnique({ where: { key: SYSTEM_START_KEY } });
  if (setting) {
    systemStartDate = new Date(setting.value);
  } else {
    systemStartDate = new Date();
    await prisma.gameSettings.create({ data: { key: SYSTEM_START_KEY, value: systemStartDate.toISOString() } });
  }
  return systemStartDate;
};

// =====================================================================
// AMM HELPERS
// =====================================================================
const getPool = async () => {
  let pool = await prisma.auraCoinPool.findUnique({ where: { id: 'main' } });
  if (!pool) {
    pool = await prisma.auraCoinPool.create({
      data: { id: 'main', coinX: INITIAL_COIN_X, moneyY: INITIAL_MONEY_Y },
    });
  }
  return pool;
};

const poolPrice = (coinX: number, moneyY: number) => moneyY / coinX;

const getMarkPrice = async (): Promise<number> => {
  const pool = await getPool();
  return poolPrice(pool.coinX, pool.moneyY);
};

const getExecutionPrice = (
  side: 'BUY' | 'SELL',
  markPrice: number,
  _notionalValue: number,
): number => (side === 'BUY' ? markPrice * (1 + AMM_FEE / 2) : markPrice * (1 - AMM_FEE / 2));

const hypePrice = async (base: number): Promise<number> => {
  const count = await prisma.user.count({ where: { isSuperAdmin: false } });
  return base * (1 + Math.log(count + 1) * HYPE_FACTOR);
};

const halvings = async (): Promise<number> => {
  const start = await getSystemStartDate();
  return Math.floor((Date.now() - start.getTime()) / HALVING_INTERVAL_MS);
};

const currentReward = async (): Promise<number> => {
  const n = await halvings();
  return INITIAL_REWARD * Math.pow(0.5, n);
};

// =====================================================================
// GPU HELPERS
// =====================================================================
const gpuPower = (count: number) => GPU_BASE * Math.log(1 + count);

const nextGpuCost = (currentCount: number): number =>
  GPU_PRICE_BASE * Math.pow(GPU_PRICE_RATIO, currentCount + 1);

// Deduct daily GPU maintenance fees since last payment (lazy).
const deductGpuFees = async (userId: string): Promise<number> => {
  const miner = await prisma.gpuMiner.findUnique({ where: { userId } });
  if (!miner || miner.gpuCount === 0) return 0;

  const now = new Date();
  const daysSince = (now.getTime() - miner.lastFeePaidAt.getTime()) / 86_400_000;
  const daysOwed = Math.floor(daysSince);
  if (daysOwed <= 0) return 0;

  const totalFee = daysOwed * miner.gpuCount * GPU_DAILY_FEE;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  if (!user) return 0;

  const actualFee = Math.min(totalFee, Number(user.money));

  await prisma.$transaction(async (tx) => {
    await tx.gpuMiner.update({ where: { userId }, data: { lastFeePaidAt: now } });
    if (actualFee > 0) {
      await tx.user.update({ where: { id: userId }, data: { money: { decrement: BigInt(Math.floor(actualFee)) } } });
      await tx.auraCoinTransaction.create({
        data: {
          userId,
          type: 'GPU_FEE',
          coinAmount: 0,
          moneyAmount: -Math.floor(actualFee),
          price: 0,
          fee: Math.floor(actualFee),
        },
      });
    }
  });

  return actualFee;
};

// Extra fee for wallets > $50M total wealth.
const whaleTaxRate = async (userId: string, price: number): Promise<number> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { money: true, auraCoinBalance: true },
  });
  if (!user) return 0;
  const wealth = Number(user.money) + user.auraCoinBalance * price;
  return wealth > WHALE_THRESHOLD ? WHALE_EXTRA_FEE : 0;
};

// =====================================================================
// MINING LOOP
// =====================================================================
let miningInterval: NodeJS.Timeout | null = null;

const mineBlock = async () => {
  try {
    const miners = await prisma.gpuMiner.findMany({
      where: { gpuCount: { gt: 0 } },
      include: { user: { select: { id: true, username: true, usernameColor: true } } },
    });
    if (miners.length === 0) return;

    const powered = miners.map((m) => ({ ...m, power: gpuPower(m.gpuCount) }));
    const totalPower = powered.reduce((s, m) => s + m.power, 0);
    if (totalPower === 0) return;

    // Weighted random selection
    let roll = Math.random() * totalPower;
    let winner = powered[powered.length - 1];
    for (const m of powered) {
      roll -= m.power;
      if (roll <= 0) {
        winner = m;
        break;
      }
    }

    const pool = await getPool();
    const reward = await currentReward();
    const price = poolPrice(pool.coinX, pool.moneyY);
    const newBlockNumber = pool.blockNumber + 1;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: winner.userId },
        data: { auraCoinBalance: { increment: reward } },
      }),
      prisma.gpuMiner.update({
        where: { userId: winner.userId },
        data: { totalMined: { increment: reward } },
      }),
      prisma.auraCoinPool.update({
        where: { id: 'main' },
        data: { blockNumber: { increment: 1 }, totalMined: { increment: reward } },
      }),
      prisma.auraCoinTransaction.create({
        data: {
          userId: winner.userId,
          type: 'MINE_REWARD',
          coinAmount: reward,
          moneyAmount: 0,
          price,
          fee: 0,
        },
      }),
    ]);

    await prisma.miningBlock.create({
      data: {
        blockNumber: newBlockNumber,
        minerId: winner.userId,
        minerName: winner.user.username,
        reward,
        difficulty: 1,
      },
    });

    // Price snapshot for chart
    await prisma.auraCoinPrice.create({ data: { price, volume: 0 } });

    io.emit('auracoin:block-mined', {
      blockNumber: newBlockNumber,
      minerId: winner.userId,
      minerName: winner.user.username,
      minerColor: winner.user.usernameColor,
      reward,
      timestamp: new Date().toISOString(),
    });

    await emitSharedBalanceUpdates(prisma, winner.userId);

    createNotification({
      userId: winner.userId,
      type: 'SYSTEM',
      title: `Bloc #${newBlockNumber} miné!`,
      body: `Tu as miné ${reward.toFixed(4)} AuraCoin.`,
      data: { blockNumber: newBlockNumber, reward },
      link: '/games/aura-coin',
      icon: 'cpu',
    }).catch(() => {});

    logAuraCoin('block_mined', winner.userId, winner.user.username, {
      blockNumber: newBlockNumber,
      reward,
      totalPower,
      gpuCount: winner.gpuCount,
    });
  } catch (err) {
    console.error('Mining block error:', err);
  }
};

export const startPriceEngine = () => {
  // Initialize pool asynchronously (non-blocking)
  Promise.all([getPool(), getSystemStartDate()]).catch(console.error);
  miningInterval = setInterval(mineBlock, BLOCK_TARGET_MS);
  console.log('AuraCoin mining engine started (3-min blocks)');
};

export const stopPriceEngine = () => {
  if (miningInterval) {
    clearInterval(miningInterval);
    miningInterval = null;
    console.log('AuraCoin mining engine stopped');
  }
};

// =====================================================================
// ROUTES
// =====================================================================

// GET /price – current price, pool state, chart history, user balances
router.get('/price', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const since = new Date(Date.now() - parseInt(hours as string) * 3_600_000);

    const [pool, user, rawHistory, userCount] = await Promise.all([
      getPool(),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { auraCoinBalance: true, money: true },
      }),
      prisma.auraCoinPrice.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { price: true, volume: true, createdAt: true },
      }),
      prisma.user.count({ where: { isSuperAdmin: false } }),
    ]);

    const base = poolPrice(pool.coinX, pool.moneyY);
    const displayed = base * (1 + Math.log(userCount + 1) * HYPE_FACTOR);

    // Downsample history if too many points
    const history =
      rawHistory.length > MAX_HISTORY_POINTS
        ? rawHistory.filter((_, i) => i % Math.ceil(rawHistory.length / MAX_HISTORY_POINTS) === 0)
        : rawHistory;

    const n = await halvings();
    const reward = INITIAL_REWARD * Math.pow(0.5, n);

    res.json({
      currentPrice: displayed,
      basePrice: base,
      feePercentage: AMM_FEE,
      history,
      pool: {
        coinX: pool.coinX,
        moneyY: pool.moneyY,
        k: pool.coinX * pool.moneyY,
        totalMined: pool.totalMined,
        blockNumber: pool.blockNumber,
      },
      mining: {
        currentReward: reward,
        halvings: n,
        nextHalvingMs: HALVING_INTERVAL_MS - ((Date.now() - (await getSystemStartDate()).getTime()) % HALVING_INTERVAL_MS),
      },
      userBalance: {
        auraCoin: user?.auraCoinBalance ?? 0,
        money: user?.money ?? 0,
      },
    });
  } catch (err) {
    console.error('Get price error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /buy – AMM buy with 2% fee (+ whale tax)
router.post('/buy', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { moneyAmount } = req.body;
    if (!moneyAmount || moneyAmount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (Number(user.money) < moneyAmount) return res.status(400).json({ error: 'Solde insuffisant' });

    const pool = await getPool();
    const price = poolPrice(pool.coinX, pool.moneyY);
    const extraFee = await whaleTaxRate(req.user!.id, price);
    const totalFeeRate = AMM_FEE + extraFee;

    const fee = Math.floor(moneyAmount * totalFeeRate);
    const netMoney = moneyAmount - fee;
    if (netMoney <= 0) return res.status(400).json({ error: 'Montant trop faible' });

    const k = pool.coinX * pool.moneyY;
    const newMoneyY = pool.moneyY + netMoney;
    const newCoinX = k / newMoneyY;
    const coinsOut = pool.coinX - newCoinX;
    if (coinsOut <= 0) return res.status(400).json({ error: 'Liquidité insuffisante' });

    const executionPrice = netMoney / coinsOut;

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user!.id },
        data: { money: { decrement: BigInt(moneyAmount) }, auraCoinBalance: { increment: coinsOut } },
      }),
      prisma.auraCoinPool.update({ where: { id: 'main' }, data: { coinX: newCoinX, moneyY: newMoneyY } }),
      prisma.auraCoinTransaction.create({
        data: { userId: req.user!.id, type: 'BUY', coinAmount: coinsOut, moneyAmount, price: executionPrice, fee },
      }),
    ]);

    const newPrice = newMoneyY / newCoinX;
    await prisma.auraCoinPrice.create({ data: { price: newPrice, volume: moneyAmount } });
    io.emit('auracoin:price-update', { price: newPrice, timestamp: new Date().toISOString() });
    await emitSharedBalanceUpdates(prisma, req.user!.id);

    logAuraCoin('auracoin_buy', req.user!.id, user.username, {
      moneySpent: moneyAmount,
      coinsReceived: coinsOut,
      fee,
      price: executionPrice,
    });

    createNotification({
      userId: req.user!.id,
      type: 'SYSTEM',
      title: 'Achat AuraCoin',
      body: `${coinsOut.toFixed(4)} AuraCoin achetés pour $${moneyAmount.toLocaleString()}.`,
      data: { type: 'BUY', moneySpent: moneyAmount, coinsReceived: coinsOut, fee, price: executionPrice },
      link: '/games/aura-coin',
      icon: 'coins',
    }).catch(() => {});

    res.json({
      success: true,
      coinsReceived: coinsOut,
      moneySpent: moneyAmount,
      fee,
      executionPrice,
      newPrice,
      newBalance: { money: updatedUser.money, auraCoin: updatedUser.auraCoinBalance },
    });
  } catch (err) {
    console.error('Buy error:', err);
    res.status(500).json({ error: "Erreur lors de l'achat" });
  }
});

// POST /sell – AMM sell with 2% fee (+ whale tax)
router.post('/sell', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { coinAmount } = req.body;
    if (!coinAmount || coinAmount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.auraCoinBalance < coinAmount) return res.status(400).json({ error: 'Solde AuraCoin insuffisant' });

    const pool = await getPool();
    const price = poolPrice(pool.coinX, pool.moneyY);
    const extraFee = await whaleTaxRate(req.user!.id, price);
    const totalFeeRate = AMM_FEE + extraFee;

    const k = pool.coinX * pool.moneyY;
    const newCoinX = pool.coinX + coinAmount;
    const newMoneyY = k / newCoinX;
    const grossMoney = pool.moneyY - newMoneyY;
    if (grossMoney <= 0) return res.status(400).json({ error: 'Liquidité insuffisante' });

    const fee = Math.floor(grossMoney * totalFeeRate);
    const netMoney = Math.floor(grossMoney - fee);
    const executionPrice = grossMoney / coinAmount;

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user!.id },
        data: { money: { increment: BigInt(netMoney) }, auraCoinBalance: { decrement: coinAmount } },
      }),
      prisma.auraCoinPool.update({ where: { id: 'main' }, data: { coinX: newCoinX, moneyY: newMoneyY } }),
      prisma.auraCoinTransaction.create({
        data: { userId: req.user!.id, type: 'SELL', coinAmount, moneyAmount: netMoney, price: executionPrice, fee },
      }),
    ]);

    const newPrice = newMoneyY / newCoinX;
    await prisma.auraCoinPrice.create({ data: { price: newPrice, volume: netMoney } });
    io.emit('auracoin:price-update', { price: newPrice, timestamp: new Date().toISOString() });
    await emitSharedBalanceUpdates(prisma, req.user!.id);

    logAuraCoin('auracoin_sell', req.user!.id, user.username, {
      coinsSold: coinAmount,
      moneyReceived: netMoney,
      fee,
      price: executionPrice,
    });

    createNotification({
      userId: req.user!.id,
      type: 'SYSTEM',
      title: 'Vente AuraCoin',
      body: `${coinAmount.toFixed(4)} AuraCoin vendus pour $${netMoney.toLocaleString()}.`,
      data: { type: 'SELL', coinsSold: coinAmount, moneyReceived: netMoney, fee, price: executionPrice },
      link: '/games/aura-coin',
      icon: 'coins',
    }).catch(() => {});

    res.json({
      success: true,
      coinsSold: coinAmount,
      moneyReceived: netMoney,
      fee,
      executionPrice,
      newPrice,
      newBalance: { money: updatedUser.money, auraCoin: updatedUser.auraCoinBalance },
    });
  } catch (err) {
    console.error('Sell error:', err);
    res.status(500).json({ error: 'Erreur lors de la vente' });
  }
});

// GET /mining/stats – user GPU info + server-wide stats
router.get('/mining/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await deductGpuFees(req.user!.id);

    const [miner, allMiners, pool, recentBlocks] = await Promise.all([
      prisma.gpuMiner.findUnique({ where: { userId: req.user!.id } }),
      prisma.gpuMiner.findMany({ where: { gpuCount: { gt: 0 } } }),
      getPool(),
      prisma.miningBlock.findMany({
        orderBy: { blockNumber: 'desc' },
        take: 10,
        select: { blockNumber: true, minedAt: true, minerId: true, minerName: true, reward: true },
      }),
    ]);

    const myGpus = miner?.gpuCount ?? 0;
    const myPower = gpuPower(myGpus);
    const totalPower = allMiners.reduce((s, m) => s + gpuPower(m.gpuCount), 0);
    const myShare = totalPower > 0 ? myPower / totalPower : 0;
    const reward = await currentReward();
    const n = await halvings();
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { money: true } });

    res.json({
      myMiner: {
        gpuCount: myGpus,
        power: myPower,
        share: myShare,
        totalMined: miner?.totalMined ?? 0,
        dailyFee: myGpus * GPU_DAILY_FEE,
        nextGpuCost: Math.floor(nextGpuCost(myGpus)),
        canAffordNext: Number(user?.money ?? 0) >= Math.floor(nextGpuCost(myGpus)),
      },
      server: {
        totalPower,
        activeMiners: allMiners.length,
        blockNumber: pool.blockNumber,
        totalMined: pool.totalMined,
        currentReward: reward,
        halvings: n,
        blockIntervalMs: BLOCK_TARGET_MS,
      },
      recentBlocks,
      gpuMax: GPU_MAX,
    });
  } catch (err) {
    console.error('Mining stats error:', err);
    res.status(500).json({ error: 'Erreur stats minage' });
  }
});

// POST /mining/buy-gpu – purchase one GPU
router.post('/mining/buy-gpu', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await deductGpuFees(req.user!.id);

    const miner = await prisma.gpuMiner.findUnique({ where: { userId: req.user!.id } });
    const currentGpus = miner?.gpuCount ?? 0;

    if (currentGpus >= GPU_MAX)
      return res.status(400).json({ error: `Maximum de ${GPU_MAX} GPUs atteint` });

    const cost = Math.floor(nextGpuCost(currentGpus));
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { money: true, username: true },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (Number(user.money) < cost)
      return res.status(400).json({ error: `Solde insuffisant. Coût: $${cost.toLocaleString()}` });

    const newGpuCount = currentGpus + 1;

    await prisma.$transaction([
      miner
        ? prisma.gpuMiner.update({ where: { userId: req.user!.id }, data: { gpuCount: newGpuCount } })
        : prisma.gpuMiner.create({ data: { userId: req.user!.id, gpuCount: 1 } }),
      prisma.user.update({ where: { id: req.user!.id }, data: { money: { decrement: BigInt(cost) } } }),
      prisma.auraCoinTransaction.create({
        data: { userId: req.user!.id, type: 'GPU_PURCHASE', coinAmount: 0, moneyAmount: -cost, price: 0, fee: 0 },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { money: true },
    });
    await emitSharedBalanceUpdates(prisma, req.user!.id);

    logAuraCoin('gpu_purchase', req.user!.id, user.username, { gpuCount: newGpuCount, cost });

    res.json({
      success: true,
      newGpuCount,
      cost,
      nextGpuCost: Math.floor(nextGpuCost(newGpuCount)),
      newBalance: { money: updatedUser?.money ?? 0 },
    });
  } catch (err) {
    console.error('Buy GPU error:', err);
    res.status(500).json({ error: 'Erreur achat GPU' });
  }
});

// GET /mining/leaderboard – top miners by total mined
router.get('/mining/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const miners = await prisma.gpuMiner.findMany({
      where: { gpuCount: { gt: 0 } },
      orderBy: { totalMined: 'desc' },
      take: 20,
      include: { user: { select: { id: true, username: true, usernameColor: true } } },
    });
    const totalPower = miners.reduce((s, m) => s + gpuPower(m.gpuCount), 0);

    res.json({
      leaderboard: miners.map((m) => ({
        userId: m.userId,
        username: m.user.username,
        usernameColor: m.user.usernameColor,
        gpuCount: m.gpuCount,
        power: gpuPower(m.gpuCount),
        share: totalPower > 0 ? gpuPower(m.gpuCount) / totalPower : 0,
        totalMined: m.totalMined,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mining leaderboard' });
  }
});

// GET /transactions/me
router.get('/transactions/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const transactions = await prisma.auraCoinTransaction.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: { user: { select: { id: true, username: true, usernameColor: true } } },
    });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Erreur transactions' });
  }
});

// GET /transactions/all – only BUY/SELL visible globally
router.get('/transactions/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const transactions = await prisma.auraCoinTransaction.findMany({
      where: { type: { in: ['BUY', 'SELL'] } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: { user: { select: { id: true, username: true, usernameColor: true } } },
    });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Erreur transactions' });
  }
});

// GET /leaderboard – top holders by balance
router.get('/leaderboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '20' } = req.query;
    const take = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const users = await prisma.user.findMany({
      where: { auraCoinBalance: { gt: 0 }, isSuperAdmin: false },
      orderBy: { auraCoinBalance: 'desc' },
      take,
      select: {
        id: true,
        username: true,
        usernameColor: true,
        auraCoinBalance: true,
      },
    });

    res.json({ leaderboard: users });
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
    const currentPrice = await getMarkPrice();
    const openPositions = await prisma.auraCoinPosition.findMany({
      where: { isOpen: true },
      include: { user: true },
    });

    for (const position of openPositions) {
      const pnl = calculatePnL(position, currentPrice);
      const currentMargin = position.marginAmount + pnl;
      const marginRatio = currentMargin / position.marginAmount;

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
              money: { increment: Math.max(0, currentMargin) }, // Return remaining margin
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
    const currentPrice = await getMarkPrice();
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

    const currentPrice = await getMarkPrice();
    const closeSide = position.type === 'LONG' ? 'SELL' : 'BUY';
    const closePrice = getExecutionPrice(closeSide, currentPrice, position.coinAmount * currentPrice);

    // Calculate P&L
    const pnl = calculatePnL(position, closePrice);
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
          money: { increment: Math.max(0, totalReturn) }, // Ensure non-negative
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
    const currentPrice = await getMarkPrice();

    // Calculate current P&L for each position
    const positionsWithPnL = positions.map(pos => {
      const pnl = calculatePnL(pos, currentPrice);
      const currentMargin = pos.marginAmount + pnl;
      const marginRatio = currentMargin / pos.marginAmount;
      const pnlPercentage = (pnl / pos.marginAmount) * 100;

      return {
        ...pos,
        currentPrice,
        pnl,
        currentMargin,
        marginRatio,
        pnlPercentage,
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
      select: {
        id: true,
        type: true,
        leverage: true,
        entryPrice: true,
        exitPrice: true,
        coinAmount: true,
        marginAmount: true,
        pnl: true,
        liquidated: true,
        createdAt: true,
        closedAt: true,
      },
    });
    res.json({ positions });
  } catch (err) {
    res.status(500).json({ error: 'Erreur positions fermées' });
  }
});

export default router;
