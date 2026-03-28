import { prisma } from '../server.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoConditionKey =
  | 'MEMBER'
  | `CLASS_${string}`
  | 'TOP_1_AURA'
  | 'TOP_3_AURA'
  | 'TOP_5_AURA'
  | 'TOP_10_AURA'
  | 'TOP_1_MONEY'
  | 'TOP_3_MONEY'
  | 'TOP_5_MONEY'
  | 'TOP_10_MONEY'
  | 'BOMBPARTY_TOP_WINS'
  | `GAME_HIGHSCORE_${string}`
  | 'GAME_HIGHSCORE_FRUIT_NINJA'
  // Achievement badges (auto-checked via scheduler or direct award)
  | 'TRYHARDEUR'              // 100+ total games played across all types
  | 'GRIND_200'               // 200+ total games played
  | 'GAME_2048_TILE_2048'     // made the 2048 tile (tracked via game_2048_tile gameType)
  | 'GAME_2048_TILE_4096'     // made the 4096 tile (tracked via game_2048_tile gameType)
  | 'SUDOKU_COMPLETED'        // completed at least one sudoku
  | 'TOP_CASINO_LOSSES'       // user with the most casino losses
  | 'TOP_BADGES_COUNT'        // user(s) with the most earned badges (excluding this badge)
  | 'CASINO_VETERAN'          // played 25+ casino games
  | 'FLAPPY_BIRD_50'          // flappy bird score >= 50
  | 'MINESWEEPER_WIN'         // won at least one minesweeper game
  // Direct-award achievement badges (awarded at event time, never auto-revoked)
  | 'CASINO_BET_10000'        // bet >= 10,000 in a single casino bet
  | 'CASINO_BET_20000'        // bet >= 20,000 in a single casino bet
  | 'CASINO_BET_50000'        // bet >= 50,000 in a single casino bet
  | 'CASINO_BET_100000'       // bet >= 100,000 in a single casino bet
  | 'NUIT_BLANCHE'            // connected between 3:00–4:00 AM
  | 'SUDOKU_EASY'             // completed at least one easy sudoku
  | 'SUDOKU_MEDIUM'           // completed at least one medium sudoku
  | 'SUDOKU_HARD'             // completed at least one hard sudoku
  | 'SUDOKU_EXPERT'           // completed at least one expert sudoku
  | 'MINESWEEPER_DEBUTANT'    // won at least one débutant minesweeper
  | 'MINESWEEPER_INTERMEDIAIRE' // won at least one intermédiaire minesweeper
  | 'MINESWEEPER_EXPERT'      // won at least one expert minesweeper
  | 'SOLITAIRE_WIN'           // won at least one game of solitaire
  | 'RACER_LAP'               // completed a lap of racer
  | 'CHESS_WIN'               // won a game of chess
  | 'GENEROUS'                // gifted something to someone
  | 'BUG_REPORTER'            // reported a bug
  | 'PUISSANCE_4_WIN'         // won a game of puissance 4
  | 'BALL_ARENA_WIN'          // won a game of ball arena
  | 'POLYMARKET_SUGGESTION_ACCEPTED' // suggestion polymarket acceptée
  | 'POLYMARKET_BETTOR'       // a placé un pari polymarket
  | 'POLYMARKET_WIN'          // a gagné un pari polymarket
  // Scheduler-based achievement badges
  | 'COLLECTIONNEUR_25'       // owns 25+ badges
  | 'GENEROUS_10_GIFTS'       // gifted 10+ times
  | 'POLYMARKET_20_WINS'      // won 20+ polymarket bets
  | 'SOCIAL_50_MESSAGES'      // sent 50+ chat messages
  | 'STREAK_7'                // daily pass streak >= 7
  | 'STREAK_30'               // daily pass streak >= 30
  | 'MENTOR_3_REFERRALS'      // referred 3+ approved users
  | 'CLAN_WARS_10'            // participated in 10+ completed clan wars
  | 'CLAN_MVP_3'              // top attacker in their clan in 3+ completed wars
  | 'MYTHIC_CATEGORY_COMPLETE' // owns all active badges in at least one category
  // Event-driven badges (awarded at event time via awardBadgeByKey)
  | 'FIRST_STEP'              // claimed first daily quest reward
  | 'SPEEDRUN_DAILY_60S'      // completed a quest within 60s of selecting it
  | 'NIGHT_OWL_WIN'           // won a game between 2:00–4:59 AM
  | 'EARLY_BIRD_WIN'          // won a game before 7:00 AM
  | 'PERFECT_10';             // 10 consecutive wins across all games

