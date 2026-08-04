import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getAnimalsAll,
  getAnimalDetails,
  getAnimalMedicalRecords,
  deleteAnimal,
  updateAnimalWizard,
  getAnimalsByFarmer,
  UpdateAnimalWizardPayload,
} from "../services/animalManagement.service";

export const animalQueryKeys = {
  all: ["technician", "animals"] as const,
  lists: (params: { page: number; limit: number; search: string }) =>
    [...animalQueryKeys.all, "list", params] as const,
  details: (id: string) => [...animalQueryKeys.all, "detail", id] as const,
  medical: (id: string) => [...animalQueryKeys.all, "medical", id] as const,
  farmer: (farmerId: string) => [...animalQueryKeys.all, "farmer", farmerId] as const,
};

export const useTechnicianAnimal = (id?: string) => {
  const api = useApi();
  const queryClient = useQueryClient();

  const useAnimalsList = (params: { page: number; limit: number; search: string }) =>
    useQuery({
      queryKey: animalQueryKeys.lists(params),
      queryFn: () => getAnimalsAll(api, params),
    });

  const animalDetailsQuery = useQuery({
    queryKey: animalQueryKeys.details(id || ""),
    queryFn: () => getAnimalDetails(api, id || ""),
    enabled: !!id,
  });

  const animalMedicalQuery = useQuery({
    queryKey: animalQueryKeys.medical(id || ""),
    queryFn: () => getAnimalMedicalRecords(api, id || ""),
    enabled: !!id,
  });

  const deleteAnimalMutation = useMutation({
    mutationFn: (animalId: string) => deleteAnimal(api, animalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: animalQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
    },
  });

  const updateWizardMutation = useMutation({
    mutationFn: (params: { id: string; payload: UpdateAnimalWizardPayload }) =>
      updateAnimalWizard(api, params.id, params.payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: animalQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: animalQueryKeys.details(variables.id) });
      queryClient.invalidateQueries({ queryKey: animalQueryKeys.medical(variables.id) });
    },
  });

  const useAnimalsByFarmerQuery = (farmerId: string, enabled = true) =>
    useQuery({
      queryKey: animalQueryKeys.farmer(farmerId),
      queryFn: () => getAnimalsByFarmer(api, farmerId),
      enabled: enabled && !!farmerId,
    });

  return {
    useAnimalsList,
    animalDetailsQuery,
    animalMedicalQuery,
    deleteAnimalMutation,
    updateWizardMutation,
    useAnimalsByFarmerQuery,
  };
};
