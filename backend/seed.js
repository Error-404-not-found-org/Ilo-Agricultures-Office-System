import { connectDB } from './src/config/db.js';
import { User } from './src/models/user.model.js';
import { Animal } from './src/models/animal.model.js';
import { Insemination } from './src/models/insemination.model.js';
import { Pregnancy } from './src/models/pregnancy.model.js';
import { Calving } from './src/models/calving.model.js';

const seed = async () => {
    try {
        await connectDB();
        console.log("Connected to DB, starting seed...");

        // --- USERS ---
        const userCount = await User.countDocuments({ role: 'farmer' });
        let farmer;
        
        if (userCount === 0) {
            console.log("Creating default farmer...");
            farmer = await User.create({
                clerkId: "seed-farmer-123",
                name: "Juan Dela Cruz",
                email: "juan@example.com",
                role: "farmer",
                isVerified: true,
                address: {
                    houseNumber: "123",
                    street: "Rizal St",
                    barangay: "Poblacion",
                    city: "Barotac Nuevo",
                    province: "Iloilo",
                    region: "VI",
                    zipCode: "5007",
                    phoneNumber: "09123456789"
                }
            });
        } else {
            console.log("Farmer exists, fetching...");
            farmer = await User.findOne({ role: 'farmer' });
        }

        // --- TECHNICIANS ---
        const techCount = await User.countDocuments({ role: 'technician' });
        if (techCount === 0) {
            console.log("Creating default technician...");
            await User.create({
                clerkId: "seed-technician-456",
                name: "Maria Santos",
                email: "maria.tech@example.com",
                role: "technician",
                isVerified: true,
                status: "active",
                address: {
                    houseNumber: "456",
                    street: "Luna St",
                    barangay: "San Jose",
                    city: "Barotac Nuevo",
                    province: "Iloilo",
                    region: "VI",
                    zipCode: "5007",
                    phoneNumber: "09987654321"
                }
            });
        }



        // --- BACKFILL STATUS ---
        console.log("Backfilling missing status fields...");
        const result = await User.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'active' } }
        );
        console.log(`Updated ${result.modifiedCount} users with default status.`);

        // --- ANIMALS ---
        const animalCount = await Animal.countDocuments();
        let animal;
        if (animalCount === 0) {
            console.log("Creating animals...");
            const animals = [
                { earTag: "TAG-001", name: "Bessie", species: "Beef", breed: "Brahman", gender: "Female", birthDate: new Date("2020-01-01"), farmerId: farmer._id },
                { earTag: "TAG-002", name: "Moo", species: "Dairy", breed: "Holstein", gender: "Female", birthDate: new Date("2021-05-15"), farmerId: farmer._id },
                { earTag: "TAG-003", name: "Red", species: "Beef", breed: "Native", gender: "Female", birthDate: new Date("2019-11-20"), farmerId: farmer._id },
            ];
            const createdAnimals = await Animal.insertMany(animals);
            animal = createdAnimals[0];
            console.log(`Created ${createdAnimals.length} animals.`);
        } else {
             console.log("Animals exist, fetching...");
             animal = await Animal.findOne();
        }

        // --- INSEMINATIONS ---
        const insCount = await Insemination.countDocuments();
        if (insCount === 0) {
             console.log("Creating insemination records...");
             const inseminations = [
                 { animalId: animal._id, farmerId: farmer._id, inseminationDate: new Date("2023-10-01"), sireCode: "SIRE-A", sireBreed: "Brahman", technicianId: null, status: "done" },
                 { animalId: animal._id, farmerId: farmer._id, inseminationDate: new Date("2023-11-05"), sireCode: "SIRE-B", sireBreed: "Holstein", technicianId: null, status: "done" },
                 { animalId: animal._id, farmerId: farmer._id, inseminationDate: new Date("2023-12-10"), sireCode: "SIRE-C", sireBreed: "Angus", technicianId: null, status: "pending" },
             ];
             await Insemination.insertMany(inseminations);
             await Insemination.insertMany(inseminations);
             console.log(`Created ${inseminations.length} inseminations.`);
        }

        // --- PREGNANCIES ---
        const pregCount = await Pregnancy.countDocuments();
        if (pregCount === 0) {
            console.log("Creating pregnancy records...");
            // Assuming the first insemination (index 0) resulted in pregnancy
            const insemination = await Insemination.findOne({ status: "done" });
            if (insemination) {
                const pregnancies = [
                    {
                        animalId: insemination.animalId,
                        farmerId: insemination.farmerId,
                        inseminationId: insemination._id,
                        checkDate: new Date("2024-01-15"),
                        result: "Positive",
                        notes: "Healthy fetus detected",
                        technicianId: null // or add a technician if you have one
                    }
                ];
                await Pregnancy.insertMany(pregnancies);
                console.log(`Created ${pregnancies.length} pregnancy records.`);
            }
        }

        // --- CALVINGS ---
        const calvingCount = await Calving.countDocuments();
        if (calvingCount === 0) {
             console.log("Creating calving records...");
             
             // Check if we have a pregnant animal or just create a new chain
             // For simplicity, let's look for a completed pregnancy or just create a new set
             // Let's create a new full chain for calving to avoid conflicts
             
             // 1. Find an animal (or use the existing one)
             const calvingAnimal = animal;

             // 2. Create an insemination for it (past)
             const ins = await Insemination.create({
                 animalId: calvingAnimal._id,
                 farmerId: farmer._id,
                 inseminationDate: new Date("2022-01-01"),
                 sireCode: "SIRE-CALVE",
                 sireBreed: "Brahman",
                 technicianId: null,
                 status: "done"
             });

             // 3. Create a pregnancy for it
             const preg = await Pregnancy.create({
                 animalId: calvingAnimal._id,
                 farmerId: farmer._id,
                 inseminationId: ins._id,
                 checkDate: new Date("2022-04-01"),
                 result: "Positive",
                 notes: "Confirmed for calving seed",
                 technicianId: null
             });

             // 4. Create the calving linked to that pregnancy
             const calvings = [
                 {
                     animalId: calvingAnimal._id,
                     farmerId: farmer._id,
                     pregnancyId: preg._id,
                     calvingDate: new Date("2022-10-10"),
                     numberOfCalves: 1,
                     calfSex: "M",
                     calvingEase: "Normal"
                     // technicianId: null // Schema doesn't have technicianId, check model if needed. 
                     // Reviewed model: CalvingSchema has no technicianId.
                 }
             ];
             await Calving.insertMany(calvings);
             console.log(`Created ${calvings.length} calving records.`);
        }

        console.log("Seed completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("Seed failed:", error);
        process.exit(1);
    }
};

seed();
