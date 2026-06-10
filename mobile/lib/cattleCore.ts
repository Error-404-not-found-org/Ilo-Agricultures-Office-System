/**
 * cattleCore.ts
 * Unified Core Domain Logic, Scientific Veterinary Matrices, & Local Milestone Calculators
 */

export type ReproductiveStatus = 'Normal' | 'In Heat' | 'Inseminated' | 'Pregnant';
export type SpeciesType = 'Beef Cattle' | 'Dairy Cattle' | 'Cattle' | 'Carabao' | 'Goat' | 'Swine';

export interface SpeciesProfile {
  minBreedingAgeMonths: number;
  avgGestationDays: number;
  voluntaryWaitingPeriodDays: number;
}

export interface EligibilityResult {
  isEligible: boolean;
  reason?: string;
}

export interface TimelineMilestones {
  heatReturnCheckDate: Date;
  ultrasoundCheckDate: Date;
  palpationCheckDate: Date;
  dryOffDate?: Date;
  expectedCalvingDate: Date;
}

// Global immutable parameters configuration mapped to Merck Veterinary Manual & ICAR guidelines
export const SPECIES_PROFILES: Record<string, SpeciesProfile> = {
  "Beef Cattle":  { minBreedingAgeMonths: 12, avgGestationDays: 283, voluntaryWaitingPeriodDays: 50 },
  "Dairy Cattle": { minBreedingAgeMonths: 12, avgGestationDays: 279, voluntaryWaitingPeriodDays: 50 },
  "Cattle":       { minBreedingAgeMonths: 12, avgGestationDays: 283, voluntaryWaitingPeriodDays: 50 },
  "Carabao":      { minBreedingAgeMonths: 24, avgGestationDays: 320, voluntaryWaitingPeriodDays: 60 },
  "Goat":         { minBreedingAgeMonths: 8,  avgGestationDays: 150, voluntaryWaitingPeriodDays: 40 },
  "Swine":        { minBreedingAgeMonths: 8,  avgGestationDays: 114, voluntaryWaitingPeriodDays: 30 },
};

/**
 * Normalizes input species to match profile keys.
 * Maps 'Beef' -> 'Beef Cattle', 'Dairy' -> 'Dairy Cattle', defaulting to 'Cattle'.
 */
export function normalizeSpecies(species: string | undefined): string {
  if (!species) return "Cattle";
  const s = species.trim();
  if (s === "Beef") return "Beef Cattle";
  if (s === "Dairy") return "Dairy Cattle";
  return s;
}

/**
 * Calculate age in months with safety check for future/invalid birth dates
 */
export function calculateAgeInMonths(birthDate: Date | string): number {
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;
  const now = new Date();
  const diff = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, diff);
}

/**
 * Universal Insemination Age Eligibility Gateway
 * Validates that an animal is old enough to breed based on its species profile.
 */
export function checkInseminationAgeEligibility(birthDate: Date | string | undefined, species: string): EligibilityResult {
  if (!birthDate) return { isEligible: true };

  const ageInMonths = calculateAgeInMonths(birthDate);
  const normSpecies = normalizeSpecies(species);
  const profile = SPECIES_PROFILES[normSpecies] || SPECIES_PROFILES["Cattle"];

  if (ageInMonths < profile.minBreedingAgeMonths) {
    return {
      isEligible: false,
      reason: `Animal is too young for insemination. Current age is ${ageInMonths === 0 ? "Newborn" : ageInMonths + " months"}. Minimum required for ${species} is ${profile.minBreedingAgeMonths} months.`
    };
  }

  return { isEligible: true };
}

/**
 * Resolves breed-specific overrides for average gestation and postpartum wait (VWP).
 */
