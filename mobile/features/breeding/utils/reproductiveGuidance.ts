export type ReproductiveGuidance = {
  kind: "heat_return" | "pregnancy_check";
  title: string;
  statusLabel: string | null;
  description: string;
  action: "give_update" | null;
};

type ReproductiveGuidanceInput = {
  reproductiveStatus?: string | null;
  pregnancyReadiness?: { isEligible?: boolean } | null;
  canGiveBreedingUpdate: boolean;
  breedingObservationDescription?: string | null;
};

export const getReproductiveGuidance = ({
  reproductiveStatus,
  pregnancyReadiness,
  canGiveBreedingUpdate,
  breedingObservationDescription,
}: ReproductiveGuidanceInput): ReproductiveGuidance | null => {
  if (reproductiveStatus !== "Inseminated") return null;

  if (pregnancyReadiness?.isEligible === true) {
    return {
      kind: "pregnancy_check",
      title: "Pregnancy Check",
      statusLabel: "Ready for check",
      description:
        "Pregnancy diagnosis can now be performed by the technician.",
      action: null,
    };
  }

  return {
    kind: "heat_return",
    title: "Heat-return monitoring",
    statusLabel: null,
    description:
      breedingObservationDescription || "Have you noticed signs of heat?",
    action: canGiveBreedingUpdate ? "give_update" : null,
  };
};
