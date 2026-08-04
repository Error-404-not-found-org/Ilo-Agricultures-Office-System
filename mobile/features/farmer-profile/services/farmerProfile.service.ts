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

export const sendPhoneOtp = async (
  api: AxiosInstance,
  phoneNumber: string
) => {
  const response = await api.post("/user/otp/send", { phoneNumber });
  return response.data;
};

export const verifyPhoneOtp = async (
  api: AxiosInstance,
  phoneNumber: string,
  otpCode: string
) => {
  const response = await api.post("/user/otp/verify", {
    phoneNumber,
    otpCode,
  });
  return response.data;
};
