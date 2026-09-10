import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  aiRequestKeys,
  animalKeys,
  animalRecordKeys,
  notificationKeys,
  technicianKeys,
} from "@/lib/queryKeys";
import { buildDirectHealthRecordPayload } from "../utils/directHealthRecord";

export const useDirectHealthRecordMutation = () => {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation({
    mutationFn: async (payload: any) => {
      const { idempotencyKey, ...input } = payload;
      const requestBody = buildDirectHealthRecordPayload(input);
      const res = await api.post("/medical", requestBody, {
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
      });
      return res.data;
    },
    onSuccess: (_result, variables: any) => {
      queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: technicianKeys.records() });
      queryClient.invalidateQueries({ queryKey: animalKeys.all });
      queryClient.invalidateQueries({ queryKey: animalRecordKeys.all });
      if (variables?.animalId) {
        queryClient.invalidateQueries({
          queryKey: animalKeys.detail(String(variables.animalId)),
        });
        queryClient.invalidateQueries({
          queryKey: animalKeys.timeline(String(variables.animalId)),
        });
      }
    },
  });
};

export const useCompleteHealthRequestMutation = (requestId: string) => {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.patch(`/health-request/${requestId}/status`, payload);
      return res.data;
    },
    onSuccess: (_result, variables: any) => {
      queryClient.invalidateQueries({ queryKey: technicianKeys.workQueue() });
      queryClient.invalidateQueries({ queryKey: technicianKeys.requests() });
      queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: technicianKeys.records() });
      queryClient.invalidateQueries({ queryKey: technicianKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: aiRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: animalKeys.all });
      queryClient.invalidateQueries({ queryKey: animalRecordKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      if (variables?.animalId) {
        queryClient.invalidateQueries({
          queryKey: animalKeys.detail(String(variables.animalId)),
        });
        queryClient.invalidateQueries({
          queryKey: animalKeys.timeline(String(variables.animalId)),
        });
      }
    },
  });
};
