import { ROLE_RANK, type UserRole } from '@storm-tips/types';

/** True when `role` is at least as privileged as `required`. */
export function hasRole(role: UserRole, required: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export const isStaff = (role: UserRole): boolean => hasRole(role, 'MODERATOR');
export const isAdmin = (role: UserRole): boolean => hasRole(role, 'ADMIN');
export const isSuperAdmin = (role: UserRole): boolean => role === 'SUPER_ADMIN';

/**
 * Capability matrix for the admin console. Keeping it declarative means the API
 * and the admin UI agree on what a moderator may do without duplicating rules.
 */
export const CAPABILITIES = {
  'tips:read': 'MODERATOR',
  'tips:write': 'MODERATOR',
  'tips:publish': 'MODERATOR',
  'tips:settle': 'ADMIN',
  'tips:delete': 'ADMIN',
  'combos:write': 'MODERATOR',
  'catalogue:write': 'ADMIN',
  'users:read': 'MODERATOR',
  'users:write': 'ADMIN',
  'users:ban': 'ADMIN',
  'users:role': 'SUPER_ADMIN',
  'entitlements:grant': 'ADMIN',
  'plans:write': 'ADMIN',
  'coupons:write': 'ADMIN',
  'promotions:write': 'ADMIN',
  'payments:read': 'ADMIN',
  'payments:refund': 'SUPER_ADMIN',
  'polls:write': 'MODERATOR',
  'notifications:send': 'ADMIN',
  'providers:write': 'SUPER_ADMIN',
  'settings:write': 'SUPER_ADMIN',
  'logs:read': 'ADMIN',
  'statistics:read': 'MODERATOR',
} as const satisfies Record<string, UserRole>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: UserRole, capability: Capability): boolean {
  return hasRole(role, CAPABILITIES[capability]);
}