// ─── Core award / revoke helpers ─────────────────────────────────────────────

/**
 * Award a badge to a user. Safe to call even if the user already has the badge.
 * Returns true if newly awarded, false if already owned.
 */
export const awardBadge = async (
  userId: string,
  badgeId: string,
  reason?: string,
): Promise<boolean> => {
  try {
    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    });
    if (existing) return false; // already owned

    await prisma.userBadge.create({
      data: { userId, badgeId, obtainedReason: reason ?? null },
    });

    // Keep dynamic leaderboard-style badge in sync whenever ownership changes.
    void recheckBadgeForCondition('TOP_BADGES_COUNT');
    return true;
  } catch (error) {
    console.error('badgeAwards.awardBadge error:', error);
    return false;
  }
};

/**
 * Award a badge to a user by its autoConditionKey (if the badge exists and is active).
 * Safe to call even if already owned. Returns true if newly awarded.
 * Used for event-driven one-time awards.
 */
export const awardBadgeByKey = async (
  userId: string,
  conditionKey: string,
  reason?: string,
): Promise<boolean> => {
  try {
    const badge = await prisma.badge.findFirst({
      where: { autoConditionKey: conditionKey, isActive: true },
      select: { id: true, name: true },
    });
    if (!badge) return false;

    const awarded = await awardBadge(userId, badge.id, reason ?? `Automatiquement obtenu : ${badge.name}`);
    if (awarded) {
      await autoEquipForUsers([userId]);
    }
    return awarded;
  } catch (error) {
    console.error(`awardBadgeByKey(${conditionKey}) error:`, error);
    return false;
  }
};

/**
 * Revoke a badge from a user and unequip it from both badge slots if present.
 * Safe to call even if the user does not own the badge.
 */
export const revokeBadge = async (userId: string, badgeId: string): Promise<boolean> => {
  try {
    // Unequip from both slots in a single update
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { equippedBadge1Id: true, equippedBadge2Id: true },
    });
    if (user) {
      const unequipData: Record<string, null> = {};
      if (user.equippedBadge1Id === badgeId) unequipData.equippedBadge1Id = null;
      if (user.equippedBadge2Id === badgeId) unequipData.equippedBadge2Id = null;
      if (Object.keys(unequipData).length > 0) {
        await prisma.user.update({ where: { id: userId }, data: unequipData });
      }
    }

    await prisma.userBadge.delete({
      where: { userId_badgeId: { userId, badgeId } },
    });

    // Keep dynamic leaderboard-style badge in sync whenever ownership changes.
    void recheckBadgeForCondition('TOP_BADGES_COUNT');
    return true;
  } catch {
    return false;
  }
};

// ─── Auto-badge helpers ───────────────────────────────────────────────────────

