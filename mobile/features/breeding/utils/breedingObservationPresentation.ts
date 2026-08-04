export type BreedingObservationType =
  | "possible_pregnancy"
  | "return_to_heat"
  | "unsure";

const OBSERVATION_LABELS: Record<BreedingObservationType, string> = {
  possible_pregnancy: "Possible pregnancy signs",
  return_to_heat: "Returned to heat",
  unsure: "Unsure of breeding outcome",
};

const SIGN_LABELS: Record<string, string> = {
  no_return_to_heat: "No return to heat",
  appetite_change: "Appetite change",
  calmer_behavior: "Calmer behavior",
  enlarged_abdomen: "Enlarged abdomen",
  udder_change: "Udder changes",
  mucus_discharge: "Mucus discharge",
  standing_heat: "Standing heat",
  mounting_behavior: "Mounting behavior",
  restlessness: "Restlessness",
  vocalization: "Increased vocalization",
};

export const getBreedingObservationLabel = (value?: string | null) =>
  value && value in OBSERVATION_LABELS
    ? OBSERVATION_LABELS[value as BreedingObservationType]
    : "Breeding observation";

export const getBreedingObservationSignLabel = (value: string) =>
  SIGN_LABELS[value] ||
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const isBreedingObservationAwaitingReview = (status?: string | null) =>
  status === "pending" ||
  status === "reported" ||
  status === "not_requested";
