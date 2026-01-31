import { PrismaClient } from '@prisma/client';
import { recalculateBombPartyPrompts } from '../src/utils/bombpartyPrompts.js';
import { ensureBombPartyDefaultSettings } from '../src/utils/bombpartySettings.js';

const prisma = new PrismaClient();

async function seedBombPartyPrompts() {
  console.log('Starting Bomb Party prompt seeding...');

  await ensureBombPartyDefaultSettings(prisma);

  const result = await recalculateBombPartyPrompts(prisma);

  console.log(`Loaded ${result.wordCount} words from ${result.languageFile}`);
  console.log(`Generated ${result.twoLetterPrompts} 2-letter prompts`);
  console.log(`Generated ${result.threeLetterPrompts} 3-letter prompts`);
  console.log(`Inserted ${result.totalPrompts} total prompts`);
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