const getQualifyingUserIds = async (key: string): Promise<Set<string>> => {
  // Every approved user earns the MEMBER badge
  if (key === 'MEMBER') {
    const users = await prisma.user.findMany({
      where: { isApproved: true },
      select: { id: true },
    });
    return new Set(users.map((u) => u.id));
  }
  // CLASS_SECONDE_A, CLASS_PREMIERE_B, CLASS_TERMINALE_G, …
  if (key.startsWith('CLASS_')) {
    const rest = key.slice('CLASS_'.length); // e.g. "SECONDE_A"
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore === -1) return new Set();
    const schoolLevel = rest.slice(0, lastUnderscore); // "SECONDE"
    const classLetter = rest.slice(lastUnderscore + 1); // "A"
    const users = await prisma.user.findMany({
      where: { isApproved: true, schoolLevel, classLetter },
      select: { id: true },
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_1_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 1,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_3_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 3,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_5_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 5,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_10_AURA') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { aura: 'desc' },
      take: 10,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_1_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 1,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_3_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 3,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_5_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 5,
    });
    return new Set(users.map((u) => u.id));
  }
  if (key === 'TOP_10_MONEY') {
    const users = await prisma.user.findMany({
      where: { isSuperAdmin: false },
      select: { id: true },
      orderBy: { money: 'desc' },
      take: 10,
    });
    return new Set(users.map((u) => u.id));
  }
  // GAME_HIGHSCORE_{gameType} – top-1 highscore for a specific game type
  // racer uses ascending order (lower lapTime = better)
  if (key.startsWith('GAME_HIGHSCORE_')) {
    const gameType = key.slice('GAME_HIGHSCORE_'.length).toLowerCase();
    const order = gameType === 'racer' ? 'asc' : 'desc';
    const stat = await prisma.gameStats.findFirst({
      where: { gameType, highScore: { gt: 0 } },
      select: { userId: true },
      orderBy: { highScore: order },
    });
    return stat ? new Set([stat.userId]) : new Set();
  }
  // BOMBPARTY_TOP_WINS – top BombParty wins holder
  if (key === 'BOMBPARTY_TOP_WINS') {
    const stat = await prisma.bombPartyStats.findFirst({
      select: { userId: true },
      orderBy: { wins: 'desc' },
    });
    return stat ? new Set([stat.userId]) : new Set();
  }

  // ── Achievement badges ──────────────────────────────────────────────────────

  // TRYHARDEUR / GRIND_200 – total games played (all game types + bombparty)
  if (key === 'TRYHARDEUR' || key === 'GRIND_200') {
    const threshold = key === 'GRIND_200' ? 200 : 100;
    const gameAgg = await prisma.gameStats.groupBy({
      by: ['userId'],
      _sum: { totalPlayed: true },
    });
    const bombStats = await prisma.bombPartyStats.findMany({
      select: { userId: true, totalPlayed: true },
    });
    const totals = new Map<string, number>();
    for (const g of gameAgg) {
      totals.set(g.userId, (g._sum.totalPlayed ?? 0));
    }
    for (const b of bombStats) {
      totals.set(b.userId, (totals.get(b.userId) ?? 0) + b.totalPlayed);
    }
    const result = new Set<string>();
    for (const [userId, total] of totals) {
      if (total >= threshold) result.add(userId);
    }
    return result;
  }

  // GAME_2048_TILE_2048 – actually made the 2048 tile (tracked via game_2048_tile gameType)
  if (key === 'GAME_2048_TILE_2048') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'game_2048_tile', highScore: { gte: 2048 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // GAME_2048_TILE_4096 – actually made the 4096 tile (tracked via game_2048_tile gameType)
  if (key === 'GAME_2048_TILE_4096') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'game_2048_tile', highScore: { gte: 4096 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // SUDOKU_COMPLETED – completed at least one sudoku grid (any difficulty)
  if (key === 'SUDOKU_COMPLETED') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'logic_lab', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // Sudoku difficulty badges – tracked via separate game type per difficulty
  if (key === 'SUDOKU_EASY') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'logic_lab_easy', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'SUDOKU_MEDIUM') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'logic_lab_medium', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'SUDOKU_HARD') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'logic_lab_hard', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'SUDOKU_EXPERT') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'logic_lab_expert', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // TOP_CASINO_LOSSES – user with the most casino losses
  if (key === 'TOP_CASINO_LOSSES') {
    const stat = await prisma.gameStats.findFirst({
      where: { gameType: 'casino', losses: { gt: 0 } },
      select: { userId: true },
      orderBy: { losses: 'desc' },
    });
    return stat ? new Set([stat.userId]) : new Set();
  }

  // TOP_BADGES_COUNT – user(s) with the most earned badges (excluding this badge)
  if (key === 'TOP_BADGES_COUNT') {
    const topBadgeIds = await prisma.badge.findMany({
      where: { autoConditionKey: 'TOP_BADGES_COUNT' },
      select: { id: true },
    });
    const excludedBadgeIds = topBadgeIds.map((b) => b.id);

    const participants = await prisma.user.findMany({
      where: { isSuperAdmin: false, isApproved: true },
      select: { id: true },
    });
    if (participants.length === 0) return new Set();

    const participantIds = participants.map((u) => u.id);
    const grouped = await prisma.userBadge.groupBy({
      by: ['userId'],
      where: {
        userId: { in: participantIds },
        ...(excludedBadgeIds.length > 0 ? { badgeId: { notIn: excludedBadgeIds } } : {}),
      },
      _count: { badgeId: true },
    });

    if (grouped.length === 0) return new Set();

    const maxCount = grouped.reduce((max, row) => Math.max(max, row._count.badgeId), 0);
    if (maxCount <= 0) return new Set();

    return new Set(
      grouped
        .filter((row) => row._count.badgeId === maxCount)
        .map((row) => row.userId),
    );
  }

  // CASINO_VETERAN – played 25+ casino games
  if (key === 'CASINO_VETERAN') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'casino', totalPlayed: { gte: 25 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // Casino big bet badges – tracked via separate game type
  if (key === 'CASINO_BET_10000') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'casino_bet_10000', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'CASINO_BET_20000') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'casino_bet_20000', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'CASINO_BET_50000') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'casino_bet_50000', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'CASINO_BET_100000') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'casino_bet_100000', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // FLAPPY_BIRD_50 – flappy bird highscore >= 50
  if (key === 'FLAPPY_BIRD_50') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'flappy_bird', highScore: { gte: 50 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // MINESWEEPER_WIN – won at least one minesweeper game (any difficulty)
  if (key === 'MINESWEEPER_WIN') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'minesweeper', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // Minesweeper difficulty badges – tracked via separate game type per difficulty
  if (key === 'MINESWEEPER_DEBUTANT') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'minesweeper_debutant', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'MINESWEEPER_INTERMEDIAIRE') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'minesweeper_intermediaire', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }
  if (key === 'MINESWEEPER_EXPERT') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'minesweeper_expert', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // SOLITAIRE_WIN – won at least one solitaire game
  if (key === 'SOLITAIRE_WIN') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'solitaire', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // RACER_LAP – completed at least one lap of racer
  if (key === 'RACER_LAP') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'racer', totalPlayed: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // CHESS_WIN – won at least one chess game
  if (key === 'CHESS_WIN') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'chess', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // PUISSANCE_4_WIN – won at least one game of puissance 4
  if (key === 'PUISSANCE_4_WIN') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'puissance_4', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // BALL_ARENA_WIN – won at least one game of ball arena
  if (key === 'BALL_ARENA_WIN') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'ball_arena', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // GENEROUS – gifted something to at least one person
  if (key === 'GENEROUS') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'gifts_sent', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // BUG_REPORTER – reported at least one bug
  if (key === 'BUG_REPORTER') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'bug_report', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // NUIT_BLANCHE – connected between 3:00–4:00 AM
  if (key === 'NUIT_BLANCHE') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'nuit_blanche', wins: { gte: 1 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // COLLECTIONNEUR_25 – owns 25+ badges (excluding this badge itself)
  if (key === 'COLLECTIONNEUR_25') {
    const thisKeys = await prisma.badge.findMany({
      where: { autoConditionKey: 'COLLECTIONNEUR_25' },
      select: { id: true },
    });
    const excludedIds = thisKeys.map((b) => b.id);

    const grouped = await prisma.userBadge.groupBy({
      by: ['userId'],
      where: excludedIds.length > 0 ? { badgeId: { notIn: excludedIds } } : {},
      _count: { badgeId: true },
    });
    return new Set(grouped.filter((r) => r._count.badgeId >= 25).map((r) => r.userId));
  }

  // GENEROUS_10_GIFTS – gifted 10+ times (tracked via gifts_sent gameStats)
  if (key === 'GENEROUS_10_GIFTS') {
    const stats = await prisma.gameStats.findMany({
      where: { gameType: 'gifts_sent', wins: { gte: 10 } },
      select: { userId: true },
    });
    return new Set(stats.map((s) => s.userId));
  }

  // POLYMARKET_20_WINS – won 20+ polymarket bets (payout != null means won)
  if (key === 'POLYMARKET_20_WINS') {
    const bets = await prisma.polymarketBet.groupBy({
      by: ['userId'],
      where: { payout: { not: null } },
      _count: { id: true },
    });
    return new Set(bets.filter((r) => r._count.id >= 20).map((r) => r.userId));
  }

  // SOCIAL_50_MESSAGES – sent 50+ chat messages
  if (key === 'SOCIAL_50_MESSAGES') {
    const msgs = await prisma.chatMessage.groupBy({
      by: ['userId'],
      where: { userId: { not: null }, type: 'user' },
      _count: { id: true },
    });
    return new Set(
      msgs
        .filter((r) => r.userId !== null && r._count.id >= 50)
        .map((r) => r.userId as string),
    );
  }

  // STREAK_7 / STREAK_30 – daily pass streak threshold
  if (key === 'STREAK_7' || key === 'STREAK_30') {
    const threshold = key === 'STREAK_30' ? 30 : 7;
    const users = await prisma.user.findMany({
      where: { isApproved: true, dailyPassStreak: { gte: threshold } },
      select: { id: true },
    });
    return new Set(users.map((u) => u.id));
  }

  // MENTOR_3_REFERRALS – referred 3+ approved users
  if (key === 'MENTOR_3_REFERRALS') {
    const referrals = await prisma.user.groupBy({
      by: ['referredById'],
      where: { isApproved: true, referredById: { not: null } },
      _count: { id: true },
    });
    return new Set(
      referrals
        .filter((r) => r.referredById !== null && r._count.id >= 3)
        .map((r) => r.referredById as string),
    );
  }

  // CLAN_WARS_10 – participated (attacked) in 10+ distinct completed wars
  if (key === 'CLAN_WARS_10') {
    const completedWars = await prisma.clanWar.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true },
    });
    const completedWarIds = completedWars.map((w) => w.id);
    if (completedWarIds.length === 0) return new Set();

    const attacks = await prisma.clanWarAttack.findMany({
      where: { warId: { in: completedWarIds } },
      select: { userId: true, warId: true },
    });
    const warsByUser = new Map<string, Set<string>>();
    for (const a of attacks) {
      if (!warsByUser.has(a.userId)) warsByUser.set(a.userId, new Set());
      warsByUser.get(a.userId)!.add(a.warId);
    }
    return new Set(
      [...warsByUser.entries()]
        .filter(([, wars]) => wars.size >= 10)
        .map(([userId]) => userId),
    );
  }

  // CLAN_MVP_3 – top attacker for their clan in 3+ completed wars
  if (key === 'CLAN_MVP_3') {
    const completedWars = await prisma.clanWar.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true },
    });
    const completedWarIds = completedWars.map((w) => w.id);
    if (completedWarIds.length === 0) return new Set();

    const attacks = await prisma.clanWarAttack.findMany({
      where: { warId: { in: completedWarIds } },
      select: { warId: true, clanId: true, userId: true, finalPoints: true },
    });

    // Sum points per (war, clan, user)
    const warClanPoints = new Map<string, Map<string, number>>();
    for (const a of attacks) {
      const key2 = `${a.warId}:${a.clanId}`;
      if (!warClanPoints.has(key2)) warClanPoints.set(key2, new Map());
      const userMap = warClanPoints.get(key2)!;
      userMap.set(a.userId, (userMap.get(a.userId) ?? 0) + a.finalPoints);
    }

    // Find top contributor per (war, clan)
    const mvpCount = new Map<string, number>();
    for (const userMap of warClanPoints.values()) {
      if (userMap.size === 0) continue;
      const [topUserId] = [...userMap.entries()].sort((a, b) => b[1] - a[1])[0];
      mvpCount.set(topUserId, (mvpCount.get(topUserId) ?? 0) + 1);
    }
    return new Set(
      [...mvpCount.entries()].filter(([, count]) => count >= 3).map(([userId]) => userId),
    );
  }

  // MYTHIC_CATEGORY_COMPLETE – owns all active badges in at least one category
  if (key === 'MYTHIC_CATEGORY_COMPLETE') {
    const thisKeys = await prisma.badge.findMany({
      where: { autoConditionKey: 'MYTHIC_CATEGORY_COMPLETE' },
      select: { id: true },
    });
    const excludedIds = new Set(thisKeys.map((b) => b.id));

    const allBadges = await prisma.badge.findMany({
      where: { isActive: true },
      select: { id: true, category: true },
    });
    const byCategory = new Map<string, string[]>();
    for (const b of allBadges) {
      if (!b.category || excludedIds.has(b.id)) continue;
      if (!byCategory.has(b.category)) byCategory.set(b.category, []);
      byCategory.get(b.category)!.push(b.id);
    }
    // Only check categories with at least 2 badges (skip trivially small ones)
    const eligibleCategories = [...byCategory.entries()].filter(([, ids]) => ids.length >= 2);
    if (eligibleCategories.length === 0) return new Set();

    const users = await prisma.user.findMany({
      where: { isApproved: true, isSuperAdmin: false },
      select: {
        id: true,
        earnedBadges: { select: { badgeId: true } },
      },
    });

    const result = new Set<string>();
    for (const user of users) {
      const earned = new Set(user.earnedBadges.map((b) => b.badgeId));
      for (const [, badgeIds] of eligibleCategories) {
        if (badgeIds.every((id) => earned.has(id))) {
          result.add(user.id);
          break;
        }
      }
    }
    return result;
  }

  return new Set();
};

