import type { ApiErrorDetails } from "@/lib/api";

export type BootstrapErrorAction = "retry" | "sign-out";

export interface BootstrapErrorPresentation {
  title: string;
  message: string;
  primaryAction: BootstrapErrorAction;
  primaryActionLabel: string;
}

const retryPresentation = (
  title: string,
  message: string,
): BootstrapErrorPresentation => ({
  title,
  message,
  primaryAction: "retry",
  primaryActionLabel: "Try Again",
});

const signOutPresentation = (
  title: string,
  message: string,
  primaryActionLabel = "Sign Out",
): BootstrapErrorPresentation => ({
  title,
  message,
  primaryAction: "sign-out",
  primaryActionLabel,
});

export const getBootstrapErrorPresentation = (
  error: ApiErrorDetails,
): BootstrapErrorPresentation => {
  const { code, status, retryable, retryAfterSeconds } = error;

  if (code === "NETWORK_ERROR") {
    return retryPresentation(
      "Connection Problem",
      "BreedSmart cannot reach the server. Check your internet connection and try again.",
    );
  }

  if (code === "AUTH_REQUIRED" || status === 401) {
    return signOutPresentation(
      "Session Problem",
      "Your session could not be verified. Sign in again to continue.",
      "Sign In Again",
    );
  }

  if (code === "EMAIL_NOT_VERIFIED") {
    return signOutPresentation(
      "Email Verification Required",
      "Verify your primary email address, then sign in again to continue.",
    );
  }

  if (code === "ACCOUNT_SUSPENDED") {
    return signOutPresentation(
      "Account Unavailable",
      "This account has been suspended. Contact the Ilo Agriculture Office if you need help.",
    );
  }

  if (code === "ACCOUNT_DELETED") {
    return signOutPresentation(
      "Account Unavailable",
      "This account has been deactivated. Contact the Ilo Agriculture Office if you need help.",
    );
  }

  if (status === 403) {
    return signOutPresentation(
      "Account Unavailable",
      error.message ||
        "This account cannot access BreedSmart. Contact the Ilo Agriculture Office if you need help.",
    );
  }

  if (code === "IDENTITY_LINK_CONFLICT" || status === 409) {
    return signOutPresentation(
      "Identity Conflict",
      "BreedSmart cannot safely link this sign-in to the existing account. Sign out and contact the Ilo Agriculture Office for help.",
    );
  }

  if (status === 429 || code === "RATE_LIMITED") {
    const retryMessage = retryAfterSeconds
      ? `Too many attempts were made. Please wait ${retryAfterSeconds} seconds, then try again.`
      : "Too many attempts were made. Please wait a moment, then try again.";

    return retryPresentation("Please Wait", retryMessage);
  }

  if ((status !== undefined && status >= 500) || retryable) {
    return retryPresentation(
      status !== undefined && status >= 500
        ? "BreedSmart Temporarily Unavailable"
        : "Setup Temporarily Unavailable",
      status !== undefined && status >= 500
        ? "BreedSmart is temporarily unavailable. Please try again in a moment."
        : "BreedSmart could not finish setting up your account. Please try again.",
    );
  }

  return signOutPresentation(
    "Setup Incomplete",
    "BreedSmart could not finish setting up your account. Sign out and try again, or contact the Ilo Agriculture Office if the problem continues.",
  );
};
