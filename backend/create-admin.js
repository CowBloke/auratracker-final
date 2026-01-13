const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('aaaaaa', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@auratracker.com',
      username: 'admin',
      passwordHash: hashedPassword,
      isAdmin: true,
      isApproved: true,  // Auto-approve the admin
      aura: 0,
      money: 1000,
      auraCoinBalance: 0,
    },
  });
  
  console.log('Admin created:', admin);
  await prisma.$disconnect();
}

createAdmin().catch(console.error);
