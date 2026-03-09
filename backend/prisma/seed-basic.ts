import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_USERNAME = 'admin';
const ADMIN_EMAIL = 'admin@auratracker.local';
const ADMIN_PASSWORD = 'SuperSecretAdminPassword';

async function main() {
  console.log('Seeding basic data (admin only)...');

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      passwordHash,
      isAdmin: true,
      isApproved: true,
      aura: BigInt(0),
      money: 0,
    },
  });

  console.log(`Admin: ${admin.username} (${admin.id})`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
