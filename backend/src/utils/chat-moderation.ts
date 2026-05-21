import type { PrismaClient } from '@prisma/client';

export type ChatModerationNotice = {
  type: 'warning' | 'mute' | 'ban';
  title: string;
  message: string;
  reason: string;
  strikeCount: number;
  strikesBeforeAction: number;
  durationLabel: string | null;
  mutedUntil: string | null;
  bannedUntil: string | null;
};

type MutableWordRule = {
  label: string;
  pattern: RegExp;
};

type ModerationUser = {
  id: string;
  chatModerationStrikes: number;
  chatModerationLevel: number;
};

const STRIKES_BEFORE_ACTION = 3;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const AUTO_MOD_REASON = 'Insulte haineuse grave dans le chat';

// Add/edit mutable words here. Keep labels display-safe; patterns can handle spacing and leetspeak.
export const MUTABLE_WORD_RULES: MutableWordRule[] = [
  { label: 'n-word anglais', pattern: /(?<![a-z0-9])n[\W_]*[i1!|][\W_]*g[\W_]*g[\W_]*(?:e[\W_]*r|a)(?![a-z0-9])/giu },
  { label: 'n-word francais', pattern: /(?<![a-z0-9])n[\W_]*[e3][\W_]*g[\W_]*r[\W_]*(?:e|o)(?![a-z0-9])/giu },
  { label: 'n-word francais pluriel', pattern: /(?<![a-z0-9])n[\W_]*[e3][\W_]*g[\W_]*r[\W_]*[e3]s(?![a-z0-9])/giu },
  { label: 'sp*c', pattern: /(?<![a-z0-9])s[\W_]*p[\W_]*[i1!|][\W_]*c(?![a-z0-9])/giu },
  { label: 'ch*nk', pattern: /(?<![a-z0-9])c[\W_]*h[\W_]*[i1!|][\W_]*n[\W_]*k(?![a-z0-9])/giu },
  { label: 'k*ke', pattern: /(?<![a-z0-9])k[\W_]*[i1!|][\W_]*k[\W_]*[e3](?![a-z0-9])/giu },
  { label: 'bougnoule', pattern: /(?<![a-z0-9])b[\W_]*[o0][\W_]*u[\W_]*g[\W_]*n[\W_]*[o0][\W_]*u[\W_]*l[\W_]*(?:e|s)?(?![a-z0-9])/giu },
  { label: 'youpin', pattern: /(?<![a-z0-9])y[\W_]*[o0][\W_]*u[\W_]*p[\W_]*(?:[i1!|]|[i1!|]n|[i1!|]ns)?(?![a-z0-9])/giu },
];

export const MUTABLE_INSULT_LABELS = MUTABLE_WORD_RULES.map((rule) => rule.label);

const replaceInsensitive = (message: string, pattern: RegExp) =>
  message.replace(pattern, (match) => '*'.repeat(match.length));

