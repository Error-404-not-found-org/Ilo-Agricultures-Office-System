import { ENV } from "../../config/env.js";

export const DISPATCH_NOTIFICATION_MODES = Object.freeze({
  LEGACY: "legacy",
  OBSERVE: "observe",
  TARGETED: "targeted",
});

export function resolveDispatchNotificationMode(
  rawMode = ENV.DISPATCH_NOTIFICATION_MODE,
) {
  const normalized = String(rawMode || "observe")
    .trim()
    .toLowerCase();

  if (
    Object.values(DISPATCH_NOTIFICATION_MODES)
      .includes(normalized)
  ) {
    return normalized;
  }

  return DISPATCH_NOTIFICATION_MODES.OBSERVE;
}
