import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getAnimalDetails,
  getAnimalMedicalRecords,
  updateReproductiveStatus,
  recordAiOutcomeForAnimal,
  deleteAnimal,
} from "../services/animals.service";
import { animalKeys } from "../utils/queryKeys";

export function useAnimalDetailsQuery(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: animalKeys.detail(id),
    queryFn: () => getAnimalDetails(api, id),
    enabled: Boolean(id),
  });
}

export function useAnimalMedicalRecordsQuery(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: animalKeys.medical(id),
    queryFn: () => getAnimalMedicalRecords(api, id),
    enabled: Boolean(id),
  });
}

export function useUpdateReproductiveStatusMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note: string }) =>
      updateReproductiveStatus(api, id, status, note),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: animalKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: animalKeys.mine() });
    },
  });
}

export function useRecordAiOutcomeForAnimalMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      isSuccess,
      note,
      animalId,
    }: {
      requestId: string;
      isSuccess: boolean;
      note: string;
      animalId: string;
    }) => recordAiOutcomeForAnimal(api, requestId, isSuccess, note),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: animalKeys.detail(variables.animalId) });
      queryClient.invalidateQueries({ queryKey: animalKeys.mine() });
      queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useDeleteAnimalMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAnimal(api, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      queryClient.invalidateQueries({ queryKey: animalKeys.mine() });
    },
  });
}
