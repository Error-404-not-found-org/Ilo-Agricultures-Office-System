import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import {
  getFarmerAnimalsForPicker,
  getFarmerSelfProfile,
  getMyHealthRequests,
  getSystemConfig,
  getTechnicianDirectory,
} from "../services/farmerRequests.service";

export const farmerRequestFormKeys = {
  config: ["system", "config"] as const,
  profile: ["user", "me"] as const,
  animalsForAi: ["animals", "my", "request-ai-picker", 1, 25] as const,
  animalsForHealth: ["animals", "my", "health-picker", 1, 25] as const,
  myHealthRequests: ["health-requests", "my"] as const,
  technicians: ["technicians", "list"] as const,
};

export const useSystemConfigQuery = () => {
  const api = useApi();
  return useQuery({
    queryKey: farmerRequestFormKeys.config,
    queryFn: () => getSystemConfig(api),
  });
};

export const useFarmerSelfProfileQuery = () => {
  const api = useApi();
  return useQuery({
    queryKey: farmerRequestFormKeys.profile,
    queryFn: () => getFarmerSelfProfile(api),
  });
};

export const useFarmerAnimalsForAiQuery = () => {
  const api = useApi();
  return useQuery({
    queryKey: farmerRequestFormKeys.animalsForAi,
    queryFn: () => getFarmerAnimalsForPicker(api),
  });
};

export const useFarmerAnimalsForHealthQuery = () => {
  const api = useApi();
  return useQuery({
    queryKey: farmerRequestFormKeys.animalsForHealth,
    queryFn: () => getFarmerAnimalsForPicker(api),
  });
};

export const useMyHealthRequestsQuery = () => {
  const api = useApi();
  return useQuery({
    queryKey: farmerRequestFormKeys.myHealthRequests,
    queryFn: () => getMyHealthRequests(api),
  });
};

export const useTechnicianDirectoryQuery = () => {
  const api = useApi();
  return useQuery({
    queryKey: farmerRequestFormKeys.technicians,
    queryFn: () => getTechnicianDirectory(api),
  });
};

export const useSubmitHealthRequestMutation = () => {
  const queryClient = useQueryClient();

  return useOfflineMutation(
    {
      url: "/health-request",
      method: "POST",
      description: "Animal health request",
    },
    {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmer", "requests"] });
      queryClient.invalidateQueries({ queryKey: farmerRequestFormKeys.myHealthRequests });
    },
    },
  );
};
