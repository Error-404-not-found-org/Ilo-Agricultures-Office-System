import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Calving } from "../models/calving.model.js";

export const registerAnimal = async (req, res) => {
  try {
    let { farmerId, animalId, earTag, brand, species, breed, color, imageUrl, birthDate } = req.body;

    // If no farmerId is provided, but a farmer is making the request, use their own ID.
    if (!farmerId && req.user?.role === "farmer") {
        farmerId = req.user._id.toString();
    }

    // Validate required fields early with a clear message
    if (!farmerId) return res.status(400).json({ message: "A farmer must be assigned to this animal." });
    if (!species) return res.status(400).json({ message: "Species is required." });
    if (!breed) return res.status(400).json({ message: "Breed is required." });

    const farmer = await User.findById(farmerId);
    if (!farmer) return res.status(404).json({ message: "Farmer not found." });

    // Auto-generate a species-based animalId if not provided
    // Format: {SPECIES_PREFIX}-{FARMER_INITIALS}-{COUNT_PER_SPECIES}
    // e.g. BEF-JD-001 (1st Beef of Juan Dela Cruz), CBU-MB-002 (2nd Carabao of Maria Buenaventura)
    if (!animalId || animalId.trim() === "") {
      const SPECIES_PREFIX = { Beef: "BEF", Dairy: "DAI", Carabao: "CBU", Goat: "GOT", Swine: "SWN" };
      const prefix = SPECIES_PREFIX[species] || "ANM";

      // Build farmer initials from name words (e.g. "Juan Dela Cruz" → "JDC")
      const initials = (farmer.name || "F")
        .split(" ")
        .map((w) => w[0]?.toUpperCase() || "")
        .join("");

      // Count how many animals of the same species this farmer already has
      const count = await Animal.countDocuments({ farmerId, species });
      animalId = `${prefix}-${initials}-${String(count + 1).padStart(3, "0")}`;
    }

    const animal = await Animal.create({
      farmerId,
      animalId,
      earTag,
      brand,
      species,
      breed,
      color,
      imageUrl: imageUrl || "",
      birthDate: birthDate ? new Date(birthDate) : undefined,
    });

    console.log(`[Animal Registered] ID: ${animal._id} | AnimalID: ${animalId} | Farmer: ${farmer.name}`);
    res.status(201).json({ message: "Animal registered", animal });
  } catch (error) {
    console.error("[registerAnimal ERROR]", error.message, error.errors || "");
    res.status(500).json({ message: error.message || "Failed to register animal" });
  }
};

export const getAllAnimals = async (req, res) => {
  try {
    const { page, limit, search } = req.query;

    let query = {};
    if (search) {
      // Find farmers matching search string
      const matchedFarmers = await User.find({ 
          name: { $regex: search, $options: "i" },
          role: "farmer" 
      });
      const farmerIds = matchedFarmers.map(f => f._id);

      query = {
        $or: [
          { animalId: { $regex: search, $options: "i" } },
          { earTag: { $regex: search, $options: "i" } },
          { brand: { $regex: search, $options: "i" } },
          { species: { $regex: search, $options: "i" } },
          { farmerId: { $in: farmerIds } }
        ]
      };
    }

    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      const animals = await Animal.find(query)
        .populate("farmerId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const total = await Animal.countDocuments(query);

      res.status(200).json({
        animals,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      });
    } else {
      // Standard Flat Array Return for Backwards Compatibility
      const animals = await Animal.find(query).populate("farmerId", "name").sort({ createdAt: -1 });
      res.status(200).json(animals);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get animals" });
  }
};

export const getMyAnimals = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const farmerId = req.user._id;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const animals = await Animal.find({ farmerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Animal.countDocuments({ farmerId });

    res.status(200).json({
      data: animals,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error("[getMyAnimals ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your animals." });
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

export const updateAnimalWizard = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    
    // Step 1: Handle Animal identity
    const animal = await Animal.findById(id);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    if (payload.animalId) animal.animalId = payload.animalId;
    if (payload.earTag) animal.earTag = payload.earTag;
    if (payload.brand) animal.brand = payload.brand;
    if (payload.species) animal.species = payload.species;
    if (payload.breed) animal.breed = payload.breed;
    if (payload.color) animal.color = payload.color;
    if (payload.birthDate) animal.birthDate = new Date(payload.birthDate);
    if (payload.imageUrl) animal.imageUrl = payload.imageUrl;
    
    await animal.save();

    // Step 2 & 3: Handle Insemination logic
    let latestInsem = await Insemination.findOne({ animalId: id }).sort({ attemptNumber: -1 });
    
    if (payload.aiDate && payload.aiDate !== 'Not Yet') {
        if (!latestInsem) {
            latestInsem = new Insemination({
                animalId: id,
                farmerId: animal.farmerId,
                attemptNumber: parseInt(payload.noOfAI) || 1,
                dateOfAI: new Date(payload.aiDate),
                estrusType: payload.estrusType || "",
                sireBreed: payload.sireBreed || "",
                sireCode: payload.sireCode || "",
                pregnancyStatus: "Pending"
            });
        } else {
            latestInsem.dateOfAI = new Date(payload.aiDate);
            latestInsem.attemptNumber = parseInt(payload.noOfAI) || latestInsem.attemptNumber;
            latestInsem.estrusType = payload.estrusType || latestInsem.estrusType;
            latestInsem.sireBreed = payload.sireBreed || latestInsem.sireBreed;
            latestInsem.sireCode = payload.sireCode || latestInsem.sireCode;
        }

        if (payload.pdDate && payload.pdDate !== 'Not Yet') {
            latestInsem.dateOfPD = new Date(payload.pdDate);
            latestInsem.pregnancyStatus = payload.pdResult || "Pending";
        }
        await latestInsem.save();
    }

    // Step 4: Handle Calving logic
    if (payload.calfDate && payload.calfDate !== 'Not Yet') {
        let latestCalving = await Calving.findOne({ animalId: id }).sort({ date: -1 });
        if (!latestCalving) {
            latestCalving = new Calving({
                animalId: id,
                farmerId: animal.farmerId,
                pregnancyId: latestInsem ? latestInsem._id : null,
                date: new Date(payload.calfDate),
                calvingEase: payload.calvingEase || "",
                calfSex: payload.calfSex || "",
                calfId: payload.calfId || ""
            });
        } else {
             latestCalving.date = new Date(payload.calfDate);
             latestCalving.calvingEase = payload.calvingEase || latestCalving.calvingEase;
             latestCalving.calfSex = payload.calfSex || latestCalving.calfSex;
             latestCalving.calfId = payload.calfId || latestCalving.calfId;
        }
        await latestCalving.save();
    }

    res.status(200).json({ message: "Animal & Medical records fully synchronized", animal });
  } catch (error) {
    console.error("Wizard Update API Error:", error);
    res.status(500).json({ message: "Failed to construct full medical updates" });
  }
};
