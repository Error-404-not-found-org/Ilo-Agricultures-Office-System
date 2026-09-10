import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

export type TechnicianOnboardingUser = {
  _id?: string;
  role?: string;
  profileClaimStatus?: string;
  technicianOnboardingCompletedAt?: string | null;
  phoneNumber?: string | null;
  address?: { barangay?: string | null } | null;
  dispatchProfile?: {
    availabilityStatus?: string;
    acceptsNewRequests?: boolean;
  } | null;
};

export const shouldShowTechnicianOnboarding = (
  user?: TechnicianOnboardingUser | null,
) =>
  user?.role === "technician" &&
  user.profileClaimStatus === "claimed" &&
  !user.technicianOnboardingCompletedAt;

export const isTechnicianAcceptingRequests = (
  user?: TechnicianOnboardingUser | null,
) => Boolean(user?.dispatchProfile?.acceptsNewRequests);

export const enableRequestAcceptance = async (
  api: Pick<AxiosInstance, "patch">,
  queryClient: Pick<QueryClient, "invalidateQueries">,
) => {
  await api.patch("/technician/dispatch-status", {
    acceptsNewRequests: true,
  });
  await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
};

export const completeOnboarding = async (
  api: Pick<AxiosInstance, "patch">,
  queryClient: Pick<QueryClient, "invalidateQueries">,
  onPersisted?: () => void,
) => {
  await api.patch("/technician/onboarding", {});
  onPersisted?.();
  await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
};

export const shouldShowProfileWarning = (
  user: TechnicianOnboardingUser | null | undefined,
  options: {
    onboardingVisible: boolean;
    suppressAfterCompletion: boolean;
  },
) => {
  if (options.onboardingVisible || options.suppressAfterCompletion) {
    return false;
  }
  return Boolean(user && (!user.phoneNumber || !user.address?.barangay));
};

const profileWarningSessionSuppressions = new Set<string>();

export const suppressNextProfileWarningForSession = (userId?: string) => {
  if (userId) profileWarningSessionSuppressions.add(userId);
};

export const consumeProfileWarningSuppression = (userId?: string) => {
  if (!userId || !profileWarningSessionSuppressions.has(userId)) return false;
  profileWarningSessionSuppressions.delete(userId);
  return true;
};
