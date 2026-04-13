import { prisma } from '../lib/prisma.js';
import { recomputeOverallClassement } from '../utils/overallClassement.js';

const run = async () => {
  try {
    await prisma.$connect();
    await recomputeOverallClassement(prisma);
  } finally {
    await prisma.$disconnect();
  }
};

void run();
