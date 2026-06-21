export type UserRole = 'admin' | 'analyst' | 'operator';

export const ROLE_CATEGORY_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['acquisition', 'engagement', 'revenue', 'retention'],
  analyst: ['acquisition', 'engagement', 'retention'],
  operator: ['acquisition', 'engagement'],
};

export const ALL_CATEGORIES = ['acquisition', 'engagement', 'revenue', 'retention'];

export function getAllowedCategories(role: string): string[] {
  const allowed = ROLE_CATEGORY_PERMISSIONS[role as UserRole];
  return allowed ?? ROLE_CATEGORY_PERMISSIONS.operator;
}

export function isCategoryAllowed(role: string, category: string): boolean {
  return getAllowedCategories(role).includes(category);
}
