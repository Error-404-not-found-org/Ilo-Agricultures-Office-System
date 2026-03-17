import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Calving } from "../models/calving.model.js";

export const registerAnimal = async (req, res) => {
  try {
    const { farmerId, earTag, species, breed, color, imageUrl } = req.body;

    const farmer = await User.findById(farmerId);
    if (!farmer) return res.status(404).json({ message: "Farmer not found" });

    const animal = await Animal.create({
      farmerId,
      earTag,
      species,
      breed,
      color,
      imageUrl: imageUrl || "",
    });

    res.status(201).json({ message: "Animal registered", animal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to register animal" });
  }
};

export const getAllAnimals = async (req, res) => {
  try {
    const animals = await Animal.find().populate("farmerId", "name");
    res.status(200).json(animals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get animals" });
  }
};

export const getAnimalById = async (req, res) => {
  try {
    const { id } = req.params;

    const [animal, inseminations, calvings] = await Promise.all([
      Animal.findById(id).populate("farmerId", "-password"),
      Insemination.find({ animalId: id })
        .populate("approvedBy", "name email imageUrl")
        .sort({ attemptNumber: -1 }),
      Calving.find({ animalId: id }).populate("pregnancyId").sort({ date: -1 }),
    ]);

    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }

    res.status(200).json({
      ...animal.toObject(),
      inseminations,
      calvings,
    });
  } catch (error) {
    console.error("Error fetching animal details:", error);
    res.status(500).json({ message: "Failed to fetch animal details" });
  }
};
