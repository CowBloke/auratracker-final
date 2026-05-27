import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import {
  ensurePixelBoardSettings,
  getPixelBoardSnapshot,
  getUserPixelClanId,
  isAllowedPixelColor,
  isValidCoordinate,
  normalizePixelColor,
  PIXEL_BOARD_ROOM,
  serializePixelBoardSettings,
} from '../pixel-board/core.js';

const emitError = (socket: Socket, message: string) => {
  socket.emit('pixel-board:error', { message });
};

export const setupPixelBoardHandlers = (socket: Socket, io: Server) => {
  socket.on('pixel-board:join', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    socket.join(PIXEL_BOARD_ROOM);
    socket.emit('pixel-board:state', await getPixelBoardSnapshot(prisma, userId));
  });

  socket.on('pixel-board:place', async (data: { x?: number; y?: number; color?: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const x = Number(data?.x);
    const y = Number(data?.y);
    const rawColor = data?.color;
    if (!isValidCoordinate(x) || !isValidCoordinate(y) || !isAllowedPixelColor(rawColor)) {
      return emitError(socket, 'Pixel invalide.');
    }

    const settings = await ensurePixelBoardSettings(prisma);
    const now = new Date();
    if (settings.isLocked) {
      const admin = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true, isSuperAdmin: true },
      });
      if (!admin?.isAdmin && !admin?.isSuperAdmin) return emitError(socket, settings.lockedMessage);
    }
    if (settings.isPaused) return emitError(socket, 'Event en pause.');
    if (settings.isEnded || (settings.endsAt && settings.endsAt <= now)) {
      return emitError(socket, 'Event termine.');
    }

    const lastEvent = await prisma.pixelBoardEvent.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    const nextPlaceAt = lastEvent
      ? new Date(lastEvent.timestamp.getTime() + settings.cooldownSeconds * 1000)
      : null;
    if (nextPlaceAt && nextPlaceAt > now) {
      socket.emit('pixel-board:cooldown', {
        nextPlaceAt: nextPlaceAt.toISOString(),
        cooldownRemainingMs: nextPlaceAt.getTime() - now.getTime(),
      });
      return;
    }

    const color = normalizePixelColor(rawColor);
    const clanId = await getUserPixelClanId(prisma, userId);
    const event = await prisma.$transaction(async (tx) => {
      await tx.pixelBoardPixel.upsert({
        where: { x_y: { x, y } },
        create: { x, y, color, userId, clanId, updatedAt: now },
        update: { color, userId, clanId, updatedAt: now },
      });
      return tx.pixelBoardEvent.create({
        data: { x, y, color, userId, clanId, timestamp: now },
      });
    });

    const next = new Date(now.getTime() + settings.cooldownSeconds * 1000);
    io.to(PIXEL_BOARD_ROOM).emit('pixel-board:pixel', {
      x,
      y,
      color,
      userId,
      clanId,
      timestamp: event.timestamp.toISOString(),
    });
    socket.emit('pixel-board:cooldown', {
      nextPlaceAt: next.toISOString(),
      cooldownRemainingMs: settings.cooldownSeconds * 1000,
    });
  });

  socket.on('pixel-board:admin-settings', async (data: { cooldownSeconds?: number; durationSeconds?: number; isPaused?: boolean; isLocked?: boolean; lockedMessage?: string; forceEnd?: boolean }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isSuperAdmin: true },
    });
    if (!admin?.isAdmin && !admin?.isSuperAdmin) {
      return emitError(socket, 'Admin requis.');
    }

    const current = await ensurePixelBoardSettings(prisma);
    const update: {
      cooldownSeconds?: number;
      durationSeconds?: number;
      endsAt?: Date | null;
      isPaused?: boolean;
      isEnded?: boolean;
      isLocked?: boolean;
      lockedMessage?: string;
    } = {};

    if (data.cooldownSeconds !== undefined) {
      const cooldown = Number(data.cooldownSeconds);
      if (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 3600) return emitError(socket, 'Cooldown invalide.');
      update.cooldownSeconds = cooldown;
    }
    if (data.durationSeconds !== undefined) {
      const duration = Number(data.durationSeconds);
      if (!Number.isInteger(duration) || duration < 60 || duration > 31 * 24 * 60 * 60) return emitError(socket, 'Duree invalide.');
      update.durationSeconds = duration;
      update.endsAt = new Date(current.startsAt.getTime() + duration * 1000);
    }
    if (data.isPaused !== undefined) update.isPaused = Boolean(data.isPaused);
    if (data.isLocked !== undefined) update.isLocked = Boolean(data.isLocked);
    if (data.lockedMessage !== undefined) {
      const message = String(data.lockedMessage).trim();
      if (message.length < 3 || message.length > 240) return emitError(socket, 'Message de blocage invalide.');
      update.lockedMessage = message;
    }
    if (data.forceEnd === true) {
      update.isEnded = true;
      update.endsAt = new Date();
    }

    const settings = await prisma.pixelBoardSettings.update({ where: { id: current.id }, data: update });
    io.to(PIXEL_BOARD_ROOM).emit('pixel-board:settings', serializePixelBoardSettings(settings));
  });

  socket.on('pixel-board:admin-reset', async () => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isSuperAdmin: true },
    });
    if (!admin?.isAdmin && !admin?.isSuperAdmin) return emitError(socket, 'Admin requis.');
    await prisma.pixelBoardPixel.deleteMany();
    io.to(PIXEL_BOARD_ROOM).emit('pixel-board:reset');
  });
};
