import { AxiosInstance } from "axios";

export const getAdminStats = async (api: AxiosInstance) => {
  const res = await api.get("/admin/stats");
  return res.data;
};

export const getAdminMonitoringData = async (api: AxiosInstance) => {
  const res = await api.get("/admin/monitoring");
  return res.data;
};

export const triggerDatabaseBackup = async (api: AxiosInstance) => {
  const res = await api.get("/admin/backup");
  return res.data;
};
