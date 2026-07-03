import type { AxiosInstance } from "axios";
import type { AnimalTimelineEvent, ReproductionEligibility } from "../types/animalTimeline.types";
import type { PaginatedResponse } from "@/features/shared/types/pagination";

type TimelineParams = {
  page?: number;
  limit?: number;
  type?: string;
  search?: string;
};

export const getAnimalTimeline = async (
  api: AxiosInstance,
  animalId: string,
  params: TimelineParams = {},
) => {
  const response = await api.get<PaginatedResponse<AnimalTimelineEvent> | { data: AnimalTimelineEvent[] }>(
    `/animals/${animalId}/timeline`,
    {
      params: {
        page: params.page,
        limit: params.limit,
        type: params.type && params.type !== "All" ? params.type : undefined,
        search: params.search || undefined,
      },
    },
  );
  const body = response.data;
  if ("total" in body) return body;

  return {
    data: body.data || [],
    page: params.page || 1,
    limit: params.limit || body.data?.length || 10,
    total: body.data?.length || 0,
    totalPages: 1,
  };
};

export const getAnimalHealthHistory = async (
  api: AxiosInstance,
  animalId: string,
  params: TimelineParams = {},
) => {
  const response = await api.get<PaginatedResponse<any>>(
    `/animals/${animalId}/health-history`,
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        type: params.type && params.type !== "All" ? params.type : undefined,
        search: params.search || undefined,
      },
    },
  );
  return response.data;
};

export const getReproductionEligibility = async (api: AxiosInstance, animalId: string) => {
  const response = await api.get<{ data: ReproductionEligibility }>(`/animals/${animalId}/reproduction-eligibility`);
  return response.data.data;
};

export const submitAnimalUpdate = async (
  api: AxiosInstance,
  animalId: string,
  payload: { status: string; note?: string; attachments?: string[] },
) => {
  const response = await api.post(`/animals/${animalId}/updates`, payload);
  return response.data;
};
