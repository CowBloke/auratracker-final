import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const COMMON_PASSWORD = 'Password123!';
const ADMIN_PASSWORD = 'SuperSecretAdminPassword';
const MOCK_IMAGE = {
  lena: '/images/mock/avatar-lena.svg',
  milo: '/images/mock/avatar-milo.svg',
  salma: '/images/mock/avatar-salma.svg',
  clan: '/images/mock/jared-rice-qzgmZKsyVsQ-unsplash.jpg',
  market: '/images/mock/nir-himi-gSIjbABf9sc-unsplash.jpg',
  update: '/images/mock/matthew-mosbauer-7DV_dT3JuLs-unsplash.jpg',
  cardA: '/images/mock/bennie-bates-rvV5zQEZBUU-unsplash.jpg',
  cardB: '/images/mock/erik-fabian-t-ylGRIbyVY-unsplash.jpg',
  cardC: '/images/mock/nir-himi-nd0x9zVw-hQ-unsplash.jpg',
  cardD: '/images/mock/nir-himi-_jmXZHtCi4U-unsplash.jpg',
  cardE: '/images/mock/nir-himi-A5BmPxqRlfc-unsplash.jpg',
  cardF: '/images/mock/nir-himi-1WfegtbvNK8-unsplash.jpg',
  cardG: '/images/mock/micke-lindstrom-w4OQcCFYdXc-unsplash.jpg',
  bannerA: '/images/mock/jared-rice-qzgmZKsyVsQ-unsplash.jpg',
  bannerB: '/images/mock/matthew-mosbauer-7DV_dT3JuLs-unsplash.jpg',
  bannerC: '/images/mock/nir-himi-gSIjbABf9sc-unsplash.jpg',
};

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const daysAgo = (days: number, hour = 12) => {
  const date = startOfDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  date.setHours(hour, 0, 0, 0);
  return date;
};

const getExistingTables = async () => {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sqlite_master WHERE type = 'table'
  `;
  return new Set(rows.map((row) => row.name));
};

const getTableColumns = async (tableName: string) => {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM pragma_table_info(${tableName})
  `;
  return new Set(rows.map((row) => row.name));
};

async function clearMockData(mockUsernames: string[], existingTables: Set<string>) {
  await prisma.userUpdatePopupView.deleteMany();
  await prisma.updatePopup.deleteMany();
  if (existingTables.has('Notification')) {
    await prisma.notification.deleteMany();
  }
  await prisma.giftItem.deleteMany();
  await prisma.gift.deleteMany();
  await prisma.giftTemplate.deleteMany();
  await prisma.userQuestProgress.deleteMany();
  await prisma.userDailyQuest.deleteMany();
  await prisma.dailyQuest.deleteMany();
  await prisma.polymarketBet.deleteMany();
  await prisma.polymarketEvent.deleteMany();
  await prisma.polymarketSuggestion.deleteMany();
  await prisma.suggestionRating.deleteMany();
  await prisma.suggestionVote.deleteMany();
  await prisma.suggestionComment.deleteMany();
  await prisma.suggestion.deleteMany();
  await prisma.bugReport.deleteMany();
  await prisma.auraCoinPosition.deleteMany();
  await prisma.auraCoinTransaction.deleteMany();
  await prisma.auraCoinPrice.deleteMany();
  if (existingTables.has('OnlineSnapshot')) {
    await prisma.onlineSnapshot.deleteMany();
  }
  await prisma.dailyRacerRun.deleteMany();
  await prisma.bombPartyStats.deleteMany();
  await prisma.gameStats.deleteMany();
  await prisma.chatReaction.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.clanJoinRequest.deleteMany();
  await prisma.clanMember.deleteMany();
  await prisma.clan.deleteMany();
  await prisma.partyMember.deleteMany();
  await prisma.party.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.userItem.deleteMany();
  await prisma.item.deleteMany();
  await prisma.log.deleteMany();
  await prisma.user.deleteMany({
    where: {
      username: {
        in: mockUsernames,
      },
    },
  });
}