/**
 * Check every automatic badge and award/revoke memberships accordingly.
 * This is idempotent — safe to call at any time.
 */
export const checkAndUpdateAutoBadges = async (): Promise<void> => {
  try {
    const autoBadges = await prisma.badge.findMany({
      where: { isAutomatic: true, isActive: true, autoConditionKey: { not: null } },
      select: { id: true, autoConditionKey: true, name: true },
    });

    for (const badge of autoBadges) {
      if (!badge.autoConditionKey) continue;

      const qualifyingIds = await getQualifyingUserIds(badge.autoConditionKey);

      // Users who currently have this badge
      const current = await prisma.userBadge.findMany({
        where: { badgeId: badge.id },
        select: { userId: true },
      });
      const currentIds = new Set(current.map((ub) => ub.userId));

      // Award to new qualifiers
      for (const userId of qualifyingIds) {
        if (!currentIds.has(userId)) {
          await awardBadge(
            userId,
            badge.id,
            `Automatiquement obtenu : ${badge.name}`,
          );
        }
      }

      // Revoke from users who no longer qualify
      for (const userId of currentIds) {
        if (!qualifyingIds.has(userId)) {
          await revokeBadge(userId, badge.id);
        }
      }
    }
  } catch (error) {
    console.error('checkAndUpdateAutoBadges error:', error);
  }
};

