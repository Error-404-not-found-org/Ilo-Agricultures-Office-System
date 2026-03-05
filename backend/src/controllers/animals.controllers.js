import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";

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
    const animals = await Animal.find().populate("farmerId", "name" );
    res.status(200).json(animals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get animals" });
  }
};
