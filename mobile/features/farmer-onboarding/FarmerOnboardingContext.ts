import { createContext, useContext } from "react";

export const FarmerOnboardingContext = createContext<{
  complete: () => Promise<void>;
} | null>(null);

export function useFarmerOnboarding() {
  const context = useContext(FarmerOnboardingContext);
  if (!context) throw new Error("Farmer onboarding requires the authenticated app gate.");
  return context;
}
