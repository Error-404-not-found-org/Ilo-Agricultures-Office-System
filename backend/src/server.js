import express from "express";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";

import { inngest, functions } from "./config/inngest.js";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

import adminRoutes from "./routes/admin.routes.js";
import technicianRoutes from "./routes/technician.routes.js";
import inseminationRoutes from "./routes/insemination.routes.js";
import animalRoutes from "./routes/animal.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

const __dirname = path.resolve();

app.use(express.json());
app.use(clerkMiddleware()); // add auth object under req.auth

app.use("/api/inngest", serve({ client: inngest, functions }));

app.use("/api/admin", adminRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/insemination", inseminationRoutes);
app.use("/api/animal", animalRoutes);
app.use("/api/user", userRoutes);

const PORT = process.env.PORT || 3000;

app.get("/homepage", (req, res) => {
  res.send("Hello World!");
});

//make our app ready

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../admin/dist")));
  app.get("/{*any}", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../admin", "build", "index.html"));
  });
}

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`Server is up and running`);
  });
};

startServer();
