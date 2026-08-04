import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../../lib/api";
import { technicianKeys } from "../../../lib/queryKeys";
import {
  getTechnicianDashboardData,
  getTechnicianAnalytics,
  getCurrentTechnicianProfile,
  getAssignedFarmers,
  getFarmerDetail,
  updateRequestStatus,
  declineTechnicianRequest,
  UpdateStatusPayload,
} from "../services/technician.service";
import { executeOfflineMutation } from "@/hooks/useOfflineMutation";

export const useTechnicianDashboardQuery = (enabled: boolean = true) => {
  const api = useApi();
  return useQuery({
    queryKey: technicianKeys.dashboard(),
    queryFn: () => getTechnicianDashboardData(api),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 2, // Auto-refresh every 2 minutes instead of 30s
  });
};

export const useTechnicianFullAgendaQuery = (enabled: boolean = true) => {
  const api = useApi();
  return useQuery({
    queryKey: [...technicianKeys.dashboard(), "full-agenda"],
    queryFn: () => getTechnicianDashboardData(api, { fullAgenda: true }),
    enabled,
    staleTime: 1000 * 60,
  });
};

export const useTechnicianAnalyticsQuery = (enabled: boolean = true) => {
  const api = useApi();
  return useQuery({
    queryKey: technicianKeys.analytics(),
    queryFn: () => getTechnicianAnalytics(api),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 2, // Auto-refresh every 2 minutes instead of 30s
  });
};

export const useCurrentTechnicianProfileQuery = (enabled: boolean = true) => {
  const api = useApi();
  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => getCurrentTechnicianProfile(api),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useAssignedFarmersQuery = (enabled: boolean = true) => {
  const api = useApi();
  return useQuery({
    queryKey: technicianKeys.assignedFarmers(),
    queryFn: async () => {
      const data = await getAssignedFarmers(api);
      const farmers = Array.isArray(data) ? data : data?.data || [];
      if (farmers.length === 0) return { data: [] };

      const detailedFarmers = await Promise.all(
        farmers.map(async (farmer: any) => {
          try {
            const detailData = await getFarmerDetail(api, farmer._id);
            const stats = detailData.stats || {};
            const animals = stats.animals || [];

            return {
              ...farmer,
              totalAnimals: animals.length,
              pregnantCount: animals.filter(
                (a: any) => a.reproductiveStatus === "Pregnant"
              ).length,
              insemCount: animals.filter(
                (a: any) => a.reproductiveStatus === "Inseminated"
              ).length,
              normalCount: animals.filter(
                (a: any) =>
                  !a.reproductiveStatus || a.reproductiveStatus === "Normal"
              ).length,
            };
          } catch (err) {
            console.warn(`Failed to fetch details for farmer ${farmer._id}:`, err);
            return {
              ...farmer,
              totalAnimals: 0,
              pregnantCount: 0,
              insemCount: 0,
              normalCount: 0,
            };
          }
        })
      );

      const sortedFarmers = detailedFarmers.sort(
        (a: any, b: any) => b.totalAnimals - a.totalAnimals
      );
      return { data: sortedFarmers };
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

interface UpdateRequestStatusArgs {
  type: "health" | "ai";
  requestId: string;
  payload: UpdateStatusPayload;
  description?: string;
}

export const useUpdateRequestStatusMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, requestId, payload, description }: UpdateRequestStatusArgs) => {
      const endpoint =
        type === "health"
          ? `/health-request/${requestId}/status`
          : `/ai-request/${requestId}/status`;
      return executeOfflineMutation(
        api,
        {
          url: endpoint,
          method: "PATCH",
          description: description || "Technician Action",
        },
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: technicianKeys.analytics() });
    },
  });
};

interface DeclineTechnicianRequestArgs {
  type: "health" | "ai";
  requestId: string;
  technicianNote?: string;
}

export const useDeclineTechnicianRequestMutation = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      requestId,
      technicianNote,
    }: DeclineTechnicianRequestArgs) => {
      return executeOfflineMutation(
        api,
        {
          url: `/technician/requests/${type}/${requestId}/decline`,
          method: "PATCH",
          description: "Decline request for this technician",
        },
        { technicianNote: technicianNote || "Declined by technician." }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
      queryClient.invalidateQueries({ queryKey: technicianKeys.analytics() });
    },
  });
};
