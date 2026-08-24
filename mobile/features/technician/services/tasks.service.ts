import type { AxiosInstance } from "axios";
import type {
  WorkQueueFilters,
  WorkQueueResponse,
} from "@/features/technician-requests/types/technicianRequests.types";

export interface CreateTaskPayload {
  farmerId: string;
  animalIds: string[];
  category: string;
  taskType: string;
  notes: string;
  dueDate?: string;
  sourceType?: string;
  metadata?: Record<string, any>;
  priority?: number;
}

export const getTasks = async (
  api: AxiosInstance,
  filters?: { scope?: string; status?: string; page?: number; limit?: number },
) => {
  const response = await api.get("/tasks", { params: filters });
  return response.data || [];
};

export const getTechnicianWorkQueue = async (
  api: AxiosInstance,
  filters: WorkQueueFilters,
): Promise<WorkQueueResponse> => {
  const response = await api.get("/technician/work-queue", { params: filters });
  return {
    data: Array.isArray(response.data?.data) ? response.data.data : [],
    pagination: response.data?.pagination || {
      total: 0,
      page: filters.page,
      limit: filters.limit,
      totalPages: 1,
    },
    counts: response.data?.counts || {},
  };
};

export const claimTask = async (api: AxiosInstance, id: string) => {
  const response = await api.put(`/tasks/${id}/claim`);
  return response.data;
};

export const getTaskDetails = async (api: AxiosInstance, id: string) => {
  const response = await api.get(`/tasks/${id}`);
  return response.data;
};

export const createTask = async (api: AxiosInstance, payload: CreateTaskPayload) => {
  const response = await api.post("/tasks", payload);
  return response.data;
};

export const completeTask = async (
  api: AxiosInstance,
  id: string,
  payload?: { relatedRecordType?: string; relatedRecordId?: string },
) => {
  const response = await api.put(`/tasks/${id}/complete`, payload || {});
  return response.data;
};
