import mongoose from "mongoose";
import { ENV } from "./env.js";
import dns from "dns";

if (process.env.FORCE_CUSTOM_DNS === 'true') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log("IPv4 DNS servers set to 8.8.8.8, 1.1.1.1");
  } catch (err) {
    console.error("Failed to set custom DNS:", err);
  }
}

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.DB_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
