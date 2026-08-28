import { AxiosInstance } from "axios";
import {
  RequestFilters,
  RequestsResponse,
  VisitPeriod,
} from "../types/technicianRequests.types";

export const getTechnicianRequests = async (
  api: AxiosInstance,
  filters: Partial<RequestFilters>
): Promise<RequestsResponse> => {
  const response = await api.get("/technician/requests", { params: filters });
  return response.data;
};

export const claimTechnicianRequest = async (
  api: AxiosInstance,
  type: "health" | "ai" | "breeding_verification",
  requestId: string
): Promise<any> => {
  const response = await api.patch(`/technician/requests/${type}/${requestId}/claim`);
  return response.data;
};

export interface ClaimAndSchedulePayload {
  scheduledDate: string;
  visitPeriod: VisitPeriod;
  samePeriodConfirmed?: boolean;
}

export const claimAndScheduleAIRequest = async (
  api: AxiosInstance,
  workflowId: string,
  payload: ClaimAndSchedulePayload,
) => {
  const response = await api.patch(
    `/ai-request/${workflowId}/claim-and-schedule`,
    payload,
  );
  return response.data;
};

