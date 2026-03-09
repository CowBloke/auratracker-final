const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('aaaaaa', 10);

  const admin = await prisma.user.upsert({
    where: {
      email: 'admin@auratracker.com',
    },
    update: {
      passwordHash: hashedPassword,
      isAdmin: true,
      isSuperAdmin: true,
      isApproved: true, // Keep this account usable as admin
    },
    create: {
      email: 'admin@auratracker.com',
      username: 'admin',
      passwordHash: hashedPassword,
      isAdmin: true,
      isSuperAdmin: true,
      isApproved: true, // Auto-approve the admin
      aura: 0,
      money: 1000,
      auraCoinBalance: 0,
    },
  });

  console.log('Admin ready:', {
    id: admin.id,
    email: admin.email,
    username: admin.username,
    isAdmin: admin.isAdmin,
    isSuperAdmin: admin.isSuperAdmin,
    isApproved: admin.isApproved,
  });
}

createAdmin()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
