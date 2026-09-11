import AsyncStorage from "@react-native-async-storage/async-storage";

export const AVAILABILITY_HELPER_STORAGE_KEY_PREFIX = "technician_availability_helper_seen:" as const;

export function getAvailabilityHelperStorageKey(technicianId: string): string {
  return `${AVAILABILITY_HELPER_STORAGE_KEY_PREFIX}${technicianId}`;
}

export const FIRST_TIME_AVAILABILITY_HELPER_COPY = {
  TITLE: "Welcome to BreedSmart 👋",
  BODY_PARAGRAPHS: [
    "Before you get started, your Technician account is currently Off Duty.",
    "Turn on Accepting Requests when you're ready to receive new AI and animal health requests from Farmers in your service area.",
    "New requests will appear in Open Requests, and you can pause them anytime from your Profile.",
  ] as const,
  PRIMARY_BUTTON: "Start Accepting Requests",
  SECONDARY_BUTTON: "Maybe Later",
} as const;

export const RETURNING_AVAILABILITY_HELPER_COPY = {
  TITLE: "Ready to receive requests?",
  BODY_PARAGRAPHS: [
    "You're still Off Duty.",
    "Turn on Accepting Requests whenever you're ready to receive new Farmer requests.",
    "You can pause requests anytime from your Profile.",
  ] as const,
  PRIMARY_BUTTON: "Start Accepting Requests",
  SECONDARY_BUTTON: "Maybe Later",
} as const;

export const AVAILABILITY_HELPER_FEEDBACK_COPY = {
  SUCCESS_TITLE: "You're now accepting requests.",
  SUCCESS_MESSAGE: "New Farmer requests can now appear in Open Requests.",
  ERROR_TITLE: "Couldn't turn on requests.",
  ERROR_MESSAGE: "Please check your connection and try again.",
} as const;

export const AVAILABILITY_HELPER_COPY = {
  ...RETURNING_AVAILABILITY_HELPER_COPY,
  ...AVAILABILITY_HELPER_FEEDBACK_COPY,
} as const;

export function getAvailabilityHelperCopy(params: { hasSeenIntro: boolean }) {
  return params.hasSeenIntro
    ? RETURNING_AVAILABILITY_HELPER_COPY
    : FIRST_TIME_AVAILABILITY_HELPER_COPY;
}

export const DISPATCH_STATUS_ENDPOINT = "/technician/dispatch-status" as const;

export function getEnableRequestsPayload(): { acceptsNewRequests: true } {
  return { acceptsNewRequests: true };
}

/**
 * Storage helpers for persisting the introductory helper seen state per Technician ID.
 * Purely determines first-time vs returning copy/presentation; NEVER determines availability.
 */
export async function hasSeenAvailabilityHelperIntro(
  technicianId: string | null | undefined,
  storage: { getItem: (key: string) => Promise<string | null> } = AsyncStorage,
): Promise<boolean> {
  if (!technicianId) return false;
  try {
    const val = await storage.getItem(getAvailabilityHelperStorageKey(technicianId));
    return val === "true";
  } catch {
    return false;
  }
}

export async function markAvailabilityHelperIntroSeen(
  technicianId: string | null | undefined,
  storage: { setItem: (key: string, value: string) => Promise<void> } = AsyncStorage,
): Promise<void> {
  if (!technicianId) return;
  try {
    await storage.setItem(getAvailabilityHelperStorageKey(technicianId), "true");
  } catch (err) {
    console.warn("[AvailabilityHelper] Failed to mark intro as seen in storage:", err);
  }
}

/**
 * Module-level in-memory Set for the running app session.
 * Does NOT use AsyncStorage, MongoDB, or backend state.
 * Resets naturally when the app process/session restarts.
 */
const sessionDismissedTechnicians = new Set<string>();

export function isAvailabilityHelperDismissedThisSession(technicianId: string | null | undefined): boolean {
  if (!technicianId) return false;
  return sessionDismissedTechnicians.has(technicianId);
}

export function dismissAvailabilityHelperForSession(technicianId: string | null | undefined): void {
  if (!technicianId) return;
  sessionDismissedTechnicians.add(technicianId);
}

export function clearAvailabilityHelperSessionDismissal(technicianId: string | null | undefined): void {
  if (!technicianId) return;
  sessionDismissedTechnicians.delete(technicianId);
}

/**
 * Development-only helper to reset the intro seen state and session dismissal for a technician.
 * Allows testing the first-time "Welcome to BreedSmart" copy repeatedly.
 */
export async function resetAvailabilityHelperIntroForDev(
  technicianId: string | null | undefined,
  storage: { removeItem: (key: string) => Promise<void> } = AsyncStorage,
): Promise<void> {
  if (!technicianId) return;
  try {
    await storage.removeItem(getAvailabilityHelperStorageKey(technicianId));
  } catch (err) {
    console.warn("[AvailabilityHelper] Failed to reset intro flag:", err);
  }
  clearAvailabilityHelperSessionDismissal(technicianId);
}

export function clearSessionAvailabilityStateForTests(): void {
  sessionDismissedTechnicians.clear();
}

export interface UserQualificationInput {
  role?: string | null;
  dispatchProfile?: {
    acceptsNewRequests?: boolean | null;
  } | null;
  phoneNumber?: string | null;
  address?: {
    barangay?: string | null;
  } | null;
}

/**
 * Evaluates whether the availability helper qualifies for a given user.
 * Strictly requires:
 * 1. User is loaded and present.
 * 2. Role is strictly "technician".
 * 3. dispatchProfile.acceptsNewRequests is strictly false.
 */
export function qualifiesForAvailabilityHelper(user: UserQualificationInput | null | undefined): boolean {
  if (!user || typeof user !== "object") {
    return false;
  }
  if (user.role !== "technician") {
    return false;
  }
  return user.dispatchProfile?.acceptsNewRequests === false;
}

/**
 * Determines whether the availability helper should be shown.
 * Requires:
 * 1. Auth is enabled.
 * 2. User qualifies (role === 'technician' && acceptsNewRequests === false).
 * 3. Has not been dismissed in the current app session.
 * 4. Intro storage has loaded (isIntroLoaded === true) to prevent copy flash.
 */
export function shouldShowAvailabilityHelper(params: {
  user: UserQualificationInput | null | undefined;
  isEnabled: boolean;
  technicianId: string | null | undefined;
  isIntroLoaded?: boolean;
}): boolean {
  if (!params.isEnabled) {
    return false;
  }
  if (params.isIntroLoaded === false) {
    return false;
  }
  if (!qualifiesForAvailabilityHelper(params.user)) {
    return false;
  }
  if (isAvailabilityHelperDismissedThisSession(params.technicianId)) {
    return false;
  }
  return true;
}

/**
 * Determines whether the "Complete Your Profile" warning should be visible.
 * Synchronously suppresses the warning if the availability helper qualifies or has
 * precedence on this specific Home landing/mount.
 */
export function shouldShowProfileWarning(params: {
  user: UserQualificationInput | null | undefined;
  isEnabled: boolean;
  hasLandingPrecedence?: boolean;
}): boolean {
  if (!params.isEnabled || !params.user || typeof params.user !== "object") {
    return false;
  }
  // If the availability helper qualified on this landing/mount, suppress profile warning for this mount
  if (params.hasLandingPrecedence) {
    return false;
  }
  if (qualifiesForAvailabilityHelper(params.user)) {
    return false;
  }
  // Original profile incompleteness check
  return !params.user.phoneNumber || !params.user.address?.barangay;
}
