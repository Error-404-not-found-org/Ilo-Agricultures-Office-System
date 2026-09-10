import type { AxiosInstance } from "axios";
import type { AnimalsResponse } from "../types/adminAnimals.types";

export const getAdminAnimals = async (
  api: AxiosInstance,
  page: number,
  search: string,
  species: string,
  reproductiveStatus: string,
): Promise<AnimalsResponse> => {
  const res = await api.get("/animals/all", {
    params: {
      page,
      limit: 10,
      search: search || undefined,
      species: species === "All" ? undefined : species,
      reproductiveStatus:
        reproductiveStatus === "All" ? undefined : reproductiveStatus,
    },
  });
  return res.data;
};

export const getAdminAnimalRegistrySummary = async (
  api: AxiosInstance,
): Promise<AnimalsResponse["summary"]> => {
  const res = await api.get<AnimalsResponse>("/animals/all", {
    params: { page: 1, limit: 1 },
  });
  return res.data.summary;
};