const formatDurationLabel = (until: Date | null, now = new Date()) => {
  if (!until) return null;
  const remainingMs = until.getTime() - now.getTime();
  if (remainingMs <= 0) return 'moins d une minute';
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

export const moderateChatMessage = (message: string) => {
  let censoredMessage = message;
  let matched = false;
  const matchedTerms = new Set<string>();

  for (const { pattern } of MUTABLE_WORD_RULES) {
    pattern.lastIndex = 0;
    const matches = [...censoredMessage.matchAll(pattern)].map((match) => match[0]);
    if (matches.length > 0) {
      matched = true;
      matches.forEach((match) => matchedTerms.add(match));
      pattern.lastIndex = 0;
      censoredMessage = replaceInsensitive(censoredMessage, pattern);
    }
  }

  return { censoredMessage, matched, matchedTerms: Array.from(matchedTerms) };
};

export const buildMuteNotice = (mutedUntil: Date | null, reason = AUTO_MOD_REASON): ChatModerationNotice => {
  const durationLabel = formatDurationLabel(mutedUntil);
  return {
    type: 'mute',
    title: 'Chat temporairement bloque',
    message: durationLabel
      ? `Tu es mute du chat pendant ${durationLabel}.`
      : 'Tu es mute du chat pour le moment.',
    reason,
    strikeCount: STRIKES_BEFORE_ACTION,
    strikesBeforeAction: STRIKES_BEFORE_ACTION,
    durationLabel,
    mutedUntil: mutedUntil ? mutedUntil.toISOString() : null,
    bannedUntil: null,
  };
};

export const buildWarningNotice = (strikeCount: number): ChatModerationNotice => ({
  type: 'warning',
  title: 'Message modere',
  message:
    strikeCount >= STRIKES_BEFORE_ACTION
      ? 'Ton message a ete censure et une sanction a ete appliquee.'
      : `Ton message a ete censure. A ${STRIKES_BEFORE_ACTION} messages comme ca, une sanction automatique tombe.`,
  reason: AUTO_MOD_REASON,
  strikeCount,
  strikesBeforeAction: STRIKES_BEFORE_ACTION,
  durationLabel: null,
  mutedUntil: null,
  bannedUntil: null,
});

export const clearExpiredChatMute = async (
  prisma: PrismaClient,
  userId: string,
  now = new Date()
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isChatMuted: true, chatMuteExpiresAt: true },
  });

  if (user?.isChatMuted && user.chatMuteExpiresAt && user.chatMuteExpiresAt <= now) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isChatMuted: false,
        chatMuteExpiresAt: null,
        chatMuteReason: null,
        chatMutedAt: null,
        chatMutedById: null,
      },
    });
    return true;
  }

  return false;
};

const findAutomodIssuerId = async (prisma: PrismaClient, fallbackUserId: string) => {
  const admin = await prisma.user.findFirst({
    where: { OR: [{ isSuperAdmin: true }, { isAdmin: true }] },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return admin?.id ?? fallbackUserId;
};

export const applyChatModerationStrike = async (
  prisma: PrismaClient,
  user: ModerationUser,
  now = new Date()
): Promise<ChatModerationNotice> => {
  const nextStrikeCount = user.chatModerationStrikes + 1;
  if (nextStrikeCount < STRIKES_BEFORE_ACTION) {
    await prisma.user.update({
      where: { id: user.id },
      data: { chatModerationStrikes: nextStrikeCount },
    });
    return buildWarningNotice(nextStrikeCount);
  }

  const nextLevel = user.chatModerationLevel + 1;
  if (nextLevel <= 2) {
    const mutedUntil = new Date(now.getTime() + (nextLevel === 1 ? ONE_HOUR_MS : ONE_DAY_MS));
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isChatMuted: true,
        chatMuteExpiresAt: mutedUntil,
        chatMuteReason: AUTO_MOD_REASON,
        chatMutedAt: now,
        chatMutedById: null,
        chatModerationStrikes: 0,
        chatModerationLevel: nextLevel,
      },
    });
    return buildMuteNotice(mutedUntil);
  }

  const bannedUntil = new Date(now.getTime() + ONE_DAY_MS);
  const bannedBy = await findAutomodIssuerId(prisma, user.id);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        chatModerationStrikes: 0,
        chatModerationLevel: nextLevel,
      },
    }),
    prisma.ban.create({
      data: {
        userId: user.id,
        bannedBy,
        reason: AUTO_MOD_REASON,
        type: 'TEMPORARY',
        expiresAt: bannedUntil,
      },
    }),
  ]);

  return {
    type: 'ban',
    title: 'Ban temporaire',
    message: 'Ton compte est banni pendant 24h du site.',
    reason: AUTO_MOD_REASON,
    strikeCount: STRIKES_BEFORE_ACTION,
    strikesBeforeAction: STRIKES_BEFORE_ACTION,
    durationLabel: '24 h',
    mutedUntil: null,
    bannedUntil: bannedUntil.toISOString(),
  };
};
