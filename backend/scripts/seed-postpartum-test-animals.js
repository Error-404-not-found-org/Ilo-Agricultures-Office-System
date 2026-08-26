/**
 * Development-only postpartum eligibility fixtures.
 *
 * Dry run:
 *   npm run seed:postpartum-test -- --farmerEmail=farmer@example.test
 * Execute against DB_URL_DEV only:
 *   npm run seed:postpartum-test -- --farmerEmail=farmer@example.test --execute
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { ENV } from "../src/config/env.js";
import { configureCustomDns } from "../src/config/custom-dns.js";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { getBreedProfile } from "../src/utils/cattleCore.js";
import { getReproductionEligibility } from "../src/domain/reproduction-lifecycle.js";

export const POSTPARTUM_TEST_IDENTIFIERS = Object.freeze({
  RECOVERING: "POSTPARTUM_RECOVERING",
  RECOVERY_COMPLETE: "POSTPARTUM_RECOVERY_COMPLETE",
});

const DAY_MS = 86_400_000;
const PRODUCTION_DATABASE_NAMES = new Set([
  "IloIlo-BreedSmart-DB2",
  "IloIlo-BreeedSmart-DB2",
]);

const addDays = (date, days) =>
  new Date(new Date(date).getTime() + days * DAY_MS);

const adultBirthDate = (now) => {
  const result = new Date(now);
  result.setUTCFullYear(result.getUTCFullYear() - 4);
  return result;
};

export const buildPostpartumTestAnimals = ({ farmerId, now = new Date() }) => {
  if (!farmerId) throw new Error("A Farmer ID is required for seed ownership.");

  const species = "Cattle";
  const breed = "Brahman";
  const { voluntaryWaitingPeriodDays } = getBreedProfile(species, breed);
  const shared = {
    farmerId,
    species,
    breed,
    gender: "Female",
    birthDate: adultBirthDate(now),
    reproductiveStatus: "Post-partum",
    parity: 1,
    isVerified: true,
    color: "Development test fixture",
    deletedAt: null,
  };

  return [
    {
      ...shared,
      _id: new mongoose.Types.ObjectId(),
      animalId: `DEV-${POSTPARTUM_TEST_IDENTIFIERS.RECOVERING}`,
      earTag: "DEV-PP-RECOVERING",
      lastCalvingDate: addDays(now, -10),
      activityLogs: [{
        event: "Development Seed",
        date: now,
        description: "POSTPARTUM_RECOVERING test animal; AI must remain blocked during recovery.",
      }],
    },
    {
      ...shared,
      _id: new mongoose.Types.ObjectId(),
      animalId: `DEV-${POSTPARTUM_TEST_IDENTIFIERS.RECOVERY_COMPLETE}`,
      earTag: "DEV-PP-RECOVERY-COMPLETE",
      lastCalvingDate: addDays(now, -(voluntaryWaitingPeriodDays + 5)),
      activityLogs: [{
        event: "Development Seed",
        date: now,
        description: "POSTPARTUM_RECOVERY_COMPLETE test animal; effective status must be Normal, never In Heat.",
      }],
    },
  ];
};

export const validatePostpartumTestAnimals = (animals, now = new Date()) => {
  const [recovering, recovered] = animals;
  const recoveringEligibility = getReproductionEligibility({
    animal: recovering,
    now,
  });
  const recoveredEligibility = getReproductionEligibility({
    animal: recovered,
    now,
  });

  if (
    recoveringEligibility.code !== "POSTPARTUM_RECOVERY" ||
    recoveredEligibility.eligible !== true ||
    recoveredEligibility.effectiveReproductiveStatus !== "Normal" ||
    recoveredEligibility.effectiveReproductiveStatus === "In Heat"
  ) {
    throw new Error("Postpartum seed fixtures do not match lifecycle expectations.");
  }

  return { recoveringEligibility, recoveredEligibility };
};

export const parsePostpartumSeedArgs = (argv = process.argv.slice(2)) => ({
  farmerEmail: String(
    argv.find((arg) => arg.startsWith("--farmerEmail="))?.slice(14) || "",
  ).trim().toLowerCase(),
  execute: argv.includes("--execute"),
});

export const assertPostpartumSeedEnvironment = () => {
  if (String(process.env.NODE_ENV || "development").toLowerCase() === "production") {
    throw new Error("Refusing to seed when NODE_ENV=production.");
  }
  if (!ENV.DB_URL_DEV) {
    throw new Error("DB_URL_DEV is required; this seed never falls back to DB_URL.");
  }
};

export const runPostpartumSeedCli = async (argv = process.argv.slice(2)) => {
  const args = parsePostpartumSeedArgs(argv);
  if (!args.farmerEmail) throw new Error("--farmerEmail is required.");
  assertPostpartumSeedEnvironment();

  configureCustomDns();
  const connection = await mongoose.connect(ENV.DB_URL_DEV, { autoIndex: false });
  try {
    const databaseName = connection.connection.name;
    if (PRODUCTION_DATABASE_NAMES.has(databaseName) || /prod/i.test(databaseName)) {
      throw new Error(`Refusing production-like database: ${databaseName}`);
    }

    const farmer = await User.findOne({
      email: args.farmerEmail,
      role: "farmer",
      deletedAt: null,
    }).select("_id email");
    if (!farmer) throw new Error(`Active Farmer not found: ${args.farmerEmail}`);

    const now = new Date();
    const animals = buildPostpartumTestAnimals({ farmerId: farmer._id, now });
    const eligibility = validatePostpartumTestAnimals(animals, now);
    const identifiers = animals.map((animal) => animal.animalId);
    const existing = await Animal.findOne({
      farmerId: farmer._id,
      animalId: { $in: identifiers },
      deletedAt: null,
    }).select("animalId");
    if (existing) {
      throw new Error(`Postpartum test animal already exists: ${existing.animalId}`);
    }

    console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY RUN"}`);
    console.log(`Development database: ${databaseName}`);
    console.table(animals.map((animal, index) => ({
      animalId: animal.animalId,
      earTag: animal.earTag,
      storedStatus: animal.reproductiveStatus,
      lastCalvingDate: animal.lastCalvingDate.toISOString(),
      eligibilityCode: index === 0
        ? eligibility.recoveringEligibility.code
        : eligibility.recoveredEligibility.code,
      effectiveStatus: index === 0
        ? eligibility.recoveringEligibility.effectiveReproductiveStatus
        : eligibility.recoveredEligibility.effectiveReproductiveStatus,
    })));

    if (!args.execute) {
      console.log("Dry run complete. No documents were written.");
      return { dryRun: true, animals };
    }

    const inserted = await Animal.insertMany(animals, { ordered: true });
    console.log(`Inserted ${inserted.length} development postpartum test animals.`);
    return { dryRun: false, animals: inserted };
  } finally {
    await mongoose.disconnect();
  }
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runPostpartumSeedCli().catch((error) => {
    console.error(`Postpartum seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}
