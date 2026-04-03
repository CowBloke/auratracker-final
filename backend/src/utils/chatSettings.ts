import { prisma } from '../server.js';

export const CHAT_BLOCK_ENABLED_KEY = 'chat_block_enabled';
export const CHAT_BLOCK_MESSAGE_KEY = 'chat_block_message';
export const CHAT_AUTO_BLOCK_ENABLED_KEY = 'chat_auto_block_enabled';
export const CHAT_AUTO_BLOCK_START_KEY = 'chat_auto_block_start';
export const CHAT_AUTO_BLOCK_END_KEY = 'chat_auto_block_end';
export const CHAT_BLOCK_TIMEZONE = 'Europe/Paris';

const DEFAULT_CHAT_BLOCK_MESSAGE = 'Le chat est temporairement bloque par l administration.';
const TIME_VALUE_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseBooleanSetting = (value?: string | null, fallback = false) => {
  if (value == null) return fallback;
  return value === 'true';
};

const normalizeTimeValue = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return TIME_VALUE_REGEX.test(trimmed) ? trimmed : null;
};

const getMinutesFromTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const getCurrentMinutesInTimezone = (timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });

  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
};

const isCurrentTimeInWindow = (start: string, end: string, timeZone: string) => {
  const startMinutes = getMinutesFromTime(start);
  const endMinutes = getMinutesFromTime(end);
  const currentMinutes = getCurrentMinutesInTimezone(timeZone);

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

export interface ChatBlockState {
  manualBlockEnabled: boolean;
  blockMessage: string;
  autoBlockEnabled: boolean;
  autoBlockStart: string | null;
  autoBlockEnd: string | null;
  autoBlockActive: boolean;
  blocked: boolean;
  activeReason: 'manual' | 'schedule' | null;
  timezone: string;
}

export const isValidChatBlockTimeValue = (value: string) => TIME_VALUE_REGEX.test(value);

export const getDefaultChatBlockMessage = () => DEFAULT_CHAT_BLOCK_MESSAGE;

export const getChatBlockState = async (): Promise<ChatBlockState> => {
  const settings = await prisma.gameSettings.findMany({
    where: {
      key: {
        in: [
          CHAT_BLOCK_ENABLED_KEY,
          CHAT_BLOCK_MESSAGE_KEY,
          CHAT_AUTO_BLOCK_ENABLED_KEY,
          CHAT_AUTO_BLOCK_START_KEY,
          CHAT_AUTO_BLOCK_END_KEY,
        ],
      },
    },
  });

  const map = new Map(settings.map((setting) => [setting.key, setting.value]));

  const manualBlockEnabled = parseBooleanSetting(map.get(CHAT_BLOCK_ENABLED_KEY));
  const autoBlockEnabled = parseBooleanSetting(map.get(CHAT_AUTO_BLOCK_ENABLED_KEY));
  const autoBlockStart = normalizeTimeValue(map.get(CHAT_AUTO_BLOCK_START_KEY));
  const autoBlockEnd = normalizeTimeValue(map.get(CHAT_AUTO_BLOCK_END_KEY));
  const blockMessage = (map.get(CHAT_BLOCK_MESSAGE_KEY)?.trim() || DEFAULT_CHAT_BLOCK_MESSAGE);
  const autoBlockActive = Boolean(
    autoBlockEnabled &&
    autoBlockStart &&
    autoBlockEnd &&
    isCurrentTimeInWindow(autoBlockStart, autoBlockEnd, CHAT_BLOCK_TIMEZONE)
  );
  const blocked = manualBlockEnabled || autoBlockActive;

  return {
    manualBlockEnabled,
    blockMessage,
    autoBlockEnabled,
    autoBlockStart,
    autoBlockEnd,
    autoBlockActive,
    blocked,
    activeReason: manualBlockEnabled ? 'manual' : autoBlockActive ? 'schedule' : null,
    timezone: CHAT_BLOCK_TIMEZONE,
  };
};
