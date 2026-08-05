import { useQueryClient } from "@tanstack/react-query";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import {
  aiRequestKeys,
  animalKeys,
  animalRecordKeys,
  notificationKeys,
  technicianKeys,
} from "@/lib/queryKeys";

export const useWalkInInseminationMutation = () => {
  const queryClient = useQueryClient();

  return useOfflineMutation(
    {
      url: "/technician/walk-in-insemination",
      method: "POST",
      description: "Walk-in AI record",
    },
    {
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
    },
  );
};

export const useCompleteAIRequestMutation = (requestId: string) => {
  const queryClient = useQueryClient();

  return useOfflineMutation(
    {
      url: `/ai-request/${requestId}/status`,
      method: "PATCH",
      description: "Complete AI Request",
    },
    {
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
    },
  );
};
