import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../server.js';
import { config } from '../config/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, registerSchema, loginSchema } from '../middleware/validation.js';
import { logAuth } from '../utils/logger.js';
import {
  createUniqueReferralCode,
  ensureUserReferralCode,
  getReferralRewardAmount,
  isReferralEnabled,
  normalizeReferralCode,
} from '../utils/referrals.js';
import { serializeClanEffect } from '../utils/clanEffects.js';

const getIpAddress = (req: Request | AuthRequest): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || null;
};

const router = Router();

const getUserClanEffects = async (userId: string) => {
  const membership = await prisma.clanMember.findUnique({
    where: { userId },
    select: {
      clan: {
        select: {
          activeEffects: {
            where: {
              OR: [
                { activeUntil: { gt: new Date() } },
                { cooldownUntil: { gt: new Date() } },
              ],
            },
            orderBy: [{ activeUntil: 'desc' }, { cooldownUntil: 'desc' }],
          },
        },
      },
    },
  });

  return membership?.clan?.activeEffects.map(serializeClanEffect) ?? [];
};

const generateToken = (userId: string, email: string): string => {
  const options: SignOptions = { expiresIn: '7d' };
  return jwt.sign(
    { userId, email },
    config.jwtSecret,
    options
  );
};

router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { username, firstName, schoolLevel, classLetter, email, password, motivationMessage } = req.body;
    const referralsEnabled = await isReferralEnabled();
    const referralCode = referralsEnabled ? normalizeReferralCode(req.body.referralCode) : null;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email
          ? 'Email already registered'
          : 'Username already taken',
      });
    }

    let referrerId: string | null = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });

      if (!referrer) {
        return res.status(400).json({ error: 'Referral code invalid' });
      }

      referrerId = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isSuperAdmin = email === config.adminEmail;
    const isAdmin = isSuperAdmin;
    const generatedReferralCode = await createUniqueReferralCode();

    await prisma.user.create({
      data: {
        username,
        firstName: typeof firstName === 'string' ? firstName.trim() : firstName,
        schoolLevel,
        classLetter,
        email,
        passwordHash,
        motivationMessage: typeof motivationMessage === 'string' ? motivationMessage.trim() : motivationMessage,
        isAdmin,
        isSuperAdmin,
        isApproved: isAdmin,
        money: 1000,
        referralCode: generatedReferralCode,
        referredById: referrerId,
        referredAt: referrerId ? new Date() : null,
      },
    });

    logAuth('register', undefined, username, { email, isAdmin, isSuperAdmin, schoolLevel, classLetter, referredById: referrerId }, getIpAddress(req));

    res.status(201).json({
      success: true,
      message: isAdmin
        ? 'Compte admin cree avec succes'
        : referrerId
          ? 'Demande envoyee ! Le parrainage sera valide quand un administrateur approuvera ton compte.'
          : 'Demande envoyee ! Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.',
      requiresApproval: !isAdmin,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      logAuth('login_failed', undefined, username, { reason: 'user_not_found' }, getIpAddress(req));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      logAuth('login_failed', user.id, username, { reason: 'invalid_password' }, getIpAddress(req));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isApproved) {
      logAuth('login_failed', user.id, username, { reason: 'pending_approval' }, getIpAddress(req));
      return res.status(403).json({
        error: 'Votre compte est en attente d\'approbation par un administrateur.',
        pendingApproval: true,
      });
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
    });

    if (activeBan) {
      logAuth('login_banned', user.id, username, { banType: activeBan.type, reason: activeBan.reason }, getIpAddress(req));
      return res.status(403).json({
        error: activeBan.type === 'PERMANENT'
          ? `Votre compte a ete banni definitivement. Raison: ${activeBan.reason}`
          : `Votre compte est banni jusqu'au ${activeBan.expiresAt?.toISOString()}. Raison: ${activeBan.reason}`,
        banned: true,
        userId: user.id,
        ban: {
          id: activeBan.id,
          reason: activeBan.reason,
          type: activeBan.type,
          expiresAt: activeBan.expiresAt ? activeBan.expiresAt.toISOString() : null,
        },
      });
    }

    const token = generateToken(user.id, user.email);
    const ensuredReferralCode = await ensureUserReferralCode(user.id, user.referralCode);

    logAuth('login', user.id, user.username, { isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin }, getIpAddress(req));

    const clanEffects = await getUserClanEffects(user.id);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        schoolLevel: user.schoolLevel,
        classLetter: user.classLetter,
        email: user.email,
        aura: user.aura,
        money: user.money,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        usernameColor: user.usernameColor,
        profilePicture: user.profilePicture,
        profileBanner: user.profileBanner,
        referralCode: ensuredReferralCode,
        referredById: user.referredById,
        createdAt: user.createdAt,
        clanEffects,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/refresh', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = generateToken(req.user.id, req.user.email);
    res.json({ token });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        schoolLevel: true,
        classLetter: true,
        email: true,
        aura: true,
        money: true,
        isAdmin: true,
        isSuperAdmin: true,
        usernameColor: true,
        profilePicture: true,
        profileBanner: true,
        referralCode: true,
        referredById: true,
        createdAt: true,
      },
    });

    if (user) {
      user.referralCode = await ensureUserReferralCode(user.id, user.referralCode);
    }

    const clanEffects = user ? await getUserClanEffects(user.id) : [];
    res.json({ user: user ? { ...user, clanEffects } : null });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.get('/referral-summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const referralsEnabled = await isReferralEnabled();
    if (!referralsEnabled) {
      return res.status(404).json({ error: 'Referral system disabled' });
    }

    const referralCode = await ensureUserReferralCode(req.user.id, req.user.referralCode);
    const [rewardAmount, successfulReferrals, pendingReferrals] = await Promise.all([
      getReferralRewardAmount(),
      prisma.user.count({
        where: {
          referredById: req.user.id,
          referralRewardGrantedAt: { not: null },
        },
      }),
      prisma.user.count({
        where: {
          referredById: req.user.id,
          referralRewardGrantedAt: null,
        },
      }),
    ]);

    res.json({
      referralCode,
      rewardAmount,
      successfulReferrals,
      pendingReferrals,
      totalRewardsEarned: successfulReferrals * rewardAmount,
    });
  } catch (error) {
    console.error('Get referral summary error:', error);
    res.status(500).json({ error: 'Failed to get referral summary' });
  }
});

export default router;
