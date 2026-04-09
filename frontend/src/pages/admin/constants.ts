export const ANNOUNCEMENT_MAX_LENGTH = 120;
export const CHAT_BLOCK_MESSAGE_MAX_LENGTH = 240;
export const YOU_LOGO_ADMIN_ONLY_SETTING_KEY = 'you_logo_admin_only';
export const ADMIN_ARCHIVED_REGISTRATIONS_STORAGE_KEY = 'admin_archived_registrations';
export const CHAT_BLOCK_TIMEZONE = 'Europe/Paris';

export const isValidChatTimeValue = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

export const ROLE_LABELS = {
  USER: 'membre',
  BETA_TESTER: 'beta tester',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super admin',
  FISCAL_INSPECTOR: 'inspecteur du fisc',
} as const;

export type AdminRole = keyof typeof ROLE_LABELS;

export type AdminTab =
  | 'inbox'
  | 'users'
  | 'clubs'
  | 'logs'
  | 'bans'
  | 'content'
  | 'ads'
  | 'taxes'
  | 'settings'
  | 'referrals'
  | 'activity'
  | 'demographics'
  | 'badges'
  | 'communication';

export const ADMIN_TABS: AdminTab[] = [
  'inbox',
  'users',
  'clubs',
  'logs',
  'bans',
  'content',
  'ads',
  'taxes',
  'settings',
  'referrals',
  'activity',
  'demographics',
  'badges',
  'communication',
];
