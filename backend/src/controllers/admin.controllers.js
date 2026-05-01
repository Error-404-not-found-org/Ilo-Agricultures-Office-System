import { User } from "../models/user.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Animal } from "../models/animal.model.js";
import { Inventory } from "../models/inventory.model.js";
import { HealthRequest } from "../models/health-request.model.js";

// Create User function removed - use user.controllers.js/createInvitedUser instead

// Dashboard Stats
export const getDashboardStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalFarmers,
            totalTechnicians,
            totalAnimals,
            totalInseminations,
            totalPregnancies,
            totalCalvings
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'farmer' }),
            User.countDocuments({ role: 'technician' }),
            Animal.countDocuments(),
            Insemination.countDocuments(),
            Pregnancy.countDocuments(),
            Calving.countDocuments()
        ]);

        res.status(200).send({
            totalUsers,
            farmers: totalFarmers,
            technicians: totalTechnicians,
            animals: totalAnimals,
            inseminations: totalInseminations,
            pregnancies: totalPregnancies,
            calvings: totalCalvings,
            successRate: "84%" // Placeholder until Inngest syncs it
        });
    } catch (error) {
         res.status(500).send({ message: "Error fetching stats", error: error.message });
    }
};

// Advanced Analytics for Admin Dashboard
export const getAdminAnalytics = async (req, res) => {
    try {
        const [inventory, technicianStats] = await Promise.all([
            Inventory.find().lean(),
            Insemination.aggregate([
                { $match: { status: 'done' } },
                { $group: { _id: '$technicianId', count: { $sum: 1 } } },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'techInfo' } },
                { $unwind: '$techInfo' },
                { $project: { name: '$techInfo.name', count: 1 } },
                { $sort: { count: -1 } }
            ])
        ]);

        res.status(200).json({ inventory, technicianStats });
    } catch (error) {
        res.status(500).json({ message: "Error fetching analytics", error: error.message });
    }
};

// ... existing get functions implementation ...
export const getAllInseminations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [inseminations, total] = await Promise.all([
            Insemination.find()
                .populate('farmerId', 'name email')
                .populate('animalId', 'earTag species breed')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Insemination.countDocuments()
        ]);

        res.status(200).send({ 
            data: inseminations,
            inseminations: inseminations, // backwards compatibility
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } 
        });
    } catch (error) {
        res.status(500).send({ message: "Error fetching inseminations", error: error.message });
    }
};

export const getAllReInseminations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const query = { attemptNumber: { $gt: 1 } };

        const [reInseminations, total] = await Promise.all([
            Insemination.find(query)
                .populate('farmerId', 'name email')
                .populate('animalId', 'earTag species breed')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Insemination.countDocuments(query)
        ]);

        res.status(200).send({ 
            data: reInseminations,
            reInseminations: reInseminations, // backwards compatibility
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } 
        });
    } catch (error) {
        res.status(500).send({ message: "Error fetching re-inseminations", error: error.message });
    }
};

export const getAllPregnancyChecks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [pregnancyChecks, total] = await Promise.all([
            Pregnancy.find()
                .populate('farmerId', 'name email')
                .populate('animalId', 'earTag species breed')
                .populate({
                    path: 'inseminationId',
                    select: 'inseminationDate sireCode'
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Pregnancy.countDocuments()
        ]);

        res.status(200).send({ 
            data: pregnancyChecks,
            pregnancyChecks: pregnancyChecks, // backwards compatibility
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } 
        });
    } catch (error) {
        res.status(500).send({ message: "Error fetching pregnancy checks", error: error.message });
    }
};

export const getAllCalvings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [calvings, total] = await Promise.all([
            Calving.find()
                .populate('farmerId', 'name email')
                .populate('animalId', 'earTag species breed')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Calving.countDocuments()
        ]);

        res.status(200).send({ 
            data: calvings,
            calvings: calvings, // backwards compatibility
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } 
        });
    } catch (error) {
        res.status(500).send({ message: "Error fetching calvings", error: error.message });
    }
};

// ... existing delete functions implementation ...
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.body; // Assuming ID is passed in body as per original placeholder, though params usually better
        if (!id) return res.status(400).send({ message: "User ID required" });
        await User.findByIdAndDelete(id);
        res.status(200).send({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).send({ message: "Error deleting user", error: error.message });
    }
};

export const deleteInsemination = async (req, res) => {
     try {
        const { id } = req.params;
        await Insemination.findByIdAndDelete(id);
        res.status(200).send({ message: "Insemination record deleted successfully" });
    } catch (error) {
        res.status(500).send({ message: "Error deleting insemination", error: error.message });
    }
};

export const syncUserMetadata = async (req, res) => {
    try {
        const { clerkClient } = await import("@clerk/clerk-sdk-node");
        const users = await User.find({ clerkId: { $ne: null } });
        let updatedCount = 0;
        
        for (const user of users) {
             try {
                // Determine logic: sync DB role to Clerk
                await clerkClient.users.updateUser(user.clerkId, {
                    publicMetadata: { role: user.role }
                });
                updatedCount++;
             } catch (err) {
                 console.error(`Failed to sync user ${user.email}:`, err.message);
             }
        }
        
        res.status(200).json({ message: `Synced metadata for ${updatedCount} users.` });
    } catch (error) {
         res.status(500).json({ message: "Error syncing metadata", error: error.message });
    }
};
