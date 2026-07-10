import type { AxiosInstance } from "axios";
import type { Animal } from "@/types";
import type { PaginatedResponse } from "@/features/shared/types/pagination";

export type MyAnimalsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  species?: string;
};

export async function getMyAnimals(
  api: AxiosInstance,
  params: MyAnimalsParams = {},
): Promise<PaginatedResponse<Animal>> {
  const res = await api.get("/animals/my", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      search: params.search || undefined,
      status: params.status && params.status !== "All" ? params.status : undefined,
      species: params.species && params.species !== "All" ? params.species : undefined,
    },
  });
  const body = res.data;
  const data = Array.isArray(body) ? body : body?.data || [];

  return {
    data,
    page: body?.page || params.page || 1,
    limit: body?.limit || params.limit || data.length || 10,
    total: body?.total ?? data.length,
    totalPages: body?.totalPages || body?.pages || 1,
  };
}

export async function registerAnimal(api: AxiosInstance, payload: any): Promise<any> {
  const res = await api.post("/animals/register", payload);
  return res.data;
}

export async function getAnimalDetails(api: AxiosInstance, id: string): Promise<Animal> {
  const res = await api.get(`/animals/${id}`);
  return res.data;
}

export async function updateAnimalBasicInfo(
  api: AxiosInstance,
  id: string,
  payload: any,
): Promise<any> {
  const res = await api.put(`/animals/wizard/${id}`, payload);
  return res.data;
}

export async function getAnimalMedicalRecords(api: AxiosInstance, id: string): Promise<any[]> {
  const res = await api.get(`/medical/${id}`);
  return Array.isArray(res.data) ? res.data : res.data?.data || [];
}

export async function updateReproductiveStatus(
  api: AxiosInstance,
  id: string,
  status: string,
  note: string,
): Promise<any> {
  const res = await api.patch(`/animals/${id}/reproductive-status`, {
    status,
    note,
  });
  return res.data;
}

export async function recordAiOutcomeForAnimal(
  api: AxiosInstance,
  requestId: string,
  isSuccess: boolean,
  note: string,
): Promise<any> {
  const res = await api.patch(`/ai-request/${requestId}/outcome`, {
    isSuccess,
    note,
  });
  return res.data;
}

export async function deleteAnimal(api: AxiosInstance, id: string): Promise<any> {
  const res = await api.delete(`/animals/${id}`);
  return res.data;
}
