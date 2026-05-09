import { prisma } from '../lib/prisma.js';
import { recomputeOverallClassement } from '../utils/overall-classement.js';

const run = async () => {
  try {
    await prisma.$connect();
    await recomputeOverallClassement(prisma);
  } finally {
    await prisma.$disconnect();
  }
};

void run();
