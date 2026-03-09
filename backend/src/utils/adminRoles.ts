export type AdminRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export const normalizeAdminRole = (adminRole: string | null | undefined): AdminRole =>
  adminRole === 'ADMIN' || adminRole === 'SUPER_ADMIN' ? adminRole : 'USER';

export const isAdminRole = (adminRole: string | null | undefined): boolean =>
  normalizeAdminRole(adminRole) !== 'USER';

export const isSuperAdminRole = (adminRole: string | null | undefined): boolean =>
  normalizeAdminRole(adminRole) === 'SUPER_ADMIN';
