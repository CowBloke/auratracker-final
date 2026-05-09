import type { PrismaClient } from '@prisma/client';
import { DEFAULT_BOMBPARTY_LANGUAGE_FILE } from './bombparty-dictionary.js';

export const DEFAULT_BOMBPARTY_WPP = {
  easy: 500,
  medium: 200,
  hard: 100,
};

export const DEFAULT_BOMBPARTY_3LETTER_START_ROUND = 10;

export async function getBombPartyWppSettings(prisma: PrismaClient): Promise<typeof DEFAULT_BOMBPARTY_WPP> {
  try {
    const settings = await prisma.gameSettings.findMany({
      where: {
        key: {
          in: ['bombparty_wpp_easy', 'bombparty_wpp_medium', 'bombparty_wpp_hard'],
        },
      },
    });

    const wpp = { ...DEFAULT_BOMBPARTY_WPP };
    for (const setting of settings) {
      if (setting.key === 'bombparty_wpp_easy') wpp.easy = parseInt(setting.value);
      if (setting.key === 'bombparty_wpp_medium') wpp.medium = parseInt(setting.value);
      if (setting.key === 'bombparty_wpp_hard') wpp.hard = parseInt(setting.value);
    }
    return wpp;
  } catch {
    return DEFAULT_BOMBPARTY_WPP;
  }
}

export async function getBombPartyThreeLetterStartRound(prisma: PrismaClient): Promise<number> {
  try {
    const setting = await prisma.gameSettings.findUnique({
      where: { key: 'bombparty_3letter_start_round' },
    });
    return setting ? parseInt(setting.value) : DEFAULT_BOMBPARTY_3LETTER_START_ROUND;
  } catch {
    return DEFAULT_BOMBPARTY_3LETTER_START_ROUND;
  }
}

export async function getBombPartyLanguageSetting(prisma: PrismaClient): Promise<string | null> {
  try {
    const setting = await prisma.gameSettings.findUnique({
      where: { key: 'bombparty_language' },
    });
    return setting?.value ?? null;
  } catch {
    return null;
  }
}

export async function ensureBombPartyDefaultSettings(prisma: PrismaClient) {
  const defaultSettings = [
    { key: 'bombparty_wpp_easy', value: String(DEFAULT_BOMBPARTY_WPP.easy) },
    { key: 'bombparty_wpp_medium', value: String(DEFAULT_BOMBPARTY_WPP.medium) },
    { key: 'bombparty_wpp_hard', value: String(DEFAULT_BOMBPARTY_WPP.hard) },
    { key: 'bombparty_3letter_start_round', value: String(DEFAULT_BOMBPARTY_3LETTER_START_ROUND) },
    { key: 'bombparty_language', value: DEFAULT_BOMBPARTY_LANGUAGE_FILE },
  ];

  for (const setting of defaultSettings) {
    await prisma.gameSettings.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }
}
