import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { User } from "../src/models/user.model.js";
import { findMunicipalityByText } from "../src/domain/geographic/psgcRegistry.js";

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const isApply = args.includes("--apply");

async function migrateProfiles() {
  if (!isApply) {
    console.log("=== DRY RUN MODE: No database changes will be made ===");
    console.log("Run with --apply to execute changes.\n");
  } else {
    console.log("=== APPLY MODE: Database will be updated ===");
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const technicians = await User.find({ role: { $in: ["technician", "veterinarian"] } });
    console.log(`Found ${technicians.length} technicians/veterinarians to process.`);

    let processedCount = 0;
    let unresolvedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const tech of technicians) {
      const city = tech.address?.city;
      const municipality = tech.address?.municipality;
      const province = tech.address?.province || "Iloilo";

      let legacyName = city || municipality;
      
      // If no legacy name, we can't suggest
      if (!legacyName) {
        console.warn(`[UNRESOLVED] Technician ${tech._id} (${tech.name}) has no legacy city/municipality.`);
        unresolvedCount++;
        continue;
      }

      const match = findMunicipalityByText(legacyName, province);
      
      if (!match) {
        console.warn(`[UNRESOLVED] Technician ${tech._id} (${tech.name}) legacy address '${legacyName}' could not be matched in PSGC.`);
        unresolvedCount++;
        continue;
      }

      // Check if already has fallback or official
      const hasOfficial = tech.dispatchProfile?.serviceMunicipalities?.some(m => m.municipalityCode === match.code);
      const hasFallback = tech.dispatchProfile?.legacyCoverageFallback?.municipalityCode === match.code;

      if (hasOfficial || hasFallback) {
        skippedCount++;
        continue;
      }

      console.log(`[SUGGESTION] Technician ${tech._id} (${tech.name}): Legacy address '${legacyName}' maps to ${match.name} (${match.code})`);

      if (isApply) {
        if (!tech.dispatchProfile) {
          tech.dispatchProfile = {
            availabilityStatus: "off_duty",
            acceptsNewRequests: false,
            profileVersion: 1,
          };
        }
        
        tech.dispatchProfile.legacyCoverageFallback = {
          municipalityCode: match.code,
          municipalityName: match.name,
          source: "legacy_address_fallback",
          requiresAdminConfirmation: true,
        };
        
        await tech.save();
        updatedCount++;
      } else {
        processedCount++;
      }
    }

    console.log("\n=== MIGRATION SUMMARY ===");
    console.log(`Total Processed (Dry Run): ${processedCount}`);
    console.log(`Total Updated: ${updatedCount}`);
    console.log(`Total Skipped (Already set): ${skippedCount}`);
    console.log(`Total Unresolved: ${unresolvedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateProfiles();
