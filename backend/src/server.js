import express from "express";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import cors from "cors";

import { inngest, functions } from "./config/inngest.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

import adminRoutes from "./routes/admin.routes.js";
import technicianRoutes from "./routes/technician.routes.js";
import inseminationRoutes from "./routes/insemination.routes.js";
import animalRoutes from "./routes/animals.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();
app.set("trust proxy", 1); // For Clerk Invalid URL when behind proxy

const __dirname = path.resolve();

app.use(express.json());
app.use(clerkMiddleware()); // add auth object under req.auth
app.use(
  cors({
    origin: [
      ENV.CLIENT_URL,
      "http://localhost:5173",
      "http://192.168.1.47:8081", // 📱 your phone (Expo)
      "http://192.168.1.32:8081", // 💻 your PC
      "http://localhost:8081",
    ],
    credentials: true,
  }),
);

app.use("/api/inngest", serve({ client: inngest, functions }));

app.use("/api/admin", adminRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/insemination", inseminationRoutes);
app.use("/api/animals", animalRoutes);
app.use("/api/user", userRoutes);

const PORT = process.env.PORT || 3000;

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../admin/dist")));
  app.get("/{*any}", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../admin", "dist", "index.html"));
  });
}

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, "0.0.0.0", () => {
    console.log(`Server is up and running on port ${ENV.PORT}`);
  });
};

startServer();
