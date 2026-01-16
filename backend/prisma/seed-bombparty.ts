import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface PromptData {
  prompt: string;
  wordCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  length: number;
}

// Default WPP (words per prompt) thresholds - these can be customized in the admin panel
const DEFAULT_WPP = {
  easy: 500,    // 500+ words = easy
  medium: 200,  // 200-499 words = medium
  hard: 100,    // 100-199 words = hard (minimum threshold)
};

async function getWppSettings(): Promise<{ easy: number; medium: number; hard: number }> {
  try {
    const settings = await prisma.gameSettings.findMany({
      where: {
        key: {
          in: ['bombparty_wpp_easy', 'bombparty_wpp_medium', 'bombparty_wpp_hard'],
        },
      },
    });

    const wpp = { ...DEFAULT_WPP };
    for (const setting of settings) {
      if (setting.key === 'bombparty_wpp_easy') wpp.easy = parseInt(setting.value);
      if (setting.key === 'bombparty_wpp_medium') wpp.medium = parseInt(setting.value);
      if (setting.key === 'bombparty_wpp_hard') wpp.hard = parseInt(setting.value);
    }
    return wpp;
  } catch {
    // If settings don't exist yet, use defaults
    return DEFAULT_WPP;
  }
}

async function seedBombPartyPrompts() {
  console.log('Starting Bomb Party prompt seeding...');

  // Get WPP settings from database or use defaults
  const wpp = await getWppSettings();
  console.log(`Using WPP thresholds: Easy=${wpp.easy}, Medium=${wpp.medium}, Hard=${wpp.hard}`);

  // Read dictionary file
  const dictionaryPath = path.join(__dirname, '../data/dictionary.txt');

  if (!fs.existsSync(dictionaryPath)) {
    console.error('Dictionary file not found at:', dictionaryPath);
    console.error('Please place your dictionary.txt file in backend/data/');
    process.exit(1);
  }

  const dictionaryContent = fs.readFileSync(dictionaryPath, 'utf-8');
  const words = dictionaryContent
    .split('\n')
    .map(w => w.trim().toUpperCase())
    .filter(w => w.length >= 2); // Min 2 chars for valid words

  console.log(`Loaded ${words.length} words from dictionary`);

  // Generate 2-letter and 3-letter substrings and count occurrences
  const promptCounts2 = new Map<string, number>();
  const promptCounts3 = new Map<string, number>();

  for (const word of words) {
    const seen2 = new Set<string>();
    const seen3 = new Set<string>();

    // Generate 2-letter substrings
    for (let i = 0; i <= word.length - 2; i++) {
      const prompt = word.substring(i, i + 2);
      if (!seen2.has(prompt)) {
        seen2.add(prompt);
        promptCounts2.set(prompt, (promptCounts2.get(prompt) || 0) + 1);
      }
    }

    // Generate 3-letter substrings
    for (let i = 0; i <= word.length - 3; i++) {
      const prompt = word.substring(i, i + 3);
      if (!seen3.has(prompt)) {
        seen3.add(prompt);
        promptCounts3.set(prompt, (promptCounts3.get(prompt) || 0) + 1);
      }
    }
  }

  console.log(`Generated ${promptCounts2.size} unique 2-letter prompts`);
  console.log(`Generated ${promptCounts3.size} unique 3-letter prompts`);

  // Assign difficulty based on word count
  const prompts: PromptData[] = [];

  // Process 2-letter prompts
  for (const [prompt, wordCount] of promptCounts2) {
    // Skip prompts with less than minimum threshold
    if (wordCount < wpp.hard) continue;

    let difficulty: 'easy' | 'medium' | 'hard';
    if (wordCount >= wpp.easy) {
      difficulty = 'easy';
    } else if (wordCount >= wpp.medium) {
      difficulty = 'medium';
    } else {
      difficulty = 'hard';
    }

    prompts.push({ prompt, wordCount, difficulty, length: 2 });
  }

  // Process 3-letter prompts
  for (const [prompt, wordCount] of promptCounts3) {
    // Skip prompts with less than minimum threshold
    if (wordCount < wpp.hard) continue;

    let difficulty: 'easy' | 'medium' | 'hard';
    if (wordCount >= wpp.easy) {
      difficulty = 'easy';
    } else if (wordCount >= wpp.medium) {
      difficulty = 'medium';
    } else {
      difficulty = 'hard';
    }

    prompts.push({ prompt, wordCount, difficulty, length: 3 });
  }

  // Count stats
  const twoLetterPrompts = prompts.filter(p => p.length === 2);
  const threeLetterPrompts = prompts.filter(p => p.length === 3);

  console.log(`\nFiltered to ${prompts.length} valid prompts total:`);
  console.log(`\n2-letter prompts (${twoLetterPrompts.length}):`);
  console.log(`  Easy (${wpp.easy}+ words): ${twoLetterPrompts.filter(p => p.difficulty === 'easy').length}`);
  console.log(`  Medium (${wpp.medium}-${wpp.easy - 1} words): ${twoLetterPrompts.filter(p => p.difficulty === 'medium').length}`);
  console.log(`  Hard (${wpp.hard}-${wpp.medium - 1} words): ${twoLetterPrompts.filter(p => p.difficulty === 'hard').length}`);

  console.log(`\n3-letter prompts (${threeLetterPrompts.length}):`);
  console.log(`  Easy (${wpp.easy}+ words): ${threeLetterPrompts.filter(p => p.difficulty === 'easy').length}`);
  console.log(`  Medium (${wpp.medium}-${wpp.easy - 1} words): ${threeLetterPrompts.filter(p => p.difficulty === 'medium').length}`);
  console.log(`  Hard (${wpp.hard}-${wpp.medium - 1} words): ${threeLetterPrompts.filter(p => p.difficulty === 'hard').length}`);

  // Clear existing prompts
  console.log('\nClearing existing prompts...');
  await prisma.bombPartyPrompt.deleteMany({});

  // Insert new prompts in batches
  console.log('Inserting prompts...');
  const batchSize = 100;

  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    await prisma.bombPartyPrompt.createMany({
      data: batch,
    });

    if ((i + batchSize) % 500 === 0 || i + batchSize >= prompts.length) {
      console.log(`  Inserted ${Math.min(i + batchSize, prompts.length)}/${prompts.length} prompts`);
    }
  }

  // Ensure default WPP settings exist in database
  console.log('\nEnsuring default WPP settings exist...');
  const defaultSettings = [
    { key: 'bombparty_wpp_easy', value: String(DEFAULT_WPP.easy) },
    { key: 'bombparty_wpp_medium', value: String(DEFAULT_WPP.medium) },
    { key: 'bombparty_wpp_hard', value: String(DEFAULT_WPP.hard) },
    { key: 'bombparty_3letter_start_round', value: '10' }, // 3-letter prompts start appearing after round 10
  ];

  for (const setting of defaultSettings) {
    await prisma.gameSettings.upsert({
      where: { key: setting.key },
      create: setting,
      update: {}, // Don't update if already exists (preserve admin changes)
    });
  }

  console.log('\nBomb Party prompt seeding complete!');
}

seedBombPartyPrompts()
  .catch((e) => {
    console.error('Error seeding prompts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
