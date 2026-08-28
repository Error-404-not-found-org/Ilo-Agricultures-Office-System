export const WEB_ROLES = Object.freeze({
  ADMIN: "admin",
  TECHNICIAN: "technician",
  UNKNOWN: "unknown",
});

export function normalizeWebRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === WEB_ROLES.ADMIN) return WEB_ROLES.ADMIN;
  if (normalized === WEB_ROLES.TECHNICIAN) return WEB_ROLES.TECHNICIAN;
  return WEB_ROLES.UNKNOWN;
}

export function getRequestActionPolicy(role) {
  const normalizedRole = normalizeWebRole(role);
  const isAdmin = normalizedRole === WEB_ROLES.ADMIN;
  const isTechnician = normalizedRole === WEB_ROLES.TECHNICIAN;

  return Object.freeze({
    role: normalizedRole,
    isAdmin,
    isTechnician,
    canClaim: isTechnician,
    canSchedule: isTechnician,
    canStart: isTechnician,
    canComplete: isTechnician,
    canCancelOwnRequest: isTechnician,
    canReassign: isAdmin,
    canReviewCancellation: isAdmin,
    readOnlyClinical: isAdmin || !isTechnician,
  });
}
