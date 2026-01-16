import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';

type RaceStatus = 'countdown' | 'running' | 'finished';

interface KartInput {
  throttle: number; // -1 (reverse/brake) to 1 (accelerate)
  steer: number;    // -1 (left) to 1 (right)
  drift?: boolean;
  brake?: boolean;
}

interface TrackCheckpoint {
  x: number;
  y: number;
  radius: number;
}

interface TrackPad {
  x: number;
  y: number;
  width: number;
  height: number;
  boost: number;
}

interface TrackConfig {
  width: number;
  height: number;
  checkpoints: TrackCheckpoint[];
  startPositions: { x: number; y: number }[];
  startAngle: number;
  pads: TrackPad[];
  lapCount: number;
}

interface KartPlayer {
  userId: string;
  username: string;
  usernameColor?: string | null;
  color: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lap: number;
  checkpointIndex: number;
  finished: boolean;
  finishTime?: number;
  lastUpdate: number;
  input: KartInput;
  boostUntil?: number;
}

interface MarioKartRace {
  partyId: string;
  status: RaceStatus;
  track: TrackConfig;
  countdownEndsAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  lapCount: number;
  players: KartPlayer[];
  finishOrder: string[];
  tickTimer: NodeJS.Timeout | null;
  broadcastTimer: NodeJS.Timeout | null;
  lastTick: number;
}

const PLAYER_COLORS = [
  '#f97316',
  '#22d3ee',
  '#a855f7',
  '#facc15',
  '#34d399',
  '#60a5fa',
  '#fb7185',
  '#f59e0b',
];

const TRACK: TrackConfig = {
  width: 1600,
  height: 900,
  lapCount: 3,
  checkpoints: [
    { x: 250, y: 450, radius: 90 },   // start/finish
    { x: 250, y: 170, radius: 80 },
    { x: 800, y: 130, radius: 80 },
    { x: 1375, y: 170, radius: 80 },
    { x: 1375, y: 450, radius: 90 },
    { x: 1375, y: 730, radius: 80 },
    { x: 800, y: 770, radius: 80 },
    { x: 250, y: 730, radius: 80 },
  ],
  startPositions: [
    { x: 220, y: 430 },
    { x: 220, y: 470 },
    { x: 220, y: 510 },
    { x: 220, y: 550 },
    { x: 180, y: 430 },
    { x: 180, y: 470 },
    { x: 180, y: 510 },
    { x: 180, y: 550 },
  ],
  startAngle: 0,
  pads: [
    { x: 520, y: 160, width: 160, height: 26, boost: 350 },
    { x: 520, y: 720, width: 160, height: 26, boost: 350 },
    { x: 1100, y: 160, width: 160, height: 26, boost: 350 },
    { x: 1100, y: 720, width: 160, height: 26, boost: 350 },
  ],
};

const COUNTDOWN_MS = 3500;
const TICK_RATE = 30; // 30 fps physics
const BROADCAST_RATE = 10; // network updates per second
const MAX_SPEED = 900;
const REVERSE_SPEED = 200;
const ACCELERATION = 750;
const BRAKE_FORCE = 900;
const FRICTION = 0.92;
const TURN_RATE = Math.PI * 0.8; // radians per second at full steer
const BOOST_DURATION = 900;
const BOOST_BONUS = 1.25;
const RACE_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes

const activeRaces = new Map<string, MarioKartRace>();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function serializeRace(race: MarioKartRace, includeTrack = false) {
  return {
    partyId: race.partyId,
    status: race.status,
    lapCount: race.lapCount,
    countdownEndsAt: race.countdownEndsAt,
    startedAt: race.startedAt,
    finishedAt: race.finishedAt,
    track: includeTrack ? race.track : undefined,
    players: race.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      color: p.color,
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      angle: p.angle,
      speed: p.speed,
      lap: p.lap,
      checkpointIndex: p.checkpointIndex,
      finished: p.finished,
      finishTime: p.finishTime,
    })),
  };
}

