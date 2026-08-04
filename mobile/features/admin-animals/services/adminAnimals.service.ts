import { AxiosInstance } from "axios";
import { AnimalsResponse } from "../types/adminAnimals.types";

export const getAdminAnimals = async (
  api: AxiosInstance,
  page: number,
  search: string
): Promise<AnimalsResponse> => {
  const res = await api.get(
    `/animals/all?page=${page}&limit=10&search=${encodeURIComponent(search)}`
  );
  return res.data;
};

export const archiveAnimal = async (api: AxiosInstance, id: string) => {
  const res = await api.delete(`/animals/${id}`);
  return res.data;
};
