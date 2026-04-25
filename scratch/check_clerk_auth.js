import { clerkMiddleware } from "@clerk/express";
import express from "express";

const app = express();
app.use(clerkMiddleware());
app.get("/test", (req, res) => {
  console.log("req.auth type:", typeof req.auth);
  res.send("ok");
});

const server = app.listen(3001, () => {
  console.log("Test server running on 3001");
  process.exit(0);
});
