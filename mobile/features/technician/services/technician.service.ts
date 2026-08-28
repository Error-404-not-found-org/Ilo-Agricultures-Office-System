import type { AxiosInstance } from "axios";
import type { HealthAdvicePayload } from "@/features/technician-health-request/utils/healthAdviceWorkflow";
import type { HealthOfficePickupPayload } from "@/features/technician-health-request/utils/healthOfficePickupWorkflow";

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
  visitPeriod?: string;
  samePeriodConfirmed?: boolean;
  earlyStartConfirmed?: boolean;
}

export const getTechnicianDashboardData = async (
  api: AxiosInstance,
  params?: { fullAgenda?: boolean },
) => {
  const response = await api.get("/technician/dashboard-data", { params });
  return response.data || {};
};

export const getTechnicianAnalytics = async (api: AxiosInstance) => {
  const response = await api.get("/technician/analytics");
  return response.data || {};
};

export const getCurrentTechnicianProfile = async (api: AxiosInstance) => {
  const response = await api.get("/user/me");
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
  requestId: string,
) => {
  const endpoint =
    type === "health"
      ? `/health-request/${requestId}`
      : `/ai-request/${requestId}`;
  const response = await api.get(endpoint);
  return response.data?.data || response.data;
};

export const updateRequestStatus = async (
  api: AxiosInstance,
  type: "health" | "ai",
  requestId: string,
  payload: UpdateStatusPayload,
) => {
  const endpoint =
    type === "health"
      ? `/health-request/${requestId}/status`
      : `/ai-request/${requestId}/status`;
  const response = await api.patch(endpoint, payload);
  return response.data;
};

export const respondToCancellationRequest = async (
  api: AxiosInstance,
  type: "health" | "ai",
  requestId: string,
  payload: { approved: boolean; reason: string },
) => {
  const endpoint =
    type === "health"
      ? `/health-request/${requestId}/cancel-respond`
      : `/ai-request/${requestId}/cancel-respond`;
  const response = await api.patch(endpoint, payload);
  return response.data;
};

export const createWalkInInsemination = async (
  api: AxiosInstance,
  payload: any,
) => {
  const response = await api.post("/technician/walk-in-insemination", payload);
  return response.data;
};

export const declineTechnicianRequest = async (
  api: AxiosInstance,
  type: "health" | "ai",
  requestId: string,
  technicianNote = "Skipped by technician.",
) => {
  const response = await api.patch(
    `/technician/requests/${type}/${requestId}/decline`,
    {
      technicianNote,
    },
  );
  return response.data;
};

export const cancelTechnicianHealthRequest = async (
  api: AxiosInstance,
  requestId: string,
  reason: string,
) => {
  const response = await api.patch(`/health-request/${requestId}/cancel`, {
    reason,
  });
  return response.data;
};

export const sendTechnicianHealthAdvice = async (
  api: AxiosInstance,
  requestId: string,
  payload: HealthAdvicePayload,
) => {
  const response = await api.patch(
    `/health-request/${requestId}/advice`,
    payload,
  );
  return response.data?.data || response.data;
};

export const sendTechnicianHealthOfficePickup = async (
  api: AxiosInstance,
  requestId: string,
  payload: HealthOfficePickupPayload,
) => {
  const response = await api.patch(
    `/health-request/${requestId}/office-pickup`,
    payload,
  );
  return response.data?.data || response.data;
};
