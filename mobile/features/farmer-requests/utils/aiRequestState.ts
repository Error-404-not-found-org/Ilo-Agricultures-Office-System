export const ACTIVE_AI_REQUEST_STATUSES = new Set([
  "pending",
  "submitted",
  "approved",
  "accepted",
  "assigned",
  "scheduled",
  "in-progress",
  "in_progress",
  "awaiting-service",
  "awaiting service",
  "awaiting-result",
  "awaiting result",
  "under-monitoring",
  "under monitoring",
]);

const idOf = (value: any) =>
  typeof value === "string" ? value : value?._id || value?.id;

export const findActiveAIRequestForAnimal = (
  requests: any[] | undefined,
  animalId: string | undefined,
) => {
  if (!animalId) return undefined;
  return requests?.find(
    (request) =>
      idOf(request?.animalId) === animalId &&
      ACTIVE_AI_REQUEST_STATUSES.has(request?.status),
  );
};

export const getAIRequestSubmitErrorMessage = (error: any) => {
  if (error?.response?.data?.code === "ACTIVE_AI_REQUEST_EXISTS") {
    return "An active AI service request already exists for this animal. Complete or cancel it before submitting another one.";
  }
  return (
    error?.response?.data?.message ||
    "Failed to submit request. Please try again."
  );
};

export const AI_REQUEST_INVALIDATION_KEYS = [
  ["farmer", "requests"],
  ["farmer", "ai-requests"],
  ["ai-requests"],
] as const;

export const getAIRequestSubmitState = ({
  hasActiveRequest,
  isSubmitting,
  isIneligible,
  ineligibleReason,
  reproductiveStatus,
}: {
  hasActiveRequest: boolean;
  isSubmitting: boolean;
  isIneligible?: boolean;
  ineligibleReason?: string;
  reproductiveStatus?: string;
}) => {
  const disabled = hasActiveRequest || Boolean(isIneligible) || isSubmitting;
  let label = "Submit AI Service Request";
  if (isSubmitting) {
    label = "Submitting...";
  } else if (hasActiveRequest) {
    label = "AI Request Already Active";
  } else if (isIneligible) {
    if (
      reproductiveStatus === "Inseminated" ||
      reproductiveStatus === "Likely Pregnant" ||
      ineligibleReason?.includes("breeding cycle") ||
      ineligibleReason?.includes("monitoring")
    ) {
      label = "Breeding Cycle in Progress";
    } else if (
      reproductiveStatus === "Pregnant" ||
      ineligibleReason?.includes("pregnant")
    ) {
      label = "AI Request Unavailable";
    } else {
      label = "AI Request Unavailable";
    }
  }

  return { disabled, label };
};

export interface AIRequestInlineNotice {
  type: "active_request" | "breeding_cycle" | "pregnant";
  title: string;
  description: string;
  actionLabel?: string;
  actionRoute?: {
    pathname: string;
    params: { id: string };
  };
}

