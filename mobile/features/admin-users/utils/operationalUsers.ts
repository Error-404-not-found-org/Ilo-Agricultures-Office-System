import type {
  OperationalUserRole,
  UserItem,
} from "../types/adminUsers.types";

export const OPERATIONAL_USER_ROLES: readonly OperationalUserRole[] = [
  "farmer",
  "technician",
];

export const isOperationalUserRole = (
  role: unknown,
): role is OperationalUserRole =>
  role === "farmer" || role === "technician";

export const isOperationalUser = (
  user: UserItem | null | undefined,
): user is UserItem & { role: OperationalUserRole } =>
  Boolean(user && isOperationalUserRole(user.role));

export const filterOperationalUsers = (users: unknown): UserItem[] =>
  Array.isArray(users) ? users.filter(isOperationalUser) : [];
