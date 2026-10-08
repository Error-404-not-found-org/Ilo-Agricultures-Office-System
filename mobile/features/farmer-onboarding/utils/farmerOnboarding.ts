type StorageReader = { getItem: (key: string) => Promise<string | null> };
type StorageWriter = { setItem: (key: string, value: string) => Promise<void> };

const storageKey = (farmerId: string) => `farmer-onboarding-seen:v1:${farmerId}`;

export async function hasSeenFarmerOnboarding(
  farmerId: string,
  storage: StorageReader,
): Promise<boolean> {
  if (!farmerId) return false;
  try {
    return (await storage.getItem(storageKey(farmerId))) === "true";
  } catch {
    return false;
  }
}

export async function markFarmerOnboardingSeen(
  farmerId: string,
  storage: StorageWriter,
): Promise<void> {
  if (!farmerId) return;
  try {
    await storage.setItem(storageKey(farmerId), "true");
  } catch {
    // Continue into the app. A storage failure may make onboarding reappear later.
  }
}

export function getFarmerOnboardingDestination({
  role,
  isVerified,
  seen,
  isOnboardingRoute,
}: {
  role: string;
  isVerified: boolean;
  seen: boolean;
  isOnboardingRoute: boolean;
}): "/(farmer)/onboarding" | "/(farmer)/(tabs)" | null {
  if (role !== "farmer" || !isVerified) return null;
  if (!seen && !isOnboardingRoute) return "/(farmer)/onboarding";
  if (seen && isOnboardingRoute) return "/(farmer)/(tabs)";
  return null;
}

export function getNextFarmerOnboardingStep(currentStep: number, pageCount: number): number | null {
  return currentStep < pageCount - 1 ? currentStep + 1 : null;
}

export function getFarmerOnboardingHandoff({
  activeFarmerId,
  onboarding,
  inFarmerGroup,
  isOnboardingRoute,
  routeSegment,
}: {
  activeFarmerId?: string;
  onboarding: { farmerId: string; seen: boolean } | null;
  inFarmerGroup: boolean;
  isOnboardingRoute: boolean;
  routeSegment?: string;
}): "none" | "preparing" | "loading-profile" {
  if (!activeFarmerId) return "none";
  if (onboarding?.farmerId !== activeFarmerId) return "preparing";
  if (!onboarding.seen) return isOnboardingRoute ? "none" : "preparing";
  if (routeSegment === "notifications" || routeSegment === "notification-details") return "none";
  return isOnboardingRoute || !inFarmerGroup ? "loading-profile" : "none";
}
