import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  BreedingObservationPayload,
  submitBreedingObservation,
} from "../services/breedingObservation.service";
import { invalidateBreedingObservationQueries } from "../utils/breedingObservationSubmission";

export function useSubmitBreedingObservation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
      idempotencyKey,
    }: {
      requestId: string;
      payload: BreedingObservationPayload;
      animalId?: string;
      idempotencyKey?: string;
    }) => submitBreedingObservation(api, requestId, payload, idempotencyKey || Date.now().toString()),
    onSuccess: (_data, variables) => {
      invalidateBreedingObservationQueries(queryClient, variables.animalId);
    },
  });
}
