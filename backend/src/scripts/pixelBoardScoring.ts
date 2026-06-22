import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { computePixelBoardAnalysis } from '../pixel-board/core.js';

const prisma = new PrismaClient();

async function main() {
  const outputDir = path.resolve('exports', 'pixel-board');
  mkdirSync(outputDir, { recursive: true });
  const analysis = await computePixelBoardAnalysis(prisma);
  const payload = {
    generatedAt: analysis.generatedAt,
    eventCount: analysis.eventCount,
    clanScores: analysis.clanScores,
    soloLeaderboard: analysis.soloLeaderboard,
  };
  const file = path.join(outputDir, 'scoring.json');
  writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Pixel board scoring exported to ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