export function getBreedProfile(species: string, breed?: string): SpeciesProfile {
  const normSpecies = normalizeSpecies(species);
  const baseProfile = SPECIES_PROFILES[normSpecies] || SPECIES_PROFILES["Cattle"];

  let avgGestationDays = baseProfile.avgGestationDays;
  let voluntaryWaitingPeriodDays = baseProfile.voluntaryWaitingPeriodDays;

  if (!breed) {
    return { minBreedingAgeMonths: baseProfile.minBreedingAgeMonths, avgGestationDays, voluntaryWaitingPeriodDays };
  }

  const b = breed.trim().toLowerCase();

  // Carabao breed-specific adjustments
  if (normSpecies === "Carabao") {
    if (b.includes("philippine") || b.includes("native") || b === "swamp") {
      avgGestationDays = 322;
      voluntaryWaitingPeriodDays = 60;
    } else if (b.includes("bulgarian") || b.includes("murrah") || b.includes("nili") || b.includes("ravi") || b.includes("river")) {
      avgGestationDays = 314;
      voluntaryWaitingPeriodDays = 60;
    } else if (b.includes("hybrid") || b.includes("cross") || b.includes("grade")) {
      avgGestationDays = 317;
      voluntaryWaitingPeriodDays = 60;
    }
  }
  // Cattle breed-specific adjustments
  else if (normSpecies === "Beef Cattle" || normSpecies === "Dairy Cattle" || normSpecies === "Cattle") {
    if (b.includes("brahman") || b.includes("nellore") || b.includes("ongole") || b.includes("zebu")) {
      avgGestationDays = 290;
      voluntaryWaitingPeriodDays = 55; // Slightly longer recovery for tropical/zebu breeds
    } else if (b.includes("holstein") || b.includes("friesian")) {
      avgGestationDays = 281;
      voluntaryWaitingPeriodDays = 60; // High-producing dairy cows typically have 60-day voluntary waiting period
    } else if (b.includes("jersey")) {
      avgGestationDays = 279;
      voluntaryWaitingPeriodDays = 50;
    } else if (b.includes("brown swiss")) {
      avgGestationDays = 288;
      voluntaryWaitingPeriodDays = 60;
    } else if (b.includes("sahiwal")) {
      avgGestationDays = 286;
      voluntaryWaitingPeriodDays = 55;
    } else if (b.includes("angus") || b.includes("hereford") || b.includes("british")) {
      avgGestationDays = 283;
      voluntaryWaitingPeriodDays = 50;
    }
  }

  return {
    minBreedingAgeMonths: baseProfile.minBreedingAgeMonths,
    avgGestationDays,
    voluntaryWaitingPeriodDays
  };
}

/**
 * Adaptive Gestation Calculator
 * Replaces hardcoded values with dynamic species/breed profiles and male embryo offsets (+1.5 days).
 */
export function calculateTargetCalvingDate(inseminationDate: Date | string, species: string, calfSex?: 'M' | 'F', breed?: string): Date {
  const baseDate = new Date(inseminationDate);
  const breedProfile = getBreedProfile(species, breed);
  let totalGestationDays = breedProfile.avgGestationDays;

  if (calfSex === 'M') {
    totalGestationDays += 1.5;
  }

  baseDate.setDate(baseDate.getDate() + Math.round(totalGestationDays));
  return baseDate;
}

/**
 * Postpartum Recovery Verification Gateway (Voluntary Waiting Period Check)
 * Confirms an animal has recovered sufficiently from calving before re-insemination.
 */
export function verifyPostpartumWindow(lastCalvingDate: Date | string, targetActionDate: Date | string, species: string, breed?: string): {
  isSafe: boolean;
  daysPassed: number;
  requiredDays: number;
} {
  const calving = new Date(lastCalvingDate);
  const action = new Date(targetActionDate);
  
  const breedProfile = getBreedProfile(species, breed);
  const requiredDays = breedProfile.voluntaryWaitingPeriodDays;
  const timeDifference = Math.abs(action.getTime() - calving.getTime());
  const daysPassed = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

  return {
    isSafe: daysPassed >= requiredDays,
    daysPassed,
    requiredDays
  };
}

/**
 * ICAR-Aligned Pregnancy Timeline Generator
 * Builds diagnostic windows locally in real-time right when an AI event gets captured.
 */
export function generatePregnancyTimeline(inseminationDate: Date | string, species: string, calfSex?: 'M' | 'F', breed?: string): TimelineMilestones {
  const start = new Date(inseminationDate);
  const expectedCalvingDate = calculateTargetCalvingDate(inseminationDate, species, calfSex, breed);
  
  const heatReturnCheckDate = new Date(start.getTime());
  heatReturnCheckDate.setDate(heatReturnCheckDate.getDate() + 21); // 21-day estrus cycle observation window
  
  const ultrasoundCheckDate = new Date(start.getTime());
  ultrasoundCheckDate.setDate(ultrasoundCheckDate.getDate() + 35); // Optimal 30-45 day scan bracket
  
  const palpationCheckDate = new Date(start.getTime());
  palpationCheckDate.setDate(palpationCheckDate.getDate() + 60); // Manual examination threshold
  
  const normSpecies = normalizeSpecies(species);
  const result: TimelineMilestones = {
    heatReturnCheckDate,
    ultrasoundCheckDate,
    palpationCheckDate,
    expectedCalvingDate
  };

  if (normSpecies === "Dairy Cattle") {
    const dryOffDate = new Date(expectedCalvingDate.getTime());
    dryOffDate.setDate(dryOffDate.getDate() - 60); // Standard 60-day lactation resting cycle
    result.dryOffDate = dryOffDate;
  }

  return result;
}
