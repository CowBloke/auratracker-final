import { PrismaClient } from '@prisma/client';
import { recomputeOverallClassement } from '../utils/overallClassement.js';

const prisma = new PrismaClient();

const run = async () => {
  try {
    await prisma.$connect();
    await recomputeOverallClassement(prisma);
  } finally {
    await prisma.$disconnect();
  }
};

void run();
