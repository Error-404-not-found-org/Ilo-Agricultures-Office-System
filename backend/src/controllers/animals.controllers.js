import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Calving } from "../models/calving.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Notification } from "../models/notification.model.js";
import cloudinary from "../config/cloudinary.js";
import { inngest } from "../config/inngest.js";
import { checkInseminationAgeEligibility, verifyPostpartumWindow } from "../utils/cattleCore.js";

export const registerAnimal = async (req, res) => {
  try {
    let { farmerId, animalId, earTag, brand, species, breed, color, imageUrl, birthDate, gender } = req.body;

    if (!farmerId && req.user?.role === "farmer") {
        farmerId = req.user._id.toString();
    }

    if (!farmerId) return res.status(400).json({ message: "A farmer must be assigned to this animal." });
    if (!species) return res.status(400).json({ message: "Species is required." });
    if (!breed) return res.status(400).json({ message: "Breed is required." });

    const farmer = await User.findById(farmerId);
    if (!farmer) return res.status(404).json({ message: "Farmer not found." });

    if (!animalId || animalId.trim() === "") {
      const SPECIES_PREFIX = { 
        "Beef Cattle": "BEF", 
        "Dairy Cattle": "DAI", 
        "Cattle": "CAT",
        "Carabao": "CBU", 
        "Goat": "GOT", 
        "Swine": "SWN" 
      };
      const prefix = SPECIES_PREFIX[species] || "ANM";

      const initials = (farmer.name || "F")
        .split(" ")
        .map((w) => w[0]?.toUpperCase() || "")
        .join("");

      const count = await Animal.countDocuments({ farmerId, species });
      animalId = `${prefix}-${initials}-${String(count + 1).padStart(3, "0")}`;
    }

    // Handle Image Upload if base64
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.startsWith("data:image")) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
          folder: "livestock_profiles",
        });
        finalImageUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error("[registerAnimal IMAGE UPLOAD ERROR]", uploadError);
        // Continue without image if upload fails
      }
    }

    const animal = await Animal.create({
      farmerId,
      animalId,
      earTag,
      brand,
      species,
      breed,
      color,
      gender: gender || "Female",
      imageUrl: finalImageUrl || "",
      birthDate: birthDate ? new Date(birthDate) : undefined,
      barangay: farmer.address?.barangay || "Not Provided",
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
    const { page, limit, search, barangay } = req.query;
    let query = { deletedAt: null };
    
    // Construct filter based on owner's location if barangay is provided
    if (barangay) {
      query.barangay = barangay;
    }
 
    if (search) {
      const matchedFarmers = await User.find({ 
          name: { $regex: search, $options: "i" },
          role: "farmer" 
      }).select("_id");
      const farmerIds = matchedFarmers.map(f => f._id);
 
      const searchFilter = {
        $or: [
          { animalId: { $regex: search, $options: "i" } },
          { earTag: { $regex: search, $options: "i" } },
          { brand: { $regex: search, $options: "i" } },
          { species: { $regex: search, $options: "i" } },
          { farmerId: { $in: farmerIds } }
        ]
      };
 
      query = { $and: [query, searchFilter] };
    }
 
    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;
 
      const animals = await Animal.find(query)
        .populate("farmerId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();
 
      const total = await Animal.countDocuments(query);
 
      res.status(200).json({
        animals,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      });
    } else {
      const animals = await Animal.find(query)
        .populate("farmerId", "name")
        .sort({ createdAt: -1 })
        .limit(100) 
        .lean();
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

    const [animals, total] = await Promise.all([
      Animal.find({ farmerId, deletedAt: null }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Animal.countDocuments({ farmerId, deletedAt: null }),
    ]);

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

    const [animal, inseminationsList, calvings, pregnancies, healthRecords] = await Promise.all([
      Animal.findOne({ _id: id, deletedAt: null }).populate("farmerId", "-password"),
      Insemination.find({ animalId: id, deletedAt: null })
        .populate("approvedBy", "name email imageUrl")
        .sort({ attemptNumber: -1 }),
      Calving.find({ animalId: id, deletedAt: null }).populate("pregnancyId").sort({ date: -1 }),
      Pregnancy.find({ animalId: id, deletedAt: null }),
      HealthRequest.find({ animalId: id, deletedAt: null }).populate("handledBy", "name").sort({ createdAt: -1 })
    ]);

    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }

    const inseminations = inseminationsList.map(ins => {
      const preg = pregnancies.find(p => p.inseminationId.toString() === ins._id.toString());
      return {
        ...ins.toObject(),
        pregnancy: preg || null
      };
    });

    res.status(200).json({
      ...animal.toObject(),
      inseminations,
      calvings,
      healthRecords,
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
    const animal = await Animal.findOne({ _id: id, deletedAt: null });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
 
    if (payload.animalId) animal.animalId = payload.animalId;
    if (payload.earTag) animal.earTag = payload.earTag;
    if (payload.brand) animal.brand = payload.brand;
    if (payload.species) animal.species = payload.species;
    if (payload.breed) animal.breed = payload.breed;
    if (payload.color) animal.color = payload.color;
    if (payload.birthDate) animal.birthDate = new Date(payload.birthDate);
    if (payload.imageUrl) animal.imageUrl = payload.imageUrl;

    if (!animal.barangay) {
      const farmer = await User.findById(animal.farmerId);
      if (farmer) animal.barangay = farmer.address?.barangay || "Not Provided";
    }
    
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

export const deleteAnimal = async (req, res) => {
  try {
    const { id } = req.params;
    const animal = await Animal.findOne({ _id: id, deletedAt: null });
 
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }
 
    // Permission Check: Only the owner (farmer) or an admin/tech can delete.
    if (req.user.role === "farmer" && animal.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to delete this animal" });
    }
 
    const deleteTime = new Date();
    // Cleanup related records - Soft Delete
    await Promise.all([
      Insemination.updateMany({ animalId: id }, { $set: { deletedAt: deleteTime } }),
      Calving.updateMany({ animalId: id }, { $set: { deletedAt: deleteTime } }),
      HealthRequest.updateMany({ animalId: id }, { $set: { deletedAt: deleteTime } }),
      Pregnancy.updateMany({ animalId: id }, { $set: { deletedAt: deleteTime } })
    ]);
 
    // Cleanup Cloudinary Image
    if (animal.imageUrl && animal.imageUrl.includes("cloudinary.com")) {
      try {
        const parts = animal.imageUrl.split("/");
        const filename = parts[parts.length - 1]; // e.g. "abcd123.jpg"
        const publicIdWithFolder = `livestock_profiles/${filename.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicIdWithFolder);
      } catch (cloudinaryError) {
        console.error("[Cloudinary Cleanup Error]", cloudinaryError);
      }
    }
 
    animal.deletedAt = deleteTime;
    await animal.save();

    req.app.get("io").emit("dashboardUpdate", {
      type: "ANIMAL_DELETED",
      animalId: id,
    });

    res.status(200).json({ message: "Animal and related records deleted successfully" });
  } catch (error) {
    console.error("Delete Animal Error:", error);
    res.status(500).json({ message: "Failed to delete animal" });
  }
};

export const updateReproductiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    
    const animal = await Animal.findById(id);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    if (animal.farmerId.toString() !== req.user._id.toString() && req.user.role !== "technician") {
      return res.status(403).json({ message: "Unauthorized to update this animal's status" });
    }

    // --- HARDENED REHEAT LOGIC ---
    if (status === "In Heat") {
        // If they observed a reheat, the last insemination attempt is officially a failure
        const lastInsem = await Insemination.findOne({ animalId: id, status: "done", deletedAt: null }).sort({ createdAt: -1 });
        if (lastInsem) {
            lastInsem.isSuccess = false;
            lastInsem.outcome = "Failed (Re-heat)";
            lastInsem.comment = (lastInsem.comment || "") + ` | Reheat observed on ${new Date().toLocaleDateString()}`;
            await lastInsem.save();
            console.log(`[Reheat Sync] Insemination ${lastInsem._id} marked as Failed (Re-heat).`);
        }
        
        // Clear any future calving dates since she's back in heat
        animal.expectedCalvingDate = undefined;
    }

    animal.reproductiveStatus = status;
    
    animal.activityLogs = animal.activityLogs || [];
    animal.activityLogs.push({
        event: "Reproductive Status Update",
        date: new Date(),
        description: `Farmer observed: ${status}. Note: ${note || "Observed during field check."}`
    });

    await animal.save();

    res.status(200).json({ message: "Animal status updated successfully", animal });
  } catch (error) {
    console.error("Update Reproductive Status Error:", error);
    res.status(500).json({ message: "Failed to update animal status" });
  }
};

export const requestReInsemination = async (req, res) => {
  try {
    const { animalId, preferredDate, comment } = req.body;
    
    const animal = await Animal.findOne({ _id: animalId, deletedAt: null });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
 
    // Gender check
    if (animal.gender !== "Female") {
      return res.status(400).json({
        message: "Insemination is restricted to female animals only. This animal is registered as Male."
      });
    }
 
    // Age Check Check
    const ageCheck = checkInseminationAgeEligibility(animal.birthDate, animal.species);
    if (!ageCheck.isEligible) {
        return res.status(400).json({ message: ageCheck.reason });
    }
 
    const lastInsem = await Insemination.findOne({ animalId, deletedAt: null }).sort({ attemptNumber: -1 });
    const nextAttempt = (lastInsem?.attemptNumber || 0) + 1;

    const newRequest = await Insemination.create({
      farmerId: req.user._id,
      animalId,
      status: "pending",
      attemptNumber: nextAttempt,
      preferredDate: preferredDate || new Date(),
      technicianNote: comment || `Re-insemination request (Attempt #${nextAttempt})`
    });

    // Mark the last successful/done insemination as failed since they are requesting a new one
    if (lastInsem && lastInsem.status === "done") {
        lastInsem.isSuccess = false;
        lastInsem.outcome = "Failed (Re-heat)";
        await lastInsem.save();
    }

    animal.reproductiveStatus = "In Heat";
    animal.expectedCalvingDate = undefined;
    await animal.save();

    res.status(201).json({ message: "Re-insemination request sent to technician", request: newRequest });
  } catch (error) {
    console.error("Re-Insemination Request Error:", error);
    res.status(500).json({ message: "Failed to send re-insemination request" });
  }
};

export const getAnimalsByFarmer = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const animals = await Animal.find({ farmerId, deletedAt: null }).sort({ earTag: 1 }).lean();
    res.status(200).json({ data: animals });
  } catch (error) {
    console.error("[getAnimalsByFarmer ERROR]", error);
    res.status(500).json({ message: "Failed to fetch farmer's animals." });
  }
};

export const recordCalving = async (req, res) => {
  try {
    const {
      pregnancyId,
      animalId,
      date,
      calvingEase,
      numberOfCalves,
      calves,
      technicianNote,
    } = req.body;

    // 1. Validate Mother & Pregnancy
    const mother = await Animal.findOne({ _id: animalId, deletedAt: null });
    if (!mother) return res.status(404).json({ message: "Mother animal not found" });

    // Permission check: Farmer can only record for their own animals
    if (req.user.role === "farmer" && mother.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    // Chronological Calving Postpartum Firewall
    if (mother.lastCalvingDate) {
      const windowCheck = verifyPostpartumWindow(mother.lastCalvingDate, date || new Date(), mother.species);
      if (!windowCheck.isSafe) {
        return res.status(422).json({ 
          message: `Warning: Calving event occurs too close to the previous calving event. Only ${windowCheck.daysPassed} days have passed, but the voluntary waiting period for ${mother.species} is ${windowCheck.requiredDays} days.` 
        });
      }
    }

    let pregnancy = null;
    if (pregnancyId) {
        pregnancy = await Pregnancy.findOne({ _id: pregnancyId, deletedAt: null }).populate("inseminationId");
    } else {
        pregnancy = await Pregnancy.findOne({ animalId, "pregnancyDiagnosis.result": "Pregnant", deletedAt: null }).populate("inseminationId").sort({ createdAt: -1 });
    }
    
    if (!pregnancy) return res.status(404).json({ message: "Pregnancy record not found. Please ensure the animal is confirmed pregnant first." });

    // Check if calving record already exists to prevent E11000 duplicate key error
    const existingCalving = await Calving.findOne({ pregnancyId: pregnancy._id, deletedAt: null });
    if (existingCalving) {
      // If the calving was recorded but the mother's status didn't update previously, fix it now
      if (mother.reproductiveStatus === "Pregnant") {
         await Animal.findByIdAndUpdate(animalId, { $set: { reproductiveStatus: "Normal" } });
      }
      return res.status(400).json({ message: "A calving record already exists for this pregnancy. Mother's status has been synchronized." });
    }

    // Extract sire info from insemination if available
    const sireBreed = pregnancy.inseminationId?.sireBreed || "Unknown";

    // 2. Register Each Calf as a New Animal
    const registeredCalves = [];
    const calfRecordsForBirth = [];

    for (let i = 0; i < calves.length; i++) {
      const calfData = calves[i];
      const calfAnimalId = `ANM-${Date.now().toString().slice(-6)}-${i}`;

      const newCalf = await Animal.create({
        earTag: calfData.earTag || `CALF-${Date.now().toString().slice(-4)}-${i}`,
        animalId: calfAnimalId,
        species: mother.species,
        breed: sireBreed !== "Unknown" ? `${mother.breed} x ${sireBreed}` : mother.breed,
        farmerId: mother.farmerId,
        motherId: mother._id,
        isVerified: req.user.role === "technician", // Auto-verify if technician records it
        gender: calfData.sex === "M" ? "Male" : "Female",
        birthDate: date || new Date(),
        barangay: mother.barangay || "Not Provided",
        activityLogs: [{
          event: "Initial Registration",
          date: new Date(),
          description: `Registered via calving event from mother ${mother.earTag || mother.animalId}. Recorded by ${req.user.role}.`,
        }]
      });

      registeredCalves.push(newCalf);
      calfRecordsForBirth.push({
        sex: calfData.sex,
        earTag: newCalf.earTag,
        weight: calfData.weight,
        animalId: newCalf._id,
      });
    }

    // 3. Create Calving Record
    const calving = await Calving.create({
      animalId,
      farmerId: mother.farmerId,
      pregnancyId,
      date: date || new Date(),
      numberOfCalves: numberOfCalves || registeredCalves.length,
      calves: calfRecordsForBirth,
      calvingEase,
      technicianId: req.user.role === "technician" ? req.user._id : undefined,
      technicianNote,
    });

    // 4. Update Mother's Status, lastCalvingDate & Increment Parity
    await Animal.findByIdAndUpdate(animalId, {
      $set: { 
        reproductiveStatus: "Normal",
        lastCalvingDate: date || new Date()
      },
      $inc: { parity: 1 },
      $push: {
        activityLogs: {
          event: "Calving",
          date: new Date(),
          description: `Gave birth to ${numberOfCalves} calf/calves. Ease: ${calvingEase}. Recorded by ${req.user.role}.`,
        },
      },
    });

    // 5. Notify involved parties
    if (req.user.role === "technician" && mother.farmerId) {
       const calfSexList = calves.map(c => c.sex === "M" ? "Male" : "Female").join(", ");
       await Notification.create({
        recipientId: mother.farmerId,
        senderId: req.user._id,
        type: "system",
        title: "🍼 New Calving Recorded",
        message: `Congratulations! Your animal Tag #${mother.earTag || mother.animalId} successfully calved ${registeredCalves.length} offspring (${calfSexList}).`,
      });
    }

    // 6. Trigger Inngest & Socket
    try {
      await inngest.send({
        name: "livestock/calving-recorded",
        data: {
          animalId,
          farmerId: mother.farmerId,
          numberOfCalves: registeredCalves.length,
          offspringIds: registeredCalves.map(c => c._id),
        },
      });
    } catch (inngestErr) {
      console.error("[recordCalving INNGEST ERROR]", inngestErr.message);
    }

    req.app.get("io").emit("dashboardUpdate", {
      type: "CALVING_RECORDED",
      motherId: animalId,
    });

    res.status(201).json({
      message: "Calving and offspring registered successfully",
      calving,
      offspring: registeredCalves,
    });
  } catch (error) {
    console.error("[recordCalving ERROR]", error);
    res.status(500).json({ message: "Failed to record calving", error: error.message });
  }
};

export const getArchivedAnimals = async (req, res) => {
  try {
    const isTechnicianOrAdmin = req.user.role === "technician" || req.user.role === "admin";
    const query = isTechnicianOrAdmin 
      ? { deletedAt: { $ne: null } } 
      : { farmerId: req.user._id, deletedAt: { $ne: null } };

    const animals = await Animal.find(query)
      .populate("farmerId", "-password")
      .sort({ deletedAt: -1 })
      .lean();

    res.status(200).json(animals);
  } catch (error) {
    console.error("[getArchivedAnimals ERROR]", error);
    res.status(500).json({ message: "Failed to fetch archived animals.", error: error.message });
  }
};

export const restoreAnimal = async (req, res) => {
  try {
    const { id } = req.params;
    const animal = await Animal.findById(id);

    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }

    if (req.user.role === "farmer" && animal.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to restore this animal" });
    }

    await Promise.all([
      Insemination.updateMany({ animalId: id, deletedAt: { $ne: null } }, { $set: { deletedAt: null } }),
      Calving.updateMany({ animalId: id, deletedAt: { $ne: null } }, { $set: { deletedAt: null } }),
      HealthRequest.updateMany({ animalId: id, deletedAt: { $ne: null } }, { $set: { deletedAt: null } }),
      Pregnancy.updateMany({ animalId: id, deletedAt: { $ne: null } }, { $set: { deletedAt: null } })
    ]);

    animal.deletedAt = null;
    await animal.save();

    req.app.get("io").emit("dashboardUpdate", {
      type: "ANIMAL_RESTORED",
      animalId: id,
    });

    res.status(200).json({ message: "Animal and associated records restored successfully.", animal });
  } catch (error) {
    console.error("[restoreAnimal ERROR]", error);
    res.status(500).json({ message: "Failed to restore animal", error: error.message });
  }
};


