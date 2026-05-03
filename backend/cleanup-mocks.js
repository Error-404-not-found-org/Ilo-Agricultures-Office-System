import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './src/models/user.model.js';
import { Animal } from './src/models/animal.model.js';
import { Insemination } from './src/models/insemination.model.js';
import { Pregnancy } from './src/models/pregnancy.model.js';
import { Calving } from './src/models/calving.model.js';
import dns from "dns";

dotenv.config();

if (process.env.FORCE_CUSTOM_DNS === 'true' || true) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log("IPv4 DNS servers set to 8.8.8.8, 1.1.1.1");
  } catch (err) {
    console.error("Failed to set custom DNS:", err);
  }
}

const run = async () => {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB");

    // 1. Find all "MOCK" or "LAB" or "PRG" tagged animals created by the script
    const mockAnimals = await Animal.find({
        $or: [
            { animalId: /MOCK/i },
            { earTag: /^PRG-/ },
            { earTag: /^LAB-/ },
            { animalId: /^CALF-/ }
        ]
    });

    console.log(`Found ${mockAnimals.length} mock animals to delete.`);

    for (const animal of mockAnimals) {
        await Insemination.deleteMany({ animalId: animal._id });
        await Pregnancy.deleteMany({ animalId: animal._id });
        await Calving.deleteMany({ animalId: animal._id });
        await Animal.findByIdAndDelete(animal._id);
        console.log(`Deleted animal and records: ${animal.earTag} (${animal.animalId})`);
    }

    // 2. Fix the "Pregnant" but no history animal (Tag 109) if it still exists
    const tag109 = await Animal.findOne({ earTag: "109" });
    if (tag109) {
        console.log("Cleaning up Tag 109...");
        await Insemination.deleteMany({ animalId: tag109._id });
        await Pregnancy.deleteMany({ animalId: tag109._id });
        await Calving.deleteMany({ animalId: tag109._id });
        
        tag109.reproductiveStatus = "Normal";
        await tag109.save();
        console.log("Reset Tag 109 to Normal status.");
    }

    console.log("Cleanup complete.");
    process.exit();
};

run().catch(console.error);
