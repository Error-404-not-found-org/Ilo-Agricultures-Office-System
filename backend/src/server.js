import express from "express";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

import { inngest, functions } from "./config/inngest.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

import adminRoutes from "./routes/admin.routes.js";
import technicianRoutes from "./routes/technician.routes.js";
import inseminationRoutes from "./routes/insemination.routes.js";
import animalRoutes from "./routes/animals.routes.js";
import userRoutes from "./routes/user.routes.js";
import aiRequestRoutes from "./routes/ai-request.routes.js";
import healthRequestRoutes from "./routes/health-request.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import configRoutes from "./routes/config.routes.js";

const app = express();
app.set("trust proxy", 1); // For Clerk Invalid URL when behind proxy

// ─── Rate Limiting ──────────────────────────────────────────────────────────
// General rate limiter: 2000 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again after 15 minutes." }
});

const __dirname = path.resolve();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(clerkMiddleware()); // add auth object under req.auth
app.use(
  cors({
    // React Native ignores CORS — this only affects web clients.
    // In dev: accept any origin. In prod: lock to CLIENT_URL.
    origin: ENV.NODE_ENV === "production" ? ENV.CLIENT_URL : true,
    credentials: true,
  }),
);

app.use("/api/inngest", serve({ client: inngest, functions }));

// Strict request limiter moved to specific routes.
app.use("/api", generalLimiter); // Apply general limiter to all /api routes

app.use("/api/admin", adminRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/insemination", inseminationRoutes);
app.use("/api/animals", animalRoutes);
app.use("/api/user", userRoutes);
app.use("/api/ai-request", aiRequestRoutes);
app.use("/api/health-request", healthRequestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/config", configRoutes);

const PORT = process.env.PORT || 3000;

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../web/dist")));
  app.get("/{*any}", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../web", "dist", "index.html"));
  });
}

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, "0.0.0.0", () => {
    console.log(`Server is up and running on port ${ENV.PORT}`);
  });
};

startServer();
