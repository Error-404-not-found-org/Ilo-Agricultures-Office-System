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
