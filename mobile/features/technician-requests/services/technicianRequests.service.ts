import { AxiosInstance } from "axios";
import { RequestFilters, RequestsResponse } from "../types/technicianRequests.types";

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

