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

export const getTechnicianDashboardData = async (api: AxiosInstance) => {
  const response = await api.get("/technician/dashboard-data");
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