// ─── Targeted single-condition recheck ───────────────────────────────────────

/**
 * Re-evaluate exactly one automatic badge condition and update only the users
 * whose membership changed. Also auto-equips newly awarded badges.
 *
 * Use this for immediate recalculations (e.g. on new highscore) instead of
 * running the full checkAndUpdateAutoBadges() cycle.
 */
export const recheckBadgeForCondition = async (conditionKey: string): Promise<void> => {
  try {
    const badge = await prisma.badge.findFirst({
      where: { autoConditionKey: conditionKey, isAutomatic: true, isActive: true },
      select: { id: true, name: true },
    });
    if (!badge) return;

    const qualifyingIds = await getQualifyingUserIds(conditionKey);

    const current = await prisma.userBadge.findMany({
      where: { badgeId: badge.id },
      select: { userId: true },
    });
    const currentIds = new Set(current.map((ub) => ub.userId));

    const affected = new Set<string>();

    for (const userId of qualifyingIds) {
      if (!currentIds.has(userId)) {
        await awardBadge(userId, badge.id, `Automatiquement obtenu : ${badge.name}`);
        affected.add(userId);
      }
    }

    for (const userId of currentIds) {
      if (!qualifyingIds.has(userId)) {
        await revokeBadge(userId, badge.id);
        affected.add(userId);
      }
    }

    // Auto-equip for affected users only (fast — at most 2 users per highscore change)
    if (affected.size > 0) {
      await autoEquipForUsers([...affected]);
    }
  } catch (error) {
    console.error(`recheckBadgeForCondition(${conditionKey}) error:`, error);
  }
};

