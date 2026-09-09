export const PREGNANCY_DIAGNOSIS_UI = {
  PAGE_1: {
    SECTION_ANIMAL_FARMER: "Animal & Farmer",
    SECTION_BREEDING_REFERENCE: "Breeding Reference",
    SECTION_DIAGNOSIS_WINDOW: "DIAGNOSIS WINDOW",
    SECTION_FARMER_UPDATE: "FARMER UPDATE",
    CTA_START_DIAGNOSIS: "Start Pregnancy Diagnosis",
    CTA_DIAGNOSIS_LOCKED: "Diagnosis Not Yet Available",
    BREEDING_LABELS: {
      LAST_INSEMINATION: "Last insemination",
      ATTEMPT: "Attempt",
      SIRE: "Sire",
    },
  },
  PAGE_2: {
    HEADER_INITIAL: "Record Pregnancy Diagnosis",
    HEADER_CONTINUATION: "Pregnancy Follow-up",
    SECTION_FORM_TITLE: "Technician Diagnosis",
    SECTION_DIAGNOSTIC_METHOD: "Diagnostic Method",
    SUBTEXT_TIMING: "Pregnancy diagnosis",
    CTA_SAVE_INITIAL: "Save Pregnancy Diagnosis",
    CTA_SAVE_CONTINUATION: "Save Pregnancy Follow-up",
  },
  DIAGNOSIS_WINDOW: {
    READY_TITLE: "Ready for pregnancy diagnosis",
    READY_DESCRIPTION:
      "The animal has reached the recommended time for pregnancy diagnosis.",
    UNREADY_TITLE: "Monitoring in progress",
    UNREADY_DEFAULT_DESCRIPTION:
      "The animal has not yet reached the recommended time for pregnancy diagnosis.",
  },
  FARMER_UPDATE: {
    REPORTED_SUBTITLE: "Farmer reported possible pregnancy",
    REPORTED_OBSERVATION: "Farmer's observation",
    REPORTED_EVIDENCE: "Evidence",
    REPORTED_GUIDANCE:
      "Review the farmer's notes and photos before recording the diagnosis.",
    NO_REPORT_SUBTITLE: "No report submitted",
    NO_REPORT_GUIDANCE:
      "Ask the farmer if they have noticed any changes since insemination.",
  },
} as const;

export function formatDaysSinceInsemination(
  daysPostAI?: number | null,
): string | null {
  if (daysPostAI === undefined || daysPostAI === null) return null;
  return `${daysPostAI} ${daysPostAI === 1 ? "day" : "days"} since insemination`;
}

export function getDiagnosisWindowCopy(
  isEligible: boolean,
  reason?: string | null,
) {
  if (isEligible) {
    return {
      title: PREGNANCY_DIAGNOSIS_UI.DIAGNOSIS_WINDOW.READY_TITLE,
      description: PREGNANCY_DIAGNOSIS_UI.DIAGNOSIS_WINDOW.READY_DESCRIPTION,
    };
  }
  return {
    title: PREGNANCY_DIAGNOSIS_UI.DIAGNOSIS_WINDOW.UNREADY_TITLE,
    description:
      reason ||
      PREGNANCY_DIAGNOSIS_UI.DIAGNOSIS_WINDOW.UNREADY_DEFAULT_DESCRIPTION,
  };
}

export function getFarmerUpdateCopy(hasReport: boolean) {
  if (hasReport) {
    return {
      subtitle: PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.REPORTED_SUBTITLE,
      guidance: PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.REPORTED_GUIDANCE,
    };
  }
  return {
    subtitle: PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.NO_REPORT_SUBTITLE,
    guidance: PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.NO_REPORT_GUIDANCE,
  };
}
