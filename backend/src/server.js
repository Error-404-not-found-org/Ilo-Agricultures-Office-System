import express from "express";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
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
import medicalRoutes from "./routes/medical.routes.js";
import reportRoutes from "./routes/report.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import moowieRoutes from "./routes/moowie.routes.js";
import gisRoutes from "./routes/gis.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";

const app = express();
const httpServer = createServer(app);

// Setup dynamic allowed origins for CORS
const allowedOrigins = [
  "https://breedsmartoton.site",
  "https://www.breedsmartoton.site",
];

if (ENV.CLIENT_URL) {
  let clientUrl = ENV.CLIENT_URL.trim();
  // If the user forgot to add the protocol, normalize it
  if (!/^https?:\/\//i.test(clientUrl)) {
    clientUrl = `https://${clientUrl}`;
  }
  allowedOrigins.push(clientUrl);
  try {
    const parsed = new URL(clientUrl);
    const host = parsed.hostname;
    if (host.startsWith("www.")) {
      allowedOrigins.push(`${parsed.protocol}//${host.replace(/^www\./, "")}`);
    } else {
      allowedOrigins.push(`${parsed.protocol}//www.${host}`);
    }
  } catch (e) {
    // ignore invalid URL parsing
  }
}

const uniqueOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if the origin matches our allowed list
    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check if the origin is a subdomain of breedsmartoton.site
    try {
      const parsedOrigin = new URL(origin);
      if (
        parsedOrigin.hostname === "breedsmartoton.site" ||
        parsedOrigin.hostname.endsWith(".breedsmartoton.site")
      ) {
        return callback(null, true);
      }
    } catch (e) {
      // ignore parsing error
    }
    
    // In non-production, allow all
    if (ENV.NODE_ENV !== "production") {
      return callback(null, true);
    }
    
    // Otherwise deny
    console.warn(`[CORS Blocked] Request origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

// Attach io to app to be accessible in controllers
app.set("io", io);

app.set("trust proxy", 1); // For Clerk Invalid URL when behind proxy

// ─── Rate Limiting ──────────────────────────────────────────────────────────
// General rate limiter: 2000 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});

const __dirname = path.resolve();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(clerkMiddleware()); // add auth object under req.auth
app.use(cors(corsOptions));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

app.use("/api/inngest", serve({ client: inngest, functions }));

// Strict request limiter moved to specific routes.
// app.use("/api", generalLimiter); // Apply general limiter to all /api routes

app.use("/api/admin", adminRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/insemination", inseminationRoutes);
app.use("/api/animals", animalRoutes);
app.use("/api/user", userRoutes);
app.use("/api/ai-request", aiRequestRoutes);
app.use("/api/health-request", healthRequestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/config", configRoutes);
app.use("/api/medical", medicalRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/moowie", moowieRoutes);
app.use("/api/gis", gisRoutes);
app.use("/api/tasks", tasksRoutes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
// MUST be defined after all routes. Catches any unhandled error from middleware
// (e.g., Clerk requireAuth() crashes) and sends a proper JSON response
// instead of silently closing the TCP connection (which Axios sees as "Network Error").
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error(
    `[Global Error Handler] ${req.method} ${req.path} →`,
    err.message || err,
  );
  res.status(status).json({
    message: err.message || "An unexpected server error occurred.",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 3000;

// Serve a simple root response for API service health check
app.get("/", (req, res) => {
  res.json({ message: "Oton Agriculture Office API is running." });
});

// Socket.io connection logging
io.on("connection", (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

const startServer = async () => {
  await connectDB();
  httpServer.listen(ENV.PORT, "0.0.0.0", () => {
    console.log(`Server is up and running on port ${ENV.PORT}`);
  });
};

startServer();
