import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BreedingObservationScreen } from "@/features/breeding/screens/BreedingObservationScreen";
import type { BreedingObservationType } from "@/features/breeding/services/breedingObservation.service";

export default function ReportBreedingObservationRoute() {
  const { animalId, requestId, defaultReport } =
    useLocalSearchParams<{
      animalId: string;
      requestId?: string;
      defaultReport?: BreedingObservationType;
    }>();

  return (
    <BreedingObservationScreen
      animalId={animalId || ""}
      requestId={requestId}
      defaultReport={defaultReport || "unsure"}
    />
  );
}
