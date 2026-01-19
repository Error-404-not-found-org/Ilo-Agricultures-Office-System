import express from "express";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";

const app = express();

const __dirname = path.resolve();

app.use(clerkMiddleware()); // add auth object under req.auth

const PORT = process.env.PORT || 5000;

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

app.listen(ENV.PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});
