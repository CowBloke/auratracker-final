import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { computePixelBoardAnalysis } from '../pixel-board/core.js';

const prisma = new PrismaClient();

async function main() {
  const outputDir = path.resolve('exports', 'pixel-board');
  mkdirSync(outputDir, { recursive: true });
  const analysis = await computePixelBoardAnalysis(prisma);
  const file = path.join(outputDir, 'heatmap.json');
  writeFileSync(file, JSON.stringify({
    generatedAt: analysis.generatedAt,
    size: analysis.size,
    heatmap: analysis.heatmap,
  }, null, 2), 'utf8');
  console.log(`Pixel board heatmap exported to ${file}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