function finishRace(race: MarioKartRace, io: Server, reason: 'completed' | 'timeout' = 'completed') {
  if (race.status === 'finished') return;

  race.status = 'finished';
  race.finishedAt = Date.now();

  if (race.tickTimer) clearInterval(race.tickTimer);
  if (race.broadcastTimer) clearInterval(race.broadcastTimer);

  // Order players: finished first by time, then progress
  const standings = [...race.players].sort((a, b) => {
    if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
    if (a.finishTime) return -1;
    if (b.finishTime) return 1;
    // Fallback: more laps/checkpoints first
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.checkpointIndex !== b.checkpointIndex) return b.checkpointIndex - a.checkpointIndex;
    return b.speed - a.speed;
  });

  io.to(`party:${race.partyId}`).emit('mariokart:finished', {
    partyId: race.partyId,
    reason,
    standings: standings.map((p, index) => ({
      userId: p.userId,
      username: p.username,
      usernameColor: p.usernameColor,
      color: p.color,
      rank: p.finishTime ? index + 1 : null,
      finishMs: p.finishTime ? Math.max(0, Math.round(p.finishTime - (race.startedAt || p.lastUpdate))) : null,
      lap: p.lap,
      checkpoints: p.checkpointIndex,
      finished: p.finished,
    })),
  });

  // Cleanup after a delay to allow clients to show results
  setTimeout(() => {
    activeRaces.delete(race.partyId);
  }, 15_000);
}

function applyPhysics(race: MarioKartRace) {
  const now = Date.now();
  const delta = clamp((now - race.lastTick) / 1000, 0, 0.1); // prevent giant jumps
  race.lastTick = now;

  if (race.status === 'countdown') {
    if (now >= race.countdownEndsAt) {
      race.status = 'running';
      race.startedAt = now;
    } else {
      return;
    }
  }

  if (race.status !== 'running' || !race.startedAt) return;

  const { track } = race;

  for (const player of race.players) {
    if (player.finished) continue;

    const throttle = clamp(player.input.throttle ?? 0, -1, 1);
    const steer = clamp(player.input.steer ?? 0, -1, 1);

    // Speed updates
    if (throttle > 0) {
      player.speed += ACCELERATION * throttle * delta;
    } else if (throttle < 0) {
      player.speed += BRAKE_FORCE * throttle * delta; // negative throttle slows down
    } else {
      player.speed *= FRICTION;
    }

    const maxSpeed = (player.boostUntil && player.boostUntil > now) ? MAX_SPEED * BOOST_BONUS : MAX_SPEED;
    player.speed = clamp(player.speed, -REVERSE_SPEED, maxSpeed);

    // Turning based on current speed
    const turnMultiplier = clamp(Math.abs(player.speed) / maxSpeed, 0.35, 1);
    player.angle += steer * TURN_RATE * turnMultiplier * delta;

    // Position update
    player.x += Math.cos(player.angle) * player.speed * delta;
    player.y += Math.sin(player.angle) * player.speed * delta;

    // Keep within bounds
    player.x = clamp(player.x, 40, track.width - 40);
    player.y = clamp(player.y, 40, track.height - 40);

    // Boost pads
    const pad = track.pads.find((p) =>
      player.x >= p.x &&
      player.x <= p.x + p.width &&
      player.y >= p.y &&
      player.y <= p.y + p.height
    );
    if (pad && (!player.boostUntil || player.boostUntil < now)) {
      player.boostUntil = now + BOOST_DURATION;
      player.speed = Math.min(player.speed + pad.boost, maxSpeed * 1.1);
    }

    // Checkpoint progression
    const checkpoint = track.checkpoints[player.checkpointIndex];
    if (distance(player, checkpoint) <= checkpoint.radius) {
      player.checkpointIndex = (player.checkpointIndex + 1) % track.checkpoints.length;

      // Completed a lap
      if (player.checkpointIndex === 0) {
        player.lap += 1;
        if (player.lap >= race.lapCount) {
          player.finished = true;
          player.finishTime = now;
          race.finishOrder.push(player.userId);
        }
      }
    }
  }

  // End the race if everyone is done or time limit reached
  const activePlayers = race.players.filter((p) => !p.finished);
  if (activePlayers.length === 0) {
    finishRace(race, ioRef!);
  } else if (race.startedAt && now - race.startedAt > RACE_TIME_LIMIT) {
    finishRace(race, ioRef!, 'timeout');
  }
}

let ioRef: Server | null = null;

