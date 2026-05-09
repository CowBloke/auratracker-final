import { Router, type Response } from 'express';
import { type PrismaClient, type Prisma } from '@prisma/client';
import { authMiddleware, adminMiddleware, type AuthRequest } from '../middleware/auth.js';
import { prisma, io } from '../server.js';
import { emitSharedBalanceUpdates } from '../utils/shared-balance.js';

const router = Router();

const TIER_CONFIG = {
  BRONZE: { cost: 500, tickets: 1, maxParticipations: 10 },
  ARGENT: { cost: 700, tickets: 4, maxParticipations: 8 },
  OR: { cost: 900, tickets: 10, maxParticipations: 6 },
  PLATINE: { cost: 1200, tickets: 25, maxParticipations: 4 },
  VIP: { cost: 1700, tickets: 60, maxParticipations: 2 },
} as const;

const BRAQUAGE_LEGAL_STATUS = {
  ACTIVE: 'ACTIVE',
  DRAWN: 'DRAWN',
  CANCELLED: 'CANCELLED',
} as const;

const WINNER_SHARE = 0.7;
const OWNER_SHARE = 0.3;
const DRAW_EVENT = 'braquage-legal:drawn';

type BraquageLegalTierKey = keyof typeof TIER_CONFIG;
type BraquageLegalStatusKey = keyof typeof BRAQUAGE_LEGAL_STATUS;
type DbClient = PrismaClient | Prisma.TransactionClient;

type BraquageLegalOwner = {
  id: string;
  username: string;
  profilePicture: string | null;
};

type BraquageLegalUserParticipationSummary = {
  tier: BraquageLegalTierKey;
  participationCount: number;
  ticketCount: number;
  amount: number;
};

type BraquageLegalCurrentSessionResponse = {
  id: number;
  status: BraquageLegalStatusKey;
  startTime: string;
  endTime: string;
  isExpired: boolean;
  totalPool: number;
  participationsCount: number;
  ticketPool: number;
  owner: BraquageLegalOwner | null;
  userParticipations: BraquageLegalUserParticipationSummary[];
};

type BraquageLegalHistoryEntry = {
  id: number;
  status: BraquageLegalStatusKey;
  totalPool: number;
  winnerPayout: number | null;
  ownerPayout: number | null;
  endTime: string;
  winner: BraquageLegalOwner | null;
};

type BraquageLegalDrawResult = {
  session: BraquageLegalCurrentSessionResponse | null;
  winner: BraquageLegalOwner | null;
  owner: BraquageLegalOwner | null;
  winnerId: string | null;
  winnerPayout: number | null;
  ownerPayout: number | null;
  ticketPool: number;
  cancelled: boolean;
};

const ownerSelect = {
  id: true,
  username: true,
  profilePicture: true,
} as const;

