import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user if it doesn't exist
  const adminUsername = 'admin';
  const adminPassword = 'SuperSecretAdminPassword';
  const adminEmail = 'admin@auratracker.com';

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    const admin = await prisma.user.create({
      data: {
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        isAdmin: true,
        aura: 0,
        money: 1000000, // Admin gets more money
      },
    });

    console.log(`✅ Admin user created: ${admin.username}`);
  } else {
    // Update password if admin already exists (to ensure correct password)
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.update({
      where: { username: adminUsername },
      data: {
        passwordHash,
        isAdmin: true,
      },
    });

    console.log(`✅ Admin user already exists, password updated`);
  }

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
