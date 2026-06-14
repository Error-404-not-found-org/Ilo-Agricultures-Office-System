import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/ilo-agriculture";

// Schemas
const InseminationSchema = new mongoose.Schema({}, { strict: false });
const Insemination = mongoose.model("Insemination", InseminationSchema, "inseminations");

async function run() {
  console.log("Connecting to:", mongoURI);
  await mongoose.connect(mongoURI);
  console.log("Connected!");

  const records = await Insemination.find({ status: "done" }).lean();
  console.log(`Found ${records.length} completed insemination records:`);
  
  for (const r of records) {
    console.log(`ID: ${r._id} | createdAt: ${r.createdAt} | inseminationDate: ${r.inseminationDate} | isSuccess: ${r.isSuccess}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
