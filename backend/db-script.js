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

    // Find Lloyd Cabanig
    const lloyd = await User.findOne({ name: /Lloyd Cabanig/i, role: "farmer" });
    if (!lloyd) {
        console.log("Farmer Lloyd Cabanig not found.");
        process.exit();
    }
    console.log("Found Lloyd Cabanig: ", lloyd._id);

    // Find Technician
    const tech = await User.findOne({ role: "technician" });

    // Find TAG 20
    const tag20 = await Animal.findOne({ earTag: "20", farmerId: lloyd._id });
    if (tag20) {
        console.log("Found TAG 20: ", tag20._id);
        const delInsem = await Insemination.deleteMany({ animalId: tag20._id });
        console.log("Deleted inseminations for TAG 20:", delInsem.deletedCount);
        const delPreg = await Pregnancy.deleteMany({ animalId: tag20._id });
        console.log("Deleted pregnancies for TAG 20:", delPreg.deletedCount);
        const delCalv = await Calving.deleteMany({ animalId: tag20._id });
        console.log("Deleted calvings for TAG 20:", delCalv.deletedCount);
        
        tag20.reproductiveStatus = "Normal";
        await tag20.save();
        console.log("Reset TAG 20 reproductive status to Normal");
    }

    console.log("Looking for other animals...");
    const otherAnimals = await Animal.find({ farmerId: lloyd._id, earTag: { $ne: "20" } }).limit(2);
    console.log(`Found ${otherAnimals.length} other animals`);
    
    let pregnantAnimal = otherAnimals[0];
    let laboredAnimal = otherAnimals[1];

    if (!pregnantAnimal) {
        pregnantAnimal = await Animal.create({
            farmerId: lloyd._id,
            animalId: `MOCK-PREG-${Date.now().toString().slice(-4)}`,
            earTag: `PRG-${Date.now().toString().slice(-3)}`,
            species: "Beef",
            breed: "Brahman",
            gender: "Female"
        });
        console.log(`Created new dummy animal for pregnancy: ${pregnantAnimal.earTag}`);
    }

    if (!laboredAnimal) {
        laboredAnimal = await Animal.create({
            farmerId: lloyd._id,
            animalId: `MOCK-LAB-${Date.now().toString().slice(-4)}`,
            earTag: `LAB-${Date.now().toString().slice(-3)}`,
            species: "Beef",
            breed: "Angus",
            gender: "Female"
        });
        console.log(`Created new dummy animal for labor: ${laboredAnimal.earTag}`);
    }

    console.log(`Setting up pregnant animal: ${pregnantAnimal.earTag}`);
        await Insemination.deleteMany({ animalId: pregnantAnimal._id });
        await Pregnancy.deleteMany({ animalId: pregnantAnimal._id });
        
        const pregInsem = await Insemination.create({
            farmerId: lloyd._id,
            animalId: pregnantAnimal._id,
            technicianId: tech ? tech._id : lloyd._id, 
            sireBreed: "Brahman Bull",
            status: "done",
            inseminationDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
        });

        const targetCalvingDate = new Date(pregInsem.inseminationDate);
        targetCalvingDate.setDate(targetCalvingDate.getDate() + 283); // ~283 days gestation

        await Pregnancy.create({
            animalId: pregnantAnimal._id,
            farmerId: lloyd._id,
            inseminationId: pregInsem._id,
            pregnancyDiagnosis: {
                date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                result: "Pregnant"
            },
            targetCalvingDate: targetCalvingDate
        });

        pregnantAnimal.reproductiveStatus = "Pregnant";
        await pregnantAnimal.save();
        console.log(`Made ${pregnantAnimal.earTag} Pregnant`);

        console.log(`Setting up labored animal: ${laboredAnimal.earTag}`);
        // Setup Labored Animal
        await Insemination.deleteMany({ animalId: laboredAnimal._id });
        await Pregnancy.deleteMany({ animalId: laboredAnimal._id });
        await Calving.deleteMany({ animalId: laboredAnimal._id });
        
        for(let i=0; i<2; i++) {
            const insem = await Insemination.create({
                farmerId: lloyd._id,
                animalId: laboredAnimal._id,
                technicianId: tech ? tech._id : lloyd._id, 
                sireBreed: i===0 ? "Angus" : "Holstein",
                status: "done",
                inseminationDate: new Date(Date.now() - (365 * (i+1) + 283) * 24 * 60 * 60 * 1000)
            });

            const preg = await Pregnancy.create({
                animalId: laboredAnimal._id,
                farmerId: lloyd._id,
                inseminationId: insem._id,
                pregnancyDiagnosis: {
                    date: new Date(insem.inseminationDate.getTime() + 60 * 24 * 60 * 60 * 1000),
                    result: "Pregnant"
                }
            });

            const calvDate = new Date(insem.inseminationDate.getTime() + 283 * 24 * 60 * 60 * 1000);
            await Calving.create({
                farmerId: lloyd._id,
                pregnancyId: preg._id,
                animalId: laboredAnimal._id,
                date: calvDate,
                calvingEase: "Normal",
                numberOfCalves: 1,
                technicianNote: "Healthy delivery"
            });
            
            // Create the calf animal
            await Animal.create({
                farmerId: lloyd._id,
                animalId: `CALF-${laboredAnimal.earTag}-${i}`,
                earTag: `${laboredAnimal.earTag}-C${i+1}`,
                species: laboredAnimal.species,
                breed: insem.sireBreed,
                birthDate: calvDate,
                gender: i===0 ? "Male" : "Female",
                reproductiveStatus: "Normal",
                motherId: laboredAnimal._id
            });
        }
        
        laboredAnimal.reproductiveStatus = "Lactating";
        await laboredAnimal.save();
        console.log(`Made ${laboredAnimal.earTag} Labored 2 Calves`);


    process.exit();
};

run().catch(console.error);
