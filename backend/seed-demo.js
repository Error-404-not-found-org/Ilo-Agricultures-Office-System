import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import { User } from "./src/models/user.model.js";
import { Animal } from "./src/models/animal.model.js";
import { Insemination } from "./src/models/insemination.model.js";
import { Pregnancy } from "./src/models/pregnancy.model.js";
import { HealthRequest } from "./src/models/health-request.model.js";
import { Calving } from "./src/models/calving.model.js";

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

console.log("=== DB Seeding Demo Data ===");
console.log(`Connecting to: ${dbURI ? dbURI.replace(/:([^:@]+)@/, ':****@') : 'None'}`);

try {
  await mongoose.connect(dbURI);
  console.log("🚀 Connected to MongoDB successfully!");

  // --- CLEAN UP EXISTING DEMO RECORDS ---
  console.log("🧹 Cleaning up existing DEMO database records...");
  const demoAnimals = await Animal.find({
    $or: [
      { animalId: /^COW-DEMO-/ },
      { brand: "SMART-COW" },
      { earTag: { $in: ["1234", "5678", "9012", "4321", "1235"] } },
      { _id: { $in: ["6a26cf95570ed7df295dd624", "6a26cf97570ed7df295dd63f"] } }
    ]
  });
  
  const demoAnimalIds = demoAnimals.map(a => a._id);
  // Guarantee manual IDs are included in deletion list
  ["6a26cf95570ed7df295dd624", "6a26cf97570ed7df295dd63f"].forEach(id => {
    if (!demoAnimalIds.map(x => x.toString()).includes(id)) {
      demoAnimalIds.push(new mongoose.Types.ObjectId(id));
    }
  });

  // Explicitly delete targets to bypass conditional skip checks
  await Calving.deleteOne({ _id: "6a26cf97570ed7df295dd63e" });
  await Pregnancy.deleteOne({ _id: "6a26cf96570ed7df295dd63c" });

  if (demoAnimalIds.length > 0) {
    const delCalvings = await Calving.deleteMany({
      $or: [
        { animalId: { $in: demoAnimalIds } },
        { "calves.animalId": { $in: demoAnimalIds } }
      ]
    });
    console.log(`Deleted ${delCalvings.deletedCount} calving records.`);

    const delPregnancies = await Pregnancy.deleteMany({
      animalId: { $in: demoAnimalIds }
    });
    console.log(`Deleted ${delPregnancies.deletedCount} pregnancy records.`);

    const delInseminations = await Insemination.deleteMany({
      animalId: { $in: demoAnimalIds }
    });
    console.log(`Deleted ${delInseminations.deletedCount} insemination records.`);

    const delHealth = await HealthRequest.deleteMany({
      animalId: { $in: demoAnimalIds }
    });
    console.log(`Deleted ${delHealth.deletedCount} health requests.`);

    const delAnimals = await Animal.deleteMany({
      _id: { $in: demoAnimalIds }
    });
    console.log(`Deleted ${delAnimals.deletedCount} demo animal records.`);
  } else {
    console.log("No existing demo animals found to clean up.");
  }

  // Find farmer by email "lloydcabanig@gmail.com"
  let farmer = await User.findOne({ email: "lloydcabanig@gmail.com" });
  if (!farmer) {
    console.log("Farmer with email 'lloydcabanig@gmail.com' not found. Searching by name 'Lloyd Cabanig'...");
    farmer = await User.findOne({ name: /Lloyd Cabanig/i });
  }
  if (!farmer) {
    console.log("Farmer not found by name. Searching for any farmer...");
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

  // Create animals
  const animal1 = await Animal.create({
    _id: "6a26cf95570ed7df295dd624",
    farmerId: farmer._id,
    animalId: "COW-DEMO-001",
    earTag: "1234",
    brand: "SMART-COW",
    species: "Dairy Cattle",
    breed: "Holstein Friesian",
    color: "Black & White",
    gender: "Female",
    reproductiveStatus: "Pregnant"
  });
  console.log(`Created Animal 1: ${animal1.animalId}`);

  const animal2 = await Animal.create({
    farmerId: farmer._id,
    animalId: "COW-DEMO-002",
    earTag: "5678",
    brand: "SMART-COW",
    species: "Beef Cattle",
    breed: "Brahman",
    color: "Grey",
    gender: "Female",
    reproductiveStatus: "Inseminated"
  });
  console.log(`Created Animal 2: ${animal2.animalId}`);

  const animal3 = await Animal.create({
    farmerId: farmer._id,
    animalId: "COW-DEMO-003",
    earTag: "9012",
    brand: "SMART-COW",
    species: "Cattle",
    breed: "Angus",
    color: "Solid Black",
    gender: "Female",
    reproductiveStatus: "Normal"
  });
  console.log(`Created Animal 3: ${animal3.animalId}`);

  // Create breeding milestone data

  // 1. Upcoming Calving milestone (Pregnancy with targetCalvingDate in 12 days)
  const ins1 = await Insemination.create({
    farmerId: farmer._id,
    animalId: animal1._id,
    status: "done",
    outcome: "Pregnant",
    sireBreed: "Holstein Friesian",
    sireCode: "HF-909",
    technicianNote: "Artificial insemination successful. Checked via ultrasound.",
    inseminationDate: new Date(Date.now() - 270 * 24 * 60 * 60 * 1000)
  });

  await Pregnancy.create({
    animalId: animal1._id,
    farmerId: farmer._id,
    inseminationId: ins1._id,
    pregnancyDiagnosis: {
      date: new Date(Date.now() - 210 * 24 * 60 * 60 * 1000),
      result: "Pregnant"
    },
    targetCalvingDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // In 12 days
    technicianNote: "Healthy fetus detected. Monitor feeding and gestation cycle."
  });
  console.log("Seeded Upcoming Calving Milestone");

  // 2. Overdue Calving milestone (Pregnancy with targetCalvingDate 4 days overdue)
  const animalOverdue = await Animal.create({
    farmerId: farmer._id,
    animalId: "COW-DEMO-004",
    earTag: "4321",
    brand: "SMART-COW",
    species: "Dairy Cattle",
    breed: "Jersey",
    color: "Fawn",
    gender: "Female",
    reproductiveStatus: "Pregnant"
  });

  const insOverdue = await Insemination.create({
    farmerId: farmer._id,
    animalId: animalOverdue._id,
    status: "done",
    outcome: "Pregnant",
    sireBreed: "Jersey",
    sireCode: "JY-112",
    inseminationDate: new Date(Date.now() - 285 * 24 * 60 * 60 * 1000)
  });

  const pregOverdue = await Pregnancy.create({
    animalId: animalOverdue._id,
    farmerId: farmer._id,
    inseminationId: insOverdue._id,
    pregnancyDiagnosis: {
      date: new Date(Date.now() - 225 * 24 * 60 * 60 * 1000),
      result: "Pregnant"
    },
    targetCalvingDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days overdue
    technicianNote: "Calving slightly delayed. Watch for signs of labor today."
  });
  console.log("Seeded Overdue Calving Milestone");

  // 3. Heat Watch milestone (Insemination 18 days ago, status done, no outcome/isSuccess yet)
  await Insemination.create({
    farmerId: farmer._id,
    animalId: animal2._id,
    status: "done",
    isSuccess: null,
    sireBreed: "Brahman",
    sireCode: "BR-501",
    technicianNote: "Insemination complete. Watch closely for signs of heat around day 21.",
    inseminationDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) // 18 days ago
  });
  console.log("Seeded Heat Watch Milestone");

  // 4. Preg-Check Due milestone (Insemination 45 days ago, status done, no outcome/isSuccess yet)
  await Insemination.create({
    farmerId: farmer._id,
    animalId: animal3._id,
    status: "done",
    isSuccess: null,
    sireBreed: "Angus",
    sireCode: "AN-303",
    technicianNote: "Inseminated. Scheduled pregnancy check due in 60 days.",
    inseminationDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) // 45 days ago
  });
  console.log("Seeded Preg-Check Due Milestone");

  // Seed Activity Feed records (Insemination, Health, Calving)

  // 1. Health Request (Resolved, high urgency)
  await HealthRequest.create({
    farmerId: farmer._id,
    animalId: animal2._id,
    requestType: "disease",
    symptoms: "High fever, nasal discharge, loss of appetite.",
    urgency: "high",
    status: "resolved",
    diagnosis: "Bovine Viral Diarrhea (BVD)",
    treatment: "Hydration therapy and antibacterial course",
    advice: "Isolate in a dry pasture. Feed high-quality hay.",
    technicianNote: "Fever broken. Appetite returning. Monitor vitals daily.",
    preferredDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  });

  // 2. Calving Event (Completed) - Needs its own Pregnancy
  const insCalving = await Insemination.create({
    farmerId: farmer._id,
    animalId: animal1._id,
    status: "done",
    outcome: "Pregnant",
    sireBreed: "Holstein Friesian",
    sireCode: "HF-707",
    inseminationDate: new Date(Date.now() - 290 * 24 * 60 * 60 * 1000)
  });

  const pregForCalving = await Pregnancy.create({
    _id: "6a26cf96570ed7df295dd63c",
    animalId: animal1._id,
    farmerId: farmer._id,
    inseminationId: insCalving._id,
    pregnancyDiagnosis: {
      date: new Date(Date.now() - 230 * 24 * 60 * 60 * 1000),
      result: "Pregnant"
    },
    targetCalvingDate: new Date("2026-05-31T14:20:07.045Z")
  });

  const calfAnimal = await Animal.create({
    _id: "6a26cf97570ed7df295dd63f",
    farmerId: farmer._id,
    animalId: "ANM-DEMO-CF5",
    earTag: "1235",
    motherId: animal1._id,
    species: "Dairy Cattle",
    breed: "Holstein Friesian",
    color: "Black & White",
    gender: "Female",
    birthDate: new Date("2026-05-31T14:20:07.045Z")
  });

  await Calving.create({
    _id: "6a26cf97570ed7df295dd63e",
    farmerId: farmer._id,
    animalId: animal1._id,
    pregnancyId: pregForCalving._id,
    date: new Date("2026-05-31T14:20:07.045Z"),
    numberOfCalves: 1,
    calves: [{
      _id: "6a26cf97570ed7df295dd63f",
      sex: "F",
      earTag: "1235",
      animalId: calfAnimal._id
    }],
    calvingEase: "Normal",
    technicianNote: "Successful unassisted calving. Heifer calf is alert and nursing well.",
    isSeen: true
  });
  
  console.log("🚀 Seeding completed successfully!");
} catch (error) {
  console.error("❌ Error during seeding:", error);
} finally {
  await mongoose.disconnect();
}
