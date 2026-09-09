import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { getAnimalDetails } from "../../animals/services/animals.service";

export function usePregnancyTrackerQuery(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["animal", id, "pregnancy-tracker"],
    queryFn: () => getAnimalDetails(api, id),
    enabled: Boolean(id),
  });
}

export function usePregnancyLossReportsQuery(animalId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: ["animals", animalId, "pregnancy-loss-reports"],
    queryFn: async () => {
      const response = await api.get(`/animals/${animalId}/pregnancy-loss-reports`);
      return (response.data?.reports || []) as any[];
    },
    enabled: Boolean(animalId) && enabled,
  });
}
