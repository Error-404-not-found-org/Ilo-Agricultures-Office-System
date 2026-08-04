import { AxiosInstance } from "axios";

export interface UpdateFarmerPayload {
  name: string;
  email?: string;
  phoneNumber: string;
  address: {
    phoneNumber: string;
    barangay: string;
    city: string;
    province: string;
  };
}

export interface RegisterFarmerPayload {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  address: {
    barangay: string;
    city: string;
    province: string;
  };
}

export const getAssignedFarmers = async (api: AxiosInstance) => {
  const response = await api.get("/user?role=farmer");
  return response.data || [];
};

export const getFarmerDetail = async (api: AxiosInstance, farmerId: string) => {
  const response = await api.get(`/user/${farmerId}`);
  return response.data || {};
};

export const updateFarmerProfile = async (
  api: AxiosInstance,
  farmerId: string,
  payload: UpdateFarmerPayload
) => {
  const response = await api.put(`/user/${farmerId}`, payload);
  return response.data;
};

export const registerFarmer = async (
  api: AxiosInstance,
  payload: RegisterFarmerPayload
) => {
  const response = await api.post("/technician/register-farmer", payload);
  return response.data;
};
