import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { AIRequest } from "../models/ai-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";

export const getCleanupSurvey = async (req, res) => {
    try {
        // 1. ORPHAN ANIMALS
        const allAnimals = await Animal.find({});
        const orphanAnimals = [];
        const orphanIds = [];
        
        for (const animal of allAnimals) {
            const owner = await User.findById(animal.farmerId);
            if (!owner) {
                orphanAnimals.push({
                    earTag: animal.earTag || "No-Tag",
                    breed: animal.breed,
                    reason: animal.farmerId ? "Owner ID Invalid" : "No Owner Assigned"
                });
                orphanIds.push(animal._id);
            }
        }

        // 2. INACTIVE FARMERS
        const farmers = await User.find({ role: 'farmer' });
        const inactiveFarmers = [];
        const inactiveFarmerIds = [];

        for (const farmer of farmers) {
            const checks = await Promise.all([
                Animal.countDocuments({ farmerId: farmer._id }),
                Insemination.countDocuments({ farmerId: farmer._id }),
                HealthRequest.countDocuments({ farmerId: farmer._id }),
                AIRequest.countDocuments({ farmerId: farmer._id }),
                Pregnancy.countDocuments({ farmerId: farmer._id }),
                Calving.countDocuments({ farmerId: farmer._id })
            ]);

            const totalActivity = checks.reduce((a, b) => a + b, 0);

            if (totalActivity === 0) {
                inactiveFarmers.push({
                    name: farmer.name,
                    email: farmer.email || "No Email"
                });
                inactiveFarmerIds.push(farmer._id);
            }
        }

        res.status(200).json({
            summary: {
                orphanAnimalsCount: orphanAnimals.length,
                inactiveFarmersCount: inactiveFarmers.length
            },
            details: {
                orphanAnimals: orphanAnimals.slice(0, 10),
                inactiveFarmers: inactiveFarmers.slice(0, 10)
            },
            ids: {
                orphanAnimals: orphanIds,
                inactiveFarmers: inactiveFarmerIds
            }
        });
    } catch (error) {
        console.error("Cleanup Survey Error:", error);
        res.status(500).json({ message: "Failed to generate survey." });
    }
};

export const executeCleanup = async (req, res) => {
    const { orphanAnimalIds, inactiveFarmerIds } = req.body;
    
    if (!orphanAnimalIds || !inactiveFarmerIds) {
        return res.status(400).json({ message: "Missing IDs for cleanup." });
    }

    try {
        const animalResult = await Animal.deleteMany({ _id: { $in: orphanAnimalIds } });
        const farmerResult = await User.deleteMany({ _id: { $in: inactiveFarmerIds } });

        res.status(200).json({
            message: "Cleanup successful",
            animalsDeleted: animalResult.deletedCount,
            farmersDeleted: farmerResult.deletedCount
        });
    } catch (error) {
        console.error("Cleanup Execution Error:", error);
        res.status(500).json({ message: "Failed to execute cleanup." });
    }
};