export const getAIRequestInlineNotice = ({
  activeRequest,
  selectedAnimal,
  eligibility,
}: {
  activeRequest?: any;
  selectedAnimal?: any;
  eligibility?: { isEligible: boolean; reason?: string; code?: string } | null;
}): AIRequestInlineNotice | null => {
  if (activeRequest) {
    const statusText = String(activeRequest.status || "pending")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
    return {
      type: "active_request",
      title: "Active AI request",
      description: `Artificial Insemination · ${statusText}\nComplete or cancel this request before creating another one.`,
      actionLabel: "View existing request",
      actionRoute: activeRequest._id
        ? {
            pathname: "/(farmer)/ai-request-detail",
            params: { id: String(activeRequest._id) },
          }
        : undefined,
    };
  }

  if (
    selectedAnimal &&
    eligibility &&
    !eligibility.isEligible &&
    (selectedAnimal.reproductiveStatus === "Inseminated" ||
      selectedAnimal.reproductiveStatus === "Likely Pregnant" ||
      eligibility.code === "ACTIVE_REPRODUCTIVE_WORKFLOW" ||
      eligibility.reason?.includes("breeding cycle"))
  ) {
    return {
      type: "breeding_cycle",
      title: "Breeding cycle in progress",
      description:
        "This animal is currently being monitored after insemination. You can request AI again once the current breeding cycle has a confirmed outcome.",
      actionLabel: "View breeding timeline",
      actionRoute: selectedAnimal._id
        ? {
            pathname: "/(farmer)/pregnancy-tracker",
            params: { id: String(selectedAnimal._id) },
          }
        : undefined,
    };
  }

  if (
    selectedAnimal &&
    eligibility &&
    !eligibility.isEligible &&
    (selectedAnimal.reproductiveStatus === "Pregnant" ||
      eligibility.code === "ACTIVE_PREGNANCY")
  ) {
    return {
      type: "pregnant",
      title: "Active pregnancy registered",
      description:
        "There is already an active pregnancy registered for this animal. AI service cannot be requested while pregnant.",
      actionLabel: "View pregnancy tracker",
      actionRoute: selectedAnimal._id
        ? {
            pathname: "/(farmer)/pregnancy-tracker",
            params: { id: String(selectedAnimal._id) },
          }
        : undefined,
    };
  }

  return null;
};

export const getAnimalPickerAdvisory = (
  eligibility?: { isEligible: boolean; reason?: string } | null,
  hasActiveRequest?: boolean,
) => {
  if (hasActiveRequest) {
    return "An AI request is already active.";
  }
  if (eligibility && !eligibility.isEligible) {
    return "Waiting for the current breeding cycle result.";
  }
  return null;
};

export const classifyAnimalSelection = (
  animal: any,
  eligibility: { isEligible: boolean; code?: string; reason?: string } | null,
): {
  canSelectDirectly: boolean;
  modalType: "male" | "age" | null;
  reason?: string;
} => {
  if (!animal) return { canSelectDirectly: false, modalType: null };
  const isMale =
    String(animal.gender || animal.sex || "").toLowerCase() === "male";
  if (isMale) {
    return {
      canSelectDirectly: false,
      modalType: "male",
      reason:
        "This animal is male. Artificial insemination service is dedicated to female breeding animals.",
    };
  }
  const isUnderage = eligibility?.code === "AGE_INELIGIBLE";
  if (isUnderage) {
    return {
      canSelectDirectly: false,
      modalType: "age",
      reason:
        eligibility?.reason ||
        "This animal has not reached the minimum breeding age yet.",
    };
  }
  return {
    canSelectDirectly: true,
    modalType: null,
  };
};

export const checkAIRequestEligibilityForSubmit = ({
  selectedAnimal,
  activeRequest,
  eligibility,
}: {
  selectedAnimal: any;
  activeRequest?: any;
  eligibility?: { isEligible: boolean; reason?: string; code?: string } | null;
}): {
  canSubmit: boolean;
  blockReason?: string;
  blockType?: "no_animal" | "active_request" | "pregnant" | "ineligible";
} => {
  if (!selectedAnimal) {
    return {
      canSubmit: false,
      blockType: "no_animal",
      blockReason: "Please select an animal for this request.",
    };
  }
  if (activeRequest) {
    return {
      canSubmit: false,
      blockType: "active_request",
      blockReason: "An active AI request already exists for this animal.",
    };
  }
  if (selectedAnimal.reproductiveStatus === "Pregnant") {
    return {
      canSubmit: false,
      blockType: "pregnant",
      blockReason:
        "There is already an active pregnancy registered for this animal. AI service cannot be submitted while pregnant.",
    };
  }
  if (eligibility && !eligibility.isEligible) {
    return {
      canSubmit: false,
      blockType: "ineligible",
      blockReason:
        eligibility.reason ||
        "This animal is not currently eligible for insemination.",
    };
  }
  return { canSubmit: true };
};
