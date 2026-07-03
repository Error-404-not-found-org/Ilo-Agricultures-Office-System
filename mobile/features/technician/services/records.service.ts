import type { AxiosInstance } from "axios";

export const getInseminations = async (api: AxiosInstance) => {
  const response = await api.get("/technician/inseminations?page=1&limit=25");
  return response.data;
};

export const getPregnancyChecks = async (api: AxiosInstance) => {
  const response = await api.get("/technician/pregnancy-checks?page=1&limit=25");
  return response.data;
};

export const getCalvings = async (api: AxiosInstance) => {
  const response = await api.get("/technician/calvings?page=1&limit=25");
  return response.data;
};

export const getAiRequests = async (api: AxiosInstance) => {
  const response = await api.get("/ai-request?page=1&limit=25");
  return response.data;
};

export const getHealthRequests = async (api: AxiosInstance) => {
  const response = await api.get("/health-request?page=1&limit=25");
  return response.data;
};

export const deleteLedgerRecord = async (api: AxiosInstance, { id, type }: { id: string; type: string }) => {
  const endpoint = type === 'health-request' 
    ? `/health-request/${id}` 
    : type === 'insemination' 
      ? `/insemination/${id}`
      : type === 'pregnancy'
        ? `/technician/pregnancy-checks/${id}`
        : type === 'calving'
          ? `/technician/calvings/${id}`
          : `/ai-request/${id}`;
  const response = await api.delete(endpoint);
  return response.data;
};
