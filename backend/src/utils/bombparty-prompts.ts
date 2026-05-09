import type { PrismaClient } from '@prisma/client';
import {
  readBombPartyDictionaryWords,
  resolveBombPartyLanguageFile,
} from './bombparty-dictionary.js';
import { getBombPartyLanguageSetting } from './bombparty-settings.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

type PromptLength = 2 | 3;

export type BombPartyPromptSeedResult = {
  languageFile: string;
  wordCount: number;
  totalPrompts: number;
  twoLetterPrompts: number;
  threeLetterPrompts: number;
};

function generatePromptCombos(length: PromptLength): string[] {
  const combos: string[] = [];
  if (length === 2) {
    for (const a of LETTERS) {
      for (const b of LETTERS) {
        combos.push(`${a}${b}`);
      }
    }
    return combos;
  }

  for (const a of LETTERS) {
    for (const b of LETTERS) {
      for (const c of LETTERS) {
        combos.push(`${a}${b}${c}`);
      }
    }
  }
  return combos;
}

function countPromptOccurrences(words: string[], length: PromptLength): Map<string, number> {
  const counts = new Map<string, number>();

  for (const word of words) {
    if (word.length < length) continue;

    const seen = new Set<string>();
    for (let i = 0; i <= word.length - length; i++) {
      const prompt = word.substring(i, i + length);
      if (seen.has(prompt)) continue;
      seen.add(prompt);
      counts.set(prompt, (counts.get(prompt) || 0) + 1);
    }
  }

  return counts;
}

export async function recalculateBombPartyPrompts(
  prisma: PrismaClient,
  languageOverride?: string
): Promise<BombPartyPromptSeedResult> {
  const languageSetting = languageOverride ?? (await getBombPartyLanguageSetting(prisma));
  const languageFile = resolveBombPartyLanguageFile(languageSetting);

  const words = readBombPartyDictionaryWords(languageFile);

  const counts2 = countPromptOccurrences(words, 2);
  const counts3 = countPromptOccurrences(words, 3);

  const prompts = [
    ...generatePromptCombos(2).map((prompt) => ({
      prompt,
      wordCount: counts2.get(prompt) || 0,
      length: 2,
    })),
    ...generatePromptCombos(3).map((prompt) => ({
      prompt,
      wordCount: counts3.get(prompt) || 0,
      length: 3,
    })),
  ];

  await prisma.bombPartyPrompt.deleteMany({});

  const batchSize = 500;
  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    await prisma.bombPartyPrompt.createMany({ data: batch });
  }

  return {
    languageFile,
    wordCount: words.length,
    totalPrompts: prompts.length,
    twoLetterPrompts: 26 * 26,
    threeLetterPrompts: 26 * 26 * 26,
  };
}
