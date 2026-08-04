import mongoose from "mongoose";
import { ENV } from "./env.js";
import { configureCustomDns } from "./custom-dns.js";

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
    // Production indexes are deployed explicitly after duplicate audits and backfills.
    configureCustomDns();
    const conn = await mongoose.connect(dbURI, { autoIndex: !isProduction });

    // Friendly reminder in your terminal so you always know where data is saving
    console.log(
      `🚀 MongoDB Connected to [${isProduction ? "PRODUCTION" : "DEVELOPMENT"}] Host: ${conn.connection.host}`,
    );
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};
