interface EarTagSuggestionInput {
  farmerName?: string;
  existingEarTags?: (string | null | undefined)[];
}

export const EAR_TAG_MAX_LENGTH = 20;

export const getEarTagValidationError = (value: string) =>
  value.trim().length > EAR_TAG_MAX_LENGTH
    ? `Ear tag must be ${EAR_TAG_MAX_LENGTH} characters or fewer.`
    : null;

export const getFarmerInitials = (farmerName = "") => {
  const parts = farmerName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)?.[0] || ""}`;
  return parts[0]?.[0] || "";
};

export const generateEarTagSuggestion = ({
  farmerName,
  existingEarTags = [],
}: EarTagSuggestionInput) => {
  const initials = getFarmerInitials(farmerName);
  const suffix = initials.toLowerCase();
  const highest = existingEarTags.reduce((max, value) => {
    const normalized = String(value || "").trim().toLowerCase();
    const match = normalized.match(/^(\d+)([a-z]+)$/);
    return match && match[2] === suffix ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${String(highest + 1).padStart(2, "0")}${initials}`;
};
