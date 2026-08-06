import type { AxiosInstance } from "axios";
import type { HealthRequest } from "@/types";

export const getHealthRequestDetail = async (api: AxiosInstance, requestId: string) => {
  const response = await api.get<{ data: HealthRequest }>(`/health-request/${requestId}`);
  return response.data.data;
};

export const triageHealthRequest = async (
  api: AxiosInstance,
  requestId: string,
  payload: {
    urgency?: "low" | "medium" | "high" | "emergency";
    findings?: string;
    technicianNote?: string;
    scheduledDate?: string;
    assignedTechnicianId?: string;
  },
) => {
  const response = await api.patch(`/health-request/${requestId}/triage`, payload);
  return response.data;
};

export const scheduleHealthFollowUp = async (
  api: AxiosInstance,
  requestId: string,
  payload: { followUpDate: string; note?: string },
) => {
  const response = await api.post(`/health-request/${requestId}/follow-up`, payload);
  return response.data;
};