const sessionSelect = {
  id: true,
  status: true,
  startTime: true,
  endTime: true,
  totalPool: true,
  winnerId: true,
  winnerPayout: true,
  ownerPayout: true,
  participations: {
    select: {
      id: true,
      userId: true,
      tier: true,
      ticketCount: true,
      amount: true,
      createdAt: true,
      user: {
        select: ownerSelect,
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  winner: {
    select: ownerSelect,
  },
} as const;

const isTierKey = (value: unknown): value is BraquageLegalTierKey => (
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(TIER_CONFIG, value)
);

const getOwner = async (db: DbClient): Promise<BraquageLegalOwner | null> => {
  const owner = await db.user.findFirst({
    where: { isBraquageLegalOwner: true },
    select: ownerSelect,
  });

  return owner ?? null;
};

const buildSessionResponse = (
  session: {
    id: number;
    status: string;
    startTime: Date;
    endTime: Date;
    totalPool: number;
    participations: Array<{
      id: number;
      userId: string;
      tier: string;
      ticketCount: number;
      amount: number;
      createdAt: Date;
      user: BraquageLegalOwner;
    }>;
  },
  owner: BraquageLegalOwner | null,
  userParticipations: BraquageLegalUserParticipationSummary[] = [],
): BraquageLegalCurrentSessionResponse => ({
  id: session.id,
  status: session.status as BraquageLegalStatusKey,
  startTime: session.startTime.toISOString(),
  endTime: session.endTime.toISOString(),
  isExpired: session.endTime.getTime() <= Date.now(),
  totalPool: session.totalPool,
  participationsCount: session.participations.length,
  ticketPool: session.participations.reduce((sum, participation) => sum + participation.ticketCount, 0),
  owner,
  userParticipations,
});

const getCurrentSession = async (db: DbClient, userId: string): Promise<BraquageLegalCurrentSessionResponse | null> => {
  const session = await db.braquageLegalSession.findFirst({
    where: { status: BRAQUAGE_LEGAL_STATUS.ACTIVE },
    orderBy: { createdAt: 'desc' },
    select: sessionSelect,
  });

  if (!session) {
    return null;
  }

  const owner = await getOwner(db);
  const userParticipations = await db.braquageLegalParticipation.findMany({
    where: {
      sessionId: session.id,
      userId,
    },
    select: {
      tier: true,
      ticketCount: true,
      amount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const grouped = new Map<BraquageLegalTierKey, { participationCount: number; ticketCount: number; amount: number }>();
  for (const entry of userParticipations) {
    const current = grouped.get(entry.tier as BraquageLegalTierKey) ?? {
      participationCount: 0,
      ticketCount: 0,
      amount: 0,
    };
    current.participationCount += 1;
    current.ticketCount += entry.ticketCount;
    current.amount += entry.amount;
    grouped.set(entry.tier as BraquageLegalTierKey, current);
  }

  return buildSessionResponse(
    session,
    owner,
    Object.entries(TIER_CONFIG)
      .map(([tier]) => {
        const key = tier as BraquageLegalTierKey;
        const summary = grouped.get(key);
        return {
          tier: key,
          participationCount: summary?.participationCount ?? 0,
          ticketCount: summary?.ticketCount ?? 0,
          amount: summary?.amount ?? 0,
        };
      })
      .filter((summary) => summary.participationCount > 0),
  );
};

export async function drawBraquageLegalSession(sessionId: number): Promise<BraquageLegalDrawResult> {
  const session = await prisma.braquageLegalSession.findUnique({
    where: { id: sessionId },
    select: sessionSelect,
  });

  if (!session) {
    throw new Error('Session introuvable');
  }

  if (session.status !== BRAQUAGE_LEGAL_STATUS.ACTIVE) {
    throw new Error('Session already closed');
  }

  const owner = await getOwner(prisma);
  const ticketPool: string[] = [];
  for (const participation of session.participations) {
    for (let index = 0; index < participation.ticketCount; index += 1) {
      ticketPool.push(participation.userId);
    }
  }

  if (ticketPool.length === 0) {
    await prisma.braquageLegalSession.update({
      where: { id: sessionId },
      data: {
        status: BRAQUAGE_LEGAL_STATUS.CANCELLED,
        winnerId: null,
        winnerPayout: null,
        ownerPayout: null,
      },
    });

    const cancelledResult: BraquageLegalDrawResult = {
      session: buildSessionResponse({ ...session }, owner, []),
      winner: null,
      owner,
      winnerId: null,
      winnerPayout: null,
      ownerPayout: null,
      ticketPool: 0,
      cancelled: true,
    };

    io.emit(DRAW_EVENT, cancelledResult);
    return cancelledResult;
  }

  const randomIndex = Math.floor(Math.random() * ticketPool.length);
  const winnerId = ticketPool[randomIndex] ?? null;
  const winnerPayout = Math.floor(session.totalPool * WINNER_SHARE);
  const ownerPayout = Math.floor(session.totalPool * OWNER_SHARE);

  const updatedSession = await prisma.$transaction(async (tx) => {
    if (!winnerId) {
      throw new Error('No winner selected');
    }

    const winnerUpdate = tx.user.updateMany({
      where: { id: winnerId },
      data: { money: { increment: winnerPayout } },
    });

    const ownerUpdate = owner
      ? tx.user.updateMany({
        where: { id: owner.id },
        data: { money: { increment: ownerPayout } },
      })
      : Promise.resolve({ count: 0 });

    const sessionUpdate = tx.braquageLegalSession.update({
      where: { id: sessionId },
      data: {
        status: BRAQUAGE_LEGAL_STATUS.DRAWN,
        winnerId,
        winnerPayout,
        ownerPayout,
      },
      select: sessionSelect,
    });

    await Promise.all([winnerUpdate, ownerUpdate, sessionUpdate]);
    return sessionUpdate;
  });

  const winner = updatedSession.winner ?? session.participations.find((participation) => participation.userId === winnerId)?.user ?? null;
  const result: BraquageLegalDrawResult = {
    session: buildSessionResponse(updatedSession, owner, []),
    winner,
    owner,
    winnerId,
    winnerPayout,
    ownerPayout,
    ticketPool: updatedSession.participations.reduce((sum, participation) => sum + participation.ticketCount, 0),
    cancelled: false,
  };

  io.emit(DRAW_EVENT, result);
  return result;
}

router.get('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getCurrentSession(prisma, req.user!.id);
    res.json({ session });
  } catch (error) {
    console.error('Braquage Legal current session error:', error);
    res.status(500).json({ error: 'Impossible de charger la session en cours.' });
  }
});

router.get('/history', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.braquageLegalSession.findMany({
      where: { status: BRAQUAGE_LEGAL_STATUS.DRAWN },
      orderBy: { endTime: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        totalPool: true,
        winnerPayout: true,
        ownerPayout: true,
        endTime: true,
        winner: {
          select: ownerSelect,
        },
      },
    });

    const history: BraquageLegalHistoryEntry[] = sessions.map((session) => ({
      id: session.id,
      status: session.status as BraquageLegalStatusKey,
      totalPool: session.totalPool,
      winnerPayout: session.winnerPayout,
      ownerPayout: session.ownerPayout,
      endTime: session.endTime.toISOString(),
      winner: session.winner,
    }));

    res.json({ sessions: history });
  } catch (error) {
    console.error('Braquage Legal history error:', error);
    res.status(500).json({ error: 'Impossible de charger l’historique.' });
  }
});

router.post('/participate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tier = req.body?.tier;
    if (!isTierKey(tier)) {
      return res.status(400).json({ error: 'Tier invalide.' });
    }

    const config = TIER_CONFIG[tier];
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.braquageLegalSession.findFirst({
        where: { status: BRAQUAGE_LEGAL_STATUS.ACTIVE },
        orderBy: { createdAt: 'desc' },
        select: sessionSelect,
      });

      if (!session) {
        return { status: 404 as const, body: { error: 'Aucune session active.' } };
      }

      if (session.endTime.getTime() <= now.getTime()) {
        return { status: 400 as const, body: { error: 'La session est terminée.' } };
      }

      const existingParticipationCount = await tx.braquageLegalParticipation.count({
        where: {
          sessionId: session.id,
          userId: req.user!.id,
          tier,
        },
      });

      if (existingParticipationCount >= config.maxParticipations) {
        return { status: 400 as const, body: { error: 'Limite de participations atteinte pour ce tier.' } };
      }

      const deduction = await tx.user.updateMany({
        where: {
          id: req.user!.id,
          money: { gte: config.cost },
        },
        data: {
          money: { decrement: config.cost },
        },
      });

      if (deduction.count === 0) {
        return { status: 400 as const, body: { error: 'Fonds insuffisants.' } };
      }

      await tx.braquageLegalSession.update({
        where: { id: session.id },
        data: { totalPool: { increment: config.cost } },
      });

      await tx.braquageLegalParticipation.create({
        data: {
          sessionId: session.id,
          userId: req.user!.id,
          tier,
          ticketCount: config.tickets,
          amount: config.cost,
        },
      });

      const updatedSession = await getCurrentSession(tx, req.user!.id);
      return {
        status: 200 as const,
        body: { session: updatedSession },
      };
    });

    if (result.status !== 200) {
      return res.status(result.status).json(result.body);
    }

    const newBalance = await emitSharedBalanceUpdates(prisma, req.user!.id);

    return res.status(200).json({
      ...result.body,
      newBalance: {
        money: newBalance.money,
        aura: Number(newBalance.aura),
      },
    });
  } catch (error) {
    console.error('Braquage Legal participate error:', error);
    return res.status(500).json({ error: 'Impossible de rejoindre la session.' });
  }
});

