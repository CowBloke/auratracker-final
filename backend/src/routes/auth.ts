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
import { serializeClanEffect } from '../utils/clan-effects.js';
import { DEFAULT_DAILY_AURA_LIMIT } from '../utils/daily/daily-aura.js';
import { getSharedBalance } from '../utils/shared-balance.js';
import { emitNotificationCreated } from '../utils/notifications.js';

const getIpAddress = (req: Request | AuthRequest): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || null;
};

const router = Router();

const createWelcomeInboxNotification = async (userId: string) => {
  const sentAt = new Date();

  const notification = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.updateMany({
      where: {
        id: userId,
        welcomeInboxSentAt: null,
      },
      data: {
        welcomeInboxSentAt: sentAt,
      },
    });

    if (updatedUser.count === 0) {
      return null;
    }

    return tx.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Bienvenue sur AuraTracker',
        body: 'Ton compte est pret. Passe par ta boite de reception pour retrouver les infos importantes et les prochaines actus.',
        link: '/inbox',
        icon: 'crown',
      },
    });
  });

  if (notification) {
    emitNotificationCreated(notification);
  }
};

const getUserClanEffects = async (userId: string) => {
  const membership = await prisma.clanMember.findUnique({
    where: { userId },
    select: {
      clan: {
        select: {
          activeEffects: {
            where: {
              activeUntil: { gt: new Date() },
            },
            orderBy: [{ activeUntil: 'desc' }],
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
    const { username, firstName, school, schoolLevel, classLetter, email, password, motivationMessage } = req.body;
    const normalizedUsername = typeof username === 'string' ? username.trim() : username;
    const normalizedEmail = typeof email === 'string' ? email.trim() : email;
    const referralsEnabled = await isReferralEnabled();
    const referralCode = referralsEnabled ? normalizeReferralCode(req.body.referralCode) : null;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === normalizedEmail
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
    const isSuperAdmin = normalizedEmail === config.adminEmail;
    const isAdmin = isSuperAdmin;
    const generatedReferralCode = await createUniqueReferralCode();

    await prisma.user.create({
      data: {
        username: normalizedUsername,
        firstName: typeof firstName === 'string' ? firstName.trim() : firstName,
        school: typeof school === 'string' ? school.trim() : school,
        schoolLevel,
        classLetter,
        email: normalizedEmail,
        passwordHash,
        motivationMessage: typeof motivationMessage === 'string' ? motivationMessage.trim() : motivationMessage,
        isAdmin,
        isSuperAdmin,
        isApproved: isAdmin,
        money: 1000,
        dailyAuraLimit: DEFAULT_DAILY_AURA_LIMIT,
        referralCode: generatedReferralCode,
        referredById: referrerId,
        referredAt: referrerId ? new Date() : null,
      },
    });

    logAuth('register', undefined, normalizedUsername, { email: normalizedEmail, isAdmin, isSuperAdmin, school, schoolLevel, classLetter, referredById: referrerId }, getIpAddress(req));

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
    const normalizedUsername = typeof username === 'string' ? username.trim() : username;

    let user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user && normalizedUsername !== username) {
      user = await prisma.user.findUnique({
        where: { username: normalizedUsername },
      });
    }

    if (!user) {
      logAuth('login_failed', undefined, normalizedUsername, { reason: 'user_not_found' }, getIpAddress(req));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      logAuth('login_failed', user.id, normalizedUsername, { reason: 'invalid_password' }, getIpAddress(req));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isApproved) {
      logAuth('login_failed', user.id, normalizedUsername, { reason: 'pending_approval' }, getIpAddress(req));
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
      logAuth('login_banned', user.id, normalizedUsername, { banType: activeBan.type, reason: activeBan.reason }, getIpAddress(req));
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
    await createWelcomeInboxNotification(user.id);

    logAuth('login', user.id, user.username, { isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin }, getIpAddress(req));

    const [clanEffects, sharedBalance] = await Promise.all([
      getUserClanEffects(user.id),
      getSharedBalance(prisma, user.id),
    ]);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        school: user.school,
        schoolLevel: user.schoolLevel,
        classLetter: user.classLetter,
        email: user.email,
        aura: Number(sharedBalance.aura),
        money: sharedBalance.money,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        isBetaTester: user.isBetaTester,
        isFiscalInspector: user.isFiscalInspector,
        isJudge: user.isJudge,
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
        school: true,
        schoolLevel: true,
        classLetter: true,
        email: true,
        aura: true,
        money: true,
        isAdmin: true,
        isSuperAdmin: true,
        isBetaTester: true,
        isFiscalInspector: true,
        isJudge: true,
        usernameColor: true,
        profilePicture: true,
        profileBanner: true,
        referralCode: true,
        referredById: true,
        createdAt: true,
        youAdblockExpiresAt: true,
      },
    });

    if (user) {
      user.referralCode = await ensureUserReferralCode(user.id, user.referralCode);
    }

    const [clanEffects, sharedBalance] = user
      ? await Promise.all([getUserClanEffects(user.id), getSharedBalance(prisma, user.id)])
      : [[], null];
    res.json({
      user: user
        ? {
            ...user,
            aura: sharedBalance ? Number(sharedBalance.aura) : user.aura,
            money: sharedBalance?.money ?? user.money,
            clanEffects,
            hasAdblock: user.youAdblockExpiresAt != null && user.youAdblockExpiresAt > new Date(),
          }
        : null,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
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
