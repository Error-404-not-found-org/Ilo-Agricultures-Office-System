import { AxiosInstance } from "axios";

export const getFarmerProfile = async (api: AxiosInstance) => {
  const response = await api.get("/user/me");
  return response.data;
};

export const updateFarmerProfile = async (
  api: AxiosInstance,
  userId: string,
  updatedData: any
) => {
  const response = await api.put(`/user/${userId}`, updatedData);
  return response.data;
};
