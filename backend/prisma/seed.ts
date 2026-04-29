/// <reference types="node" />

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();
const prismaAny = prisma as any;
const SEED_DATA_VERSION = 5; // Increment this whenever the seed data changes.
const SEED_VERSION_MARKER_PATH = path.resolve('prisma', '.seed-version.json');

const writeSeedVersionMarker = async () => {
  try {
    await fs.writeFile(
      SEED_VERSION_MARKER_PATH,
      JSON.stringify({ version: SEED_DATA_VERSION, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (error) {
    console.warn('Unable to persist seed version marker:', error);
  }
};

const DEV_PASSWORD = 'aaaaaa';
const COMMON_PASSWORD = DEV_PASSWORD;
const ADMIN_PASSWORD = DEV_PASSWORD;
const MOCK_IMAGE = {
  lena: '/images/mock/avatar-lena.svg',
  milo: '/images/mock/avatar-milo.svg',
  salma: '/images/mock/avatar-salma.svg',
  clanNebula: '/images/mock/clan-nebula.svg',
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
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);
const daysAgo = (days: number, hour = 12) => {
  const date = startOfDay(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  date.setHours(hour, 0, 0, 0);
  return date;
};
const getDirectKey = (userAId: string, userBId: string) => [userAId, userBId].sort().join(':');
const getCanonicalPair = (userIdA: string, userIdB: string) =>
  userIdA < userIdB
    ? { userAId: userIdA, userBId: userIdB }
    : { userAId: userIdB, userBId: userIdA };

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
  if (existingTables.has('AuraScrollCommentLike')) {
    await prisma.auraScrollCommentLike.deleteMany();
  }
  if (existingTables.has('AuraScrollComment')) {
    await prisma.auraScrollComment.deleteMany();
  }
  if (existingTables.has('AuraScrollLike')) {
    await prisma.auraScrollLike.deleteMany();
  }
  if (existingTables.has('AuraScrollPost')) {
    await prisma.auraScrollPost.deleteMany();
  }
  if (existingTables.has('UpdateReaction')) {
    await prisma.updateReaction.deleteMany();
  }
  if (existingTables.has('UpdateItem')) {
    await prisma.updateItem.deleteMany();
  }
  if (existingTables.has('UpdateEntry')) {
    await prisma.updateEntry.deleteMany();
  }
  if (existingTables.has('DirectMessage')) {
    await prisma.directMessage.deleteMany();
  }
  if (existingTables.has('DirectConversationParticipant')) {
    await prisma.directConversationParticipant.deleteMany();
  }
  if (existingTables.has('DirectConversation')) {
    await prisma.directConversation.deleteMany();
  }
  if (existingTables.has('SupportMessage')) {
    await prisma.supportMessage.deleteMany();
  }
  if (existingTables.has('AdminWarning')) {
    await prisma.adminWarning.deleteMany();
  }
  if (existingTables.has('CustomBadgeRequest')) {
    await prisma.customBadgeRequest.deleteMany();
  }
  if (existingTables.has('UserBadge')) {
    await prisma.userBadge.deleteMany();
  }
  if (existingTables.has('UserUpdatePopupView')) {
    await prismaAny.userUpdatePopupView.deleteMany();
  }
  if (existingTables.has('UpdatePopup')) {
    await prismaAny.updatePopup.deleteMany();
  }
  if (existingTables.has('Notification')) {
    await prisma.notification.deleteMany();
  }
  if (existingTables.has('PolytrackRecord')) {
    await prisma.polytrackRecord.deleteMany();
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
  if (existingTables.has('GameScoreHistory')) {
    await prisma.gameScoreHistory.deleteMany();
  }
  await prisma.bombPartyStats.deleteMany();
  await prisma.gameStats.deleteMany();
  await prisma.chatReaction.deleteMany();
  await prisma.chatMessage.deleteMany();
  if (existingTables.has('ClanPumpUpMessage')) {
    await prisma.clanPumpUpMessage.deleteMany();
  }
  if (existingTables.has('ClanWarNavalShot')) {
    await prisma.clanWarNavalShot.deleteMany();
  }
  if (existingTables.has('ClanWarNavalBoard')) {
    await prisma.clanWarNavalBoard.deleteMany();
  }
  if (existingTables.has('ClanWarGameLog')) {
    await prisma.clanWarGameLog.deleteMany();
  }
  if (existingTables.has('ClanWarFortification')) {
    await prisma.clanWarFortification.deleteMany();
  }
  if (existingTables.has('ClanWarAttack')) {
    await prisma.clanWarAttack.deleteMany();
  }
  if (existingTables.has('ClanWarDefense')) {
    await prisma.clanWarDefense.deleteMany();
  }
  if (existingTables.has('ClanWar')) {
    await prisma.clanWar.deleteMany();
  }
  if (existingTables.has('ClanMessage')) {
    await prisma.clanMessage.deleteMany();
  }
  await prisma.clanJoinRequest.deleteMany();
  if (existingTables.has('ClanEffect')) {
    await prisma.clanEffect.deleteMany();
  }
  if (existingTables.has('ClanOwnedItem')) {
    await prisma.clanOwnedItem.deleteMany();
  }
  await prisma.clanMember.deleteMany();
  await prisma.clan.deleteMany();
  if (existingTables.has('PartyMessage')) {
    await prisma.partyMessage.deleteMany();
  }
  await prisma.partyMember.deleteMany();
  await prisma.party.deleteMany();
  if (existingTables.has('ClashActivity')) {
    await prisma.clashActivity.deleteMany();
  }
  if (existingTables.has('ClashBattle')) {
    await prisma.clashBattle.deleteMany();
  }
  if (existingTables.has('ClashVillage')) {
    await prisma.clashVillage.deleteMany();
  }
  if (existingTables.has('RegistrationReview')) {
    await prisma.registrationReview.deleteMany();
  }
  if (existingTables.has('CheatingAccusation')) {
    await prisma.cheatingAccusation.deleteMany();
  }
  if (existingTables.has('DivorceProposal')) {
    await prisma.divorceProposal.deleteMany();
  }
  if (existingTables.has('MarriageProposal')) {
    await prisma.marriageProposal.deleteMany();
  }
  if (existingTables.has('Relationship')) {
    await prisma.relationship.deleteMany();
  }
  if (existingTables.has('UserSkill')) {
    await prisma.userSkill.deleteMany();
  }
  if (existingTables.has('ReviewEligibility')) {
    await prisma.reviewEligibility.deleteMany();
  }
  if (existingTables.has('LawyerRating')) {
    await prisma.lawyerRating.deleteMany();
  }
  if (existingTables.has('BusinessRating')) {
    await prisma.businessRating.deleteMany();
  }
  if (existingTables.has('FormationProductRating')) {
    await prisma.formationProductRating.deleteMany();
  }
  if (existingTables.has('FormationProductPurchase')) {
    await prisma.formationProductPurchase.deleteMany();
  }
  if (existingTables.has('FormationProduct')) {
    await prisma.formationProduct.deleteMany();
  }
  if (existingTables.has('BankAccount')) {
    await prisma.bankAccount.deleteMany();
  }
  if (existingTables.has('BusinessPurchasedItem')) {
    await prisma.businessPurchasedItem.deleteMany();
  }
  if (existingTables.has('BusinessTransaction')) {
    await prisma.businessTransaction.deleteMany();
  }
  if (existingTables.has('BusinessSupplyContract')) {
    await prisma.businessSupplyContract.deleteMany();
  }
  if (existingTables.has('BusinessSupplyOffer')) {
    await prisma.businessSupplyOffer.deleteMany();
  }
  if (existingTables.has('BusinessResourceInventory')) {
    await prisma.businessResourceInventory.deleteMany();
  }
  if (existingTables.has('BusinessConstructionMaterial')) {
    await prismaAny.businessConstructionMaterial.deleteMany();
  }
  if (existingTables.has('BusinessConstructionProject')) {
    await prismaAny.businessConstructionProject.deleteMany();
  }
  if (existingTables.has('BusinessStartupProduct')) {
    await prisma.businessStartupProduct.deleteMany();
  }
  if (existingTables.has('BusinessTransferTransaction')) {
    await prisma.businessTransferTransaction.deleteMany();
  }
  if (existingTables.has('BusinessBuyoutOffer')) {
    await prisma.businessBuyoutOffer.deleteMany();
  }
  if (existingTables.has('BusinessShareMarketListing')) {
    await prisma.businessShareMarketListing.deleteMany();
  }
  if (existingTables.has('BusinessShareProposal')) {
    await prisma.businessShareProposal.deleteMany();
  }
  if (existingTables.has('BusinessShareholder')) {
    await prisma.businessShareholder.deleteMany();
  }
  if (existingTables.has('BusinessInvestment')) {
    await prisma.businessInvestment.deleteMany();
  }
  if (existingTables.has('BusinessLoan')) {
    await prisma.businessLoan.deleteMany();
  }
  if (existingTables.has('BusinessInvitation')) {
    await prisma.businessInvitation.deleteMany();
  }
  if (existingTables.has('BusinessMember')) {
    await prisma.businessMember.deleteMany();
  }
  if (existingTables.has('Business')) {
    await prisma.business.deleteMany();
  }
  if (existingTables.has('UserFollow')) {
    await prisma.userFollow.deleteMany();
  }
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
      schoolLevel: 'TERMINALE',
      classLetter: 'B',
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
      schoolLevel: 'PREMIERE',
      classLetter: 'D',
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
      schoolLevel: 'TERMINALE',
      classLetter: 'A',
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
      schoolLevel: 'TERMINALE',
      classLetter: 'C',
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
      schoolLevel: 'PREMIERE',
      classLetter: 'B',
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
      schoolLevel: 'SECONDE',
      classLetter: 'E',
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
      schoolLevel: 'TERMINALE',
      classLetter: 'D',
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
      schoolLevel: 'PREMIERE',
      classLetter: 'A',
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
      username: 'ava',
      firstName: 'Ava',
      schoolLevel: 'TERMINALE',
      classLetter: 'E',
      email: 'ava@auratracker.com',
      aura: 1425n,
      money: 10150,
      auraCoinBalance: 29.3,
      usernameColor: '#EC4899',
      profilePicture: MOCK_IMAGE.lena,
      profileBanner: MOCK_IMAGE.bannerC,
      bio: 'Toujours en haut des events de clan et des records Polytrack.',
      dailyPassStreak: 11,
      lastDailyPassClaim: daysAgo(0, 8),
      isApproved: true,
    },
    {
      username: 'lucas',
      firstName: 'Lucas',
      schoolLevel: 'PREMIERE',
      classLetter: 'C',
      email: 'lucas@auratracker.com',
      aura: 875n,
      money: 6240,
      auraCoinBalance: 11.6,
      usernameColor: '#38BDF8',
      profilePicture: MOCK_IMAGE.milo,
      profileBanner: MOCK_IMAGE.bannerA,
      bio: 'Main Tetris, radar à records, et spécialiste des défenses de guerre.',
      dailyPassStreak: 5,
      lastDailyPassClaim: daysAgo(0, 10),
      isApproved: true,
    },
    {
      username: 'ines',
      firstName: 'Ines',
      schoolLevel: 'TERMINALE',
      classLetter: 'F',
      email: 'ines@auratracker.com',
      aura: 1335n,
      money: 8890,
      auraCoinBalance: 19.4,
      usernameColor: '#8B5CF6',
      profilePicture: MOCK_IMAGE.salma,
      profileBanner: MOCK_IMAGE.bannerB,
      bio: 'Aime les profils soignés, les badges rares et les grosses séries de quêtes.',
      dailyPassStreak: 8,
      lastDailyPassClaim: daysAgo(0, 7),
      isApproved: true,
    },
    {
      username: 'jade',
      firstName: 'Jade',
      schoolLevel: 'SECONDE',
      classLetter: 'A',
      email: 'jade@auratracker.com',
      aura: 590n,
      money: 4720,
      auraCoinBalance: 4.8,
      usernameColor: '#F59E0B',
      profilePicture: MOCK_IMAGE.lena,
      profileBanner: MOCK_IMAGE.bannerA,
      bio: 'Teste tout: inbox, support, chat, cadeaux et alertes système.',
      dailyPassStreak: 3,
      lastDailyPassClaim: daysAgo(1, 7),
      isApproved: true,
    },
    {
      username: 'theo',
      firstName: 'Theo',
      schoolLevel: 'PREMIERE',
      classLetter: 'F',
      email: 'theo@auratracker.com',
      aura: 960n,
      money: 7310,
      auraCoinBalance: 9.9,
      usernameColor: '#10B981',
      profilePicture: MOCK_IMAGE.milo,
      profileBanner: MOCK_IMAGE.bannerC,
      bio: 'Joueur de Poker, Bomb Party et clan games la nuit.',
      dailyPassStreak: 6,
      lastDailyPassClaim: daysAgo(0, 9),
      isApproved: true,
    },
    {
      username: 'yanis',
      firstName: 'Yanis',
      schoolLevel: 'TERMINALE',
      classLetter: 'G',
      email: 'yanis@auratracker.com',
      aura: 1180n,
      money: 8040,
      auraCoinBalance: 15.7,
      usernameColor: '#EF4444',
      profilePicture: MOCK_IMAGE.salma,
      profileBanner: MOCK_IMAGE.bannerB,
      bio: 'Speedrunner Racer et capitaine officieux sur les mini-jeux de guerre.',
      dailyPassStreak: 10,
      lastDailyPassClaim: daysAgo(0, 6),
      isApproved: true,
    },
    {
      username: 'camille',
      firstName: 'Camille',
      schoolLevel: 'SECONDE',
      classLetter: 'C',
      email: 'camille@auratracker.com',
      aura: 720n,
      money: 5480,
      auraCoinBalance: 7.3,
      usernameColor: '#14B8A6',
      profilePicture: MOCK_IMAGE.lena,
      profileBanner: MOCK_IMAGE.bannerC,
      bio: 'Clash Village, support, suivis sociaux et salons de clan.',
      dailyPassStreak: 4,
      lastDailyPassClaim: daysAgo(0, 12),
      isApproved: true,
    },
    {
      username: 'hugo',
      firstName: 'Hugo',
      schoolLevel: 'PREMIERE',
      classLetter: 'G',
      email: 'hugo@auratracker.com',
      aura: 510n,
      money: 3560,
      auraCoinBalance: 3.7,
      usernameColor: '#60A5FA',
      profilePicture: MOCK_IMAGE.milo,
      profileBanner: MOCK_IMAGE.bannerA,
      bio: 'Nouveau mais deja partout: leaderboards, social et guerres de clans.',
      dailyPassStreak: 2,
      lastDailyPassClaim: null,
      isApproved: true,
    },
    {
      username: 'iris_pending',
      firstName: 'Iris',
      schoolLevel: 'SECONDE',
      classLetter: 'D',
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
      schoolLevel: 'PREMIERE',
      classLetter: 'E',
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
    {
      username: 'maya_pending',
      firstName: 'Maya',
      schoolLevel: 'TERMINALE',
      classLetter: 'A',
      email: 'maya@auratracker.com',
      aura: 0n,
      money: 1000,
      auraCoinBalance: 0,
      usernameColor: '#F97316',
      profilePicture: null,
      bio: null,
      dailyPassStreak: 0,
      lastDailyPassClaim: null,
      motivationMessage: 'Je veux surtout suivre mes amis, jouer a Polytrack et rejoindre un clan actif.',
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
      schoolLevel: user.schoolLevel,
      classLetter: user.classLetter,
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

  await prisma.user.update({
    where: { id: userByName.get('lena')!.id },
    data: { referralCode: 'LENA2026' },
  });
  await prisma.user.update({
    where: { id: userByName.get('milo')!.id },
    data: { referralCode: 'MILOFAST' },
  });
  await prisma.user.update({
    where: { id: userByName.get('zoe')!.id },
    data: { referralCode: 'ZOECLAN' },
  });
  await prisma.user.update({
    where: { id: userByName.get('salma')!.id },
    data: { referralCode: 'SALMATOP' },
  });

  await prisma.user.updateMany({
    where: { username: { in: ['ava', 'lucas'] } },
    data: {
      referredById: userByName.get('lena')!.id,
      referredAt: daysAgo(12, 19),
      referralRewardGrantedAt: daysAgo(11, 12),
    },
  });
  await prisma.user.updateMany({
    where: { username: { in: ['yanis', 'hugo'] } },
    data: {
      referredById: userByName.get('milo')!.id,
      referredAt: daysAgo(8, 18),
      referralRewardGrantedAt: daysAgo(7, 11),
    },
  });
  await prisma.user.updateMany({
    where: { username: 'maya_pending' },
    data: {
      referredById: userByName.get('zoe')!.id,
      referredAt: hoursAgo(30),
    },
  });

  await prisma.registrationReview.createMany({
    data: ['iris_pending', 'leo_pending', 'maya_pending'].map((username) => {
      const user = userByName.get(username)!;
      return {
        registrationUserId: user.id,
        username: user.username,
        firstName: user.firstName,
        schoolLevel: user.schoolLevel,
        classLetter: user.classLetter,
        email: user.email,
        motivationMessage: user.motivationMessage,
        registrationCreatedAt: daysAgo(2, 17),
        status: 'PENDING',
        importedFromLegacy: false,
      };
    }),
  });

  await prisma.userFollow.createMany({
    data: [
      { followerId: userByName.get('lena')!.id, followingId: userByName.get('milo')!.id, createdAt: daysAgo(18, 19) },
      { followerId: userByName.get('lena')!.id, followingId: userByName.get('zoe')!.id, createdAt: daysAgo(12, 15) },
      { followerId: userByName.get('milo')!.id, followingId: userByName.get('lena')!.id, createdAt: daysAgo(17, 20) },
      { followerId: userByName.get('milo')!.id, followingId: userByName.get('yanis')!.id, createdAt: daysAgo(10, 18) },
      { followerId: userByName.get('salma')!.id, followingId: userByName.get('zoe')!.id, createdAt: daysAgo(9, 12) },
      { followerId: userByName.get('salma')!.id, followingId: userByName.get('ava')!.id, createdAt: daysAgo(7, 14) },
      { followerId: userByName.get('zoe')!.id, followingId: userByName.get('lena')!.id, createdAt: daysAgo(13, 16) },
      { followerId: userByName.get('zoe')!.id, followingId: userByName.get('salma')!.id, createdAt: daysAgo(6, 11) },
      { followerId: userByName.get('ava')!.id, followingId: userByName.get('lena')!.id, createdAt: daysAgo(5, 10) },
      { followerId: userByName.get('ava')!.id, followingId: userByName.get('milo')!.id, createdAt: daysAgo(5, 10) },
      { followerId: userByName.get('yanis')!.id, followingId: userByName.get('milo')!.id, createdAt: daysAgo(4, 19) },
      { followerId: userByName.get('camille')!.id, followingId: userByName.get('jade')!.id, createdAt: daysAgo(3, 13) },
      { followerId: userByName.get('jade')!.id, followingId: userByName.get('camille')!.id, createdAt: daysAgo(3, 14) },
      { followerId: userByName.get('hugo')!.id, followingId: userByName.get('ava')!.id, createdAt: daysAgo(2, 20) },
      { followerId: userByName.get('theo')!.id, followingId: userByName.get('salma')!.id, createdAt: daysAgo(2, 9) },
      { followerId: userByName.get('lucas')!.id, followingId: userByName.get('ines')!.id, createdAt: daysAgo(1, 18) },
      { followerId: userByName.get('ines')!.id, followingId: userByName.get('lucas')!.id, createdAt: daysAgo(1, 19) },
    ],
  });

  const youSkillKeys = ['affaires', 'social', 'intelligence', 'charisme', 'finance', 'illegalite'] as const;
  const skillLevelByUsername: Record<string, number> = {
    lena: 5,
    milo: 6,
    salma: 6,
    zoe: 4,
    tom: 3,
    nina: 2,
    ava: 5,
    yanis: 4,
    jade: 2,
    raph: 2,
    noah: 3,
  };

  await prisma.userSkill.createMany({
    data: Object.entries(skillLevelByUsername).flatMap(([username, level]) =>
      youSkillKeys.map((key, index) => ({
        userId: userByName.get(username)!.id,
        key,
        level,
        xp: Math.min(99, level * 12 + index * 3),
      }))
    ),
  });

  const lenaMiloPair = getCanonicalPair(userByName.get('lena')!.id, userByName.get('milo')!.id);
  const zoeSalmaPair = getCanonicalPair(userByName.get('zoe')!.id, userByName.get('salma')!.id);
  const ninaTomPair = getCanonicalPair(userByName.get('nina')!.id, userByName.get('tom')!.id);

  const [relationshipLenaMilo, relationshipZoeSalma, relationshipNinaTom] = await prisma.$transaction([
    prisma.relationship.create({
      data: {
        userAId: lenaMiloPair.userAId,
        userBId: lenaMiloPair.userBId,
        initiatedById: userByName.get('lena')!.id,
        status: 'MARRIED',
        connectionLevel: 93,
        coupleBalance: 2450,
        createdAt: daysAgo(120, 10),
        marriedAt: daysAgo(100, 12),
      },
    }),
    prisma.relationship.create({
      data: {
        userAId: zoeSalmaPair.userAId,
        userBId: zoeSalmaPair.userBId,
        initiatedById: userByName.get('zoe')!.id,
        status: 'DATING',
        connectionLevel: 74,
        coupleBalance: 0,
        createdAt: daysAgo(18, 18),
      },
    }),
    prisma.relationship.create({
      data: {
        userAId: ninaTomPair.userAId,
        userBId: ninaTomPair.userBId,
        initiatedById: userByName.get('tom')!.id,
        status: 'FRIEND',
        connectionLevel: 63,
        coupleBalance: 0,
        createdAt: daysAgo(7, 14),
      },
    }),
  ]);

  await prisma.marriageProposal.create({
    data: {
      relationshipId: relationshipZoeSalma.id,
      proposerId: userByName.get('zoe')!.id,
      recipientId: userByName.get('salma')!.id,
      message: 'On verrouille le duo pour la suite ?',
      status: 'PENDING',
      createdAt: hoursAgo(7),
    },
  });

  await prisma.cheatingAccusation.create({
    data: {
      accuserId: userByName.get('lena')!.id,
      accusedId: userByName.get('milo')!.id,
      status: 'PENDING',
      createdAt: hoursAgo(6),
    },
  });

  const businesses = await prisma.business.createManyAndReturn({
    data: [
      {
        ownerId: userByName.get('salma')!.id,
        supportAgentId: userByName.get('jade')!.id,
        name: 'Orbit Banque',
        typeKey: 'bank',
        description: 'Banque communautaire pour depots, prets et virements.',
        logoUrl: MOCK_IMAGE.market,
        location: 'Quartier central',
        mapX: 27,
        mapY: 34,
        verified: true,
        hiring: true,
        startingCapital: 10000,
        treasuryMoney: 18600,
        monthlyRevenue: 4200,
        monthlyExpenses: 800,
        satisfaction: 90,
        livretEpargneUnlocked: true,
        loanInterestRate: 4.5,
        transferFeeRate: 2.0,
        lastBankRevenueDate: startOfDay().toISOString(),
        lastBusinessRevenueDate: startOfDay().toISOString(),
        createdAt: daysAgo(28, 10),
      },
      {
        ownerId: userByName.get('milo')!.id,
        supportAgentId: userByName.get('camille')!.id,
        name: 'Nova Labs',
        typeKey: 'startup',
        description: 'Startup orientee produits SaaS et automatisation.',
        logoUrl: MOCK_IMAGE.cardB,
        location: 'Zone Tech',
        mapX: 61,
        mapY: 22,
        verified: true,
        hiring: true,
        startingCapital: 10000,
        treasuryMoney: 15200,
        monthlyRevenue: 5400,
        monthlyExpenses: 1700,
        satisfaction: 87,
        lastBusinessRevenueDate: startOfDay().toISOString(),
        createdAt: daysAgo(20, 11),
      },
      {
        ownerId: userByName.get('zoe')!.id,
        supportAgentId: userByName.get('jade')!.id,
        name: 'Lex Nova',
        typeKey: 'law_firm',
        description: 'Cabinet d avocats specialise en litiges entre joueurs.',
        logoUrl: MOCK_IMAGE.bannerA,
        location: 'District Justice',
        mapX: 74,
        mapY: 66,
        verified: true,
        hiring: true,
        startingCapital: 2500,
        treasuryMoney: 7600,
        monthlyRevenue: 2300,
        monthlyExpenses: 740,
        satisfaction: 86,
        lastBusinessRevenueDate: startOfDay().toISOString(),
        createdAt: daysAgo(17, 9),
      },
      {
        ownerId: userByName.get('lena')!.id,
        supportAgentId: userByName.get('tom')!.id,
        name: 'Campus Skills',
        typeKey: 'formation',
        description: 'Micro-formations pour optimiser jeu, commerce et social.',
        logoUrl: MOCK_IMAGE.update,
        location: 'Campus Nord',
        mapX: 42,
        mapY: 58,
        verified: true,
        hiring: true,
        startingCapital: 2800,
        treasuryMoney: 6300,
        monthlyRevenue: 1750,
        monthlyExpenses: 520,
        satisfaction: 83,
        formationUrl: 'https://example.com/campus-skills',
        formationPrice: 540,
        lastBusinessRevenueDate: startOfDay().toISOString(),
        createdAt: daysAgo(15, 13),
      },
      {
        ownerId: userByName.get('tom')!.id,
        supportAgentId: userByName.get('nina')!.id,
        name: 'Swift Transfer',
        typeKey: 'transfer',
        description: 'Service de transferts rapides avec frais reduits.',
        logoUrl: MOCK_IMAGE.cardC,
        location: 'Hub Commerce',
        mapX: 50,
        mapY: 40,
        verified: false,
        hiring: true,
        startingCapital: 5000,
        treasuryMoney: 9200,
        monthlyRevenue: 1180,
        monthlyExpenses: 690,
        satisfaction: 79,
        transferFeeRate: 1.5,
        lastBusinessRevenueDate: startOfDay().toISOString(),
        createdAt: daysAgo(12, 16),
      },
      {
        ownerId: userByName.get('noah')!.id,
        supportAgentId: userByName.get('ava')!.id,
        name: 'Burger Pulse',
        typeKey: 'restaurant',
        description: 'Resto rapide orienté ventes NPC et commandes joueurs.',
        logoUrl: MOCK_IMAGE.cardD,
        location: 'Centre Ville',
        mapX: 33,
        mapY: 72,
        verified: true,
        hiring: true,
        startingCapital: 2200,
        treasuryMoney: 4100,
        monthlyRevenue: 1300,
        monthlyExpenses: 450,
        satisfaction: 82,
        lastBusinessRevenueDate: startOfDay().toISOString(),
        createdAt: daysAgo(9, 12),
      },
      {
        ownerId: admin.id,
        supportAgentId: null,
        name: 'Cour Supreme Aura',
        typeKey: 'supreme_court',
        description: 'Institution judiciaire d etat pour les plaintes formelles.',
        logoUrl: MOCK_IMAGE.bannerC,
        location: 'Capitole',
        mapX: 86,
        mapY: 18,
        verified: true,
        hiring: false,
        startingCapital: 0,
        treasuryMoney: 0,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        satisfaction: 100,
        isStateOwned: true,
        createdAt: daysAgo(60, 10),
      },
      ...(process.env.NODE_ENV !== 'production' ? [
        {
          ownerId: userByName.get('ava')!.id,
          name: 'Ferme Basse Plaine',
          typeKey: 'farm',
          description: 'Production alimentaire bon marche pour les chantiers locaux.',
          logoUrl: MOCK_IMAGE.cardE,
          location: 'Plaine Sud',
          mapX: 18,
          mapY: 46,
          verified: true,
          hiring: true,
          startingCapital: 1200,
          treasuryMoney: 3400,
          monthlyRevenue: 700,
          monthlyExpenses: 180,
          satisfaction: 81,
          lastBusinessRevenueDate: startOfDay().toISOString(),
          createdAt: daysAgo(7, 10),
        },
        {
          ownerId: userByName.get('yanis')!.id,
          name: 'Scierie Yanis',
          typeKey: 'sawmill',
          description: 'Bois de chantier a prix bas.',
          logoUrl: MOCK_IMAGE.cardF,
          location: 'Foret Est',
          mapX: 12,
          mapY: 64,
          verified: true,
          hiring: true,
          startingCapital: 1800,
          treasuryMoney: 3900,
          monthlyRevenue: 900,
          monthlyExpenses: 260,
          satisfaction: 79,
          lastBusinessRevenueDate: startOfDay().toISOString(),
          createdAt: daysAgo(6, 11),
        },
        {
          ownerId: userByName.get('jade')!.id,
          name: 'Carriere Jade',
          typeKey: 'quarry',
          description: 'Pierre et beton disponibles pour les nouveaux commerces.',
          logoUrl: MOCK_IMAGE.cardG,
          location: 'Falaises Ouest',
          mapX: 44,
          mapY: 30,
          verified: true,
          hiring: true,
          startingCapital: 2200,
          treasuryMoney: 4300,
          monthlyRevenue: 980,
          monthlyExpenses: 310,
          satisfaction: 80,
          lastBusinessRevenueDate: startOfDay().toISOString(),
          createdAt: daysAgo(6, 14),
        },
        {
          ownerId: userByName.get('theo')!.id,
          name: 'Mine Theo',
          typeKey: 'iron_mine',
          description: 'Fer et acier pour les structures avancees.',
          logoUrl: MOCK_IMAGE.cardA,
          location: 'Mont Nord',
          mapX: 66,
          mapY: 48,
          verified: true,
          hiring: true,
          startingCapital: 2600,
          treasuryMoney: 5100,
          monthlyRevenue: 1100,
          monthlyExpenses: 360,
          satisfaction: 78,
          lastBusinessRevenueDate: startOfDay().toISOString(),
          createdAt: daysAgo(5, 9),
        },
        {
          ownerId: userByName.get('camille')!.id,
          name: 'Textile Camille',
          typeKey: 'textile_mill',
          description: 'Tissu en gros pour boutiques et agences.',
          logoUrl: MOCK_IMAGE.cardB,
          location: 'Ateliers Centre',
          mapX: 58,
          mapY: 70,
          verified: true,
          hiring: true,
          startingCapital: 1900,
          treasuryMoney: 3600,
          monthlyRevenue: 820,
          monthlyExpenses: 240,
          satisfaction: 82,
          lastBusinessRevenueDate: startOfDay().toISOString(),
          createdAt: daysAgo(5, 15),
        },
        {
          ownerId: admin.id,
          name: 'Depot Serveur Materiaux',
          typeKey: 'quarry',
          description: 'Offres serveur de secours pour tous les materiaux de chantier.',
          logoUrl: MOCK_IMAGE.market,
          location: 'Infrastructure serveur',
          mapX: 4,
          mapY: 12,
          verified: true,
          hiring: false,
          startingCapital: 0,
          treasuryMoney: 100000,
          monthlyRevenue: 0,
          monthlyExpenses: 0,
          satisfaction: 100,
          isStateOwned: true,
          createdAt: daysAgo(4, 10),
        },
      ] : []),
    ],
    select: {
      id: true,
      name: true,
    },
  });

  const businessByName = new Map(businesses.map((business) => [business.name, business]));

  if (process.env.NODE_ENV !== 'production') {
    const supplySeeds: Array<{ name: string; resources: Array<{ resourceType: string; quantity: number; capacity: number; rate: number; price: number }> }> = [
      { name: 'Ferme Basse Plaine', resources: [{ resourceType: 'FOOD', quantity: 420, capacity: 500, rate: 8, price: 3 }] },
      { name: 'Scierie Yanis', resources: [{ resourceType: 'WOOD', quantity: 360, capacity: 450, rate: 7, price: 4 }] },
      { name: 'Carriere Jade', resources: [
        { resourceType: 'STONE', quantity: 340, capacity: 450, rate: 7, price: 3 },
        { resourceType: 'CONCRETE', quantity: 240, capacity: 320, rate: 3, price: 6 },
      ] },
      { name: 'Mine Theo', resources: [
        { resourceType: 'IRON', quantity: 280, capacity: 360, rate: 5, price: 5 },
        { resourceType: 'STEEL', quantity: 180, capacity: 260, rate: 2, price: 8 },
      ] },
      { name: 'Textile Camille', resources: [{ resourceType: 'CLOTH', quantity: 260, capacity: 330, rate: 5, price: 4 }] },
      { name: 'Nova Labs', resources: [{ resourceType: 'DATA', quantity: 220, capacity: 300, rate: 3, price: 5 }] },
      { name: 'Campus Skills', resources: [{ resourceType: 'PAPER', quantity: 260, capacity: 340, rate: 2, price: 3 }] },
      { name: 'Burger Pulse', resources: [{ resourceType: 'FOOD', quantity: 180, capacity: 260, rate: 4, price: 4 }] },
      { name: 'Depot Serveur Materiaux', resources: [
        { resourceType: 'WOOD', quantity: 1000, capacity: 1200, rate: 0, price: 5 },
        { resourceType: 'STONE', quantity: 1000, capacity: 1200, rate: 0, price: 4 },
        { resourceType: 'IRON', quantity: 800, capacity: 1000, rate: 0, price: 6 },
        { resourceType: 'FOOD', quantity: 1000, capacity: 1200, rate: 0, price: 4 },
        { resourceType: 'CLOTH', quantity: 700, capacity: 900, rate: 0, price: 5 },
        { resourceType: 'CONCRETE', quantity: 800, capacity: 1000, rate: 0, price: 7 },
        { resourceType: 'STEEL', quantity: 600, capacity: 800, rate: 0, price: 9 },
        { resourceType: 'FUEL', quantity: 500, capacity: 700, rate: 0, price: 7 },
        { resourceType: 'PAPER', quantity: 700, capacity: 900, rate: 0, price: 4 },
        { resourceType: 'LUXURY_GOODS', quantity: 400, capacity: 600, rate: 0, price: 10 },
        { resourceType: 'MEDICINE', quantity: 400, capacity: 600, rate: 0, price: 9 },
        { resourceType: 'DATA', quantity: 600, capacity: 800, rate: 0, price: 6 },
        { resourceType: 'CONTRABAND', quantity: 250, capacity: 400, rate: 0, price: 12 },
      ] },
    ];

    for (const seed of supplySeeds) {
      const business = businessByName.get(seed.name);
      if (!business) continue;
      await prisma.businessResourceInventory.createMany({
        data: seed.resources.map((resource) => ({
          businessId: business.id,
          resourceType: resource.resourceType,
          quantity: resource.quantity,
          capacity: resource.capacity,
          productionRatePerHour: resource.rate,
          lastProducedAt: hoursAgo(1),
        })),
      });
      await prisma.businessSupplyOffer.createMany({
        data: seed.resources.map((resource) => ({
          businessId: business.id,
          resourceType: resource.resourceType,
          unitPrice: resource.price,
          autoAccept: true,
          isActive: true,
        })),
      });
    }
  }

  await prisma.businessMember.createMany({
    data: [
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        userId: userByName.get('jade')!.id,
        role: 'Conseillere',
        specialty: 'Comptes premium',
        salary: 460,
        createdAt: daysAgo(14, 9),
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        userId: userByName.get('yanis')!.id,
        role: 'associe',
        specialty: 'Produit',
        salary: 520,
        createdAt: daysAgo(13, 11),
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        userId: userByName.get('camille')!.id,
        role: 'Developpeuse',
        specialty: 'Frontend',
        salary: 430,
        createdAt: daysAgo(10, 10),
      },
      {
        businessId: businessByName.get('Lex Nova')!.id,
        userId: userByName.get('salma')!.id,
        role: 'Avocate',
        specialty: 'Contentieux commercial',
        isPrimaryLawyer: true,
        displayOrder: 0,
        salary: 600,
        createdAt: daysAgo(11, 14),
      },
      {
        businessId: businessByName.get('Lex Nova')!.id,
        userId: userByName.get('theo')!.id,
        role: 'Juriste',
        specialty: 'Procedures rapides',
        displayOrder: 1,
        salary: 340,
        createdAt: daysAgo(9, 9),
      },
      {
        businessId: businessByName.get('Campus Skills')!.id,
        userId: userByName.get('tom')!.id,
        role: 'Formateur',
        specialty: 'Monetisation',
        salary: 390,
        createdAt: daysAgo(8, 10),
      },
      {
        businessId: businessByName.get('Swift Transfer')!.id,
        userId: userByName.get('nina')!.id,
        role: 'associee',
        specialty: 'Operations',
        salary: 410,
        createdAt: daysAgo(7, 15),
      },
      {
        businessId: businessByName.get('Burger Pulse')!.id,
        userId: userByName.get('ava')!.id,
        role: 'Gerante',
        specialty: 'Service',
        salary: 350,
        createdAt: daysAgo(6, 12),
      },
    ],
  });

  await prisma.businessInvitation.createMany({
    data: [
      {
        businessId: businessByName.get('Campus Skills')!.id,
        inviterId: userByName.get('lena')!.id,
        inviteeId: userByName.get('ines')!.id,
        employerId: userByName.get('lena')!.id,
        employeeId: userByName.get('ines')!.id,
        initiatedByRole: 'EMPLOYER',
        role: 'Coach',
        salary: 380,
        message: 'On monte le niveau des formations social/finance.',
        status: 'PENDING',
        createdAt: hoursAgo(8),
      },
    ],
  });

  await prisma.businessLoan.createMany({
    data: [
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        borrowerId: userByName.get('raph')!.id,
        amount: 1200,
        termMonths: 30,
        interestRate: 5.5,
        motivationMessage: 'Investir dans mon stand de niveau 1.',
        collateralAura: 20,
        collateralAuraHeld: 20,
        status: 'APPROVED',
        repaidAmount: 300,
        decidedAt: daysAgo(3, 14),
        createdAt: daysAgo(3, 13),
      },
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        borrowerId: userByName.get('hugo')!.id,
        amount: 900,
        termMonths: 21,
        interestRate: 6.2,
        motivationMessage: 'Upgrade de production et equipement.',
        collateralAura: 10,
        collateralAuraHeld: 10,
        status: 'PENDING',
        repaidAmount: 0,
        createdAt: hoursAgo(5),
      },
    ],
  });

  await prisma.businessInvestment.createMany({
    data: [
      {
        businessId: businessByName.get('Nova Labs')!.id,
        investorId: userByName.get('ava')!.id,
        amount: 2200,
        riskLevel: 'medium',
        expectedReturnMin: 150,
        expectedReturnMax: 420,
        createdAt: daysAgo(2, 16),
      },
      {
        businessId: businessByName.get('Burger Pulse')!.id,
        investorId: userByName.get('lena')!.id,
        amount: 900,
        riskLevel: 'low',
        expectedReturnMin: 20,
        expectedReturnMax: 65,
        createdAt: daysAgo(1, 15),
      },
    ],
  });

  await prisma.businessShareholder.createMany({
    data: [
      {
        businessId: businessByName.get('Nova Labs')!.id,
        userId: userByName.get('milo')!.id,
        sharePercent: 65,
        investedAmount: 10000,
        averagePrice: 154,
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        userId: userByName.get('ava')!.id,
        sharePercent: 20,
        investedAmount: 3600,
        averagePrice: 180,
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        userId: userByName.get('yanis')!.id,
        sharePercent: 15,
        investedAmount: 2600,
        averagePrice: 173,
      },
      {
        businessId: businessByName.get('Swift Transfer')!.id,
        userId: userByName.get('tom')!.id,
        sharePercent: 75,
        investedAmount: 5000,
        averagePrice: 66,
      },
      {
        businessId: businessByName.get('Swift Transfer')!.id,
        userId: userByName.get('nina')!.id,
        sharePercent: 25,
        investedAmount: 1800,
        averagePrice: 72,
      },
    ],
  });

  await prisma.businessShareProposal.create({
    data: {
      businessId: businessByName.get('Nova Labs')!.id,
      investorId: userByName.get('salma')!.id,
      ownerId: userByName.get('milo')!.id,
      sharePercent: 8,
      amount: 1800,
      suggestedAmount: 2100,
      message: 'Je veux entrer pour booster le run croissance.',
      status: 'PENDING',
      createdAt: hoursAgo(4),
    },
  });

  await prisma.businessShareMarketListing.create({
    data: {
      businessId: businessByName.get('Swift Transfer')!.id,
      sellerId: userByName.get('nina')!.id,
      sharePercent: 5,
      price: 430,
      status: 'ACTIVE',
      createdAt: hoursAgo(9),
    },
  });

  await prisma.businessBuyoutOffer.create({
    data: {
      businessId: businessByName.get('Burger Pulse')!.id,
      bidderId: userByName.get('tom')!.id,
      ownerId: userByName.get('noah')!.id,
      amount: 6200,
      message: 'Offre cash immediate avec reprise de staff.',
      status: 'PENDING',
      createdAt: hoursAgo(10),
    },
  });

  await prisma.businessTransferTransaction.createMany({
    data: [
      {
        businessId: businessByName.get('Swift Transfer')!.id,
        senderId: userByName.get('tom')!.id,
        recipientId: userByName.get('hugo')!.id,
        amount: 300,
        fee: 5,
        feeRate: 1.5,
        createdAt: hoursAgo(11),
      },
      {
        businessId: businessByName.get('Swift Transfer')!.id,
        senderId: userByName.get('nina')!.id,
        recipientId: userByName.get('raph')!.id,
        amount: 420,
        fee: 6,
        feeRate: 1.5,
        createdAt: hoursAgo(3),
      },
    ],
  });

  await prisma.businessStartupProduct.createMany({
    data: [
      {
        businessId: businessByName.get('Nova Labs')!.id,
        slotIndex: 1,
        name: 'Produit Alpha',
        deployedLevel: 2,
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        slotIndex: 2,
        name: 'Produit Nova',
        deployedLevel: 1,
        activeResearchLevel: 2,
        researchStartedAt: hoursAgo(2),
        researchEndsAt: hoursAgo(-1),
        researchCost: 6400,
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        slotIndex: 3,
        name: 'Produit Pulse',
        deployedLevel: 0,
      },
    ],
  });

  await prisma.bankAccount.createMany({
    data: [
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        userId: userByName.get('lena')!.id,
        balance: 1450,
        accountType: 'COURANT',
      },
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        userId: userByName.get('milo')!.id,
        balance: 1900,
        accountType: 'COURANT',
      },
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        userId: userByName.get('salma')!.id,
        balance: 2600,
        accountType: 'EPARGNE',
      },
    ],
  });

  await prisma.businessTransaction.createMany({
    data: [
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        type: 'LOAN_DISBURSEMENT',
        amount: -1200,
        label: 'Pret accorde a raph',
        actorId: userByName.get('salma')!.id,
        createdAt: daysAgo(3, 14),
      },
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        type: 'ACCOUNT_DEPOSIT',
        amount: 700,
        label: 'Depot compte courant lena',
        actorId: userByName.get('lena')!.id,
        createdAt: daysAgo(1, 15),
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        type: 'INVESTMENT',
        amount: 2200,
        label: 'Investissement de ava',
        actorId: userByName.get('ava')!.id,
        createdAt: daysAgo(2, 16),
      },
      {
        businessId: businessByName.get('Campus Skills')!.id,
        type: 'FORMATION_SALE',
        amount: 540,
        label: 'Vente formation monetisation',
        actorId: userByName.get('noah')!.id,
        createdAt: hoursAgo(20),
      },
      {
        businessId: businessByName.get('Swift Transfer')!.id,
        type: 'TRANSFER_FEE',
        amount: 11,
        label: 'Frais de transfert cumules',
        actorId: userByName.get('tom')!.id,
        createdAt: hoursAgo(2),
      },
    ],
  });

  await prisma.businessRating.createMany({
    data: [
      {
        businessId: businessByName.get('Orbit Banque')!.id,
        userId: userByName.get('lena')!.id,
        rating: 5,
        comment: 'Service rapide et lisible.',
        createdAt: daysAgo(2, 12),
      },
      {
        businessId: businessByName.get('Nova Labs')!.id,
        userId: userByName.get('salma')!.id,
        rating: 4,
        comment: 'Bon potentiel, a structurer encore.',
        createdAt: daysAgo(1, 11),
      },
      {
        businessId: businessByName.get('Burger Pulse')!.id,
        userId: userByName.get('hugo')!.id,
        rating: 4,
        comment: 'Bon rapport qualite prix.',
        createdAt: hoursAgo(18),
      },
    ],
  });

  const formationProducts = await prisma.formationProduct.createManyAndReturn({
    data: [
      {
        businessId: businessByName.get('Campus Skills')!.id,
        title: 'Monetiser ses quetes quotidiennes',
        description: 'Methodes simples pour convertir quetes en cash regulier.',
        price: 540,
        url: 'https://example.com/formation-quetes',
        imageUrl: MOCK_IMAGE.cardE,
        status: 'APPROVED',
        createdAt: daysAgo(6, 10),
      },
      {
        businessId: businessByName.get('Campus Skills')!.id,
        title: 'Guide social et reputations',
        description: 'Ameliorer connexions, reputations et interactions utiles.',
        price: 620,
        url: 'https://example.com/formation-social',
        imageUrl: MOCK_IMAGE.cardF,
        status: 'APPROVED',
        createdAt: daysAgo(4, 11),
      },
    ],
    select: { id: true, title: true },
  });

  const formationProductByTitle = new Map(formationProducts.map((product) => [product.title, product]));

  await prisma.formationProductPurchase.createMany({
    data: [
      {
        userId: userByName.get('noah')!.id,
        businessId: businessByName.get('Campus Skills')!.id,
        productId: formationProductByTitle.get('Monetiser ses quetes quotidiennes')!.id,
        pricePaid: 540,
        purchasedAt: hoursAgo(20),
        reviewPromptAt: hoursAgo(2),
      },
      {
        userId: userByName.get('yanis')!.id,
        businessId: businessByName.get('Campus Skills')!.id,
        productId: formationProductByTitle.get('Guide social et reputations')!.id,
        pricePaid: 620,
        purchasedAt: hoursAgo(16),
        reviewPromptAt: hoursAgo(1),
      },
    ],
  });

  await prisma.formationProductRating.createMany({
    data: [
      {
        productId: formationProductByTitle.get('Monetiser ses quetes quotidiennes')!.id,
        businessId: businessByName.get('Campus Skills')!.id,
        userId: userByName.get('noah')!.id,
        rating: 5,
        comment: 'Clair et actionnable en 10 minutes.',
        createdAt: hoursAgo(4),
      },
      {
        productId: formationProductByTitle.get('Guide social et reputations')!.id,
        businessId: businessByName.get('Campus Skills')!.id,
        userId: userByName.get('yanis')!.id,
        rating: 4,
        comment: 'Bon guide, exemples utiles.',
        createdAt: hoursAgo(3),
      },
    ],
  });

  await prisma.reviewEligibility.createMany({
    data: [
      {
        userId: userByName.get('noah')!.id,
        businessId: businessByName.get('Campus Skills')!.id,
        formationProductId: formationProductByTitle.get('Monetiser ses quetes quotidiennes')!.id,
        targetType: 'FORMATION_PRODUCT',
        sourceType: 'FORMATION_PURCHASE',
        promptAt: hoursAgo(2),
      },
      {
        userId: userByName.get('yanis')!.id,
        businessId: businessByName.get('Campus Skills')!.id,
        formationProductId: formationProductByTitle.get('Guide social et reputations')!.id,
        targetType: 'FORMATION_PRODUCT',
        sourceType: 'FORMATION_PURCHASE',
        promptAt: hoursAgo(1),
      },
      {
        userId: userByName.get('lena')!.id,
        businessId: businessByName.get('Orbit Banque')!.id,
        targetType: 'BUSINESS',
        sourceType: 'BANK_ACCOUNT',
        promptAt: hoursAgo(3),
      },
    ],
  });

  await prisma.businessPurchasedItem.createMany({
    data: [
      {
        userId: userByName.get('hugo')!.id,
        businessId: businessByName.get('Burger Pulse')!.id,
        businessName: 'Burger Pulse',
        itemKey: 'combo_burger',
        itemLabel: 'Menu Burger',
        itemEmoji: '🍔',
        price: 55,
        quantity: 1,
        acquiredAt: hoursAgo(9),
      },
      {
        userId: userByName.get('raph')!.id,
        businessId: businessByName.get('Burger Pulse')!.id,
        businessName: 'Burger Pulse',
        itemKey: 'frites',
        itemLabel: 'Frites',
        itemEmoji: '🍟',
        price: 22,
        quantity: 2,
        acquiredAt: hoursAgo(6),
      },
    ],
  });

  void relationshipLenaMilo;
  void relationshipNinaTom;

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
      { userId: userByName.get('ava')!.id, itemId: itemByName.get('Profile Banner')!.id, quantity: 1 },
      { userId: userByName.get('lucas')!.id, itemId: itemByName.get('Aura Capsule')!.id, quantity: 4 },
      { userId: userByName.get('ines')!.id, itemId: itemByName.get('Neon Alias')!.id, quantity: 2 },
      { userId: userByName.get('jade')!.id, itemId: itemByName.get('Mystery Crate')!.id, quantity: 1 },
      { userId: userByName.get('theo')!.id, itemId: itemByName.get('Cash Sprint')!.id, quantity: 2 },
      { userId: userByName.get('yanis')!.id, itemId: itemByName.get('Party Permit')!.id, quantity: 1 },
      { userId: userByName.get('camille')!.id, itemId: itemByName.get('Profile Snap')!.id, quantity: 1 },
      { userId: userByName.get('hugo')!.id, itemId: itemByName.get('Lucky Koi')!.id, quantity: 2 },
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
    ['ava', 'polytrack', 18, 7, 67480, 27],
    ['yanis', 'polytrack', 16, 9, 68110, 29],
    ['lucas', 'sudoku', 17, 3, 540, 20],
    ['ines', 'sudoku', 14, 4, 610, 19],
    ['ava', 'minesweeper', 19, 6, 182, 28],
    ['camille', 'minesweeper', 12, 8, 146, 23],
    ['jade', 'fruit_ninja', 20, 12, 284, 32],
    ['salma', 'fruit_ninja', 27, 9, 362, 36],
    ['lucas', 'stack_tower', 15, 7, 94, 22],
    ['hugo', 'stack_tower', 9, 10, 62, 19],
    ['ines', 'qs_watermelon', 11, 9, 14800, 21],
    ['ava', 'qs_watermelon', 15, 7, 17550, 24],
    ['yanis', 'knife_hit', 18, 13, 38, 31],
    ['milo', 'knife_hit', 24, 11, 49, 35],
    ['theo', 'geometry_dash', 21, 16, 74, 37],
    ['ava', 'geometry_dash', 24, 12, 89, 36],
    ['lucas', 'chrome_dino', 15, 11, 913, 26],
    ['camille', 'chrome_dino', 10, 9, 640, 19],
    ['milo', 'goyave_empire', 13, 5, 245000, 18],
    ['ines', 'goyave_empire', 9, 4, 198500, 13],
    ['salma', 'ball_arena', 16, 10, 28, 26],
    ['yanis', 'ball_arena', 19, 9, 31, 28],
    ['lena', 'chess', 12, 4, 1, 16],
    ['ava', 'chess', 10, 5, 1, 15],
    ['zoe', 'puissance_quatre', 14, 6, 1, 20],
    ['jade', 'puissance_quatre', 7, 8, 1, 15],
    ['camille', 'morpion', 9, 7, 1, 16],
    ['hugo', 'morpion', 6, 9, 1, 15],
    ['theo', 'uno', 14, 11, 1, 25],
    ['lucas', 'uno', 12, 13, 1, 25],
    ['ava', 'bataille_navale', 8, 4, 1, 12],
    ['yanis', 'bataille_navale', 9, 3, 1, 12],
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

  await prisma.gameScoreHistory.createMany({
    data: [
      { userId: userByName.get('milo')!.id, gameType: 'racer', score: 68412, createdAt: daysAgo(5, 20) },
      { userId: userByName.get('milo')!.id, gameType: 'racer', score: 67994, createdAt: hoursAgo(4) },
      { userId: userByName.get('salma')!.id, gameType: 'racer', score: 67108, createdAt: hoursAgo(5) },
      { userId: userByName.get('ava')!.id, gameType: 'polytrack', score: 67480, createdAt: hoursAgo(8) },
      { userId: userByName.get('yanis')!.id, gameType: 'polytrack', score: 68110, createdAt: hoursAgo(6) },
      { userId: userByName.get('milo')!.id, gameType: 'tetris', score: 148200, createdAt: daysAgo(2, 21) },
      { userId: userByName.get('salma')!.id, gameType: 'fruit_ninja', score: 362, createdAt: hoursAgo(19) },
      { userId: userByName.get('ines')!.id, gameType: 'qs_watermelon', score: 14800, createdAt: hoursAgo(17) },
      { userId: userByName.get('ava')!.id, gameType: 'geometry_dash', score: 89, createdAt: hoursAgo(11) },
      { userId: userByName.get('camille')!.id, gameType: 'chrome_dino', score: 640, createdAt: hoursAgo(9) },
      { userId: userByName.get('lucas')!.id, gameType: 'sudoku', score: 540, createdAt: hoursAgo(7) },
      { userId: userByName.get('yanis')!.id, gameType: 'ball_arena', score: 31, createdAt: hoursAgo(3) },
    ],
  });

  await prisma.bombPartyStats.createMany({
    data: [
      { userId: userByName.get('lena')!.id, wins: 6, losses: 4, totalPlayed: 10, wordsTyped: 118, longestWord: 'constellation' },
      { userId: userByName.get('milo')!.id, wins: 9, losses: 5, totalPlayed: 14, wordsTyped: 156, longestWord: 'miscalculation' },
      { userId: userByName.get('salma')!.id, wins: 12, losses: 3, totalPlayed: 15, wordsTyped: 181, longestWord: 'transformation' },
      { userId: userByName.get('raph')!.id, wins: 3, losses: 8, totalPlayed: 11, wordsTyped: 67, longestWord: 'meteorology' },
      { userId: userByName.get('zoe')!.id, wins: 8, losses: 6, totalPlayed: 14, wordsTyped: 143, longestWord: 'extraordinary' },
      { userId: userByName.get('ava')!.id, wins: 11, losses: 4, totalPlayed: 15, wordsTyped: 176, longestWord: 'intercontinental' },
      { userId: userByName.get('theo')!.id, wins: 7, losses: 7, totalPlayed: 14, wordsTyped: 121, longestWord: 'hallucination' },
    ],
  });

  const trackDate = startOfDay();
  await prisma.dailyRacerRun.createMany({
    data: [
      { userId: userByName.get('milo')!.id, trackDate, lapTimeMs: 68412, createdAt: hoursAgo(9) },
      { userId: userByName.get('milo')!.id, trackDate, lapTimeMs: 67994, createdAt: hoursAgo(4) },
      { userId: userByName.get('salma')!.id, trackDate, lapTimeMs: 67108, createdAt: hoursAgo(5) },
      { userId: userByName.get('ava')!.id, trackDate, lapTimeMs: 67382, createdAt: hoursAgo(6) },
      { userId: userByName.get('lena')!.id, trackDate, lapTimeMs: 69550, createdAt: hoursAgo(3) },
      { userId: userByName.get('zoe')!.id, trackDate, lapTimeMs: 70255, createdAt: hoursAgo(2) },
      { userId: userByName.get('yanis')!.id, trackDate, lapTimeMs: 68811, createdAt: hoursAgo(1.5) },
      { userId: userByName.get('noah')!.id, trackDate, lapTimeMs: 71510, createdAt: hoursAgo(1) },
      { userId: userByName.get('lucas')!.id, trackDate, lapTimeMs: 72440, createdAt: minutesAgo(35) },
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
      { userId: userByName.get('ava')!.id, message: 'Je viens de poser un 67.3 sur le track daily, screenshot oblige.', imageUrl: MOCK_IMAGE.cardB, createdAt: hoursAgo(1.2) },
      { userId: userByName.get('jade')!.id, message: 'Le support répond vite, on peut tester la boîte admin aussi.', createdAt: hoursAgo(0.9) },
      { userId: null, type: 'system', message: 'Maya a demandé l accès au site. Pensez a traiter la demande dans l admin.', createdAt: hoursAgo(0.6) },
    ],
  });

  const chatMessages = await prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' } });
  await prisma.chatReaction.createMany({
    data: [
      { messageId: chatMessages[0].id, userId: userByName.get('milo')!.id, emoji: '🔥' },
      { messageId: chatMessages[2].id, userId: userByName.get('salma')!.id, emoji: '🏎️' },
      { messageId: chatMessages[3].id, userId: userByName.get('lena')!.id, emoji: '📈' },
      { messageId: chatMessages[5].id, userId: userByName.get('raph')!.id, emoji: '🙌' },
      { messageId: chatMessages[6].id, userId: userByName.get('yanis')!.id, emoji: '🏁' },
      { messageId: chatMessages[8].id, userId: userByName.get('camille')!.id, emoji: '👀' },
    ],
  });

  if (existingTables.has('DirectConversation') && existingTables.has('DirectConversationParticipant') && existingTables.has('DirectMessage')) {
    const dmThreads = [
      {
        users: ['lena', 'milo'] as const,
        messages: [
          { sender: 'lena', body: 'Tu peux relire mon setup Racer avant le reset daily ?', createdAt: hoursAgo(10.5) },
          { sender: 'milo', body: 'Oui, j ai vu ta trajectoire, tu gagnes 0.4s au secteur 2.', createdAt: hoursAgo(10.3) },
          { sender: 'lena', body: 'Parfait, je push un dernier run ce soir.', createdAt: hoursAgo(9.9) },
        ],
      },
      {
        users: ['zoe', 'salma'] as const,
        messages: [
          { sender: 'zoe', body: 'Je garde deux slots pour la guerre active. Tu confirmes ?', createdAt: hoursAgo(8.2) },
          { sender: 'salma', body: 'Confirmé. Je couvre aussi les fortifs banner.', createdAt: hoursAgo(8) },
        ],
      },
      {
        users: ['jade', 'camille'] as const,
        messages: [
          { sender: 'jade', body: 'Le ticket support Racer est bien classé côté admin.', createdAt: hoursAgo(5.1) },
          { sender: 'camille', body: 'Nickel, je valide demain avec un replay mobile.', createdAt: hoursAgo(4.8) },
        ],
      },
    ];

    for (const thread of dmThreads) {
      const userAId = userByName.get(thread.users[0])!.id;
      const userBId = userByName.get(thread.users[1])!.id;
      const directKey = getDirectKey(userAId, userBId);
      const lastMessageAt = thread.messages[thread.messages.length - 1]!.createdAt;

      const conversation = await prisma.directConversation.create({
        data: {
          directKey,
          lastMessageAt,
          participants: {
            create: [
              { userId: userAId, lastReadAt: hoursAgo(1.5) },
              { userId: userBId, lastReadAt: hoursAgo(1.1) },
            ],
          },
        },
      });

      await prisma.directMessage.createMany({
        data: thread.messages.map((message) => ({
          conversationId: conversation.id,
          senderId: userByName.get(message.sender)!.id,
          body: message.body,
          createdAt: message.createdAt,
        })),
      });
    }
  }

  if (
    existingTables.has('AuraScrollPost')
    && existingTables.has('AuraScrollLike')
    && existingTables.has('AuraScrollComment')
    && existingTables.has('AuraScrollCommentLike')
  ) {
    const scrollPosts = await prisma.auraScrollPost.createManyAndReturn({
      data: [
        {
          userId: userByName.get('ava')!.id,
          title: 'Run propre sur Track 14',
          description: 'Setup stable, freinage tardif et gain net sur le dernier split.',
          mediaUrls: JSON.stringify([MOCK_IMAGE.cardB]),
          mediaType: 'PHOTO',
          thumbnailUrl: MOCK_IMAGE.cardB,
          status: 'APPROVED',
          viewCount: 214,
          createdAt: hoursAgo(7),
        },
        {
          userId: userByName.get('zoe')!.id,
          title: 'Prépa de guerre: rotation mini-jeux',
          description: 'On alterne memory et bomb pour tenir le score et les fortifs.',
          mediaUrls: JSON.stringify([MOCK_IMAGE.clan, MOCK_IMAGE.bannerA]),
          mediaType: 'PHOTOS',
          thumbnailUrl: MOCK_IMAGE.clan,
          status: 'APPROVED',
          viewCount: 167,
          createdAt: hoursAgo(6),
        },
        {
          userId: userByName.get('nina')!.id,
          title: null,
          description: 'Inbox cleanup fini, prêt pour une nouvelle vague de cadeaux.',
          mediaUrls: JSON.stringify([MOCK_IMAGE.cardF]),
          mediaType: 'PHOTO',
          thumbnailUrl: MOCK_IMAGE.cardF,
          status: 'APPROVED',
          viewCount: 93,
          createdAt: hoursAgo(4.5),
        },
      ],
      select: { id: true, userId: true },
    });

    const scrollPostByAuthor = new Map(scrollPosts.map((post) => [post.userId, post.id]));

    await prisma.auraScrollLike.createMany({
      data: [
        { postId: scrollPostByAuthor.get(userByName.get('ava')!.id)!, userId: userByName.get('milo')!.id },
        { postId: scrollPostByAuthor.get(userByName.get('ava')!.id)!, userId: userByName.get('yanis')!.id },
        { postId: scrollPostByAuthor.get(userByName.get('zoe')!.id)!, userId: userByName.get('lena')!.id },
        { postId: scrollPostByAuthor.get(userByName.get('zoe')!.id)!, userId: userByName.get('salma')!.id },
        { postId: scrollPostByAuthor.get(userByName.get('nina')!.id)!, userId: userByName.get('jade')!.id },
      ],
    });

    const scrollComments = await prisma.auraScrollComment.createManyAndReturn({
      data: [
        {
          postId: scrollPostByAuthor.get(userByName.get('ava')!.id)!,
          userId: userByName.get('milo')!.id,
          content: 'Split 2 est monstrueux, poste le ghost lap aussi.',
          createdAt: hoursAgo(6.7),
        },
        {
          postId: scrollPostByAuthor.get(userByName.get('zoe')!.id)!,
          userId: userByName.get('ava')!.id,
          content: 'Je prends memory puis navale, timing validé.',
          createdAt: hoursAgo(5.6),
        },
        {
          postId: scrollPostByAuthor.get(userByName.get('nina')!.id)!,
          userId: userByName.get('tom')!.id,
          content: 'Parfait, je renvoie des crates pour le test boutique.',
          createdAt: hoursAgo(4),
        },
      ],
      select: { id: true },
    });

    await prisma.auraScrollCommentLike.createMany({
      data: [
        { commentId: scrollComments[0]!.id, userId: userByName.get('ava')!.id },
        { commentId: scrollComments[1]!.id, userId: userByName.get('zoe')!.id },
        { commentId: scrollComments[2]!.id, userId: userByName.get('nina')!.id },
      ],
    });
  }

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
      {
        senderId: userByName.get('ava')!.id,
        receiverId: userByName.get('hugo')!.id,
        auraAmount: 8,
        moneyAmount: 60,
        isGift: false,
        message: 'Bienvenue dans la rotation.',
        createdAt: hoursAgo(2),
      },
    ],
  });

  await prisma.party.createMany({
    data: [
      { name: 'Les Nebuleux', isPublic: true, maxSize: 6, createdAt: daysAgo(5), lastActivity: minutesAgo(20) },
      { name: 'Orbit Exchange', isPublic: false, maxSize: 5, createdAt: daysAgo(4), lastActivity: hoursAgo(2) },
      { name: 'Voltage Drift', isPublic: true, maxSize: 5, createdAt: daysAgo(3), lastActivity: hoursAgo(1.2) },
      { name: 'Support Squad', isPublic: true, maxSize: 4, createdAt: daysAgo(1), lastActivity: hoursAgo(6) },
    ],
  });

  const parties = await prisma.party.findMany();
  const partyByName = new Map(parties.map((party) => [party.name, party]));
  await prisma.partyMember.createMany({
    data: [
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('zoe')!.id, isLeader: true },
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('lena')!.id, isLeader: false },
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('raph')!.id, isLeader: false },
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('ava')!.id, isLeader: false },
      { partyId: partyByName.get('Orbit Exchange')!.id, userId: userByName.get('salma')!.id, isLeader: true },
      { partyId: partyByName.get('Orbit Exchange')!.id, userId: userByName.get('tom')!.id, isLeader: false },
      { partyId: partyByName.get('Orbit Exchange')!.id, userId: userByName.get('nina')!.id, isLeader: false },
      { partyId: partyByName.get('Voltage Drift')!.id, userId: userByName.get('milo')!.id, isLeader: true },
      { partyId: partyByName.get('Voltage Drift')!.id, userId: userByName.get('yanis')!.id, isLeader: false },
      { partyId: partyByName.get('Voltage Drift')!.id, userId: userByName.get('lucas')!.id, isLeader: false },
      { partyId: partyByName.get('Support Squad')!.id, userId: userByName.get('jade')!.id, isLeader: true },
      { partyId: partyByName.get('Support Squad')!.id, userId: userByName.get('camille')!.id, isLeader: false },
      { partyId: partyByName.get('Support Squad')!.id, userId: userByName.get('hugo')!.id, isLeader: false },
    ],
  });

  await prisma.partyMessage.createMany({
    data: [
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('zoe')!.id, message: 'On garde Ava pour le memory game ce soir.', createdAt: hoursAgo(2.2) },
      { partyId: partyByName.get('Les Nebuleux')!.id, userId: userByName.get('lena')!.id, message: 'Je couvre le chat et les fortifications.', createdAt: hoursAgo(1.6) },
      { partyId: partyByName.get('Orbit Exchange')!.id, userId: userByName.get('salma')!.id, message: 'Fermez vos positions avant la fin de la nuit.', createdAt: hoursAgo(3.1) },
      { partyId: partyByName.get('Voltage Drift')!.id, userId: userByName.get('milo')!.id, message: 'Track 7 puis guerre active juste après.', createdAt: hoursAgo(1.3) },
      { partyId: partyByName.get('Support Squad')!.id, userId: userByName.get('jade')!.id, message: 'Je remonte les retours support dans l admin.', createdAt: hoursAgo(4.4) },
    ],
  });

  const nebuleux = await prisma.clan.create({
    data: {
      name: 'Les Nebuleux',
      description: 'Clan public ultra actif pour profils, guerres, chat et inbox.',
      imageUrl: MOCK_IMAGE.clanNebula,
      banner: MOCK_IMAGE.bannerA,
      isPublic: true,
      maxMembers: 5,
      clanBankMoney: 2840,
      ownerId: userByName.get('zoe')!.id,
      tagUnlocked: true,
      tagText: 'NEB',
      tagStyle: JSON.stringify({ backgroundColor: '#111827', textColor: '#E879F9', borderColor: '#38BDF8' }),
      slotUpgraded: true,
    },
  });

  const orbit = await prisma.clan.create({
    data: {
      name: 'Orbit Exchange',
      description: 'Clan prive oriente Aura Coin, Polymarket et fortifications optimales.',
      imageUrl: MOCK_IMAGE.market,
      banner: MOCK_IMAGE.bannerB,
      isPublic: false,
      maxMembers: 5,
      clanBankMoney: 3210,
      ownerId: userByName.get('salma')!.id,
      tagUnlocked: true,
      tagText: 'ORB',
      tagStyle: JSON.stringify({ backgroundColor: '#0F172A', textColor: '#FBBF24', borderColor: '#22C55E' }),
      slotUpgraded: true,
    },
  });

  const voltage = await prisma.clan.create({
    data: {
      name: 'Voltage Drift',
      description: 'Clan public axe mini-jeux, Racer, Polytrack et guerres agressives.',
      imageUrl: MOCK_IMAGE.cardG,
      banner: MOCK_IMAGE.bannerC,
      isPublic: true,
      maxMembers: 5,
      clanBankMoney: 1940,
      ownerId: userByName.get('milo')!.id,
      tagUnlocked: true,
      tagText: 'VLT',
      tagStyle: JSON.stringify({ backgroundColor: '#1F2937', textColor: '#FB7185', borderColor: '#F59E0B' }),
      slotUpgraded: false,
    },
  });

  await prisma.clanMember.createMany({
    data: [
      { clanId: nebuleux.id, userId: userByName.get('zoe')!.id, isLeader: true },
      { clanId: nebuleux.id, userId: userByName.get('lena')!.id, isLeader: false },
      { clanId: nebuleux.id, userId: userByName.get('raph')!.id, isLeader: false },
      { clanId: nebuleux.id, userId: userByName.get('ava')!.id, isLeader: false },
      { clanId: nebuleux.id, userId: userByName.get('noah')!.id, isLeader: false },
      { clanId: orbit.id, userId: userByName.get('salma')!.id, isLeader: true },
      { clanId: orbit.id, userId: userByName.get('tom')!.id, isLeader: false },
      { clanId: orbit.id, userId: userByName.get('nina')!.id, isLeader: false },
      { clanId: orbit.id, userId: userByName.get('jade')!.id, isLeader: false },
      { clanId: orbit.id, userId: userByName.get('theo')!.id, isLeader: false },
      { clanId: voltage.id, userId: userByName.get('milo')!.id, isLeader: true },
      { clanId: voltage.id, userId: userByName.get('yanis')!.id, isLeader: false },
      { clanId: voltage.id, userId: userByName.get('lucas')!.id, isLeader: false },
      { clanId: voltage.id, userId: userByName.get('ines')!.id, isLeader: false },
      { clanId: voltage.id, userId: userByName.get('camille')!.id, isLeader: false },
    ],
  });

  await prisma.clanJoinRequest.createMany({
    data: [
      { clanId: voltage.id, userId: userByName.get('hugo')!.id, createdAt: hoursAgo(6) },
      { clanId: nebuleux.id, userId: userByName.get('maya_pending')!.id, createdAt: hoursAgo(5) },
    ],
  });

  await prisma.clanMessage.createMany({
    data: [
      { clanId: nebuleux.id, userId: userByName.get('zoe')!.id, message: 'Préparation guerre à 20h, on garde les fortifs pour la bannière.', createdAt: hoursAgo(5) },
      { clanId: nebuleux.id, userId: userByName.get('ava')!.id, message: 'Je prends memory + naval si besoin.', createdAt: hoursAgo(2) },
      { clanId: orbit.id, userId: userByName.get('salma')!.id, message: 'On défend puis on joue le score propre.', createdAt: hoursAgo(4) },
      { clanId: orbit.id, userId: userByName.get('jade')!.id, message: 'Je pose les tickets cadeaux après le raid.', createdAt: hoursAgo(1.5) },
      { clanId: voltage.id, userId: userByName.get('milo')!.id, message: 'Push Polytrack puis guerre historique dans 30 min.', createdAt: hoursAgo(3) },
      { clanId: voltage.id, userId: userByName.get('yanis')!.id, message: 'Le board naval est prêt.', createdAt: hoursAgo(1.2) },
    ],
  });

  await prisma.clanPumpUpMessage.createMany({
    data: [
      { clanId: nebuleux.id, content: 'Pas de panique, on gagne au mental.', color: '#A855F7', createdAt: daysAgo(1, 18) },
      { clanId: orbit.id, content: 'Chaque point compte, propre et net.', color: '#F59E0B', createdAt: daysAgo(1, 19) },
      { clanId: voltage.id, content: 'Full pression, full vitesse.', color: '#EF4444', createdAt: daysAgo(0, 16) },
    ],
  });

  await prisma.clanOwnedItem.createMany({
    data: [
      { clanId: nebuleux.id, itemId: itemByName.get('Profile Banner')!.id, quantity: 1, acquiredAt: daysAgo(3, 20) },
      { clanId: nebuleux.id, itemId: itemByName.get('Aura Capsule')!.id, quantity: 4, acquiredAt: daysAgo(2, 19) },
      { clanId: orbit.id, itemId: itemByName.get('Mystery Crate')!.id, quantity: 3, acquiredAt: daysAgo(4, 18) },
      { clanId: orbit.id, itemId: itemByName.get('Party Permit')!.id, quantity: 1, acquiredAt: daysAgo(1, 15) },
      { clanId: voltage.id, itemId: itemByName.get('Lucky Koi')!.id, quantity: 2, acquiredAt: daysAgo(2, 13) },
      { clanId: voltage.id, itemId: itemByName.get('Cash Sprint')!.id, quantity: 5, acquiredAt: hoursAgo(22) },
    ],
  });

  await prisma.clanEffect.createMany({
    data: [
      {
        clanId: nebuleux.id,
        type: 'GAME_MONEY_BOOST',
        name: 'Prime de momentum',
        description: 'Bonus de money sur les mini-jeux pendant la guerre active.',
        value: 18,
        durationHours: 8,
        cooldownHours: 24,
        activatedAt: hoursAgo(4),
        activeUntil: hoursAgo(-4),
        cooldownUntil: hoursAgo(20),
      },
      {
        clanId: orbit.id,
        type: 'BANK_INTEREST',
        name: 'Coffre premium',
        description: 'Gonfle la trésorerie du clan et encourage les dépôts.',
        value: 12,
        durationHours: 6,
        cooldownHours: 18,
        activatedAt: hoursAgo(14),
        activeUntil: hoursAgo(8),
        cooldownUntil: hoursAgo(4),
      },
      {
        clanId: voltage.id,
        type: 'GAME_MONEY_BOOST',
        name: 'Nitro de guerre',
        description: 'Petit boost de récompense pour les runs et mini-jeux.',
        value: 14,
        durationHours: 5,
        cooldownHours: 20,
        activatedAt: hoursAgo(18),
        activeUntil: hoursAgo(13),
        cooldownUntil: hoursAgo(2),
      },
    ],
  });

  const activeWar = await prisma.clanWar.create({
    data: {
      attackerClanId: nebuleux.id,
      defenderClanId: orbit.id,
      declaredByUserId: userByName.get('zoe')!.id,
      status: 'ACTIVE',
      startsAt: hoursAgo(6),
      endsAt: hoursAgo(-26),
      attackerScore: 112,
      defenderScore: 104,
      targetScore: 180,
      winnerRewardMoney: 1500,
      loserRewardMoney: 480,
      winnerRewardAura: 55,
      loserRewardAura: 18,
      createdAt: hoursAgo(18),
    },
  });

  const completedWar = await prisma.clanWar.create({
    data: {
      attackerClanId: voltage.id,
      defenderClanId: orbit.id,
      declaredByUserId: userByName.get('milo')!.id,
      winnerClanId: voltage.id,
      winnerUserId: userByName.get('yanis')!.id,
      status: 'COMPLETED',
      startsAt: daysAgo(3, 9),
      endsAt: daysAgo(1, 21),
      completedAt: daysAgo(1, 21),
      attackerScore: 186,
      defenderScore: 161,
      targetScore: 180,
      winnerRewardMoney: 1400,
      loserRewardMoney: 420,
      winnerRewardAura: 52,
      loserRewardAura: 15,
      createdAt: daysAgo(3, 1),
    },
  });

  await prisma.clanWarDefense.createMany({
    data: [
      { warId: activeWar.id, clanId: nebuleux.id, type: 'FORTRESS', level: 2, durability: 76, maxDurability: 78 },
      { warId: activeWar.id, clanId: nebuleux.id, type: 'ARMORY', level: 1, durability: 53, maxDurability: 64 },
      { warId: activeWar.id, clanId: nebuleux.id, type: 'BANNER', level: 2, durability: 57, maxDurability: 56 },
      { warId: activeWar.id, clanId: orbit.id, type: 'FORTRESS', level: 2, durability: 41, maxDurability: 78 },
      { warId: activeWar.id, clanId: orbit.id, type: 'ARMORY', level: 2, durability: 35, maxDurability: 64 },
      { warId: activeWar.id, clanId: orbit.id, type: 'BANNER', level: 1, durability: 18, maxDurability: 42 },
      { warId: completedWar.id, clanId: voltage.id, type: 'FORTRESS', level: 2, durability: 22, maxDurability: 78 },
      { warId: completedWar.id, clanId: voltage.id, type: 'ARMORY', level: 2, durability: 16, maxDurability: 64 },
      { warId: completedWar.id, clanId: voltage.id, type: 'BANNER', level: 1, durability: 0, maxDurability: 42 },
      { warId: completedWar.id, clanId: orbit.id, type: 'FORTRESS', level: 2, durability: 0, maxDurability: 78 },
      { warId: completedWar.id, clanId: orbit.id, type: 'ARMORY', level: 1, durability: 0, maxDurability: 48 },
      { warId: completedWar.id, clanId: orbit.id, type: 'BANNER', level: 2, durability: 12, maxDurability: 56 },
    ],
  });

  const defenses = await prisma.clanWarDefense.findMany();
  const defenseByKey = new Map(defenses.map((entry) => [`${entry.warId}:${entry.clanId}:${entry.type}`, entry]));

  await prisma.clanWarFortification.createMany({
    data: [
      { warId: activeWar.id, defenseId: defenseByKey.get(`${activeWar.id}:${nebuleux.id}:FORTRESS`)!.id, clanId: nebuleux.id, userId: userByName.get('lena')!.id, levelAdded: 1, durabilityAdded: 18, createdAt: hoursAgo(7) },
      { warId: activeWar.id, defenseId: defenseByKey.get(`${activeWar.id}:${nebuleux.id}:BANNER`)!.id, clanId: nebuleux.id, userId: userByName.get('ava')!.id, levelAdded: 1, durabilityAdded: 14, createdAt: hoursAgo(6.5) },
      { warId: activeWar.id, defenseId: defenseByKey.get(`${activeWar.id}:${orbit.id}:ARMORY`)!.id, clanId: orbit.id, userId: userByName.get('tom')!.id, levelAdded: 1, durabilityAdded: 16, createdAt: hoursAgo(5.6) },
      { warId: activeWar.id, defenseId: defenseByKey.get(`${activeWar.id}:${orbit.id}:FORTRESS`)!.id, clanId: orbit.id, userId: userByName.get('salma')!.id, levelAdded: 1, durabilityAdded: 18, createdAt: hoursAgo(5.2) },
      { warId: completedWar.id, defenseId: defenseByKey.get(`${completedWar.id}:${voltage.id}:ARMORY`)!.id, clanId: voltage.id, userId: userByName.get('lucas')!.id, levelAdded: 1, durabilityAdded: 16, createdAt: daysAgo(2, 11) },
      { warId: completedWar.id, defenseId: defenseByKey.get(`${completedWar.id}:${orbit.id}:BANNER`)!.id, clanId: orbit.id, userId: userByName.get('jade')!.id, levelAdded: 1, durabilityAdded: 14, createdAt: daysAgo(2, 12) },
    ],
  });

  await prisma.clanWarAttack.createMany({
    data: [
      { warId: activeWar.id, userId: userByName.get('zoe')!.id, clanId: nebuleux.id, targetClanId: orbit.id, attackType: 'RAID', staminaCost: 1, basePoints: 24, bonusPoints: 4, defenseMitigation: 3, structureDamage: 10, finalPoints: 25, createdAt: hoursAgo(4.8) },
      { warId: activeWar.id, userId: userByName.get('salma')!.id, clanId: orbit.id, targetClanId: nebuleux.id, attackType: 'SIEGE', staminaCost: 2, basePoints: 39, bonusPoints: 3, defenseMitigation: 4, structureDamage: 18, finalPoints: 38, createdAt: hoursAgo(4.4) },
      { warId: activeWar.id, userId: userByName.get('ava')!.id, clanId: nebuleux.id, targetClanId: orbit.id, attackType: 'SABOTAGE', staminaCost: 1, basePoints: 22, bonusPoints: 5, defenseMitigation: 2, structureDamage: 22, finalPoints: 25, createdAt: hoursAgo(3.7) },
      { warId: activeWar.id, userId: userByName.get('tom')!.id, clanId: orbit.id, targetClanId: nebuleux.id, attackType: 'RAID', staminaCost: 1, basePoints: 21, bonusPoints: 2, defenseMitigation: 2, structureDamage: 10, finalPoints: 21, createdAt: hoursAgo(2.9) },
      { warId: activeWar.id, userId: userByName.get('lena')!.id, clanId: nebuleux.id, targetClanId: orbit.id, attackType: 'SIEGE', staminaCost: 2, basePoints: 41, bonusPoints: 6, defenseMitigation: 5, structureDamage: 18, finalPoints: 42, createdAt: hoursAgo(2.2) },
      { warId: completedWar.id, userId: userByName.get('milo')!.id, clanId: voltage.id, targetClanId: orbit.id, attackType: 'RAID', staminaCost: 1, basePoints: 26, bonusPoints: 3, defenseMitigation: 2, structureDamage: 10, finalPoints: 27, createdAt: daysAgo(2, 10) },
      { warId: completedWar.id, userId: userByName.get('yanis')!.id, clanId: voltage.id, targetClanId: orbit.id, attackType: 'SIEGE', staminaCost: 2, basePoints: 43, bonusPoints: 4, defenseMitigation: 3, structureDamage: 18, finalPoints: 44, createdAt: daysAgo(2, 8) },
      { warId: completedWar.id, userId: userByName.get('salma')!.id, clanId: orbit.id, targetClanId: voltage.id, attackType: 'SABOTAGE', staminaCost: 1, basePoints: 23, bonusPoints: 2, defenseMitigation: 1, structureDamage: 22, finalPoints: 24, createdAt: daysAgo(2, 7) },
    ],
  });

  await prisma.clanWarGameLog.createMany({
    data: [
      { warId: activeWar.id, userId: userByName.get('ava')!.id, clanId: nebuleux.id, gameType: 'MEMORY', score: 820, pointsAwarded: 14, isPractice: false, playedAt: hoursAgo(3.4) },
      { warId: activeWar.id, userId: userByName.get('jade')!.id, clanId: orbit.id, gameType: 'BOMB', score: 27, pointsAwarded: 11, isPractice: false, playedAt: hoursAgo(2.6) },
      { warId: activeWar.id, userId: userByName.get('theo')!.id, clanId: orbit.id, gameType: 'MEMORY', score: 750, pointsAwarded: 12, isPractice: false, playedAt: hoursAgo(1.8) },
      { warId: completedWar.id, userId: userByName.get('yanis')!.id, clanId: voltage.id, gameType: 'BOMB', score: 31, pointsAwarded: 13, isPractice: false, playedAt: daysAgo(2, 6) },
      { warId: completedWar.id, userId: userByName.get('lucas')!.id, clanId: voltage.id, gameType: 'MEMORY', score: 790, pointsAwarded: 12, isPractice: false, playedAt: daysAgo(2, 5) },
      { warId: completedWar.id, userId: userByName.get('tom')!.id, clanId: orbit.id, gameType: 'BOMB', score: 20, pointsAwarded: 7, isPractice: false, playedAt: daysAgo(2, 4) },
    ],
  });

  const createNavalGrid = (placements: Array<{ x: number; y: number; type: string; hp: number }>) => {
    const grid = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => ({ type: null as string | null, hp: 0 })));
    for (const placement of placements) {
      grid[placement.y]![placement.x] = { type: placement.type, hp: placement.hp };
    }
    return JSON.stringify(grid);
  };

  await prisma.clanWarNavalBoard.createMany({
    data: [
      {
        warId: activeWar.id,
        clanId: orbit.id,
        grid: createNavalGrid([
          { x: 1, y: 1, type: 'cannon', hp: 2 },
          { x: 4, y: 3, type: 'vault', hp: 1 },
          { x: 2, y: 4, type: 'banner', hp: 1 },
        ]),
      },
      {
        warId: activeWar.id,
        clanId: nebuleux.id,
        grid: createNavalGrid([
          { x: 0, y: 0, type: 'cannon', hp: 2 },
          { x: 5, y: 4, type: 'vault', hp: 1 },
          { x: 3, y: 2, type: 'armory', hp: 1 },
        ]),
      },
      {
        warId: completedWar.id,
        clanId: orbit.id,
        grid: createNavalGrid([
          { x: 1, y: 2, type: 'cannon', hp: 2 },
          { x: 3, y: 3, type: 'vault', hp: 1 },
        ]),
      },
      {
        warId: completedWar.id,
        clanId: voltage.id,
        grid: createNavalGrid([
          { x: 2, y: 1, type: 'armory', hp: 1 },
          { x: 4, y: 4, type: 'banner', hp: 1 },
        ]),
      },
    ],
  });

  const navalBoards = await prisma.clanWarNavalBoard.findMany();
  const boardByKey = new Map(navalBoards.map((board) => [`${board.warId}:${board.clanId}`, board]));
  await prisma.clanWarNavalShot.createMany({
    data: [
      { boardId: boardByKey.get(`${activeWar.id}:${orbit.id}`)!.id, warId: activeWar.id, userId: userByName.get('ava')!.id, clanId: nebuleux.id, x: 1, y: 1, isHit: true, building: 'cannon', points: 8, createdAt: hoursAgo(2.4) },
      { boardId: boardByKey.get(`${activeWar.id}:${orbit.id}`)!.id, warId: activeWar.id, userId: userByName.get('lena')!.id, clanId: nebuleux.id, x: 2, y: 4, isHit: true, building: 'banner', points: 10, createdAt: hoursAgo(1.9) },
      { boardId: boardByKey.get(`${activeWar.id}:${nebuleux.id}`)!.id, warId: activeWar.id, userId: userByName.get('jade')!.id, clanId: orbit.id, x: 5, y: 5, isHit: false, building: null, points: 0, createdAt: hoursAgo(1.7) },
      { boardId: boardByKey.get(`${completedWar.id}:${orbit.id}`)!.id, warId: completedWar.id, userId: userByName.get('yanis')!.id, clanId: voltage.id, x: 1, y: 2, isHit: true, building: 'cannon', points: 8, createdAt: daysAgo(2, 6) },
      { boardId: boardByKey.get(`${completedWar.id}:${orbit.id}`)!.id, warId: completedWar.id, userId: userByName.get('lucas')!.id, clanId: voltage.id, x: 3, y: 3, isHit: true, building: 'vault', points: 10, createdAt: daysAgo(2, 5) },
    ],
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

  await prisma.supportMessage.createMany({
    data: [
      { userId: userByName.get('jade')!.id, body: 'Salut, je confirme que le tri des cadeaux est plus clair maintenant.', fromAdmin: false, isRead: true, createdAt: hoursAgo(20) },
      { userId: userByName.get('jade')!.id, body: 'Merci, on surveille encore le cas des cadeaux déjà ouverts.', fromAdmin: true, isRead: true, createdAt: hoursAgo(18) },
      { userId: userByName.get('camille')!.id, body: 'Le panneau social marche bien, mais je voulais vérifier les connexions mutuelles.', fromAdmin: false, isRead: false, createdAt: hoursAgo(9) },
      { userId: userByName.get('raph')!.id, body: 'Sur mobile le HUD Racer se superpose encore légèrement.', fromAdmin: false, isRead: false, createdAt: hoursAgo(7) },
      { userId: userByName.get('raph')!.id, body: 'Bien reçu, on a ouvert un ticket interne pour ça.', fromAdmin: true, isRead: false, createdAt: hoursAgo(6) },
    ],
  });

  await prisma.adminWarning.createMany({
    data: [
      {
        userId: userByName.get('raph')!.id,
        issuedById: admin.id,
        message: 'Évite le spam de demandes de revanche dans le chat public.',
        severity: 'MEDIUM',
        isAcknowledged: false,
        createdAt: daysAgo(1, 13),
      },
      {
        userId: userByName.get('jade')!.id,
        issuedById: admin.id,
        message: 'Rappel: les images de clan doivent rester liées au thème du groupe.',
        severity: 'LOW',
        isAcknowledged: true,
        acknowledgedAt: hoursAgo(12),
        createdAt: daysAgo(2, 18),
      },
    ],
  });

  await prisma.polytrackRecord.createMany({
    data: [
      { userId: userByName.get('ava')!.id, trackNumber: 1, timeMs: 71234, createdAt: daysAgo(4, 19) },
      { userId: userByName.get('milo')!.id, trackNumber: 1, timeMs: 71910, createdAt: daysAgo(2, 20) },
      { userId: userByName.get('yanis')!.id, trackNumber: 2, timeMs: 70122, createdAt: daysAgo(3, 18) },
      { userId: userByName.get('ava')!.id, trackNumber: 2, timeMs: 70980, createdAt: daysAgo(1, 21) },
      { userId: userByName.get('lucas')!.id, trackNumber: 3, timeMs: 73540, createdAt: daysAgo(5, 17) },
      { userId: userByName.get('milo')!.id, trackNumber: 3, timeMs: 72995, createdAt: daysAgo(2, 17) },
      { userId: userByName.get('salma')!.id, trackNumber: 4, timeMs: 74810, createdAt: daysAgo(4, 16) },
      { userId: userByName.get('yanis')!.id, trackNumber: 4, timeMs: 74140, createdAt: daysAgo(1, 16) },
      { userId: userByName.get('ava')!.id, trackNumber: 5, timeMs: 69640, createdAt: daysAgo(6, 14) },
      { userId: userByName.get('theo')!.id, trackNumber: 5, timeMs: 70420, createdAt: daysAgo(2, 14) },
      { userId: userByName.get('milo')!.id, trackNumber: 6, timeMs: 68880, createdAt: daysAgo(3, 13) },
      { userId: userByName.get('ava')!.id, trackNumber: 6, timeMs: 68490, createdAt: daysAgo(1, 13) },
      { userId: userByName.get('yanis')!.id, trackNumber: 7, timeMs: 67610, createdAt: daysAgo(2, 12) },
      { userId: userByName.get('milo')!.id, trackNumber: 7, timeMs: 67940, createdAt: daysAgo(1, 12) },
      { userId: userByName.get('lucas')!.id, trackNumber: 8, timeMs: 75220, createdAt: daysAgo(4, 12) },
      { userId: userByName.get('camille')!.id, trackNumber: 8, timeMs: 76010, createdAt: daysAgo(2, 11) },
      { userId: userByName.get('salma')!.id, trackNumber: 9, timeMs: 72440, createdAt: daysAgo(3, 11) },
      { userId: userByName.get('ava')!.id, trackNumber: 9, timeMs: 71820, createdAt: daysAgo(1, 11) },
      { userId: userByName.get('milo')!.id, trackNumber: 10, timeMs: 70660, createdAt: daysAgo(3, 10) },
      { userId: userByName.get('yanis')!.id, trackNumber: 10, timeMs: 70190, createdAt: daysAgo(1, 10) },
      { userId: userByName.get('theo')!.id, trackNumber: 11, timeMs: 73910, createdAt: daysAgo(4, 10) },
      { userId: userByName.get('lucas')!.id, trackNumber: 11, timeMs: 73280, createdAt: daysAgo(2, 10) },
      { userId: userByName.get('ava')!.id, trackNumber: 12, timeMs: 68990, createdAt: daysAgo(3, 9) },
      { userId: userByName.get('milo')!.id, trackNumber: 12, timeMs: 69240, createdAt: daysAgo(2, 9) },
      { userId: userByName.get('yanis')!.id, trackNumber: 13, timeMs: 71510, createdAt: daysAgo(2, 9) },
      { userId: userByName.get('salma')!.id, trackNumber: 13, timeMs: 71930, createdAt: daysAgo(1, 9) },
      { userId: userByName.get('milo')!.id, trackNumber: 14, timeMs: 69780, createdAt: daysAgo(3, 8) },
      { userId: userByName.get('ava')!.id, trackNumber: 14, timeMs: 69460, createdAt: daysAgo(1, 8) },
    ],
  });

  const createClashBuildings = (config: {
    townHall: number;
    storage: number;
    vault: number;
    cannon: number;
    wall: number;
  }) => {
    const makeBuilding = (
      type: 'townHall' | 'goldStorage' | 'vault' | 'cannon' | 'wall',
      level: number,
      x: number,
      y: number
    ) => {
      const maxHp = {
        townHall: 900 + (level - 1) * 240,
        goldStorage: 620 + (level - 1) * 160,
        vault: 520 + (level - 1) * 120,
        cannon: 560 + (level - 1) * 150,
        wall: 750 + (level - 1) * 190,
      }[type];

      return {
        id: `${type}-${x}-${y}`,
        type,
        level,
        x,
        y,
        hp: maxHp,
        maxHp,
        storageCapacity: type === 'goldStorage' ? 2000 + (level - 1) * 1500 : undefined,
        defensePower: type === 'cannon' ? 14 + (level - 1) * 8 : type === 'wall' ? 8 + (level - 1) * 6 : undefined,
        protectionPct: type === 'vault' ? Math.min(0.08 + (level - 1) * 0.06, 0.5) : undefined,
      };
    };

    return [
      makeBuilding('townHall', config.townHall, 4, 1),
      makeBuilding('goldStorage', config.storage, 2, 3),
      makeBuilding('vault', config.vault, 6, 3),
      makeBuilding('cannon', config.cannon, 2, 1),
      makeBuilding('wall', config.wall, 5, 4),
    ];
  };

  const createClashLayout = (buildings: Array<{ id: string; type: string; x: number; y: number }>) =>
    buildings.map((building) => ({ id: building.id, type: building.type, x: building.x, y: building.y }));

  const createTroops = (barbarian: number, archer: number, giant: number) => ([
    { type: 'barbarian', count: barbarian },
    { type: 'archer', count: archer },
    { type: 'giant', count: giant },
  ]);

  const clashVillageConfigs = [
    { username: 'milo', townHallLevel: 3, moneyInStorage: 3450, trophies: 182, buildings: createClashBuildings({ townHall: 3, storage: 2, vault: 2, cannon: 3, wall: 2 }), troops: createTroops(22, 16, 7) },
    { username: 'yanis', townHallLevel: 3, moneyInStorage: 3220, trophies: 176, buildings: createClashBuildings({ townHall: 3, storage: 2, vault: 2, cannon: 2, wall: 3 }), troops: createTroops(18, 14, 8) },
    { username: 'camille', townHallLevel: 2, moneyInStorage: 2140, trophies: 141, buildings: createClashBuildings({ townHall: 2, storage: 2, vault: 1, cannon: 2, wall: 2 }), troops: createTroops(16, 12, 5) },
    { username: 'hugo', townHallLevel: 2, moneyInStorage: 1680, trophies: 128, buildings: createClashBuildings({ townHall: 2, storage: 1, vault: 1, cannon: 2, wall: 2 }), troops: createTroops(14, 11, 4) },
    { username: 'salma', townHallLevel: 3, moneyInStorage: 3580, trophies: 189, buildings: createClashBuildings({ townHall: 3, storage: 3, vault: 2, cannon: 3, wall: 2 }), troops: createTroops(20, 18, 6) },
  ] as const;

  await prisma.clashVillage.createMany({
    data: clashVillageConfigs.map((entry) => ({
      userId: userByName.get(entry.username)!.id,
      townHallLevel: entry.townHallLevel,
      moneyInStorage: entry.moneyInStorage,
      trophies: entry.trophies,
      layoutJson: JSON.stringify(createClashLayout(entry.buildings)),
      buildingsJson: JSON.stringify(entry.buildings),
      troopsJson: JSON.stringify(entry.troops),
      shieldUntil: entry.username === 'camille' ? hoursAgo(-2) : null,
      attackCooldownUntil: entry.username === 'milo' ? hoursAgo(-1) : null,
    })),
  });

  const clashVillages = await prisma.clashVillage.findMany();
  const clashVillageByUserId = new Map(clashVillages.map((village) => [village.userId, village]));
  await prisma.clashActivity.createMany({
    data: [
      { villageId: clashVillageByUserId.get(userByName.get('milo')!.id)!.id, type: 'SYSTEM', title: 'Village fondé', detail: 'Base calibrée pour les tests de matchmaking.', createdAt: daysAgo(5, 18) },
      { villageId: clashVillageByUserId.get(userByName.get('milo')!.id)!.id, type: 'UPGRADE', title: 'Amélioration cannon', detail: 'Le canon passe au niveau 3.', deltaMoney: -1200, createdAt: daysAgo(1, 18) },
      { villageId: clashVillageByUserId.get(userByName.get('camille')!.id)!.id, type: 'DEFENSE', title: 'Défense réussie', detail: 'Un attaquant est reparti avec peu de butin.', deltaTrophies: 5, createdAt: hoursAgo(9) },
      { villageId: clashVillageByUserId.get(userByName.get('salma')!.id)!.id, type: 'ATTACK', title: 'Raid gagnant', detail: 'Butin encaissé contre Hugo.', deltaMoney: 340, deltaTrophies: 10, createdAt: hoursAgo(7) },
      { villageId: clashVillageByUserId.get(userByName.get('hugo')!.id)!.id, type: 'ATTACKED', title: 'Base attaquée', detail: 'Quelques ressources perdues, bouclier activé.', deltaMoney: -340, deltaTrophies: -10, createdAt: hoursAgo(7) },
    ],
  });

  await prisma.clashBattle.createMany({
    data: [
      {
        attackerUserId: userByName.get('salma')!.id,
        defenderUserId: userByName.get('hugo')!.id,
        destructionPercent: 68,
        moneyStolen: 340,
        trophiesDeltaAttacker: 10,
        trophiesDeltaDefender: -10,
        resultJson: JSON.stringify({ result: 'win', destroyedBuildings: ['townHall-4-1', 'goldStorage-2-3'] }),
        createdAt: hoursAgo(7),
      },
      {
        attackerUserId: userByName.get('milo')!.id,
        defenderUserId: userByName.get('camille')!.id,
        destructionPercent: 22,
        moneyStolen: 110,
        trophiesDeltaAttacker: -8,
        trophiesDeltaDefender: 5,
        resultJson: JSON.stringify({ result: 'fail', destroyedBuildings: ['wall-5-4'] }),
        createdAt: hoursAgo(9),
      },
      {
        attackerUserId: userByName.get('yanis')!.id,
        defenderUserId: userByName.get('salma')!.id,
        destructionPercent: 51,
        moneyStolen: 260,
        trophiesDeltaAttacker: 10,
        trophiesDeltaDefender: -10,
        resultJson: JSON.stringify({ result: 'win', destroyedBuildings: ['vault-6-3'] }),
        createdAt: daysAgo(1, 17),
      },
    ],
  });

  const seedBadgeDefinitions = [
    {
      name: 'Fondateur de saison',
      description: 'Compte seed historique visible sur les profils mock.',
      howToObtain: 'Attribué aux profils de démonstration principaux.',
      icon: '🌌',
      iconColor: '#ffffff',
      backgroundColor: '#1E293B',
      borderColor: '#38BDF8',
      rarity: 'rare',
      category: 'special',
    },
    {
      name: 'MVP de guerre',
      description: 'Récompense un joueur dominant lors d une guerre de clan.',
      howToObtain: 'Attribué au meilleur score de guerre seed.',
      icon: '⚔️',
      iconColor: '#FEF3C7',
      backgroundColor: '#7C2D12',
      borderColor: '#F59E0B',
      rarity: 'epic',
      category: 'achievement',
    },
    {
      name: 'Support exemplaire',
      description: 'Visible dans le chat et sur les profils orientés aide.',
      howToObtain: 'Attribué aux membres utilisés pour le seed support.',
      icon: '🛟',
      iconColor: '#DCFCE7',
      backgroundColor: '#14532D',
      borderColor: '#22C55E',
      rarity: 'uncommon',
      category: 'special',
    },
  ] as const;

  const badgeByName = new Map<string, { id: string }>();
  for (const badge of seedBadgeDefinitions) {
    const existing = await prisma.badge.findFirst({ where: { name: badge.name } });
    const upserted = existing
      ? await prisma.badge.update({
          where: { id: existing.id },
          data: { ...badge, createdById: admin.id, isAutomatic: false, isActive: true, isHidden: false },
          select: { id: true },
        })
      : await prisma.badge.create({
          data: { ...badge, createdById: admin.id, isAutomatic: false, isActive: true, isHidden: false },
          select: { id: true },
        });
    badgeByName.set(badge.name, upserted);
  }

  await prisma.userBadge.createMany({
    data: [
      { userId: userByName.get('lena')!.id, badgeId: badgeByName.get('Fondateur de saison')!.id, obtainedAt: daysAgo(40, 12), obtainedReason: 'Profil seed fondateur' },
      { userId: userByName.get('milo')!.id, badgeId: badgeByName.get('Fondateur de saison')!.id, obtainedAt: daysAgo(39, 12), obtainedReason: 'Profil seed fondateur' },
      { userId: userByName.get('salma')!.id, badgeId: badgeByName.get('Fondateur de saison')!.id, obtainedAt: daysAgo(38, 12), obtainedReason: 'Profil seed fondateur' },
      { userId: userByName.get('yanis')!.id, badgeId: badgeByName.get('MVP de guerre')!.id, obtainedAt: daysAgo(1, 21), obtainedReason: 'Meilleur score sur la guerre Voltage Drift' },
      { userId: userByName.get('jade')!.id, badgeId: badgeByName.get('Support exemplaire')!.id, obtainedAt: daysAgo(4, 14), obtainedReason: 'Thread support seed' },
      { userId: userByName.get('camille')!.id, badgeId: badgeByName.get('Support exemplaire')!.id, obtainedAt: daysAgo(3, 10), obtainedReason: 'Social + support tests' },
    ],
  });

  await prisma.user.update({
    where: { id: userByName.get('lena')!.id },
    data: {
      equippedBadge1Id: badgeByName.get('Fondateur de saison')!.id,
    },
  });
  await prisma.user.update({
    where: { id: userByName.get('yanis')!.id },
    data: {
      equippedBadge1Id: badgeByName.get('MVP de guerre')!.id,
    },
  });
  await prisma.user.update({
    where: { id: userByName.get('jade')!.id },
    data: {
      equippedBadge1Id: badgeByName.get('Support exemplaire')!.id,
    },
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

  let popup2: { id: string; title: string } | null = null;
  if (existingTables.has('UpdatePopup')) {
    const popup1 = await prismaAny.updatePopup.create({
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
      select: {
        id: true,
      },
    });
    const popup2Created = await prismaAny.updatePopup.create({
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
      select: {
        id: true,
        title: true,
      },
    });
    popup2 = popup2Created;

    if (existingTables.has('UserUpdatePopupView')) {
      await prismaAny.userUpdatePopupView.createMany({
        data: [
          { userId: userByName.get('milo')!.id, popupId: popup1.id, viewedAt: hoursAgo(10) },
          { userId: userByName.get('salma')!.id, popupId: popup1.id, viewedAt: hoursAgo(9) },
          { userId: userByName.get('lena')!.id, popupId: popup2Created.id, viewedAt: hoursAgo(1) },
        ],
      });
    }
  }

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
          body: 'Maya a demandé à rejoindre Les Nebuleux.',
          data: JSON.stringify({ clanId: nebuleux.id, requesterId: userByName.get('maya_pending')!.id }),
          link: '/clans',
          icon: 'flag',
          isRead: false,
          createdAt: hoursAgo(5),
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
          data: JSON.stringify({ popupId: popup2?.id ?? null }),
          link: '/',
          icon: 'sparkles',
          isRead: true,
          readAt: hoursAgo(1),
          createdAt: hoursAgo(1.2),
        },
        {
          userId: userByName.get('camille')!.id,
          type: 'SOCIAL_CONNECTION',
          title: 'Nouvelle connexion',
          body: 'Jade te suit aussi maintenant.',
          data: JSON.stringify({ userId: userByName.get('jade')!.id }),
          link: `/profile/${userByName.get('jade')!.id}`,
          icon: 'users',
          isRead: false,
          createdAt: hoursAgo(3.2),
        },
        {
          userId: userByName.get('raph')!.id,
          type: 'SYSTEM',
          title: 'Réponse support',
          body: 'Un admin a répondu à ton message concernant Racer.',
          data: JSON.stringify({ threadUserId: userByName.get('raph')!.id }),
          link: '/support',
          icon: 'life-buoy',
          isRead: false,
          createdAt: hoursAgo(6),
        },
        {
          userId: userByName.get('ava')!.id,
          type: 'SYSTEM',
          title: 'Badge obtenu',
          body: 'Ton profil a reçu un badge visible sur le chat et les leaderboards.',
          data: JSON.stringify({ badgeName: 'Fondateur de saison' }),
          link: `/profile/${userByName.get('ava')!.id}`,
          icon: 'badge-check',
          isRead: true,
          readAt: hoursAgo(1.5),
          createdAt: hoursAgo(8),
        },
        {
          userId: userByName.get('salma')!.id,
          type: 'SYSTEM',
          title: 'Guerre de clan en cours',
          body: 'Orbit Exchange affronte Les Nebuleux, score serré.',
          data: JSON.stringify({ warId: activeWar.id }),
          link: '/clans',
          icon: 'swords',
          isRead: false,
          createdAt: hoursAgo(2.4),
        },
      ],
    });
  }

  if (existingTables.has('OnlineSnapshot')) {
    await prisma.onlineSnapshot.createMany({
      data: [
        { count: 4, usernames: JSON.stringify([{ userId: userByName.get('lena')!.id, username: 'lena' }, { userId: userByName.get('milo')!.id, username: 'milo' }, { userId: userByName.get('zoe')!.id, username: 'zoe' }, { userId: userByName.get('salma')!.id, username: 'salma' }]), createdAt: daysAgo(6, 18) },
        { count: 7, usernames: JSON.stringify([{ userId: userByName.get('lena')!.id, username: 'lena' }, { userId: userByName.get('milo')!.id, username: 'milo' }, { userId: userByName.get('zoe')!.id, username: 'zoe' }, { userId: userByName.get('salma')!.id, username: 'salma' }, { userId: userByName.get('tom')!.id, username: 'tom' }, { userId: userByName.get('ava')!.id, username: 'ava' }, { userId: userByName.get('yanis')!.id, username: 'yanis' }]), createdAt: daysAgo(5, 21) },
        { count: 5, usernames: JSON.stringify([{ userId: userByName.get('nina')!.id, username: 'nina' }, { userId: userByName.get('jade')!.id, username: 'jade' }, { userId: userByName.get('camille')!.id, username: 'camille' }, { userId: userByName.get('lucas')!.id, username: 'lucas' }, { userId: userByName.get('theo')!.id, username: 'theo' }]), createdAt: daysAgo(4, 16) },
        { count: 9, usernames: JSON.stringify([{ userId: userByName.get('lena')!.id, username: 'lena' }, { userId: userByName.get('milo')!.id, username: 'milo' }, { userId: userByName.get('zoe')!.id, username: 'zoe' }, { userId: userByName.get('salma')!.id, username: 'salma' }, { userId: userByName.get('ava')!.id, username: 'ava' }, { userId: userByName.get('yanis')!.id, username: 'yanis' }, { userId: userByName.get('lucas')!.id, username: 'lucas' }, { userId: userByName.get('ines')!.id, username: 'ines' }, { userId: userByName.get('jade')!.id, username: 'jade' }]), createdAt: daysAgo(3, 20) },
        { count: 6, usernames: JSON.stringify([{ userId: userByName.get('tom')!.id, username: 'tom' }, { userId: userByName.get('nina')!.id, username: 'nina' }, { userId: userByName.get('raph')!.id, username: 'raph' }, { userId: userByName.get('noah')!.id, username: 'noah' }, { userId: userByName.get('jade')!.id, username: 'jade' }, { userId: userByName.get('camille')!.id, username: 'camille' }]), createdAt: daysAgo(2, 14) },
        { count: 11, usernames: JSON.stringify([{ userId: userByName.get('lena')!.id, username: 'lena' }, { userId: userByName.get('milo')!.id, username: 'milo' }, { userId: userByName.get('zoe')!.id, username: 'zoe' }, { userId: userByName.get('salma')!.id, username: 'salma' }, { userId: userByName.get('ava')!.id, username: 'ava' }, { userId: userByName.get('yanis')!.id, username: 'yanis' }, { userId: userByName.get('lucas')!.id, username: 'lucas' }, { userId: userByName.get('ines')!.id, username: 'ines' }, { userId: userByName.get('jade')!.id, username: 'jade' }, { userId: userByName.get('camille')!.id, username: 'camille' }, { userId: userByName.get('theo')!.id, username: 'theo' }]), createdAt: daysAgo(1, 22) },
        { count: 8, usernames: JSON.stringify([{ userId: userByName.get('lena')!.id, username: 'lena' }, { userId: userByName.get('milo')!.id, username: 'milo' }, { userId: userByName.get('zoe')!.id, username: 'zoe' }, { userId: userByName.get('ava')!.id, username: 'ava' }, { userId: userByName.get('salma')!.id, username: 'salma' }, { userId: userByName.get('theo')!.id, username: 'theo' }, { userId: userByName.get('yanis')!.id, username: 'yanis' }, { userId: userByName.get('jade')!.id, username: 'jade' }]), createdAt: hoursAgo(12) },
        { count: 10, usernames: JSON.stringify([{ userId: userByName.get('lena')!.id, username: 'lena' }, { userId: userByName.get('milo')!.id, username: 'milo' }, { userId: userByName.get('zoe')!.id, username: 'zoe' }, { userId: userByName.get('salma')!.id, username: 'salma' }, { userId: userByName.get('ava')!.id, username: 'ava' }, { userId: userByName.get('yanis')!.id, username: 'yanis' }, { userId: userByName.get('lucas')!.id, username: 'lucas' }, { userId: userByName.get('ines')!.id, username: 'ines' }, { userId: userByName.get('jade')!.id, username: 'jade' }, { userId: userByName.get('camille')!.id, username: 'camille' }]), createdAt: hoursAgo(1) },
      ],
    });
  }

  if (existingTables.has('UpdateEntry') && existingTables.has('UpdateItem') && existingTables.has('UpdateReaction')) {
    const updateEntries = await prisma.updateEntry.createManyAndReturn({
      data: [
        {
          date: startOfDay().toISOString().slice(0, 10),
          title: 'DM inbox and Aura Scroll coverage',
          summary: 'Seed now includes direct messages and seeded Aura Scroll activity.',
          body: 'Added realistic DM threads, scroll posts, likes, comments, and comment likes to improve local QA coverage.',
          feedCategory: 'PATCH',
          imageUrl: MOCK_IMAGE.update,
          accentColor: '#0EA5E9',
          isFeatured: true,
          authorName: 'Equipe AuraTracker',
          authorRole: 'Backend Seed',
          authorAvatarUrl: MOCK_IMAGE.lena,
          isPublished: true,
          publishedAt: hoursAgo(1.2),
          createdAt: hoursAgo(1.2),
        },
        {
          date: startOfDay().toISOString().slice(0, 10),
          title: 'Update feed receives seed entries',
          summary: 'Changelog cards now have seeded entries, bullets, and reactions.',
          body: 'This helps validate update-feed UI states without relying on manual admin creation.',
          feedCategory: 'DEV',
          imageUrl: MOCK_IMAGE.market,
          accentColor: '#22C55E',
          isFeatured: false,
          authorName: 'Equipe AuraTracker',
          authorRole: 'Data Ops',
          authorAvatarUrl: MOCK_IMAGE.milo,
          isPublished: true,
          publishedAt: hoursAgo(0.9),
          createdAt: hoursAgo(0.9),
        },
      ],
      select: { id: true, title: true },
    });

    const entryByTitle = new Map(updateEntries.map((entry) => [entry.title, entry.id]));

    await prisma.updateItem.createMany({
      data: [
        {
          entryId: entryByTitle.get('DM inbox and Aura Scroll coverage')!,
          category: 'BIG_FEATURE',
          text: 'Direct conversations now ship with multi-message threads between active users.',
          order: 1,
        },
        {
          entryId: entryByTitle.get('DM inbox and Aura Scroll coverage')!,
          category: 'SMALL_FEATURE',
          text: 'Aura Scroll includes approved posts, likes, and comment-like interactions.',
          order: 2,
        },
        {
          entryId: entryByTitle.get('Update feed receives seed entries')!,
          category: 'SMALL_FEATURE',
          text: 'Update feed renders with seed cards and category bullets by default.',
          order: 1,
        },
        {
          entryId: entryByTitle.get('Update feed receives seed entries')!,
          category: 'BUG_FIX',
          text: 'Added deterministic seed order for update-card testing snapshots.',
          order: 2,
        },
      ],
    });

    await prisma.updateReaction.createMany({
      data: [
        {
          entryId: entryByTitle.get('DM inbox and Aura Scroll coverage')!,
          userId: userByName.get('lena')!.id,
          kind: 'fire',
          createdAt: hoursAgo(0.8),
        },
        {
          entryId: entryByTitle.get('DM inbox and Aura Scroll coverage')!,
          userId: userByName.get('milo')!.id,
          kind: 'zap',
          createdAt: hoursAgo(0.75),
        },
        {
          entryId: entryByTitle.get('Update feed receives seed entries')!,
          userId: userByName.get('zoe')!.id,
          kind: 'heart',
          createdAt: hoursAgo(0.6),
        },
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
        details: JSON.stringify({ partyName: 'Voltage Drift' }),
        createdAt: daysAgo(3),
      },
      {
        type: 'CLAN',
        action: 'war_attack',
        userId: userByName.get('lena')!.id,
        username: 'lena',
        targetId: orbit.id,
        targetName: 'Orbit Exchange',
        details: JSON.stringify({ warId: activeWar.id, attackType: 'SIEGE', points: 42 }),
        metadata: JSON.stringify({ warStatus: 'ACTIVE' }),
        createdAt: hoursAgo(2.2),
      },
      {
        type: 'SUPPORT',
        action: 'reply',
        userId: admin.id,
        username: 'admin',
        targetId: userByName.get('raph')!.id,
        targetName: 'raph',
        details: JSON.stringify({ body: 'Bien reçu, on a ouvert un ticket interne pour ça.' }),
        createdAt: hoursAgo(6),
      },
      {
        type: 'SOCIAL',
        action: 'follow',
        userId: userByName.get('jade')!.id,
        username: 'jade',
        targetId: userByName.get('camille')!.id,
        targetName: 'camille',
        details: JSON.stringify({ mutual: true }),
        createdAt: daysAgo(3, 14),
      },
      {
        type: 'GAME',
        action: 'polytrack_record',
        userId: userByName.get('ava')!.id,
        username: 'ava',
        details: JSON.stringify({ trackNumber: 14, timeMs: 69460 }),
        metadata: JSON.stringify({ gameType: 'polytrack' }),
        createdAt: daysAgo(1, 8),
      },
      {
        type: 'ADMIN',
        action: 'update_popup_create',
        userId: admin.id,
        username: 'admin',
        details: JSON.stringify({ title: popup2?.title ?? 'Prediction market visuals' }),
        createdAt: hoursAgo(3),
      },
    ],
  });

  console.log('Seed complete.');
  console.log(`Admin login: admin / ${ADMIN_PASSWORD}`);
  console.log(`Mock users password: ${COMMON_PASSWORD}`);
  console.log('Seeded features: games, daily racer, polytrack, clash village, shop, inventory, clans, clan wars, support, social, suggestions, polymarket, gifts, badges, quests, pass, inbox, update popups, admin pending users.');
  console.log(`Kept active features only. No legacy placeholder entries were reintroduced for removed mock content.`);
  console.log(`Pending polymarket suggestion id: ${polyPending.id}`);

  await writeSeedVersionMarker();
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