export function setupMarioKartHandlers(socket: Socket, io: Server) {
  ioRef = io;

  // Start a race (party leader only)
  socket.on('mariokart:start', async (data: { userId: string; partyId: string; laps?: number }) => {
    const { userId, partyId, laps } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
      });

      if (!membership || membership.partyId !== partyId) {
        socket.emit('mariokart:error', { message: 'Tu dois etre dans la party pour lancer la course.' });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('mariokart:error', { message: 'Seul le leader peut lancer Mario Kart.' });
        return;
      }

      if (activeRaces.has(partyId)) {
        socket.emit('mariokart:error', { message: 'Une course est deja en cours dans cette party.' });
        return;
      }

      const partyMembers = await prisma.partyMember.findMany({
        where: { partyId },
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: { id: true, username: true, usernameColor: true },
          },
        },
      });

      if (partyMembers.length < 2) {
        socket.emit('mariokart:error', { message: 'Il faut au moins 2 joueurs pour lancer une course.' });
        return;
      }

      const lapCount = clamp(laps || TRACK.lapCount, 1, 9);
      const countdownEndsAt = Date.now() + COUNTDOWN_MS;
      const players: KartPlayer[] = partyMembers.map((member, index) => {
        const start = TRACK.startPositions[index % TRACK.startPositions.length];
        const rowOffset = Math.floor(index / TRACK.startPositions.length) * 34;
        return {
          userId: member.userId,
          username: member.user.username,
          usernameColor: member.user.usernameColor,
          color: PLAYER_COLORS[index % PLAYER_COLORS.length],
          x: start.x,
          y: start.y + rowOffset,
          angle: TRACK.startAngle,
          speed: 0,
          lap: 0,
          checkpointIndex: 0,
          finished: false,
          finishTime: undefined,
          lastUpdate: Date.now(),
          input: { throttle: 0, steer: 0, brake: false, drift: false },
          boostUntil: 0,
        };
      });

      const race: MarioKartRace = {
        partyId,
        status: 'countdown',
        track: { ...TRACK, lapCount },
        countdownEndsAt,
        startedAt: null,
        finishedAt: null,
        lapCount,
        players,
        finishOrder: [],
        tickTimer: null,
        broadcastTimer: null,
        lastTick: Date.now(),
      };

      activeRaces.set(partyId, race);

      // Notify party
      io.to(`party:${partyId}`).emit('mariokart:starting', serializeRace(race, true));

      // Physics + broadcast loops
      race.tickTimer = setInterval(() => applyPhysics(race), 1000 / TICK_RATE);
      race.broadcastTimer = setInterval(() => {
        io.to(`party:${partyId}`).emit('mariokart:state', serializeRace(race));
      }, 1000 / BROADCAST_RATE);
    } catch (error) {
      console.error('Start mariokart error:', error);
      socket.emit('mariokart:error', { message: 'Impossible de lancer la course.' });
    }
  });

  // Player input update
  socket.on('mariokart:input', (data: { partyId: string; userId: string; input: KartInput }) => {
    const { partyId, userId, input } = data;
    const race = activeRaces.get(partyId);
    if (!race) return;

    const player = race.players.find((p) => p.userId === userId);
    if (!player) return;

    player.input = {
      throttle: clamp(input.throttle ?? 0, -1, 1),
      steer: clamp(input.steer ?? 0, -1, 1),
      drift: !!input.drift,
      brake: !!input.brake,
    };
    player.lastUpdate = Date.now();
  });

  // Manual leave (e.g., user leaves page or party)
  socket.on('mariokart:leave', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    const race = activeRaces.get(partyId);
    if (!race) return;

    const player = race.players.find((p) => p.userId === userId);
    if (!player || player.finished) return;

    player.finished = true;
    player.speed = 0;
    player.finishTime = undefined;
    race.finishOrder.push(userId);

    const activePlayers = race.players.filter((p) => !p.finished);
    if (activePlayers.length === 0) {
      finishRace(race, io, 'timeout');
    }
  });

  // Request full state (reconnect)
  socket.on('mariokart:request-state', (data: { partyId: string; userId: string }) => {
    const { partyId, userId } = data;
    sendActiveMarioKartState(socket, partyId, userId);
  });
}

export function sendActiveMarioKartState(socket: Socket, partyId: string, userId: string) {
  const race = activeRaces.get(partyId);
  if (!race) return;

  const isPlayer = race.players.some((p) => p.userId === userId);
  if (!isPlayer) return;

  socket.emit('mariokart:state', serializeRace(race, true));
}
