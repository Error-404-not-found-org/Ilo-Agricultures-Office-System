import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

if (process.env.FORCE_CUSTOM_DNS === "true") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (err) {}
}

const mongoURI = process.env.DB_URL_DEV || process.env.DB_URL;

const InseminationSchema = new mongoose.Schema({}, { strict: false });
const Insemination = mongoose.model("Insemination", InseminationSchema, "inseminations");

async function run() {
  await mongoose.connect(mongoURI);
  console.log("Connected!");

  const records = await Insemination.find({ status: "done" }).lean();
  for (const r of records) {
    console.log(`Document: ${r._id}`);
    console.log(`- has inseminationDate: ${r.inseminationDate !== undefined} (type: ${typeof r.inseminationDate}, val: ${r.inseminationDate})`);
    console.log(`- has createdAt: ${r.createdAt !== undefined} (type: ${typeof r.createdAt}, val: ${r.createdAt})`);
    console.log(`- has isSuccess: ${r.isSuccess !== undefined} (val: ${r.isSuccess})`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
