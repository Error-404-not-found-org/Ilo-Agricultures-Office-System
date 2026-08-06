import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { User } from "../src/models/user.model.js";
import { resolveRequestLocation } from "../src/domain/geographic/municipalityResolver.js";

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const isApply = args.includes("--apply");

async function migrateSnapshots() {
  if (!isApply) {
    console.log("=== DRY RUN MODE: No database changes will be made ===");
    console.log("Run with --apply to execute changes.\n");
  } else {
    console.log("=== APPLY MODE: Database will be updated ===");
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const activeStatuses = ["pending", "assigned", "scheduled", "in-progress", "in_progress", "triaged"];
    
    // Find active requests without a dispatch snapshot
    const aiRequests = await Insemination.find({ 
      status: { $in: activeStatuses },
      dispatch: { $exists: false },
      deletedAt: null
    }).populate("farmerId");
    
    const healthRequests = await HealthRequest.find({
      status: { $in: activeStatuses },
      dispatch: { $exists: false },
      deletedAt: null
    }).populate("farmerId");

    console.log(`Found ${aiRequests.length} active AI requests to migrate.`);
    console.log(`Found ${healthRequests.length} active Health requests to migrate.`);

    let processedCount = 0;
    let unresolvedCount = 0;
    let updatedCount = 0;

    const processRequest = async (request, modelName) => {
      const farmer = request.farmerId;
      if (!farmer) {
        console.warn(`[UNRESOLVED] ${modelName} ${request._id} has no populated farmer.`);
        unresolvedCount++;
        return;
      }

      const dispatchLocation = resolveRequestLocation(farmer);
      const isUnresolved = dispatchLocation.source === "unresolved";

      if (isUnresolved) {
        console.warn(`[UNRESOLVED] ${modelName} ${request._id} location could not be resolved from Farmer ${farmer._id}.`);
        unresolvedCount++;
      }

      console.log(`[PROCESS] ${modelName} ${request._id} -> ${dispatchLocation.municipalityName || 'Unresolved'} (${dispatchLocation.source})`);

      if (isApply) {
        request.dispatch = {
          location: dispatchLocation,
          stage: "local",
          resolutionStatus: isUnresolved ? "unresolved" : "legacy_fallback",
          version: 1,
          resolvedAt: new Date(),
        };
        await request.save();
        updatedCount++;
      } else {
        processedCount++;
      }
    };

    for (const req of aiRequests) {
      await processRequest(req, "AI");
    }

    for (const req of healthRequests) {
      await processRequest(req, "Health");
    }

    console.log("\n=== MIGRATION SUMMARY ===");
    console.log(`Total Processed (Dry Run): ${processedCount}`);
    console.log(`Total Updated: ${updatedCount}`);
    console.log(`Total Unresolved: ${unresolvedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateSnapshots();
