import mongoose from "mongoose";
import { ENV } from "./env.js";
import dns from "dns";

if (process.env.FORCE_CUSTOM_DNS === "true") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.log("IPv4 DNS servers set to 8.8.8.8, 1.1.1.1");
  } catch (err) {
    console.error("Failed to set custom DNS:", err);
  }
}

export const connectDB = async () => {
  try {
    // 1. Determine environment status dynamically
    const isProduction = process.env.NODE_ENV === "production";

    // 2. Fall back to DEV string if not running on the live production server
    const dbURI = isProduction ? ENV.DB_URL : ENV.DB_URL_DEV || ENV.DB_URL;

    if (!dbURI) {
      throw new Error(
        "Target Database connection string is missing in environment variables.",
      );
    }

    // 3. Connect using the dynamically chosen string
    const conn = await mongoose.connect(dbURI);

    // Friendly reminder in your terminal so you always know where data is saving
    console.log(
      `🚀 MongoDB Connected to [${isProduction ? "PRODUCTION" : "DEVELOPMENT"}] Host: ${conn.connection.host}`,
    );
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};
