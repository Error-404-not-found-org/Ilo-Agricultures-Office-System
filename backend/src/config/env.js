import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV,
  FORCE_CUSTOM_DNS: process.env.FORCE_CUSTOM_DNS,
  PORT: process.env.PORT,

  DB_URL: process.env.DB_URL,
  DB_URL_DEV: process.env.DB_URL_DEV,

  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,

  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,

  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,

  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Base BreedSmart website
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  // Invitation destinations
  TECHNICIAN_INVITATION_REDIRECT_URL:
    process.env.TECHNICIAN_INVITATION_REDIRECT_URL ||
    `${process.env.CLIENT_URL || "http://localhost:5173"}/technician/welcome`,

  FARMER_INVITATION_REDIRECT_URL:
    process.env.FARMER_INVITATION_REDIRECT_URL ||
    `${process.env.CLIENT_URL || "http://localhost:5173"}/download-app`,

  VOICEFLOW_API_KEY: process.env.VOICEFLOW_API_KEY,

  IPROG_SMS_ENABLED: process.env.IPROG_SMS_ENABLED,
  IPROG_SMS_API_TOKEN: process.env.IPROG_SMS_API_TOKEN,
  IPROG_SMS_BASE_URL: process.env.IPROG_SMS_BASE_URL,

  DISPATCH_NOTIFICATION_MODE: process.env.DISPATCH_NOTIFICATION_MODE,
};
