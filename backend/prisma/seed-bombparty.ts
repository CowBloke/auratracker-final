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
}

async function seedBombPartyPrompts() {
  console.log('Starting Bomb Party prompt seeding...');

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

  // Create a Set for O(1) lookups
  const wordSet = new Set(words);

  // Generate only 2-letter substrings and count occurrences
  const promptCounts = new Map<string, number>();

  for (const word of words) {
    const seen = new Set<string>(); // Track seen prompts for this word

    // Generate 2-letter substrings only
    for (let i = 0; i <= word.length - 2; i++) {
      const prompt = word.substring(i, i + 2);
      if (!seen.has(prompt)) {
        seen.add(prompt);
        promptCounts.set(prompt, (promptCounts.get(prompt) || 0) + 1);
      }
    }
  }

  console.log(`Generated ${promptCounts.size} unique prompts`);

  // Assign difficulty based on word count
  const prompts: PromptData[] = [];

  for (const [prompt, wordCount] of promptCounts) {
    // Skip prompts with less than 100 words (too hard)
    if (wordCount < 100) continue;

    let difficulty: 'easy' | 'medium' | 'hard';

    if (wordCount >= 500) {
      difficulty = 'easy';
    } else if (wordCount >= 200) {
      difficulty = 'medium';
    } else {
      difficulty = 'hard';
    }

    prompts.push({ prompt, wordCount, difficulty });
  }

  console.log(`Filtered to ${prompts.length} valid prompts`);
  console.log(`  Easy (500+ words): ${prompts.filter(p => p.difficulty === 'easy').length}`);
  console.log(`  Medium (200-499 words): ${prompts.filter(p => p.difficulty === 'medium').length}`);
  console.log(`  Hard (100-199 words): ${prompts.filter(p => p.difficulty === 'hard').length}`);

  // Clear existing prompts
  console.log('Clearing existing prompts...');
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

  console.log('Bomb Party prompt seeding complete!');
}

seedBombPartyPrompts()
  .catch((e) => {
    console.error('Error seeding prompts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
