import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import { User } from "./src/models/user.model.js";
import { Animal } from "./src/models/animal.model.js";
import { Insemination } from "./src/models/insemination.model.js";
import { Pregnancy } from "./src/models/pregnancy.model.js";
import { HealthRequest } from "./src/models/health-request.model.js";
import { Calving } from "./src/models/calving.model.js";
import { Notification } from "./src/models/notification.model.js";
import { MedicalRecord } from "./src/models/medical-record.model.js";
import { AuditLog } from "./src/models/audit-log.model.js";
import { AnimalTimelineEvent } from "./src/models/animal-timeline-event.model.js";

dotenv.config();

// Apply custom DNS config if forced
if (process.env.FORCE_CUSTOM_DNS === "true") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    console.log("IPv4 DNS servers set to 8.8.8.8, 1.1.1.1");
  } catch (err) {
    console.error("Failed to set custom DNS:", err);
  }
}

const dbURI = process.env.NODE_ENV === "production" ? process.env.DB_URL : process.env.DB_URL_DEV || process.env.DB_URL;

console.log("=== DB Seeding Advanced Demo Data ===");
console.log(`Connecting to: ${dbURI ? dbURI.replace(/:([^:@]+)@/, ':****@') : 'None'}`);

try {
  await mongoose.connect(dbURI);
  console.log("🚀 Connected to MongoDB successfully!");

  // --- CLEAN UP EXISTING OPERATIONAL RECORDS ---
  console.log("🧹 Cleaning up ALL existing database collections (except Users)...");
  await Calving.deleteMany({});
  await Pregnancy.deleteMany({});
  await Insemination.deleteMany({});
  await HealthRequest.deleteMany({});
  await Animal.deleteMany({});
  await Notification.deleteMany({});
  await MedicalRecord.deleteMany({});
  await AuditLog.deleteMany({});
  await AnimalTimelineEvent.deleteMany({});
  console.log("✨ All operational collections cleaned!");

  // --- RESOLVE OR CREATE FARMER ---
  let farmer = await User.findOne({ email: "lloydcabanig@gmail.com" });
  if (!farmer) {
    farmer = await User.findOne({ name: /Lloyd Cabanig/i });
  }
  if (!farmer) {
    farmer = await User.findOne({ role: "farmer" });
  }
  if (!farmer) {
    farmer = await User.create({
      name: "Lloyd Cabanig",
      email: "lloydcabanig@gmail.com",
      phoneNumber: "09171234567",
      role: "farmer",
      isVerified: true,
      address: {
        barangay: "General Luna",
        city: "Iloilo City",
        province: "Iloilo",
        zipCode: "5000"
      }
    });
    console.log(`Created mock farmer: ${farmer.name}`);
  } else {
    console.log(`Using farmer: ${farmer.name} (${farmer.email}) (${farmer._id})`);
  }

  // --- RESOLVE OR CREATE STAFF (TECHNICIAN/VETERINARIAN) ---
  let technician = await User.findOne({ email: "cabanigjohnlloyd@gmail.com" });
  if (!technician) {
    technician = await User.findOne({ role: "technician" });
  }
  if (!technician) {
    technician = await User.findOne({ role: "veterinarian" });
  }
  if (!technician) {
    technician = await User.findOne({ role: "admin" });
  }
  if (!technician) {
    technician = await User.create({
      name: "Lloyd Cabanig (Tech)",
      email: "cabanigjohnlloyd@gmail.com",
      phoneNumber: "09187654321",
      role: "technician",
      isVerified: true,
      address: {
        barangay: "Poblacion South",
        city: "Oton",
        province: "Iloilo",
        zipCode: "5201"
      }
    });
    console.log(`Created mock technician: ${technician.name}`);
  } else {
    console.log(`Using technician: ${technician.name} (${technician.role}) (${technician._id})`);
  }

  // --- CREATE ANIMALS (LIVESTOCK) ---

  // 1. Animal 1: Normal - Calving drop 10 days ago ( Holstein Friesian )
  const animal1 = await Animal.create({
    farmerId: farmer._id,
    animalId: "ANM-DEMO-001",
    earTag: "1234",
    brand: "SMART-COW",
    species: "Dairy Cattle",
    breed: "Holstein Friesian",
    color: "Black & White",
    gender: "Female",
    reproductiveStatus: "Normal",
    lastCalvingDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  });
  console.log(`Created Animal 1: ${animal1.animalId}`);

  // 2. Animal 2: Inseminated - Insemination 20 days ago ( Brahman )
  const animal2 = await Animal.create({
    farmerId: farmer._id,
    animalId: "ANM-DEMO-002",
    earTag: "5678",
    brand: "SMART-COW",
    species: "Beef Cattle",
    breed: "Brahman",
    color: "Grey",
    gender: "Female",
    reproductiveStatus: "Inseminated"
  });
  console.log(`Created Animal 2: ${animal2.animalId}`);

  // 3. Animal 3: Normal - Ready / Eligible ( Angus )
  const animal3 = await Animal.create({
    farmerId: farmer._id,
    animalId: "ANM-DEMO-003",
    earTag: "9012",
    brand: "SMART-COW",
    species: "Cattle",
    breed: "Angus",
    color: "Solid Black",
    gender: "Female",
    reproductiveStatus: "Normal"
  });
  console.log(`Created Animal 3: ${animal3.animalId}`);

  // 4. Animal 4: Pregnant - Calving due in 100 days ( Jersey )
  const animal4 = await Animal.create({
    farmerId: farmer._id,
    animalId: "ANM-DEMO-004",
    earTag: "4321",
    brand: "SMART-COW",
    species: "Dairy Cattle",
    breed: "Jersey",
    color: "Fawn",
    gender: "Female",
    reproductiveStatus: "Pregnant"
  });
  console.log(`Created Animal 4: ${animal4.animalId}`);

  // 5. Animal 5: In Heat ( Hereford )
  const animal5 = await Animal.create({
    farmerId: farmer._id,
    animalId: "ANM-DEMO-005",
    earTag: "5555",
    brand: "SMART-COW",
    species: "Beef Cattle",
    breed: "Hereford",
    color: "Red & White",
    gender: "Female",
    reproductiveStatus: "In Heat"
  });
  console.log(`Created Animal 5: ${animal5.animalId}`);

  // --- SEED BREEDING & LIFE-CYCLE RECORDS ---

  // Animal 2: Inseminated 20 days ago (Heat Watch)
  await Insemination.create({
    farmerId: farmer._id,
    animalId: animal2._id,
    status: "done",
    isSuccess: null,
    sireBreed: "Brahman",
    sireCode: "BR-501",
    approvedBy: technician._id,
    technicianNote: "Standard insemination. Monitor for heat signs at day 21.",
    inseminationDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
  });

  // Animal 4: Successful AI + Pregnancy -> Due in 100 days
  const ins4 = await Insemination.create({
    farmerId: farmer._id,
    animalId: animal4._id,
    status: "done",
    outcome: "Pregnant",
    sireBreed: "Jersey",
    sireCode: "JY-112",
    approvedBy: technician._id,
    inseminationDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  });

  await Pregnancy.create({
    animalId: animal4._id,
    farmerId: farmer._id,
    inseminationId: ins4._id,
    pregnancyDiagnosis: {
      date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      result: "Pregnant"
    },
    targetCalvingDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), // Due in 100 days
    technicianNote: "Fetus active and gestation normal."
  });

  // --- SEED DISPATCH & OPERATIONAL QUEUES ---

  // 1. AI REQUESTS:

  // AI-1: Pending Request (Farmer submitted, technician needs to Accept/Decline)
  await Insemination.create({
    farmerId: farmer._id,
    animalId: animal5._id,
    status: "pending",
    comment: "Cattle is showing strong standing heat and mounting behavior.",
    heatSigns: ["Standing Heat", "Mucus Discharge"],
    preferredDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    attemptNumber: 1
  });

  // AI-2: Scheduled Request (Assigned and scheduled with a technician)
  await Insemination.create({
    farmerId: farmer._id,
    animalId: animal3._id,
    status: "approved",
    approvedBy: technician._id,
    comment: "Angus cow is in heat. Requesting technician visit.",
    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    attemptNumber: 1
  });

  // AI-3: In-Progress Request (Active visit/task right now)
  await Insemination.create({
    farmerId: farmer._id,
    animalId: animal3._id,
    status: "in-progress",
    approvedBy: technician._id,
    comment: "Timed AI program.",
    scheduledDate: new Date(),
    attemptNumber: 2
  });

  // 2. HEALTH REQUESTS:

  // Health-1: Pending Request (High urgency - nasal discharge)
  await HealthRequest.create({
    farmerId: farmer._id,
    animalId: animal2._id,
    requestType: "disease",
    symptoms: "Lethargy, coughing, nasal discharge.",
    urgency: "high",
    status: "pending",
    preferredDate: new Date()
  });

  // Health-2: In-Progress Request (Limb concern, assigned to current technician)
  await HealthRequest.create({
    farmerId: farmer._id,
    animalId: animal1._id,
    requestType: "injury",
    symptoms: "Cattle is limping and favoring the rear left hoof.",
    urgency: "medium",
    status: "in-progress",
    handledBy: technician._id,
    preferredDate: new Date()
  });

  // Health-3: Resolved Request (Untracked resolved request - treated with 2 days withdrawal)
  const resolvedHealth = await HealthRequest.create({
    farmerId: farmer._id,
    animalId: animal2._id,
    requestType: "disease",
    symptoms: "Fever and loss of appetite.",
    urgency: "medium",
    status: "resolved",
    handledBy: technician._id,
    diagnosis: "Bovine Viral Diarrhea (BVD)",
    treatment: "Penicillin Antibiotics Injection",
    advice: "Isolate from the milking herd.",
    technicianNote: "Fever normalized. Appetite returned. Penicillin administered.",
    preferredDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  });

  // --- CREATE COMPLEMENTARY HISTORICAL LOGS ---

  // 1. Medical record cascading from Resolved Health-3 (with active withdrawal end date)
  const withdrawalDays = 2;
  const withdrawalEndDate = new Date(resolvedHealth.resolvedAt.getTime() + withdrawalDays * 24 * 60 * 60 * 1000);

  await MedicalRecord.create({
    animalId: animal2._id,
    farmerId: farmer._id,
    technicianId: technician._id,
    healthRequestId: resolvedHealth._id,
    type: "Treatment",
    date: resolvedHealth.resolvedAt,
    details: {
      medicineName: "Penicillin",
      diagnosis: resolvedHealth.diagnosis,
      treatment: resolvedHealth.treatment,
      withdrawalPeriodDays: withdrawalDays,
      withdrawalEndDate: withdrawalEndDate
    },
    note: "Administered Penicillin intramuscularly. Advised withdrawal period."
  });

  // 2. Active Withdrawal Alert Notification to the Farmer
  await Notification.create({
    recipientId: farmer._id,
    senderId: technician._id,
    type: "system",
    relatedId: animal2._id,
    title: "⚠️ Active Withdrawal Warning",
    message: `Meat and milk from animal Tag #${animal2.earTag} are unsafe for consumption or sale until ${withdrawalEndDate.toLocaleDateString()} due to treatment with Penicillin.`
  });

  // 3. Past Successful Calving Event
  const pastIns = await Insemination.create({
    farmerId: farmer._id,
    animalId: animal1._id,
    status: "done",
    outcome: "Pregnant",
    sireBreed: "Holstein Friesian",
    sireCode: "HF-331",
    approvedBy: technician._id,
    inseminationDate: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000)
  });

  const pastPreg = await Pregnancy.create({
    animalId: animal1._id,
    farmerId: farmer._id,
    inseminationId: pastIns._id,
    pregnancyDiagnosis: {
      date: new Date(Date.now() - 240 * 24 * 60 * 60 * 1000),
      result: "Pregnant"
    },
    targetCalvingDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  });

  const calf = await Animal.create({
    farmerId: farmer._id,
    animalId: "ANM-DEMO-CLF1",
    earTag: "9999",
    motherId: animal1._id,
    species: "Dairy Cattle",
    breed: "Holstein Friesian",
    color: "Black & White",
    gender: "Female",
    birthDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  });

  await Calving.create({
    animalId: animal1._id,
    farmerId: farmer._id,
    pregnancyId: pastPreg._id,
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    numberOfCalves: 1,
    calves: [{
      sex: "F",
      earTag: "9999",
      animalId: calf._id
    }],
    calvingEase: "Normal",
    technicianNote: "Unassisted birth. Healthy heifer calf, actively nursing."
  });

  console.log("🚀 Seeding completed successfully! All logics and workflows mapped.");
} catch (error) {
  console.error("❌ Error during seeding:", error);
} finally {
  await mongoose.disconnect();
}
