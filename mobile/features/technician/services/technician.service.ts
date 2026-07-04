import { AxiosInstance } from "axios";

export interface UpdateStatusPayload {
  status: string;
  technicianNote?: string;
  diagnosis?: string;
  treatment?: string;
  advice?: string;
  sireBreed?: string;
  sireCode?: string;
  estrus?: string;
  scheduledDate?: string;
}

export const getTechnicianDashboardData = async (
  api: AxiosInstance,
  params?: { fullAgenda?: boolean }
) => {
  const response = await api.get("/technician/dashboard-data", { params });
  return response.data || {};
};

export const getTechnicianAnalytics = async (api: AxiosInstance) => {
  const response = await api.get("/technician/analytics");
  return response.data || {};
};

export const getAssignedFarmers = async (api: AxiosInstance) => {
  const response = await api.get("/user?role=farmer");
  return response.data || {};
};

export const getFarmerDetail = async (api: AxiosInstance, farmerId: string) => {
  const response = await api.get(`/user/${farmerId}`);
  return response.data || {};
};

export const getTechnicianRequestDetail = async (
  api: AxiosInstance,
  type: "health" | "ai",
  requestId: string
) => {
  const endpoint = type === "health" ? `/health-request/${requestId}` : `/ai-request/${requestId}`;
  const response = await api.get(endpoint);
  return response.data?.data || response.data;
};

export const getTechnicianAnimalHistory = async (api: AxiosInstance, animalId: string) => {
  const response = await api.get(`/technician/animal-history/${animalId}`);
  return response.data?.timeline || [];
};

export const updateRequestStatus = async (
  api: AxiosInstance,
  type: "health" | "ai",
  requestId: string,
  payload: UpdateStatusPayload
) => {
  const endpoint =
    type === "health"
      ? `/health-request/${requestId}/status`
      : `/technician/inseminations/${requestId}/status`;
  const response = await api.patch(endpoint, payload);
  return response.data;
};

export const respondToCancellationRequest = async (
  api: AxiosInstance,
  type: "health" | "ai",
  requestId: string,
  payload: { approved: boolean; reason: string }
) => {
  const endpoint = type === "health" ? `/health-request/${requestId}/cancel-respond` : `/ai-request/${requestId}/cancel-respond`;
  const response = await api.patch(endpoint, payload);
  return response.data;
};

export const createWalkInInsemination = async (api: AxiosInstance, payload: any) => {
  const response = await api.post("/technician/walk-in-insemination", payload);
  return response.data;
};

export const declineTechnicianRequest = async (
  api: AxiosInstance,
  type: "health" | "ai",
  requestId: string,
  technicianNote = "Declined by technician."
) => {
  const response = await api.patch(`/technician/requests/${type}/${requestId}/decline`, {
    technicianNote,
  });
  return response.data;
};