/** Auto-equip logic scoped to a specific list of user IDs. */
export const autoEquipForUsers = async (userIds: string[]): Promise<void> => {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isApproved: true },
      select: {
        id: true,
        schoolLevel: true,
        classLetter: true,
        equippedBadge1Id: true,
        equippedBadge2Id: true,
        earnedBadges: {
          select: { badge: { select: { id: true, autoConditionKey: true } } },
        },
      },
    });

    for (const user of users) {
      if (user.equippedBadge1Id && user.equippedBadge2Id) continue;

      const ownedByKey = new Map(
        user.earnedBadges
          .filter((ub) => ub.badge.autoConditionKey)
          .map((ub) => [ub.badge.autoConditionKey!, ub.badge.id]),
      );
      const ownedIds = user.earnedBadges.map((ub) => ub.badge.id);

      const classKey =
        user.schoolLevel && user.classLetter
          ? `CLASS_${user.schoolLevel}_${user.classLetter}`
          : null;

      const priority: string[] = [];
      if (classKey && ownedByKey.has(classKey)) priority.push(ownedByKey.get(classKey)!);
      if (ownedByKey.has('MEMBER')) priority.push(ownedByKey.get('MEMBER')!);
      for (const id of ownedIds) {
        if (!priority.includes(id)) priority.push(id);
      }

      const alreadyEquipped = new Set(
        [user.equippedBadge1Id, user.equippedBadge2Id].filter(Boolean) as string[],
      );
      const candidates = priority.filter((id) => !alreadyEquipped.has(id));

      const patch: { equippedBadge1Id?: string; equippedBadge2Id?: string } = {};

      if (!user.equippedBadge1Id && candidates[0]) {
        patch.equippedBadge1Id = candidates[0];
        alreadyEquipped.add(candidates[0]);
        candidates.shift();
      }
      if (!user.equippedBadge2Id) {
        const next = candidates.find((id) => !alreadyEquipped.has(id));
        if (next) patch.equippedBadge2Id = next;
      }

      if (Object.keys(patch).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: patch });
      }
    }
  } catch (error) {
    console.error('autoEquipForUsers error:', error);
  }
};

