export const USER = 0;
export const ADMIN = 1;
export const OWNER = 2;

export function normalizeRole(profile) {
  if (!profile || typeof profile !== "object") return USER;
  const value = Object.hasOwn(profile, "userState") ? profile.userState : profile.userStatus;
  return value === ADMIN || value === OWNER ? value : USER;
}
