import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  BreedingObservationPayload,
  submitBreedingObservation,
} from "../services/breedingObservation.service";

export function useSubmitBreedingObservation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: BreedingObservationPayload;
      animalId?: string;
    }) => submitBreedingObservation(api, requestId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["animal", variables.animalId] }),
        queryClient.invalidateQueries({ queryKey: ["animal", variables.animalId, "pregnancy-tracker"] }),
        queryClient.invalidateQueries({ queryKey: ["animal-records"] }),
        queryClient.invalidateQueries({ queryKey: ["ai-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["farmer", "dashboard"] }),
      ]);
    },
  });
}
