import mongoose from "mongoose";
import dotenv from "dotenv";
import { Insemination } from "./backend/src/models/insemination.model.js";
import { Pregnancy } from "./backend/src/models/pregnancy.model.js";
import { Calving } from "./backend/src/models/calving.model.js";

dotenv.config({ path: "./backend/.env" });

const purgeOrphans = async () => {
  try {
    console.log("🚀 Starting Ghost Data Purge...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Find all pregnancies
    const pregnancies = await Pregnancy.find().lean();
    console.log(`📊 Checking ${pregnancies.length} pregnancy records...`);

    let purgedCount = 0;
    let calvingPurgedCount = 0;

    for (const preg of pregnancies) {
      // Check if parent insemination exists
      const parentExists = await Insemination.exists({ _id: preg.inseminationId });
      
      if (!parentExists) {
        console.log(`⚠️ Orphan found: Pregnancy ${preg._id} (Parent AI ${preg.inseminationId} is missing)`);
        
        // Delete linked calvings first
        const calvingResult = await Calving.deleteMany({ pregnancyId: preg._id });
        calvingPurgedCount += calvingResult.deletedCount;

        // Delete the orphaned pregnancy
        await Pregnancy.findByIdAndDelete(preg._id);
        purgedCount++;
      }
    }

    console.log("\n✨ PURGE COMPLETE ✨");
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🗑️ Orphaned Pregnancies Deleted: ${purgedCount}`);
    console.log(`👶 Orphaned Calvings Deleted:    ${calvingPurgedCount}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Purge Failed:", error);
    process.exit(1);
  }
};

purgeOrphans();
