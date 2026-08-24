import type { AxiosInstance } from "axios";
import type { AIRequest, Animal } from "@/types";
import type {
  FarmerActivity,
  FarmerMilestone,
  FarmerDashboardNotificationSummary,
  FarmerDashboardProfile,
  UpcomingVisit,
} from "../types/farmerDashboard.types";
import {
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
  const response = await api.get("/ai-request/upcoming");
  return responseToArray<UpcomingVisit>(response.data);
};

export const getPendingOutcomes = async (
  api: AxiosInstance,
): Promise<AIRequest[]> => {
  const response = await api.get("/ai-request/my");
  return filterPendingOutcomes(response.data);
};

export const getMilestones = async (api: AxiosInstance): Promise<FarmerMilestone[]> => {
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
  reason: string,
) => {
  const endpoint = type === "ai" ? `/ai-request/${id}/cancel` : `/health-request/${id}/cancel`;
  const response = await api.patch(endpoint, { reason: reason.trim() });
  return response.data;
};
