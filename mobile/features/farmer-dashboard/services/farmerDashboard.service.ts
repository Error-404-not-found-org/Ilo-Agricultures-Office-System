import type { AxiosInstance } from "axios";
import type { AIRequest, Animal } from "@/types";
import type {
  FarmerActivity,
  FarmerDashboardNotificationSummary,
  FarmerDashboardProfile,
  UpcomingVisit,
} from "../types/farmerDashboard.types";
import {
  buildUpcomingVisits,
  filterPendingOutcomes,
  responseToArray,
} from "../utils/farmerDashboard.transforms";

export const getFarmerProfile = async (
  api: AxiosInstance,
): Promise<FarmerDashboardProfile> => {
  const response = await api.get("/user/me");
  return response.data;
};

export const getUnreadNotificationSummary = async (
  api: AxiosInstance,
): Promise<FarmerDashboardNotificationSummary> => {
  const response = await api.get("/notifications/unread-count");
  return response.data;
};

export const getUpcomingVisits = async (
  api: AxiosInstance,
): Promise<UpcomingVisit[]> => {
  const [aiResponse, healthResponse] = await Promise.all([
    api.get("/ai-request/my?limit=100"),
    api.get("/health-request/my?limit=100"),
  ]);
  return buildUpcomingVisits(aiResponse.data, healthResponse.data);
};

export const getPendingOutcomes = async (
  api: AxiosInstance,
): Promise<AIRequest[]> => {
  const response = await api.get("/ai-request/my");
  return filterPendingOutcomes(response.data);
};

export const getMilestones = async (api: AxiosInstance): Promise<unknown[]> => {
  const response = await api.get("/user/milestones");
  return responseToArray(response.data);
};

export const getMyAnimals = async (api: AxiosInstance): Promise<Animal[]> => {
  const response = await api.get("/animals/my");
  return responseToArray<Animal>(response.data);
};

export const getActivityFeed = async (
  api: AxiosInstance,
): Promise<FarmerActivity[]> => {
  const response = await api.get("/user/activity");
  return responseToArray<FarmerActivity>(response.data);
};

export const recordAiOutcome = async (
  api: AxiosInstance,
  requestId: string,
  isSuccess: boolean,
) => {
  const response = await api.patch(`/ai-request/${requestId}/outcome`, {
    isSuccess,
  });
  return response.data;
};

export const cancelFarmerRequest = async (
  api: AxiosInstance,
  id: string,
  type: string,
) => {
  const endpoint = type === "ai" ? `/ai-request/${id}/cancel` : `/health-request/${id}/cancel`;
  const response = await api.patch(endpoint, { reason: "Cancelled from dashboard home" });
  return response.data;
};
