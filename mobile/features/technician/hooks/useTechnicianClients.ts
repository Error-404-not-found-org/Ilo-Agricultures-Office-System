import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getAssignedFarmers,
  getFarmerDetail,
  updateFarmerProfile,
  registerFarmer,
  UpdateFarmerPayload,
  RegisterFarmerPayload,
} from "../services/clients.service";

export const clientsQueryKeys = {
  all: ["technician", "clients"] as const,
  lists: () => [...clientsQueryKeys.all, "list"] as const,
  details: (id: string) => [...clientsQueryKeys.all, "detail", id] as const,
};

export const useTechnicianClients = (id?: string) => {
  const api = useApi();
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: clientsQueryKeys.lists(),
    queryFn: () => getAssignedFarmers(api),
  });

  const clientDetailsQuery = useQuery({
    queryKey: clientsQueryKeys.details(id || ""),
    queryFn: () => getFarmerDetail(api, id || ""),
    enabled: !!id,
    refetchInterval: 10000, // Matches original 10s polling interval
  });

  const updateClientMutation = useMutation({
    mutationFn: (params: { id: string; payload: UpdateFarmerPayload }) =>
      updateFarmerProfile(api, params.id, params.payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientsQueryKeys.details(variables.id) });
    },
  });

  const registerClientMutation = useMutation({
    mutationFn: (payload: RegisterFarmerPayload) => registerFarmer(api, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientsQueryKeys.lists() });
    },
  });

  return {
    clientsQuery,
    clientDetailsQuery,
    updateClientMutation,
    registerClientMutation,
  };
};
