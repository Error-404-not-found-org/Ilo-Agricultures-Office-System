import { MongoClient } from "mongodb";
import { ENV } from "../src/config/env.js";

const isProduction = process.env.NODE_ENV === "production";
const uri = isProduction ? ENV.DB_URL : ENV.DB_URL_DEV || ENV.DB_URL;

if (!uri) throw new Error("Database connection string is missing.");

const client = new MongoClient(uri);
try {
  await client.connect();
  const duplicates = await client.db().collection("animals").aggregate([
    { $match: { deletedAt: null, earTag: { $type: "string" } } },
    { $project: {
      farmerId: 1,
      earTag: 1,
      normalizedEarTag: { $toLower: { $trim: { input: "$earTag" } } },
    } },
    { $match: { normalizedEarTag: { $ne: "" } } },
    { $group: {
      _id: { farmerId: "$farmerId", normalizedEarTag: "$normalizedEarTag" },
      count: { $sum: 1 },
      animals: { $push: { _id: "$_id", earTag: "$earTag" } },
    } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  console.log(JSON.stringify({ duplicateGroupCount: duplicates.length, duplicates }, null, 2));
  if (duplicates.length) process.exitCode = 2;
} finally {
  await client.close();
}
