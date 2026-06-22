import type { PrismaClient } from '@prisma/client';

export const PIXEL_BOARD_SIZE = 100;
export const PIXEL_BOARD_ROOM = 'pixel-board';
export const PIXEL_BOARD_COLORS = [
  '#6D001A',
  '#BE0039',
  '#FF4500',
  '#FFA800',
  '#FFD635',
  '#FFF8B8',
  '#00A368',
  '#00CC78',
  '#7EED56',
  '#00756F',
  '#009EAA',
  '#00CCC0',
  '#2450A4',
  '#3690EA',
  '#51E9F4',
  '#493AC1',
  '#6A5CFF',
  '#94B3FF',
  '#811E9F',
  '#B44AC0',
  '#E4ABFF',
  '#DE107F',
  '#FF3881',
  '#FF99AA',
  '#6D482F',
  '#9C6926',
  '#FFB470',
  '#000000',
  '#515252',
  '#898D90',
  '#D4D7D9',
  '#FFFFFF',
] as const;

const SETTINGS_ID = 'default';
const DEFAULT_DURATION_SECONDS = 7 * 24 * 60 * 60;

export const isAllowedPixelColor = (color: unknown): color is string =>
  typeof color === 'string' && PIXEL_BOARD_COLORS.includes(color.toUpperCase() as typeof PIXEL_BOARD_COLORS[number]);

export const normalizePixelColor = (color: string) => color.toUpperCase();

export const isValidCoordinate = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) < PIXEL_BOARD_SIZE;

export const ensurePixelBoardSettings = async (prisma: PrismaClient) => {
  const existing = await prisma.pixelBoardSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  const startsAt = new Date();
  return prisma.pixelBoardSettings.create({
    data: {
      id: SETTINGS_ID,
      cooldownSeconds: 30,
      durationSeconds: DEFAULT_DURATION_SECONDS,
      startsAt,
      endsAt: new Date(startsAt.getTime() + DEFAULT_DURATION_SECONDS * 1000),
      isLocked: true,
      lockedMessage: "Le Pixel Board n'est pas encore ouvert.",
    },
  });
};

export const getUserPixelClanId = async (prisma: PrismaClient, userId: string) => {
  const membership = await prisma.clanMember.findUnique({
    where: { userId },
    select: { clanId: true },
  });
  return membership?.clanId ?? null;
};

export const serializePixelBoardSettings = (settings: Awaited<ReturnType<typeof ensurePixelBoardSettings>>) => ({
  cooldownSeconds: settings.cooldownSeconds,
  durationSeconds: settings.durationSeconds,
  startsAt: settings.startsAt.toISOString(),
  endsAt: settings.endsAt ? settings.endsAt.toISOString() : null,
  isPaused: settings.isPaused,
  isEnded: settings.isEnded,
  isLocked: settings.isLocked,
  lockedMessage: settings.lockedMessage,
});

export const getPixelBoardSnapshot = async (prisma: PrismaClient, userId?: string) => {
  const [settings, pixels, leaderboardRows, userLastEvent] = await Promise.all([
    ensurePixelBoardSettings(prisma),
    prisma.pixelBoardPixel.findMany(),
    prisma.pixelBoardEvent.groupBy({
      by: ['userId'],
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
    userId
      ? prisma.pixelBoardEvent.findFirst({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        })
      : Promise.resolve(null),
  ]);

  const users = leaderboardRows.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: leaderboardRows.map((row) => row.userId) } },
        select: { id: true, username: true, usernameColor: true },
      })
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const now = Date.now();
  const nextPlaceAt = userLastEvent
    ? new Date(userLastEvent.timestamp.getTime() + settings.cooldownSeconds * 1000).toISOString()
    : null;

  return {
    size: PIXEL_BOARD_SIZE,
    colors: PIXEL_BOARD_COLORS,
    settings: serializePixelBoardSettings(settings),
    pixels: pixels.map((pixel) => ({
      x: pixel.x,
      y: pixel.y,
      color: pixel.color,
      userId: pixel.userId,
      clanId: pixel.clanId,
      updatedAt: pixel.updatedAt.toISOString(),
    })),
    leaderboard: leaderboardRows.map((row) => {
      const user = userById.get(row.userId);
      return {
        userId: row.userId,
        username: user?.username ?? 'Utilisateur',
        usernameColor: user?.usernameColor ?? null,
        actions: row._count._all,
      };
    }),
    me: {
      nextPlaceAt,
      cooldownRemainingMs: nextPlaceAt ? Math.max(0, new Date(nextPlaceAt).getTime() - now) : 0,
    },
  };
};

