import axios from "axios";
import { ENV } from "../config/env.js";
import { normalizePhilippineMobileNumber } from "../utils/phone.js";

const DEFAULT_IPROG_BASE_URL = "https://www.iprogsms.com/api/v1";

const getSmsConfig = () => {
  const enabled = String(ENV.IPROG_SMS_ENABLED || "").toLowerCase() === "true";
  const token = ENV.IPROG_SMS_API_TOKEN;
  const baseUrl = (ENV.IPROG_SMS_BASE_URL || DEFAULT_IPROG_BASE_URL).replace(
    /\/$/,
    "",
  );

  if (!enabled) {
    throw Object.assign(new Error("SMS OTP is not enabled."), {
      statusCode: 503,
    });
  }

  if (!token) {
    throw Object.assign(new Error("SMS provider token is not configured."), {
      statusCode: 503,
    });
  }

  return { token, baseUrl };
};

const getProviderMessage = (error, fallback) => {
  const data = error.response?.data;
  if (typeof data === "string") return data;
  return data?.message || data?.error || fallback;
};

export const sendOtpSms = async (phoneNumber, options = {}) => {
  const { token, baseUrl } = getSmsConfig();
  const phone = normalizePhilippineMobileNumber(phoneNumber);

  try {
    const response = await axios.post(
      `${baseUrl}/otp/send_otp`,
      {
        api_token: token,
        phone_number: phone.international,
        expiration: options.expirationMinutes || 5,
      },
      {
        timeout: 10000,
        headers: { "Content-Type": "application/json" },
      },
    );

    return {
      provider: "iprog",
      phone,
      response: response.data,
    };
  } catch (error) {
    throw Object.assign(
      new Error(getProviderMessage(error, "Failed to send OTP.")),
      { statusCode: error.response?.status || 502 },
    );
  }
};

export const verifyOtpSms = async (phoneNumber, otpCode) => {
  const { token, baseUrl } = getSmsConfig();
  const phone = normalizePhilippineMobileNumber(phoneNumber);
  const code = String(otpCode || "").trim();

  if (!/^\d{4,8}$/.test(code)) {
    throw Object.assign(new Error("OTP code must be 4 to 8 digits."), {
      statusCode: 400,
    });
  }

  try {
    const response = await axios.post(
      `${baseUrl}/otp/verify_otp`,
      {
        api_token: token,
        phone_number: phone.international,
        otp: code,
      },
      {
        timeout: 10000,
        headers: { "Content-Type": "application/json" },
      },
    );

    return {
      provider: "iprog",
      phone,
      response: response.data,
    };
  } catch (error) {
    throw Object.assign(
      new Error(getProviderMessage(error, "Invalid or expired OTP code.")),
      { statusCode: error.response?.status || 400 },
    );
  }
};
