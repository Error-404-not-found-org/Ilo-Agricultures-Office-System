import { User } from "../models/user.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Animal } from "../models/animal.model.js";

// Create User (simplified - primarily for creating technician/admin accounts directly)
export const registerUser = async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).send({ message: "User created successfully", user });
    } catch (error) {
        res.status(500).send({ message: "Error creating user", error: error.message });
    }
};

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
            calvings: totalCalvings
        });
    } catch (error) {
         res.status(500).send({ message: "Error fetching stats", error: error.message });
    }
};

// ... existing get functions implementation ...
export const getAllInseminations = async (req, res) => {
    try {
        const inseminations = await Insemination.find()
            .populate('farmerId', 'name email')
            .populate('animalId', 'earTag species breed')
            .sort({ createdAt: -1 });
        res.status(200).send({ inseminations });
    } catch (error) {
        res.status(500).send({ message: "Error fetching inseminations", error: error.message });
    }
};

export const getAllReInseminations = async (req, res) => {
  // Logic for re-inseminations (typically filtered inseminations or a separate model if defined)
  // For now returning empty or implementation dependent on specific business logic for 're-insemination'
  // Assuming it might be inseminations with attemptNumber > 1
    try {
        const reInseminations = await Insemination.find({ attemptNumber: { $gt: 1 } })
            .populate('farmerId', 'name email')
            .populate('animalId', 'earTag species breed')
             .sort({ createdAt: -1 });
        res.status(200).send({ reInseminations });
    } catch (error) {
        res.status(500).send({ message: "Error fetching re-inseminations", error: error.message });
    }
};

export const getAllPregnancyChecks = async (req, res) => {
    try {
        const pregnancyChecks = await Pregnancy.find()
            .populate('farmerId', 'name email')
            .populate('animalId', 'earTag species breed')
            .populate({
                path: 'inseminationId',
                select: 'inseminationDate sireCode'
            })
            .sort({ createdAt: -1 });
        res.status(200).send({ pregnancyChecks });
    } catch (error) {
        res.status(500).send({ message: "Error fetching pregnancy checks", error: error.message });
    }
};

export const getAllCalvings = async (req, res) => {
    try {
        const calvings = await Calving.find()
            .populate('farmerId', 'name email')
            .populate('animalId', 'earTag species breed')
             .sort({ createdAt: -1 });
        res.status(200).send({ calvings });
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