// ─── Auto-equip ──────────────────────────────────────────────────────────────

/**
 * For every approved user with at least one empty badge slot, fill it with:
 *   Slot 1 priority: class badge → member badge → any earned badge
 *   Slot 2 priority: member badge → any earned badge (different from slot 1)
 *
 * Already-equipped slots are never changed.
 */
export const autoEquipDefaultBadges = async (): Promise<void> => {
  try {
    const ids = await prisma.user.findMany({
      where: { isApproved: true },
      select: { id: true },
    });
    await autoEquipForUsers(ids.map((u) => u.id));
    console.log('[badges] Auto-equip completed');
  } catch (error) {
    console.error('autoEquipDefaultBadges error:', error);
  }
};

// ─── Scheduled runner ─────────────────────────────────────────────────────────

let _autoBadgeTimer: ReturnType<typeof setInterval> | null = null;

const runFullBadgeCycle = async () => {
  await checkAndUpdateAutoBadges();
  await autoEquipDefaultBadges();
};

/** Start periodic auto-badge checks + auto-equip every 5 minutes. */
export const startAutoBadgeScheduler = (): void => {
  if (_autoBadgeTimer) return;
  void runFullBadgeCycle(); // run once immediately
  _autoBadgeTimer = setInterval(() => {
    void runFullBadgeCycle();
  }, 5 * 60_000);
};

export const stopAutoBadgeScheduler = (): void => {
  if (_autoBadgeTimer) {
    clearInterval(_autoBadgeTimer);
    _autoBadgeTimer = null;
  }
};
