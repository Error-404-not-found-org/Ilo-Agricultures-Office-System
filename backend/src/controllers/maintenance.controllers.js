import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import cloudinary from "../config/cloudinary.js";

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

        // 3. CLOUDINARY ORPHANS (Survey Only)
        // We can't easily list all for a survey without intensive API calls, 
        // but we can estimate based on a sample or just provide the tool.

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
    const { orphanAnimalIds, inactiveFarmerIds, cleanupCloudinary } = req.body;
    
    try {
        let animalsDeleted = 0;
        let farmersDeleted = 0;
        let imagesDeleted = 0;

        if (orphanAnimalIds && orphanAnimalIds.length > 0) {
            const result = await Animal.deleteMany({ _id: { $in: orphanAnimalIds } });
            animalsDeleted = result.deletedCount;
        }

        if (inactiveFarmerIds && inactiveFarmerIds.length > 0) {
            const result = await User.deleteMany({ _id: { $in: inactiveFarmerIds } });
            farmersDeleted = result.deletedCount;
        }

        // --- CLOUDINARY ORPHAN CLEANUP ---
        if (cleanupCloudinary) {
            // 1. Get all animal image URLs from DB
            const animals = await Animal.find({}, 'imageUrl');
            const validUrls = new Set(animals.map(a => a.imageUrl).filter(Boolean));

            // 2. List resources in folder
            const { resources } = await cloudinary.api.resources({
                type: 'upload',
                prefix: 'livestock_profiles/',
                max_results: 500
            });

            const toDelete = resources
                .filter(res => !validUrls.has(res.secure_url))
                .map(res => res.public_id);

            if (toDelete.length > 0) {
                const cloudResult = await cloudinary.api.delete_resources(toDelete);
                imagesDeleted = toDelete.length;
                console.log(`[Cloudinary Cleanup] Deleted ${imagesDeleted} orphaned images.`, cloudResult);
            }
        }

        res.status(200).json({
            message: "Cleanup successful",
            animalsDeleted,
            farmersDeleted,
            imagesDeleted
        });
    } catch (error) {
        console.error("Cleanup Execution Error:", error);
        res.status(500).json({ message: "Failed to execute cleanup.", error: error.message });
    }
};
