import type { AxiosInstance } from "axios";

export interface UpdateFarmerPayload {
  name: string;
  email?: string;
  phoneNumber?: string;
  address: {
    phoneNumber?: string;
    barangay: string;
    city: string;
    province: string;
  };
}

export interface RegisterFarmerPayload {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
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

export const archiveFarmerProfile = async (api: AxiosInstance, farmerId: string) => {
  const response = await api.patch(`/user/${farmerId}/technician-archive`);
  return response.data;
};

export const updateFarmerProfile = async (
  api: AxiosInstance,
  farmerId: string,
  payload: UpdateFarmerPayload
) => {
  const response = await api.put(`/user/${farmerId}`, payload);
  return response.data;
};

export interface FarmerInvitationResult {
  message?: string;
  appAccountStatus?: string;
  invitationExpiresAt?: string;
}

export const sendFarmerInvitation = async (
  api: AxiosInstance,
  farmerId: string,
  resend: boolean
): Promise<FarmerInvitationResult> => {
  const response = await api.post(
    `/user/${farmerId}/app-invitation${resend ? "/resend" : ""}`
  );
  return response.data;
};

export interface FarmerCancelInvitationResult {
  message?: string;
  appAccountStatus?: string;
}

export const cancelFarmerInvitation = async (
  api: AxiosInstance,
  farmerId: string
): Promise<FarmerCancelInvitationResult> => {
  const response = await api.delete(`/user/${farmerId}/app-invitation`);
  return response.data;
};

export const registerFarmer = async (
  api: AxiosInstance,
  payload: RegisterFarmerPayload
) => {
  const response = await api.post("/technician/register-farmer", payload);
  return response.data;
};
