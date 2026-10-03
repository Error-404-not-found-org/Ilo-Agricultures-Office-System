export type PhoneOtpFeedback = {
  title: string;
  message: string;
  kind: "error" | "info";
};

export const resolvePhoneOtpTiming = ({
  nowMs = Date.now(),
  expiresAt,
  lastOtpSentAt,
  retryAfterSeconds = 60,
}: {
  nowMs?: number;
  expiresAt?: string | null;
  lastOtpSentAt?: string | null;
  retryAfterSeconds?: number;
}) => {
  const expiryMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const sentMs = lastOtpSentAt ? Date.parse(lastOtpSentAt) : Number.NaN;
  const remainingSeconds = Number.isFinite(expiryMs)
    ? Math.max(0, Math.ceil((expiryMs - nowMs) / 1000))
    : 0;
  const cooldownSeconds = Number.isFinite(sentMs)
    ? Math.max(0, Math.ceil((sentMs + retryAfterSeconds * 1000 - nowMs) / 1000))
    : 0;
  return { remainingSeconds, cooldownSeconds, isActive: remainingSeconds > 0 };
};

export const getPhoneOtpErrorPresentation = (
  code?: string,
  serverMessage?: string,
): PhoneOtpFeedback => {
  switch (code) {
    case "OTP_COOLDOWN":
      return {
        title: "Please wait before sending another code",
        message: "You can send another code when the countdown reaches zero.",
        kind: "info",
      };
    case "OTP_INVALID":
      return {
        title: "Incorrect verification code",
        message: serverMessage || "Check the code and try again.",
        kind: "error",
      };
    case "OTP_EXPIRED":
      return {
        title: "Verification code expired",
        message: "Request a new code to continue.",
        kind: "error",
      };
    case "OTP_SEND_FAILED":
    case "SMS_NOT_AVAILABLE":
    case "OTP_NOT_CONFIGURED":
      return {
        title: "Could not send verification code",
        message: serverMessage || "Please try again in a moment.",
        kind: "error",
      };
    default:
      return {
        title: "Phone verification unsuccessful",
        message: serverMessage || "Please try again.",
        kind: "error",
      };
  }
};