async function main() {
  console.log('Seeding mock data...');

  const mockUsers = [
    {
      username: 'lena',
      firstName: 'Lena',
      email: 'lena@auratracker.com',
      aura: 1240n,
      money: 8450,
      auraCoinBalance: 21.4,
      usernameColor: '#FF7A59',
      profilePicture: MOCK_IMAGE.lena,
      profileBanner: MOCK_IMAGE.bannerA,
      bio: 'Public parties, inbox zero, and far too many side quests.',
      dailyPassStreak: 6,
      lastDailyPassClaim: daysAgo(0, 9),
      isApproved: true,
    },
    {
      username: 'tom',
      firstName: 'Tom',
      email: 'tom@auratracker.com',
      aura: 930n,
      money: 6620,
      auraCoinBalance: 13.1,
      usernameColor: '#1D9BF0',
      profilePicture: MOCK_IMAGE.milo,
      profileBanner: MOCK_IMAGE.bannerB,
      bio: 'Always in the shop, always one cosmetic ahead.',
      dailyPassStreak: 3,
      lastDailyPassClaim: daysAgo(1, 8),
      isApproved: true,
    },
    {
      username: 'milo',
      firstName: 'Milo',
      email: 'milo@auratracker.com',
      aura: 1680n,
      money: 11240,
      auraCoinBalance: 34.8,
      usernameColor: '#22C55E',
      profilePicture: MOCK_IMAGE.milo,
      profileBanner: MOCK_IMAGE.bannerC,
      bio: 'Racer hot laps and Doodle marathons.',
      dailyPassStreak: 9,
      lastDailyPassClaim: daysAgo(0, 7),
      isApproved: true,
    },
    {
      username: 'salma',
      firstName: 'Salma',
      email: 'salma@auratracker.com',
      aura: 1510n,
      money: 9780,
      auraCoinBalance: 27.2,
      usernameColor: '#F97316',
      profilePicture: MOCK_IMAGE.salma,
      profileBanner: MOCK_IMAGE.bannerA,
      bio: 'Top of the boards, first in line for every update.',
      dailyPassStreak: 5,
      lastDailyPassClaim: daysAgo(2, 8),
      isApproved: true,
    },
    {
      username: 'nina',
      firstName: 'Nina',
      email: 'nina@auratracker.com',
      aura: 780n,
      money: 5930,
      auraCoinBalance: 8.6,
      usernameColor: '#A855F7',
      profilePicture: MOCK_IMAGE.salma,
      profileBanner: MOCK_IMAGE.bannerB,
      bio: 'Gift economy gremlin and inventory curator.',
      dailyPassStreak: 2,
      lastDailyPassClaim: null,
      isApproved: true,
    },
    {
      username: 'raph',
      firstName: 'Raph',
      email: 'raph@auratracker.com',
      aura: 420n,
      money: 2840,
      auraCoinBalance: 2.2,
      usernameColor: '#0EA5E9',
      profilePicture: MOCK_IMAGE.lena,
      profileBanner: MOCK_IMAGE.bannerC,
      bio: 'Still learning, still betting, still asking for rematches.',
      dailyPassStreak: 1,
      lastDailyPassClaim: daysAgo(1, 10),
      isApproved: true,
    },
    {
      username: 'zoe',
      firstName: 'Zoe',
      email: 'zoe@auratracker.com',
      aura: 1105n,
      money: 7560,
      auraCoinBalance: 17.7,
      usernameColor: '#14B8A6',
      profilePicture: MOCK_IMAGE.salma,
      profileBanner: MOCK_IMAGE.bannerA,
      bio: 'Clan organizer and quest optimizer.',
      dailyPassStreak: 7,
      lastDailyPassClaim: daysAgo(0, 6),
      isApproved: true,
    },
    {
      username: 'noah',
      firstName: 'Noah',
      email: 'noah@auratracker.com',
      aura: 660n,
      money: 4380,
      auraCoinBalance: 6.4,
      usernameColor: '#EAB308',
      profilePicture: MOCK_IMAGE.milo,
      profileBanner: MOCK_IMAGE.bannerB,
      bio: 'Casual cards, serious clan loyalty.',
      dailyPassStreak: 4,
      lastDailyPassClaim: daysAgo(0, 11),
      isApproved: true,
    },
    {
      username: 'iris_pending',
      firstName: 'Iris',
      email: 'iris@auratracker.com',
      aura: 0n,
      money: 1000,
      auraCoinBalance: 0,
      usernameColor: '#F472B6',
      profilePicture: null,
      bio: null,
      dailyPassStreak: 0,
      lastDailyPassClaim: null,
      motivationMessage: 'Je veux surtout tester les quetes, les clans et les cadeaux.',
      isApproved: false,
    },
    {
      username: 'leo_pending',
      firstName: 'Leo',
      email: 'leo@auratracker.com',
      aura: 0n,
      money: 1000,
      auraCoinBalance: 0,
      usernameColor: '#60A5FA',
      profilePicture: null,
      bio: null,
      dailyPassStreak: 0,
      lastDailyPassClaim: null,
      motivationMessage: 'J arrive pour Bomb Party, Polymarket et le chat.',
      isApproved: false,
    },
  ];

  const existingTables = await getExistingTables();
  const polymarketSuggestionColumns = existingTables.has('PolymarketSuggestion')
    ? await getTableColumns('PolymarketSuggestion')
    : new Set<string>();
  const giftColumns = existingTables.has('Gift')
    ? await getTableColumns('Gift')
    : new Set<string>();
  await clearMockData(mockUsers.map((user) => user.username), existingTables);

  const insertPolymarketSuggestion = async (data: {
    userId: string;
    title: string;
    description: string;
    imageUrl: string;
    eventDate: Date;
    status: string;
    createdAt: Date;
    reviewedAt?: Date | null;
    reviewedBy?: string | null;
    suggestedYesOdds?: number;
    suggestedNoOdds?: number;
  }) => {
    const id = randomUUID();
    const columns = ['id', 'userId', 'title', 'description', 'imageUrl', 'eventDate', 'status', 'createdAt'];
    const values: Array<string | number | Date | null> = [
      id,
      data.userId,
      data.title,
      data.description,
      data.imageUrl,
      data.eventDate,
      data.status,
      data.createdAt,
    ];

    if (polymarketSuggestionColumns.has('reviewedAt')) {
      columns.push('reviewedAt');
      values.push(data.reviewedAt ?? null);
    }
    if (polymarketSuggestionColumns.has('reviewedBy')) {
      columns.push('reviewedBy');
      values.push(data.reviewedBy ?? null);
    }
    if (polymarketSuggestionColumns.has('suggestedYesOdds')) {
      columns.push('suggestedYesOdds');
      values.push(data.suggestedYesOdds ?? null);
    }
    if (polymarketSuggestionColumns.has('suggestedNoOdds')) {
      columns.push('suggestedNoOdds');
      values.push(data.suggestedNoOdds ?? null);
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO "PolymarketSuggestion" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${placeholders})`;
    await prisma.$executeRawUnsafe(sql, ...values);
    return { id };
  };

  const insertGift = async (data: {
    senderId: string;
    receiverId: string;
    message?: string | null;
    moneyAmount?: number;
    auraAmount?: number;
    giftedItemId?: string | null;
    isOpened?: boolean;
    openedAt?: Date | null;
    createdAt: Date;
  }) => {
    const id = randomUUID();
    const columns = ['id', 'senderId', 'receiverId', 'message', 'moneyAmount', 'auraAmount', 'isOpened', 'openedAt', 'createdAt'];
    const values: Array<string | number | boolean | Date | null> = [
      id,
      data.senderId,
      data.receiverId,
      data.message ?? null,
      data.moneyAmount ?? 0,
      data.auraAmount ?? 0,
      data.isOpened ?? false,
      data.openedAt ?? null,
      data.createdAt,
    ];

    if (giftColumns.has('giftedItemId')) {
      columns.splice(6, 0, 'giftedItemId');
      values.splice(6, 0, data.giftedItemId ?? null);
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO "Gift" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${placeholders})`;
    await prisma.$executeRawUnsafe(sql, ...values);
    return { id };
  };

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      email: 'admin@auratracker.com',
      passwordHash: adminHash,
      isAdmin: true,
      isSuperAdmin: true,
      isApproved: true,
      money: 250000,
      aura: 0n,
      firstName: 'Admin',
      profilePicture: null,
      bio: 'Seeded admin account for dev.',
    },
    create: {
      username: 'admin',
      firstName: 'Admin',
      email: 'admin@auratracker.com',
      passwordHash: adminHash,
      isAdmin: true,
      isSuperAdmin: true,
      isApproved: true,
      money: 250000,
      aura: 0n,
      bio: 'Seeded admin account for dev.',
    },
  });

  const commonHash = await bcrypt.hash(COMMON_PASSWORD, 10);
  await prisma.user.createMany({
    data: mockUsers.map((user) => ({
      username: user.username,
      firstName: user.firstName,
      email: user.email,
      passwordHash: commonHash,
      aura: user.aura,
      money: user.money,
      auraCoinBalance: user.auraCoinBalance,
      isApproved: user.isApproved,
      usernameColor: user.usernameColor,
      profilePicture: user.profilePicture,
      profileBanner: user.profileBanner,
      bio: user.bio,
      dailyPassStreak: user.dailyPassStreak,
      lastDailyPassClaim: user.lastDailyPassClaim,
      motivationMessage: user.motivationMessage ?? null,
    })),
  });

  const users = await prisma.user.findMany({
    where: {
      username: {
        in: ['admin', ...mockUsers.map((user) => user.username)],
      },
    },
  });
  const userByName = new Map(users.map((user) => [user.username, user]));
  const admin = userByName.get('admin');
  if (!admin) {
    throw new Error('Admin user missing after seed.');
  }

  const items = [
    {
      name: 'Aura Capsule',
      description: 'Single-use boost that adds a clean aura bonus.',
      type: 'CONSUMABLE',
      price: 450,
      imageUrl: MOCK_IMAGE.cardA,
      effect: JSON.stringify({ bonusAura: 30 }),
    },
    {
      name: 'Cash Sprint',
      description: 'Pocket money drop for quest resets and quick buys.',
      type: 'CONSUMABLE',
      price: 520,
      imageUrl: MOCK_IMAGE.cardB,
      effect: JSON.stringify({ bonusMoney: 500 }),
    },
    {
      name: 'Neon Alias',
      description: 'Consumable cosmetic to change your username color.',
      type: 'COSMETIC',
      price: 900,
      imageUrl: MOCK_IMAGE.cardC,
      effect: JSON.stringify({ type: 'USERNAME_COLOR' }),
    },
    {
      name: 'Profile Snap',
      description: 'Consumable cosmetic to set a profile picture.',
      type: 'COSMETIC',
      price: 1100,
      imageUrl: MOCK_IMAGE.cardD,
      effect: JSON.stringify({ type: 'PROFILE_PICTURE' }),
    },
    {
      name: 'Profile Banner',
      description: 'Consumable cosmetic to set the banner shown on your profile.',
      type: 'COSMETIC',
      price: 1450,
      imageUrl: MOCK_IMAGE.bannerA,
      effect: JSON.stringify({ type: 'PROFILE_BANNER' }),
    },
    {
      name: 'Party Permit',
      description: 'Upgrade token reserved for future party capacity perks.',
      type: 'UPGRADE',
      price: 1800,
      imageUrl: MOCK_IMAGE.cardE,
      effect: JSON.stringify({ partySizeBonus: 1 }),
    },
    {
      name: 'Mystery Crate',
      description: 'Gift-only crate that can be sent to another user.',
      type: 'GIFT',
      price: 700,
      imageUrl: MOCK_IMAGE.cardF,
      effect: JSON.stringify({ rarity: 'rare' }),
    },
    {
      name: 'Lucky Koi',
      description: 'Decorative gift item for inbox tests and resale flows.',
      type: 'GIFT',
      price: 950,
      imageUrl: MOCK_IMAGE.cardG,
      effect: JSON.stringify({ rarity: 'epic' }),
    },
  ];

  await prisma.item.createMany({ data: items });
  const seededItems = await prisma.item.findMany();
  const itemByName = new Map(seededItems.map((item) => [item.name, item]));

  await prisma.userItem.createMany({
    data: [
      { userId: userByName.get('lena')!.id, itemId: itemByName.get('Aura Capsule')!.id, quantity: 2 },
      { userId: userByName.get('lena')!.id, itemId: itemByName.get('Neon Alias')!.id, quantity: 1 },
      { userId: userByName.get('tom')!.id, itemId: itemByName.get('Profile Snap')!.id, quantity: 1 },
      { userId: userByName.get('milo')!.id, itemId: itemByName.get('Cash Sprint')!.id, quantity: 3 },
      { userId: userByName.get('nina')!.id, itemId: itemByName.get('Mystery Crate')!.id, quantity: 2 },
      { userId: userByName.get('noah')!.id, itemId: itemByName.get('Lucky Koi')!.id, quantity: 1 },
      { userId: userByName.get('zoe')!.id, itemId: itemByName.get('Party Permit')!.id, quantity: 1 },
    ],
  });

  const gameStatsSeed = [
    ['lena', 'doodle_jump', 22, 11, 15340, 33],
    ['milo', 'doodle_jump', 31, 14, 19880, 45],
    ['salma', 'doodle_jump', 28, 9, 17620, 37],
    ['zoe', 'doodle_jump', 16, 10, 13210, 26],
    ['lena', 'doodle_jump_mort_subite', 9, 6, 8100, 15],
    ['milo', 'doodle_jump_mort_subite', 15, 8, 11440, 23],
    ['salma', 'doodle_jump_mort_subite', 13, 7, 10220, 20],
    ['tom', 'game_2048', 19, 12, 4096, 31],
    ['nina', 'game_2048', 15, 9, 8192, 24],
    ['zoe', 'game_2048', 12, 8, 4096, 20],
    ['lena', 'flappy_bird', 17, 22, 68, 39],
    ['raph', 'flappy_bird', 11, 16, 41, 27],
    ['salma', 'flappy_bird', 21, 13, 93, 34],
    ['tom', 'solitaire', 18, 13, 12650, 31],
    ['nina', 'solitaire', 24, 12, 14220, 36],
    ['noah', 'solitaire', 10, 15, 9180, 25],
    ['milo', 'racer', 9, 5, 68412, 14],
    ['salma', 'racer', 12, 7, 67108, 19],
    ['zoe', 'racer', 7, 6, 70255, 13],
    ['milo', 'tetris', 22, 9, 148200, 31],
    ['tom', 'tetris', 14, 11, 112640, 25],
    ['lena', 'tetris', 11, 9, 98550, 20],
    ['salma', 'casino', 26, 19, 4200, 45],
    ['raph', 'casino', 8, 17, 1600, 25],
    ['noah', 'casino', 14, 16, 2850, 30],
    ['milo', 'poker', 7, 5, 1, 12],
    ['salma', 'poker', 11, 4, 1, 15],
    ['lena', 'petit_bac', 10, 6, 72, 16],
    ['zoe', 'petit_bac', 13, 5, 91, 18],
    ['tom', 'battleship', 6, 4, 1, 10],
    ['noah', 'battleship', 8, 3, 1, 11],
  ] as const;

  await prisma.gameStats.createMany({
    data: gameStatsSeed.map(([username, gameType, wins, losses, highScore, totalPlayed]) => ({
      userId: userByName.get(username)!.id,
      gameType,
      wins,
      losses,
      highScore,
      totalPlayed,
    })),
  });

  await prisma.bombPartyStats.createMany({
    data: [
      { userId: userByName.get('lena')!.id, wins: 6, losses: 4, totalPlayed: 10, wordsTyped: 118, longestWord: 'constellation' },
      { userId: userByName.get('milo')!.id, wins: 9, losses: 5, totalPlayed: 14, wordsTyped: 156, longestWord: 'miscalculation' },
      { userId: userByName.get('salma')!.id, wins: 12, losses: 3, totalPlayed: 15, wordsTyped: 181, longestWord: 'transformation' },
      { userId: userByName.get('raph')!.id, wins: 3, losses: 8, totalPlayed: 11, wordsTyped: 67, longestWord: 'meteorology' },
      { userId: userByName.get('zoe')!.id, wins: 8, losses: 6, totalPlayed: 14, wordsTyped: 143, longestWord: 'extraordinary' },
    ],
  });

  const trackDate = startOfDay();
  await prisma.dailyRacerRun.createMany({
    data: [
      { userId: userByName.get('milo')!.id, trackDate, lapTimeMs: 68412, createdAt: hoursAgo(9) },
      { userId: userByName.get('milo')!.id, trackDate, lapTimeMs: 67994, createdAt: hoursAgo(4) },
      { userId: userByName.get('salma')!.id, trackDate, lapTimeMs: 67108, createdAt: hoursAgo(5) },
      { userId: userByName.get('lena')!.id, trackDate, lapTimeMs: 69550, createdAt: hoursAgo(3) },
      { userId: userByName.get('zoe')!.id, trackDate, lapTimeMs: 70255, createdAt: hoursAgo(2) },
      { userId: userByName.get('noah')!.id, trackDate, lapTimeMs: 71510, createdAt: hoursAgo(1) },
    ],
  });

  await prisma.chatMessage.createMany({
    data: [
      { userId: userByName.get('lena')!.id, message: 'Party publique ouverte pour Bomb Party dans 10 minutes.', pinned: true, pinnedAt: hoursAgo(3), createdAt: hoursAgo(3) },
      { userId: userByName.get('tom')!.id, message: 'Le shop a enfin assez d items pour tester les cadeaux.', createdAt: hoursAgo(2.8) },
      { userId: userByName.get('milo')!.id, message: 'Daily racer en 67.9, je veux voir mieux.', createdAt: hoursAgo(2.5) },
      { userId: userByName.get('salma')!.id, message: 'Quelqu un valide ma suggestion Polymarket ?', createdAt: hoursAgo(2.1) },
      { userId: userByName.get('nina')!.id, message: 'Inbox pleine, je garde les Lucky Koi pour plus tard.', createdAt: hoursAgo(1.8) },
      { userId: userByName.get('zoe')!.id, message: 'Les Nebuleux prennent un nouveau membre ce soir.', createdAt: hoursAgo(1.4) },
    ],
  });

  const chatMessages = await prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' } });
  await prisma.chatReaction.createMany({
    data: [
      { messageId: chatMessages[0].id, userId: userByName.get('milo')!.id, emoji: '🔥' },
      { messageId: chatMessages[2].id, userId: userByName.get('salma')!.id, emoji: '🏎️' },
      { messageId: chatMessages[3].id, userId: userByName.get('lena')!.id, emoji: '📈' },
      { messageId: chatMessages[5].id, userId: userByName.get('raph')!.id, emoji: '🙌' },
    ],
  });

  await prisma.transfer.createMany({
    data: [
      {
        senderId: userByName.get('lena')!.id,
        receiverId: userByName.get('raph')!.id,
        auraAmount: 20,
        moneyAmount: 150,
        isGift: true,
        message: 'Starter pack for tonight.',
        createdAt: hoursAgo(30),
      },
      {
        senderId: userByName.get('milo')!.id,
        receiverId: userByName.get('tom')!.id,
        auraAmount: 12,
        moneyAmount: 0,
        isGift: false,
        message: 'Bet settled.',
        createdAt: hoursAgo(20),
      },
      {
        senderId: userByName.get('salma')!.id,
        receiverId: userByName.get('nina')!.id,
        auraAmount: 0,
        moneyAmount: 300,
        isGift: false,
        message: 'For the next gift batch.',
        createdAt: hoursAgo(12),
      },
      {
        senderId: userByName.get('zoe')!.id,
        receiverId: userByName.get('noah')!.id,
        auraAmount: 15,
        moneyAmount: 90,
        isGift: false,
        message: 'Clan dues refunded.',
        createdAt: hoursAgo(4),
      },
    ],
  });

  await prisma.party.createMany({
    data: [
      { name: 'Les Nebuleux', isPublic: true, maxSize: 6, createdAt: daysAgo(5), lastActivity: hoursAgo(1) },
      { name: 'Aura Rangers', isPublic: false, maxSize: 5, createdAt: daysAgo(4), lastActivity: hoursAgo(2) },
      { name: 'Speed Demons', isPublic: true, maxSize: 4, createdAt: daysAgo(2), lastActivity: hoursAgo(5) },
    ],
  });

  const parties = await prisma.party.findMany();
  const partyByName = new Map(parties.map((party) => [party.name, party]));
  await prisma.partyMember.createMany({
    data: [
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('lena')!.id, isLeader: true },
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('raph')!.id, isLeader: false },
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('zoe')!.id, isLeader: false },
      { partyId: partyByName.get('Aura Rangers')!.id, userId: userByName.get('salma')!.id, isLeader: true },
      { partyId: partyByName.get('Aura Rangers')!.id, userId: userByName.get('tom')!.id, isLeader: false },
      { partyId: partyByName.get('Aura Rangers')!.id, userId: userByName.get('nina')!.id, isLeader: false },
      { partyId: partyByName.get('Speed Demons')!.id, userId: userByName.get('milo')!.id, isLeader: true },
      { partyId: partyByName.get('Speed Demons')!.id, userId: userByName.get('noah')!.id, isLeader: false },
    ],
  });

  const nebuleux = await prisma.clan.create({
    data: {
      name: 'Les Nebuleux',
      description: 'Clan public de mock pour clans, inbox et profils.',
      imageUrl: MOCK_IMAGE.clan,
      isPublic: true,
      maxMembers: 5,
      ownerId: userByName.get('zoe')!.id,
    },
  });

  const orbit = await prisma.clan.create({
    data: {
      name: 'Orbit Exchange',
      description: 'Clan prive pour traders Aura Coin et Polymarket.',
      imageUrl: MOCK_IMAGE.market,
      isPublic: false,
      maxMembers: 5,
      ownerId: userByName.get('salma')!.id,
    },
  });

  await prisma.clanMember.createMany({
    data: [
      { clanId: nebuleux.id, userId: userByName.get('zoe')!.id, isLeader: true },
      { clanId: nebuleux.id, userId: userByName.get('lena')!.id, isLeader: false },
      { clanId: nebuleux.id, userId: userByName.get('raph')!.id, isLeader: false },
      { clanId: orbit.id, userId: userByName.get('salma')!.id, isLeader: true },
      { clanId: orbit.id, userId: userByName.get('tom')!.id, isLeader: false },
      { clanId: orbit.id, userId: userByName.get('nina')!.id, isLeader: false },
    ],
  });

  await prisma.clanJoinRequest.create({
    data: {
      clanId: nebuleux.id,
      userId: userByName.get('noah')!.id,
      createdAt: hoursAgo(6),
    },
  });

  await prisma.auraCoinPrice.createMany({
    data: [
      { price: 1.42, volume: 3200, createdAt: hoursAgo(36) },
      { price: 1.48, volume: 4100, createdAt: hoursAgo(30) },
      { price: 1.51, volume: 4500, createdAt: hoursAgo(24) },
      { price: 1.57, volume: 5200, createdAt: hoursAgo(20) },
      { price: 1.61, volume: 6400, createdAt: hoursAgo(16) },
      { price: 1.58, volume: 5900, createdAt: hoursAgo(12) },
      { price: 1.66, volume: 7100, createdAt: hoursAgo(8) },
      { price: 1.72, volume: 7600, createdAt: hoursAgo(4) },
      { price: 1.69, volume: 6880, createdAt: hoursAgo(1) },
    ],
  });

  await prisma.auraCoinTransaction.createMany({
    data: [
      { userId: userByName.get('milo')!.id, type: 'BUY', coinAmount: 8.5, moneyAmount: 1320, price: 1.55, fee: 20, createdAt: hoursAgo(22) },
      { userId: userByName.get('salma')!.id, type: 'BUY', coinAmount: 10.1, moneyAmount: 1620, price: 1.58, fee: 25, createdAt: hoursAgo(17) },
      { userId: userByName.get('lena')!.id, type: 'SELL', coinAmount: 4.2, moneyAmount: 710, price: 1.69, fee: 11, createdAt: hoursAgo(9) },
      { userId: userByName.get('nina')!.id, type: 'BUY', coinAmount: 2.8, moneyAmount: 440, price: 1.57, fee: 8, createdAt: hoursAgo(7) },
      { userId: userByName.get('tom')!.id, type: 'SELL', coinAmount: 1.6, moneyAmount: 260, price: 1.66, fee: 4, createdAt: hoursAgo(3) },
    ],
  });

  await prisma.auraCoinPosition.createMany({
    data: [
      {
        userId: userByName.get('salma')!.id,
        type: 'LONG',
        leverage: 3,
        entryPrice: 1.58,
        coinAmount: 18.0,
        marginAmount: 950,
        isOpen: true,
        createdAt: hoursAgo(10),
      },
      {
        userId: userByName.get('milo')!.id,
        type: 'SHORT',
        leverage: 2,
        entryPrice: 1.72,
        coinAmount: 12.0,
        marginAmount: 700,
        isOpen: true,
        createdAt: hoursAgo(2),
      },
      {
        userId: userByName.get('lena')!.id,
        type: 'LONG',
        leverage: 4,
        entryPrice: 1.44,
        coinAmount: 20.0,
        marginAmount: 800,
        isOpen: false,
        exitPrice: 1.61,
        pnl: 340,
        liquidated: false,
        createdAt: hoursAgo(30),
        closedAt: hoursAgo(18),
      },
      {
        userId: userByName.get('tom')!.id,
        type: 'SHORT',
        leverage: 5,
        entryPrice: 1.49,
        coinAmount: 14.0,
        marginAmount: 600,
        isOpen: false,
        exitPrice: 1.66,
        pnl: -220,
        liquidated: false,
        createdAt: hoursAgo(28),
        closedAt: hoursAgo(11),
      },
    ],
  });

  await prisma.bugReport.createMany({
    data: [
      {
        userId: userByName.get('raph')!.id,
        title: 'Racer countdown overlaps the HUD',
        description: 'The countdown text can cover the lap card on narrow screens.',
        status: 'PENDING',
        createdAt: hoursAgo(26),
      },
      {
        userId: userByName.get('nina')!.id,
        title: 'Gift inbox order feels inverted',
        description: 'Newest gifts should stay at the top after opening one gift.',
        status: 'DONE',
        createdAt: hoursAgo(21),
        resolvedAt: hoursAgo(6),
      },
      {
        userId: userByName.get('zoe')!.id,
        title: 'Clan dialog preview stretches wide images',
        description: 'Mock banner images should keep aspect ratio in the create clan modal.',
        status: 'PENDING',
        createdAt: hoursAgo(8),
      },
    ],
  });

  const suggestionA = await prisma.suggestion.create({
    data: {
      userId: userByName.get('tom')!.id,
      title: 'Daily clan contract',
      description: 'Add a rotating clan mission with shared reward and inbox recap.',
      imageUrl: MOCK_IMAGE.clan,
      status: 'PENDING',
      createdAt: hoursAgo(48),
    },
  });
  const suggestionB = await prisma.suggestion.create({
    data: {
      userId: userByName.get('salma')!.id,
      title: 'Polymarket event badges',
      description: 'Grant a visible badge when a user resolves three markets in a row.',
      imageUrl: MOCK_IMAGE.market,
      status: 'DONE',
      createdAt: hoursAgo(36),
      resolvedAt: hoursAgo(10),
    },
  });
  const suggestionC = await prisma.suggestion.create({
    data: {
      userId: userByName.get('zoe')!.id,
      title: 'Quest reroll token',
      description: 'One reroll per day using money, visible from the dashboard quest widget.',
      imageUrl: MOCK_IMAGE.update,
      status: 'PENDING',
      createdAt: hoursAgo(18),
    },
  });

  await prisma.suggestionVote.createMany({
    data: [
      { suggestionId: suggestionA.id, userId: userByName.get('lena')!.id, value: 1 },
      { suggestionId: suggestionA.id, userId: userByName.get('milo')!.id, value: 1 },
      { suggestionId: suggestionA.id, userId: userByName.get('raph')!.id, value: -1 },
      { suggestionId: suggestionB.id, userId: userByName.get('tom')!.id, value: 1 },
      { suggestionId: suggestionB.id, userId: userByName.get('nina')!.id, value: 1 },
      { suggestionId: suggestionC.id, userId: userByName.get('salma')!.id, value: 1 },
      { suggestionId: suggestionC.id, userId: userByName.get('noah')!.id, value: 1 },
    ],
  });

  await prisma.suggestionRating.createMany({
    data: [
      { suggestionId: suggestionB.id, userId: userByName.get('lena')!.id, rating: 8 },
      { suggestionId: suggestionB.id, userId: userByName.get('milo')!.id, rating: 9 },
      { suggestionId: suggestionB.id, userId: userByName.get('zoe')!.id, rating: 7 },
    ],
  });

  await prisma.suggestionComment.createMany({
    data: [
      { suggestionId: suggestionA.id, userId: userByName.get('zoe')!.id, content: 'Good fit for the clan page and inbox together.' },
      { suggestionId: suggestionA.id, userId: userByName.get('salma')!.id, content: 'Needs a visible cooldown, otherwise yes.' },
      { suggestionId: suggestionC.id, userId: userByName.get('nina')!.id, content: 'Please keep the reroll price low enough for new users.' },
    ],
  });

  const polyPending = await insertPolymarketSuggestion({
    userId: userByName.get('raph')!.id,
    title: 'Aura Coin closes above 1.80 tonight',
    description: 'Simple one-day market for the current trading streak.',
    imageUrl: MOCK_IMAGE.market,
    eventDate: daysAgo(0, 23),
    suggestedYesOdds: 1.7,
    suggestedNoOdds: 2.1,
    status: 'PENDING',
    createdAt: hoursAgo(7),
  });

  const polyApproved = await insertPolymarketSuggestion({
    userId: userByName.get('salma')!.id,
    title: 'New clan joins exceed 2 before Friday',
    description: 'Tracks whether two or more accepted join requests land before week end.',
    imageUrl: MOCK_IMAGE.clan,
    eventDate: daysAgo(-3, 18),
    suggestedYesOdds: 1.9,
    suggestedNoOdds: 1.9,
    status: 'APPROVED',
    reviewedAt: hoursAgo(14),
    reviewedBy: admin.id,
    createdAt: hoursAgo(20),
  });
  const polyApprovedTitle = 'New clan joins exceed 2 before Friday';
  const polyApprovedDescription = 'Tracks whether two or more accepted join requests land before week end.';
  const polyApprovedImage = MOCK_IMAGE.clan;

  const eventOpen = await prisma.polymarketEvent.create({
    data: {
      suggestionId: polyApproved.id,
      title: polyApprovedTitle,
      description: polyApprovedDescription,
      imageUrl: polyApprovedImage,
      eventDate: daysAgo(-3, 18),
      yesOdds: 1.9,
      noOdds: 1.9,
      status: 'OPEN',
      createdAt: hoursAgo(14),
    },
  });

  const eventResolved = await prisma.polymarketEvent.create({
    data: {
      title: 'Daily racer world record falls under 67 seconds',
      description: 'Community bet tied to the seeded daily racer leaderboard.',
      imageUrl: MOCK_IMAGE.cardB,
      eventDate: hoursAgo(5),
      yesOdds: 2.4,
      noOdds: 1.6,
      status: 'RESOLVED',
      resolution: 'NO',
      resolvedAt: hoursAgo(2),
      resolvedBy: admin.id,
      closedAt: hoursAgo(6),
      createdAt: hoursAgo(18),
    },
  });

  const eventClosed = await prisma.polymarketEvent.create({
    data: {
      title: 'Update popup ships before midnight',
      description: 'Tests CLOSED markets that are not yet resolved.',
      imageUrl: MOCK_IMAGE.update,
      eventDate: daysAgo(-1, 0),
      yesOdds: 1.8,
      noOdds: 2.0,
      status: 'CLOSED',
      closedAt: hoursAgo(1),
      createdAt: hoursAgo(16),
    },
  });

  await prisma.polymarketBet.createMany({
    data: [
      { userId: userByName.get('lena')!.id, eventId: eventOpen.id, prediction: 'YES', amount: 240, createdAt: hoursAgo(13) },
      { userId: userByName.get('milo')!.id, eventId: eventOpen.id, prediction: 'NO', amount: 180, createdAt: hoursAgo(11) },
      { userId: userByName.get('nina')!.id, eventId: eventResolved.id, prediction: 'YES', amount: 120, payout: null, createdAt: hoursAgo(17) },
      { userId: userByName.get('salma')!.id, eventId: eventResolved.id, prediction: 'NO', amount: 200, payout: 320n, createdAt: hoursAgo(17) },
      { userId: userByName.get('tom')!.id, eventId: eventClosed.id, prediction: 'YES', amount: 140, createdAt: hoursAgo(4) },
    ],
  });

  const today = startOfDay();
  const quests = await prisma.$transaction([
    prisma.dailyQuest.create({
      data: { questType: 'JOIN_PARTIES', title: 'Party finder', description: 'Join 3 parties today', targetValue: 3, moneyReward: 120, auraReward: 8, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'DOODLE_JUMP_SCORE', title: 'Sky run', description: 'Reach 1500 on Doodle Jump', targetValue: 1500, moneyReward: 180, auraReward: 12, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'GAME_2048_SCORE', title: 'Merge lane', description: 'Reach 2048 score today', targetValue: 2048, moneyReward: 160, auraReward: 10, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'FLAPPY_BIRD_SCORE', title: 'Pipe test', description: 'Score 40 on Flappy Bird', targetValue: 40, moneyReward: 180, auraReward: 12, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'BOMB_PARTY_PLAYS', title: 'Word rush', description: 'Play 2 Bomb Party games', targetValue: 2, moneyReward: 140, auraReward: 9, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'POKER_PLAYS', title: 'Card table', description: 'Play 2 Poker hands', targetValue: 2, moneyReward: 130, auraReward: 8, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'PETIT_BAC_PLAYS', title: 'Letter sprint', description: 'Play 2 Petit Bac rounds', targetValue: 2, moneyReward: 130, auraReward: 8, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'BATTLESHIP_PLAYS', title: 'Naval duel', description: 'Play 2 battleship games', targetValue: 2, moneyReward: 150, auraReward: 10, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'WIN_GAMES', title: 'Clean sweep', description: 'Win 3 games today', targetValue: 3, moneyReward: 220, auraReward: 16, questDate: today },
    }),
    prisma.dailyQuest.create({
      data: { questType: 'PLAY_GAMES', title: 'Full rotation', description: 'Play 8 games today', targetValue: 8, moneyReward: 200, auraReward: 14, questDate: today },
    }),
  ]);

  const lenaQuests = await prisma.$transaction([
    prisma.userDailyQuest.create({
      data: {
        userId: userByName.get('lena')!.id,
        questId: quests[0].id,
        questDate: today,
        isCompleted: false,
      },
    }),
    prisma.userDailyQuest.create({
      data: {
        userId: userByName.get('lena')!.id,
        questId: quests[1].id,
        questDate: today,
        isCompleted: true,
        completedAt: hoursAgo(3),
      },
    }),
    prisma.userDailyQuest.create({
      data: {
        userId: userByName.get('lena')!.id,
        questId: quests[8].id,
        questDate: today,
        isCompleted: true,
        completedAt: hoursAgo(2),
        isClaimed: true,
        claimedAt: hoursAgo(1),
      },
    }),
  ]);

  const miloQuests = await prisma.$transaction([
    prisma.userDailyQuest.create({
      data: {
        userId: userByName.get('milo')!.id,
        questId: quests[2].id,
        questDate: today,
        isCompleted: false,
      },
    }),
    prisma.userDailyQuest.create({
      data: {
        userId: userByName.get('milo')!.id,
        questId: quests[4].id,
        questDate: today,
        isCompleted: true,
        completedAt: hoursAgo(4),
      },
    }),
    prisma.userDailyQuest.create({
      data: {
        userId: userByName.get('milo')!.id,
        questId: quests[9].id,
        questDate: today,
        isCompleted: false,
      },
    }),
  ]);

  await prisma.userQuestProgress.createMany({
    data: [
      { userQuestId: lenaQuests[0].id, currentValue: 2, lastUpdated: hoursAgo(1) },
      { userQuestId: lenaQuests[1].id, currentValue: 1670, lastUpdated: hoursAgo(3) },
      { userQuestId: lenaQuests[2].id, currentValue: 3, lastUpdated: hoursAgo(2) },
      { userQuestId: miloQuests[0].id, currentValue: 1536, lastUpdated: hoursAgo(1) },
      { userQuestId: miloQuests[1].id, currentValue: 2, lastUpdated: hoursAgo(4) },
      { userQuestId: miloQuests[2].id, currentValue: 5, lastUpdated: hoursAgo(1) },
    ],
  });

  await prisma.giftTemplate.createMany({
    data: [
      { name: 'Sticker Pack', description: 'Tiny cosmetic pack for inbox previews.', imageUrl: MOCK_IMAGE.update, price: 80, createdAt: hoursAgo(30) },
      { name: 'Clan Banner', description: 'Banner token for clan themed gifts.', imageUrl: MOCK_IMAGE.clan, price: 140, createdAt: hoursAgo(28) },
      { name: 'Market Ticket', description: 'Prediction token for Polymarket style gifts.', imageUrl: MOCK_IMAGE.market, price: 110, createdAt: hoursAgo(24) },
    ],
  });

  const giftTemplates = await prisma.giftTemplate.findMany();
  const giftTemplateByName = new Map(giftTemplates.map((template) => [template.name, template]));

  const giftInbox = await insertGift({
    senderId: userByName.get('tom')!.id,
    receiverId: userByName.get('lena')!.id,
    message: 'For your next clan push.',
    moneyAmount: 180,
    auraAmount: 14,
    createdAt: hoursAgo(5),
  });
  const giftOpened = await insertGift({
    senderId: userByName.get('salma')!.id,
    receiverId: userByName.get('lena')!.id,
    message: 'You earned this after the racer tie-break.',
    moneyAmount: 320,
    auraAmount: 20,
    isOpened: true,
    openedAt: hoursAgo(6),
    createdAt: hoursAgo(8),
    giftedItemId: itemByName.get('Lucky Koi')!.id,
  });
  const giftShopItem = await insertGift({
    senderId: userByName.get('nina')!.id,
    receiverId: userByName.get('tom')!.id,
    message: 'Test du flux cadeau boutique.',
    giftedItemId: itemByName.get('Mystery Crate')!.id,
    isOpened: false,
    createdAt: hoursAgo(2),
  });

  await prisma.giftItem.createMany({
    data: [
      { giftId: giftInbox.id, giftTemplateId: giftTemplateByName.get('Sticker Pack')!.id },
      { giftId: giftInbox.id, giftTemplateId: giftTemplateByName.get('Market Ticket')!.id },
      { giftId: giftOpened.id, giftTemplateId: giftTemplateByName.get('Clan Banner')!.id },
      { giftId: giftShopItem.id, giftTemplateId: giftTemplateByName.get('Sticker Pack')!.id },
    ],
  });

  const popup1 = await prisma.updatePopup.create({
    data: {
      title: '1.9 mock data refresh',
      summary: 'Dashboard, clans, inbox, market and quests now have richer seed data.',
      message: 'This popup ships with seeded gifts, polymarket events, clans, quest progress, daily racer runs, and reusable mock images for cards and avatars.',
      imageUrl: MOCK_IMAGE.update,
      releaseDate: hoursAgo(12),
      isPublished: true,
      createdById: admin.id,
      createdAt: hoursAgo(12),
    },
  });
  const popup2 = await prisma.updatePopup.create({
    data: {
      title: 'Prediction market visuals',
      summary: 'Added local SVG mock visuals for polymarket and clan cards.',
      message: 'Use the new local assets to preview suggestion images, event covers, update popups, and profile avatars without external URLs.',
      imageUrl: MOCK_IMAGE.market,
      releaseDate: hoursAgo(3),
      isPublished: true,
      createdById: admin.id,
      createdAt: hoursAgo(3),
    },
  });

  await prisma.userUpdatePopupView.createMany({
    data: [
      { userId: userByName.get('milo')!.id, popupId: popup1.id, viewedAt: hoursAgo(10) },
      { userId: userByName.get('salma')!.id, popupId: popup1.id, viewedAt: hoursAgo(9) },
      { userId: userByName.get('lena')!.id, popupId: popup2.id, viewedAt: hoursAgo(1) },
    ],
  });

  if (existingTables.has('Notification')) {
    await prisma.notification.createMany({
      data: [
        {
          userId: userByName.get('lena')!.id,
          type: 'GIFT_RECEIVED',
          title: 'New gift in inbox',
          body: 'Tom sent aura, money, and templates to your inbox.',
          data: JSON.stringify({ giftId: giftInbox.id, senderUsername: 'tom' }),
          link: '/inbox',
          icon: 'gift',
          isRead: false,
          createdAt: hoursAgo(5),
        },
        {
          userId: userByName.get('zoe')!.id,
          type: 'CLAN_JOIN_REQUEST',
          title: 'New clan request',
          body: 'Noah asked to join Les Nebuleux.',
          data: JSON.stringify({ clanId: nebuleux.id, requesterId: userByName.get('noah')!.id }),
          link: '/clans',
          icon: 'flag',
          isRead: false,
          createdAt: hoursAgo(6),
        },
        {
          userId: userByName.get('salma')!.id,
          type: 'POLYMARKET_WIN',
          title: 'Market won',
          body: 'Your NO position on the racer market paid out.',
          data: JSON.stringify({ eventId: eventResolved.id, payout: 320 }),
          link: '/polymarket',
          icon: 'bar-chart-3',
          isRead: false,
          createdAt: hoursAgo(2),
        },
        {
          userId: userByName.get('nina')!.id,
          type: 'POLYMARKET_LOSS',
          title: 'Market lost',
          body: 'Your YES bet on the racer market resolved against you.',
          data: JSON.stringify({ eventId: eventResolved.id }),
          link: '/polymarket',
          icon: 'bar-chart-3',
          isRead: true,
          readAt: hoursAgo(1),
          createdAt: hoursAgo(2),
        },
        {
          userId: userByName.get('lena')!.id,
          type: 'QUEST_COMPLETED',
          title: 'Quest complete',
          body: 'Sky run is ready to claim.',
          data: JSON.stringify({ questId: quests[1].id }),
          link: '/quests',
          icon: 'check',
          isRead: false,
          createdAt: hoursAgo(3),
        },
        {
          userId: userByName.get('tom')!.id,
          type: 'ITEM_RECEIVED',
          title: 'Gifted item received',
          body: 'Nina sent you a Mystery Crate.',
          data: JSON.stringify({ giftId: giftShopItem.id, itemId: itemByName.get('Mystery Crate')!.id }),
          link: '/inbox',
          icon: 'package',
          isRead: false,
          createdAt: hoursAgo(2),
        },
        {
          userId: userByName.get('milo')!.id,
          type: 'SYSTEM',
          title: 'Mock seed refreshed',
          body: 'New seed data is available across the dashboard and admin tools.',
          data: JSON.stringify({ popupId: popup2.id }),
          link: '/',
          icon: 'sparkles',
          isRead: true,
          readAt: hoursAgo(1),
          createdAt: hoursAgo(1.2),
        },
      ],
    });
  }

  if (existingTables.has('OnlineSnapshot')) {
    await prisma.onlineSnapshot.createMany({
      data: [
        { count: 4, createdAt: daysAgo(6, 18) },
        { count: 7, createdAt: daysAgo(5, 21) },
        { count: 5, createdAt: daysAgo(4, 16) },
        { count: 9, createdAt: daysAgo(3, 20) },
        { count: 6, createdAt: daysAgo(2, 14) },
        { count: 11, createdAt: daysAgo(1, 22) },
        { count: 8, createdAt: hoursAgo(12) },
        { count: 10, createdAt: hoursAgo(1) },
      ],
    });
  }

  await prisma.log.createMany({
    data: [
      {
        type: 'AUTH',
        action: 'login',
        userId: userByName.get('lena')!.id,
        username: 'lena',
        createdAt: hoursAgo(6),
      },
      {
        type: 'GAME',
        action: 'game_complete',
        userId: userByName.get('milo')!.id,
        username: 'milo',
        details: JSON.stringify({ gameType: 'racer', score: 67994, won: true }),
        metadata: JSON.stringify({ gameType: 'racer' }),
        createdAt: hoursAgo(4),
      },
      {
        type: 'MARKETPLACE',
        action: 'item_purchase',
        userId: userByName.get('nina')!.id,
        username: 'nina',
        details: JSON.stringify({ itemName: 'Mystery Crate', quantity: 1 }),
        createdAt: hoursAgo(3.5),
      },
      {
        type: 'SUGGESTION',
        action: 'suggestion_create',
        userId: userByName.get('zoe')!.id,
        username: 'zoe',
        details: JSON.stringify({ title: suggestionC.title }),
        createdAt: hoursAgo(18),
      },
      {
        type: 'ECONOMY',
        action: 'transfer',
        userId: userByName.get('zoe')!.id,
        username: 'zoe',
        targetId: userByName.get('noah')!.id,
        targetName: 'noah',
        details: JSON.stringify({ auraAmount: 15, moneyAmount: 90 }),
        createdAt: hoursAgo(4),
      },
      {
        type: 'AURACOIN',
        action: 'position_open',
        userId: userByName.get('salma')!.id,
        username: 'salma',
        details: JSON.stringify({ type: 'LONG', leverage: 3, marginAmount: 950 }),
        createdAt: hoursAgo(10),
      },
      {
        type: 'PARTY',
        action: 'party_create',
        userId: userByName.get('milo')!.id,
        username: 'milo',
        details: JSON.stringify({ partyName: 'Speed Demons' }),
        createdAt: daysAgo(2),
      },
      {
        type: 'ADMIN',
        action: 'update_popup_create',
        userId: admin.id,
        username: 'admin',
        details: JSON.stringify({ title: popup2.title }),
        createdAt: hoursAgo(3),
      },
    ],
  });

  console.log('Seed complete.');
  console.log('Admin login: admin / SuperSecretAdminPassword');
  console.log('Mock users password: Password123!');
  console.log('Seeded features: games, racer daily, shop, inventory, clans, suggestions, polymarket, gifts, quests, pass, inbox, update popups, admin pending users.');
  console.log(`Kept active features only. No legacy placeholder entries were reintroduced for removed mock content.`);
  console.log(`Pending polymarket suggestion id: ${polyPending.id}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
