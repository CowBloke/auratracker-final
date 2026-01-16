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
        isApproved: true,
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
        isApproved: true,
      },
    });

    console.log(`✅ Admin user already exists, password updated`);
  }

  const commonPassword = 'Password123!';
  const commonPasswordHash = await bcrypt.hash(commonPassword, 10);

  const usersData = [
    {
      username: 'lena',
      email: 'lena@auratracker.com',
      aura: 320,
      money: 5400,
      auraCoinBalance: 12.5,
      isApproved: true,
      usernameColor: '#FF7A59',
      profilePicture: null,
      bio: 'Capitaine des parties publiques. Toujours partante pour un duel.',
    },
    {
      username: 'tom',
      email: 'tom@auratracker.com',
      aura: 180,
      money: 3200,
      auraCoinBalance: 4.2,
      isApproved: true,
      usernameColor: '#1D9BF0',
      profilePicture: null,
      bio: 'Collectionneur de skins rares et roi du chat.',
    },
    {
      username: 'milo',
      email: 'milo@auratracker.com',
      aura: 540,
      money: 8900,
      auraCoinBalance: 22.3,
      isApproved: true,
      usernameColor: '#22C55E',
      profilePicture: null,
      bio: 'Speedrun Doodle Jump, vibes chill.',
    },
    {
      username: 'salma',
      email: 'salma@auratracker.com',
      aura: 410,
      money: 6100,
      auraCoinBalance: 9.9,
      isApproved: true,
      usernameColor: '#F97316',
      profilePicture: null,
      bio: 'Toujours connectee, toujours en tete des classements.',
    },
    {
      username: 'nina',
      email: 'nina@auratracker.com',
      aura: 260,
      money: 2700,
      auraCoinBalance: 6.1,
      isApproved: true,
      usernameColor: '#A855F7',
      profilePicture: null,
      bio: 'Shoppeuse de marketplace, fan de cosmetiques.',
    },
    {
      username: 'raph',
      email: 'raph@auratracker.com',
      aura: 95,
      money: 1400,
      auraCoinBalance: 1.4,
      isApproved: true,
      usernameColor: '#0EA5E9',
      profilePicture: null,
      bio: 'Petit aura, grosses ambitions.',
    },
  ];

  await Promise.all(
    usersData.map((user) =>
      prisma.user.upsert({
        where: { username: user.username },
        update: {
          email: user.email,
          passwordHash: commonPasswordHash,
          aura: user.aura,
          money: user.money,
          auraCoinBalance: user.auraCoinBalance,
          isApproved: user.isApproved,
          usernameColor: user.usernameColor,
          profilePicture: user.profilePicture,
          bio: user.bio,
        },
        create: {
          username: user.username,
          email: user.email,
          passwordHash: commonPasswordHash,
          aura: user.aura,
          money: user.money,
          auraCoinBalance: user.auraCoinBalance,
          isApproved: user.isApproved,
          usernameColor: user.usernameColor,
          profilePicture: user.profilePicture,
          bio: user.bio,
        },
      })
    )
  );

  const users = await prisma.user.findMany({
    where: { username: { in: usersData.map((u) => u.username) } },
  });
  const userByName = new Map(users.map((user) => [user.username, user]));

  const itemCount = await prisma.item.count();
  if (itemCount === 0) {
    await prisma.item.createMany({
      data: [
        {
          name: 'Boost Aura x2',
          description: 'Double tes gains d\'aura pendant 1 heure.',
          type: 'CONSUMABLE',
          price: 800,
          imageUrl: null,
          effect: JSON.stringify({ auraMultiplier: 2, durationMinutes: 60 }),
        },
        {
          name: 'Pseudo Neon',
          description: 'Effet neon pour ton pseudo dans le chat.',
          type: 'COSMETIC',
          price: 1200,
          imageUrl: null,
          effect: JSON.stringify({ chatGlow: true }),
        },
        {
          name: 'Badge Elite',
          description: 'Badge exclusif pour les meilleurs joueurs.',
          type: 'COSMETIC',
          price: 2500,
          imageUrl: null,
          effect: JSON.stringify({ badge: 'elite' }),
        },
        {
          name: 'Coffre Aura',
          description: 'Ouvre un coffre avec des gains aleatoires.',
          type: 'CONSUMABLE',
          price: 400,
          imageUrl: null,
          effect: JSON.stringify({ minAura: 25, maxAura: 120 }),
        },
        {
          name: 'Slot VIP',
          description: 'Augmente la taille max de ta party.',
          type: 'UPGRADE',
          price: 3000,
          imageUrl: null,
          effect: JSON.stringify({ partySizeBonus: 2 }),
        },
      ],
    });
  }

  const items = await prisma.item.findMany();
  const itemByName = new Map(items.map((item) => [item.name, item]));

  const userItemCount = await prisma.userItem.count();
  if (userItemCount === 0) {
    await prisma.userItem.createMany({
      data: [
        {
          userId: userByName.get('lena')!.id,
          itemId: itemByName.get('Boost Aura x2')!.id,
          quantity: 2,
        },
        {
          userId: userByName.get('tom')!.id,
          itemId: itemByName.get('Pseudo Neon')!.id,
          quantity: 1,
        },
        {
          userId: userByName.get('milo')!.id,
          itemId: itemByName.get('Badge Elite')!.id,
          quantity: 1,
        },
        {
          userId: userByName.get('nina')!.id,
          itemId: itemByName.get('Coffre Aura')!.id,
          quantity: 4,
        },
        {
          userId: userByName.get('raph')!.id,
          itemId: itemByName.get('Slot VIP')!.id,
          quantity: 1,
        },
      ],
    });
  }

  const gameTypes = ['doodle_jump'];
  await Promise.all(
    users.map((user) =>
      Promise.all(
        gameTypes.map((gameType) =>
          prisma.gameStats.upsert({
            where: { userId_gameType: { userId: user.id, gameType } },
            update: {
              wins: 14,
              losses: 6,
              highScore: 12800,
              totalPlayed: 20,
            },
            create: {
              userId: user.id,
              gameType,
              wins: 14,
              losses: 6,
              highScore: 12800,
              totalPlayed: 20,
            },
          })
        )
      )
    )
  );

  const chatCount = await prisma.chatMessage.count();
  if (chatCount === 0) {
    await prisma.chatMessage.createMany({
      data: [
        {
          userId: userByName.get('lena')!.id,
          message: 'Qui veut une party pour ce soir ?',
          createdAt: new Date(Date.now() - 1000 * 60 * 45),
        },
        {
          userId: userByName.get('tom')!.id,
          message: 'Le nouveau badge elite est insane.',
          createdAt: new Date(Date.now() - 1000 * 60 * 42),
        },
        {
          userId: userByName.get('milo')!.id,
          message: 'Record battu sur Doodle Jump !',
          createdAt: new Date(Date.now() - 1000 * 60 * 35),
        },
        {
          userId: userByName.get('salma')!.id,
          message: 'On fait un rush doodle jump ?',
          createdAt: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          userId: userByName.get('nina')!.id,
          message: 'Marketplace: promo sur les coffres aura !',
          createdAt: new Date(Date.now() - 1000 * 60 * 20),
        },
        {
          userId: userByName.get('raph')!.id,
          message: 'Je debute, tips pour gagner de l\'aura ?',
          createdAt: new Date(Date.now() - 1000 * 60 * 15),
        },
      ],
    });
  }

  const transferCount = await prisma.transfer.count();
  if (transferCount === 0) {
    await prisma.transfer.createMany({
      data: [
        {
          senderId: userByName.get('lena')!.id,
          receiverId: userByName.get('raph')!.id,
          auraAmount: 20,
          moneyAmount: 150,
          isGift: true,
          message: 'Bienvenue sur Aura Tracker !',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
        {
          senderId: userByName.get('milo')!.id,
          receiverId: userByName.get('tom')!.id,
          auraAmount: 10,
          moneyAmount: 50,
          isGift: false,
          message: 'GG pour la victoire d\'hier.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        },
        {
          senderId: userByName.get('salma')!.id,
          receiverId: userByName.get('nina')!.id,
          auraAmount: 15,
          moneyAmount: 200,
          isGift: false,
          message: 'Pour ton shop, amuse-toi.',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
        },
      ],
    });
  }

  const partyCount = await prisma.party.count();
  if (partyCount === 0) {
    const parties = await prisma.party.createMany({
      data: [
        {
          name: 'Les Nebuleux',
          isPublic: true,
          maxSize: 6,
          lastActivity: new Date(Date.now() - 1000 * 60 * 12),
        },
        {
          name: 'Aura Rangers',
          isPublic: false,
          maxSize: 8,
          lastActivity: new Date(Date.now() - 1000 * 60 * 8),
        },
      ],
    });

    if (parties.count > 0) {
      const createdParties = await prisma.party.findMany();
      const partyByName = new Map(createdParties.map((party) => [party.name, party]));

      await prisma.partyMember.createMany({
        data: [
          {
            partyId: partyByName.get('Les Nebuleux')!.id,
            userId: userByName.get('lena')!.id,
            isLeader: true,
          },
          {
            partyId: partyByName.get('Les Nebuleux')!.id,
            userId: userByName.get('raph')!.id,
            isLeader: false,
          },
          {
            partyId: partyByName.get('Aura Rangers')!.id,
            userId: userByName.get('milo')!.id,
            isLeader: true,
          },
          {
            partyId: partyByName.get('Aura Rangers')!.id,
            userId: userByName.get('tom')!.id,
            isLeader: false,
          },
          {
            partyId: partyByName.get('Aura Rangers')!.id,
            userId: userByName.get('salma')!.id,
            isLeader: false,
          },
        ],
      });
    }
  }

  const clashBaseCount = await prisma.clashBase.count();
  if (clashBaseCount === 0) {
    await prisma.clashBase.createMany({
      data: [
        {
          userId: userByName.get('lena')!.id,
          baseLayout: JSON.stringify({
            townHall: 4,
            buildings: [
              { id: 'cannon', level: 2, x: 4, y: 6 },
              { id: 'tower', level: 1, x: 7, y: 3 },
            ],
          }),
          defenseRating: 140,
          trophies: 320,
        },
        {
          userId: userByName.get('milo')!.id,
          baseLayout: JSON.stringify({
            townHall: 5,
            buildings: [
              { id: 'cannon', level: 3, x: 2, y: 4 },
              { id: 'mortar', level: 2, x: 6, y: 8 },
            ],
          }),
          defenseRating: 165,
          trophies: 410,
        },
      ],
    });
  }

  const attackCount = await prisma.attack.count();
  if (attackCount === 0) {
    await prisma.attack.createMany({
      data: [
        {
          attackerId: userByName.get('lena')!.id,
          defenderId: userByName.get('milo')!.id,
          success: true,
          starsEarned: 3,
          destruction: 92,
          auraTaken: 30,
          moneyTaken: 240,
          trophiesWon: 18,
          trophiesLost: 12,
          attackedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
        },
        {
          attackerId: userByName.get('tom')!.id,
          defenderId: userByName.get('lena')!.id,
          success: false,
          starsEarned: 1,
          destruction: 46,
          auraTaken: 5,
          moneyTaken: 40,
          trophiesWon: 6,
          trophiesLost: 8,
          attackedAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
        },
      ],
    });
  }

  const auraPriceCount = await prisma.auraCoinPrice.count();
  if (auraPriceCount === 0) {
    await prisma.auraCoinPrice.createMany({
      data: [
        { price: 1.4, volume: 5200, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
        { price: 1.6, volume: 6100, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12) },
        { price: 1.55, volume: 4800, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6) },
        { price: 1.7, volume: 7400, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
      ],
    });
  }

  const auraTransactionCount = await prisma.auraCoinTransaction.count();
  if (auraTransactionCount === 0) {
    await prisma.auraCoinTransaction.createMany({
      data: [
        {
          userId: userByName.get('milo')!.id,
          type: 'BUY',
          coinAmount: 5.5,
          moneyAmount: 880,
          price: 1.6,
          fee: 12,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
        },
        {
          userId: userByName.get('lena')!.id,
          type: 'SELL',
          coinAmount: 3.2,
          moneyAmount: 540,
          price: 1.7,
          fee: 8,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
        },
      ],
    });
  }

  const bugCount = await prisma.bugReport.count();
  if (bugCount === 0) {
    await prisma.bugReport.createMany({
      data: [
        {
          userId: userByName.get('raph')!.id,
          title: 'Freeze apres partie',
          description: 'Le jeu se fige apres un doodle jump long.',
          status: 'PENDING',
        },
        {
          userId: userByName.get('nina')!.id,
          title: 'Prix marketplace',
          description: 'Le prix du badge elite affiche 0.',
          status: 'DONE',
          resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
        },
      ],
    });
  }

  const suggestionCount = await prisma.suggestion.count();
  if (suggestionCount === 0) {
    const suggestions = await prisma.suggestion.createMany({
      data: [
        {
          userId: userByName.get('tom')!.id,
          title: 'Mode tournoi weekly',
          description: 'Ajouter un tournoi hebdo avec recompenses aura.',
          imageUrl: null,
        },
        {
          userId: userByName.get('salma')!.id,
          title: 'Skins saisonniers',
          description: 'Skins winter pour le chat et la base.',
          imageUrl: null,
        },
      ],
    });

    if (suggestions.count > 0) {
      const suggestionList = await prisma.suggestion.findMany();
      const suggestionByTitle = new Map(
        suggestionList.map((suggestion) => [suggestion.title, suggestion])
      );

      await prisma.suggestionVote.createMany({
        data: [
          {
            suggestionId: suggestionByTitle.get('Mode tournoi weekly')!.id,
            userId: userByName.get('lena')!.id,
            value: 1,
          },
          {
            suggestionId: suggestionByTitle.get('Mode tournoi weekly')!.id,
            userId: userByName.get('milo')!.id,
            value: 1,
          },
          {
            suggestionId: suggestionByTitle.get('Skins saisonniers')!.id,
            userId: userByName.get('tom')!.id,
            value: 1,
          },
          {
            suggestionId: suggestionByTitle.get('Skins saisonniers')!.id,
            userId: userByName.get('raph')!.id,
            value: -1,
          },
        ],
      });
    }
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
