import { AxiosInstance } from "axios";

export const getAdminInseminations = async (api: AxiosInstance) => {
  const res = await api.get("/admin/inseminations");
  return res.data.inseminations || [];
};

export const getAdminPregnancies = async (api: AxiosInstance) => {
  const res = await api.get("/admin/pregnancy-checks");
  return res.data.pregnancyChecks || [];
};

export const getAdminCalvings = async (api: AxiosInstance) => {
  const res = await api.get("/admin/calvings");
  return res.data.calvings || [];
};
