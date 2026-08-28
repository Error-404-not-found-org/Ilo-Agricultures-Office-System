import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  FarmerPregnancyReportPayload,
  submitFarmerPregnancyReport,
} from "../services/farmerPregnancyReport.service";
import { invalidateBreedingObservationQueries } from "../utils/breedingObservationSubmission";

export function useSubmitFarmerPregnancyReport() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
      idempotencyKey,
    }: {
      requestId: string;
      payload: FarmerPregnancyReportPayload;
      animalId: string;
      idempotencyKey?: string;
    }) => submitFarmerPregnancyReport(api, requestId, payload, idempotencyKey || Date.now().toString()),
    onSuccess: (_data, variables) => {
      invalidateBreedingObservationQueries(queryClient, variables.animalId);
    },
  });
}
