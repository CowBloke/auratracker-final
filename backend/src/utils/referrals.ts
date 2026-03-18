import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../server.js';

export const DEFAULT_REFERRAL_REWARD = 250;
export const REFERRAL_REWARD_SETTING_KEY = 'referral_reward_amount';
export const REFERRAL_ENABLED_SETTING_KEY = 'referral_enabled';

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 8;

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const normalizeReferralCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
  return normalized.length > 0 ? normalized : null;
};

const buildReferralCode = () =>
  Array.from(randomBytes(REFERRAL_CODE_LENGTH), (byte) => REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length]).join('');

export async function createUniqueReferralCode(client: PrismaLike = prisma): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const referralCode = buildReferralCode();
    const existing = await client.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!existing) {
      return referralCode;
    }
  }

  throw new Error('Unable to generate unique referral code');
}

export async function ensureUserReferralCode(
  userId: string,
  existingCode?: string | null,
  client: PrismaLike = prisma
): Promise<string> {
  if (existingCode) {
    return existingCode;
  }

  const currentUser = await client.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (currentUser?.referralCode) {
    return currentUser.referralCode;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const referralCode = buildReferralCode();

    try {
      const updatedUser = await client.user.update({
        where: { id: userId },
        data: { referralCode },
        select: { referralCode: true },
      });

      return updatedUser.referralCode as string;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to assign referral code');
}

export async function getReferralRewardAmount(client: PrismaLike = prisma): Promise<number> {
  const setting = await client.gameSettings.findUnique({
    where: { key: REFERRAL_REWARD_SETTING_KEY },
    select: { value: true },
  });

  const parsedValue = Number.parseInt(setting?.value ?? '', 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return DEFAULT_REFERRAL_REWARD;
  }

  return parsedValue;
}

export async function isReferralEnabled(client: PrismaLike = prisma): Promise<boolean> {
  const setting = await client.gameSettings.findUnique({
    where: { key: REFERRAL_ENABLED_SETTING_KEY },
    select: { value: true },
  });

  return setting?.value !== 'false';
}
