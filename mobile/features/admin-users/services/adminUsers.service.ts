import { AxiosInstance } from "axios";

export const listUsers = async (api: AxiosInstance) => {
  const res = await api.get("/admin/list-users");
  return Array.isArray(res.data) ? res.data : [];
};

export const deleteUser = async (api: AxiosInstance, id: string) => {
  const res = await api.post("/admin/delete-user", { id });
  return res.data;
};

export const createUser = async (
  api: AxiosInstance,
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    phoneNumber?: string;
    address?: {
      street?: string;
      barangay?: string;
      city?: string;
      district?: string;
      province?: string;
    };
  }
) => {
  const res = await api.post("/admin/create-user", userData);
  return res.data;
};

export const createTechnician = async (
  api: AxiosInstance,
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    address?: {
      street?: string;
      barangay?: string;
      city?: string;
      district?: string;
      province?: string;
    };
  }
) => {
  const res = await api.post("/admin/technicians", userData);
  return res.data;
};

export const suspendUser = async (api: AxiosInstance, id: string) => {
  const res = await api.post("/admin/suspend-user", { id });
  return res.data;
};

export const reactivateUser = async (api: AxiosInstance, id: string) => {
  const res = await api.post("/admin/reactivate-user", { id });
  return res.data;
};

export const verifyUser = async (api: AxiosInstance, id: string) => {
  const res = await api.post("/admin/verify-user", { id });
  return res.data;
};

export const resetPassword = async (api: AxiosInstance, id: string) => {
  const res = await api.post("/admin/reset-password", { id });
  return res.data;
};

export const updateRole = async (api: AxiosInstance, id: string, role: string) => {
  const res = await api.post("/admin/update-role", { id, role });
  return res.data;
};

export const getArchivedUsers = async (api: AxiosInstance) => {
  const res = await api.get("/user/archived");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const restoreUser = async (api: AxiosInstance, id: string) => {
  const res = await api.post(`/user/${id}/restore`);
  return res.data;
};

export const updateDispatchProfile = async (
  api: AxiosInstance,
  id: string,
  profileData: {
    serviceMunicipalities?: {
      municipalityCode: string;
      municipalityName: string;
      localityType: string;
      provinceCode: string;
      provinceName: string;
    }[];
    serviceCapabilities?: string[];
  }
) => {
  const res = await api.patch(`/admin/technician/${id}/dispatch-profile`, profileData);
  return res.data;
};