export const computePixelBoardAnalysis = async (prisma: PrismaClient) => {
  const events = await prisma.pixelBoardEvent.findMany({ orderBy: { timestamp: 'asc' } });
  const finalPixels = await prisma.pixelBoardPixel.findMany();

  const actionsByClan = new Map<string, number>();
  const actionsByUser = new Map<string, number>();
  const heatmap = Array.from({ length: PIXEL_BOARD_SIZE }, () => Array(PIXEL_BOARD_SIZE).fill(0) as number[]);

  for (const event of events) {
    const clanKey = event.clanId ?? 'no-clan';
    actionsByClan.set(clanKey, (actionsByClan.get(clanKey) ?? 0) + 1);
    actionsByUser.set(event.userId, (actionsByUser.get(event.userId) ?? 0) + 1);
    if (event.y >= 0 && event.y < PIXEL_BOARD_SIZE && event.x >= 0 && event.x < PIXEL_BOARD_SIZE) {
      heatmap[event.y][event.x] += 1;
    }
  }

  const ownedByClan = new Map<string, number>();
  const effectiveByUser = new Map<string, number>();
  for (const pixel of finalPixels) {
    const clanKey = pixel.clanId ?? 'no-clan';
    ownedByClan.set(clanKey, (ownedByClan.get(clanKey) ?? 0) + 1);
    effectiveByUser.set(pixel.userId, (effectiveByUser.get(pixel.userId) ?? 0) + 1);
  }

  const totalOwned = finalPixels.length || 1;
  const totalActions = events.length || 1;
  const clanIds = new Set([...ownedByClan.keys(), ...actionsByClan.keys()]);
  const clanScores = Array.from(clanIds).map((clanId) => {
    const pixelsOwned = ownedByClan.get(clanId) ?? 0;
    const actions = actionsByClan.get(clanId) ?? 0;
    const ownershipShare = pixelsOwned / totalOwned;
    const activityShare = actions / totalActions;
    return {
      clanId,
      pixelsOwned,
      actions,
      ownershipShare,
      activityShare,
      score: 0.7 * ownershipShare + 0.3 * activityShare,
    };
  }).sort((a, b) => b.score - a.score);

  const userIds = new Set([...actionsByUser.keys(), ...effectiveByUser.keys()]);
  const users = userIds.size > 0
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, username: true },
      })
    : [];
  const userById = new Map(users.map((user) => [user.id, user.username]));
  const soloLeaderboard = Array.from(userIds).map((userId) => ({
    userId,
    username: userById.get(userId) ?? 'Utilisateur',
    actions: actionsByUser.get(userId) ?? 0,
    effectivePixels: effectiveByUser.get(userId) ?? 0,
  })).sort((a, b) => b.actions - a.actions || b.effectivePixels - a.effectivePixels);

  return {
    generatedAt: new Date().toISOString(),
    size: PIXEL_BOARD_SIZE,
    eventCount: events.length,
    clanScores,
    soloLeaderboard,
    heatmap,
    timelapse: events.map((event) => ({
      x: event.x,
      y: event.y,
      color: event.color,
      userId: event.userId,
      clanId: event.clanId,
      timestamp: event.timestamp.toISOString(),
    })),
  };
};
