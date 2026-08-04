import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { recordAiOutcome, cancelFarmerRequest } from "../services/farmerDashboard.service";

export const useFarmerDashboardMutations = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  const outcomeMutation = useMutation({
    mutationFn: async ({ requestId, isSuccess }: { requestId: string; isSuccess: boolean }) => {
      return await recordAiOutcome(api, requestId, isSuccess);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["user", "activity"] });
      queryClient.invalidateQueries({ queryKey: ["animals", "my"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, type, reason }: { id: string; type: string; reason: string }) => {
      return await cancelFarmerRequest(api, id, type, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits", "upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["health-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });

  return {
    outcomeMutation,
    cancelMutation,
  };
};
