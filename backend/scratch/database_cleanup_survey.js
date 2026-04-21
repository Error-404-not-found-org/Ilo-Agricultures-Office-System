import mongoose from 'mongoose';
import { ENV } from '../src/config/env.js';
import { User } from '../src/models/user.model.js';
import { Animal } from '../src/models/animal.model.js';
import { Insemination } from '../src/models/insemination.model.js';
import { HealthRequest } from '../src/models/health-request.model.js';
import { AIRequest } from '../src/models/ai-request.model.js';
import { Pregnancy } from '../src/models/pregnancy.model.js';
import { Calving } from '../src/models/calving.model.js';

async function survey() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(ENV.DB_URL);
        console.log("Connected.\n");

        // 1. ORPHAN ANIMALS
        console.log("Scanning for Orphan Animals...");
        const allAnimals = await Animal.find({});
        const orphanAnimals = [];
        
        for (const animal of allAnimals) {
            const owner = await User.findById(animal.farmerId);
            if (!owner) {
                orphanAnimals.push({
                    id: animal._id,
                    earTag: animal.earTag,
                    breed: animal.breed,
                    orphanReason: animal.farmerId ? "Owner ID Invalid" : "No Owner Assigned"
                });
            }
        }
        
        console.log(`Found ${orphanAnimals.length} orphan animals.`);

        // 2. INACTIVE FARMERS
        console.log("\nScanning for Inactive Farmers...");
        const farmers = await User.find({ role: 'farmer' });
        const inactiveFarmers = [];

        for (const farmer of farmers) {
            const checks = await Promise.all([
                Animal.countDocuments({ farmerId: farmer._id }),
                Insemination.countDocuments({ farmerId: farmer._id }),
                HealthRequest.countDocuments({ farmerId: farmer._id }),
                AIRequest.countDocuments({ farmerId: farmer._id }),
                Pregnancy.countDocuments({ farmerId: farmer._id }),
                Calving.countDocuments({ farmerId: farmer._id })
            ]);

            const [animalCount, insemCount, healthCount, aiCount, pregCount, calvCount] = checks;
            const totalActivity = animalCount + insemCount + healthCount + aiCount + pregCount + calvCount;

            if (totalActivity === 0) {
                inactiveFarmers.push({
                    id: farmer._id,
                    name: farmer.name,
                    email: farmer.email
                });
            }
        }

        console.log(`Found ${inactiveFarmers.length} inactive farmers.`);

        console.log("\nSUMMARY:");
        console.log("====================================");
        console.log("Orphan Animals To Delete:", orphanAnimals.length);
        console.log("Inactive Farmers To Delete:", inactiveFarmers.length);
        console.log("====================================");

        if (orphanAnimals.length > 0) {
            console.log("\nSample Orphan Animals:");
            orphanAnimals.slice(0, 5).forEach(a => console.log(`- ${a.earTag || "No-Tag"} (${a.breed}): ${a.orphanReason}`));
        }

        if (inactiveFarmers.length > 0) {
            console.log("\nSample Inactive Farmers:");
            inactiveFarmers.slice(0, 5).forEach(f => console.log(`- ${f.name} (${f.email || "No Email"})`));
        }

        process.exit(0);
    } catch (err) {
        console.error("Survey Failed:", err);
        process.exit(1);
    }
}

survey();
