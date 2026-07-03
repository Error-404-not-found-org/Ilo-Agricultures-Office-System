import { AxiosInstance } from "axios";

export const getFarmerMilestones = async (api: AxiosInstance) => {
  const response = await api.get("/user/milestones");
  return response.data;
};

export const getFarmerActivity = async (api: AxiosInstance) => {
  const response = await api.get("/user/activity");
  return response.data;
};