router.post('/admin/create-session', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const durationHours = Number(req.body?.durationHours);
    if (!Number.isInteger(durationHours) || durationHours < 24 || durationHours > 48) {
      return res.status(400).json({ error: 'La durée doit être comprise entre 24 et 48 heures.' });
    }

    const activeSession = await prisma.braquageLegalSession.findFirst({
      where: { status: BRAQUAGE_LEGAL_STATUS.ACTIVE },
      select: { id: true },
    });

    if (activeSession) {
      return res.status(400).json({ error: 'Une session active existe déjà.' });
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const session = await prisma.braquageLegalSession.create({
      data: {
        endTime,
      },
      select: sessionSelect,
    });

    const owner = await getOwner(prisma);

    return res.json({
      session: buildSessionResponse(session, owner, []),
    });
  } catch (error) {
    console.error('Braquage Legal create session error:', error);
    return res.status(500).json({ error: 'Impossible de créer la session.' });
  }
});

router.post('/admin/draw', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = Number(req.body?.sessionId);
    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({ error: 'Session invalide.' });
    }

    const result = await drawBraquageLegalSession(sessionId);
    return res.json({ result });
  } catch (error) {
    console.error('Braquage Legal draw error:', error);
    const message = error instanceof Error ? error.message : 'Impossible de lancer le tirage.';
    return res.status(400).json({ error: message });
  }
});

router.post('/admin/set-owner', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    if (!userId) {
      return res.status(400).json({ error: 'Utilisateur invalide.' });
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        data: { isBraquageLegalOwner: false },
      });

      const target = await tx.user.findUnique({
        where: { id: userId },
        select: ownerSelect,
      });

      if (!target) {
        throw new Error('Utilisateur introuvable');
      }

      await tx.user.update({
        where: { id: userId },
        data: { isBraquageLegalOwner: true },
      });

      return target;
    });

    return res.json({ user: { ...user, isBraquageLegalOwner: true } });
  } catch (error) {
    console.error('Braquage Legal set owner error:', error);
    const message = error instanceof Error && error.message === 'Utilisateur introuvable'
      ? 'Utilisateur introuvable.'
      : 'Impossible de définir le propriétaire.';
    return res.status(400).json({ error: message });
  }
});

router.get('/owner', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const owner = await getOwner(prisma);
    return res.json({ owner });
  } catch (error) {
    console.error('Braquage Legal owner error:', error);
    return res.status(500).json({ error: 'Impossible de charger le propriétaire.' });
  }
});

export default router;