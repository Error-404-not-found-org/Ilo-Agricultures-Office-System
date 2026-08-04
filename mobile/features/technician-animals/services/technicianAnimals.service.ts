import { AxiosInstance } from "axios";
import { AnimalsFetchParams, AnimalsResponse } from "../types/technicianAnimals.types";

export const getTechnicianAnimals = async (
  api: AxiosInstance,
  params: AnimalsFetchParams
): Promise<AnimalsResponse> => {
  const response = await api.get("/animals/all", {
    params: {
      page: params.page,
      limit: params.limit,
      search: params.search || undefined,
      city: params.city && params.city !== "All" ? params.city : undefined,
      barangay: params.barangay && params.barangay !== "All" ? params.barangay : undefined,
      reproductiveStatus:
        params.reproductiveStatus && params.reproductiveStatus !== "All"
          ? params.reproductiveStatus
          : undefined,
    },
  });
  const body = response.data || {};
  return {
    animals: body.animals || body.data || [],
    total: body.total || 0,
    pages: body.pages || body.totalPages || 1,
  };
};
