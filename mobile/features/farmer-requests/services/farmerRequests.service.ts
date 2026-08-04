import type { AxiosInstance } from "axios";

export const getSystemConfig = async (api: AxiosInstance) => {
  const response = await api.get("/config");
  return response.data;
};

export const getFarmerSelfProfile = async (api: AxiosInstance) => {
  const response = await api.get("/user/me");
  return response.data;
};

export const getFarmerAnimalsForPicker = async (api: AxiosInstance) => {
  const response = await api.get("/animals/my", {
    params: { page: 1, limit: 25 },
  });
  return response.data;
};

export const getMyHealthRequests = async (api: AxiosInstance) => {
  const response = await api.get("/health-request/my");
  return response.data;
};

export const getMyAIRequests = async (api: AxiosInstance) => {
  const response = await api.get("/ai-request/my", {
    params: { page: 1, limit: 100 },
  });
  return response.data;
};

export const getTechnicianDirectory = async (api: AxiosInstance) => {
  const response = await api.get("/user", { params: { role: "technician" } });
  return Array.isArray(response.data) ? response.data : response.data?.data || [];
};

export const submitHealthRequest = async (api: AxiosInstance, payload: any) => {
  const response = await api.post("/health-request", payload);
  return response.data;
};
