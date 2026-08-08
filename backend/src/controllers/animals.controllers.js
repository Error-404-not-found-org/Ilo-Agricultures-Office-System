import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Calving } from "../models/calving.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Notification } from "../models/notification.model.js";
import { Task } from "../models/task.model.js";
import { resolveReproductionNextAction } from "../domain/reproduction-next-action.js";
import cloudinary from "../config/cloudinary.js";
import { inngest } from "../config/inngest.js";
import { assertAnimalAccess } from "../policies/animal.policy.js";
import { getPagination } from "../utils/pagination.js";
import {
  ANIMAL_REPRODUCTIVE_STATUS,
  TASK_STATUS,
  isActiveAIRequestStatus,
  reproductiveStatusQuery,
} from "../domain/status-vocabulary.js";
import { persistCalving } from "../services/calving.service.js";
import { getPregnancyCheckReadiness } from "../domain/pregnancy-readiness.js";
import { loadPregnancyConfirmationPolicy } from "../services/pregnancy-policy.service.js";

export const registerAnimal = async (req, res) => {
  try {
    let { farmerId, animalId, earTag, brand, species, breed, color, imageUrl, birthDate, gender } = req.body;
 
    if (req.user?.role === "farmer") {
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
    const { page, limit, search, barangay, city, species, gender, status, reproductiveStatus, breed, sortBy = "createdAt", sortOrder = "desc" } = req.query;
    let query = { deletedAt: null };

    if (city || barangay) {
      const locationQuery = {
        role: "farmer",
        deletedAt: null,
      };
      const addressFilters = [];
      if (city) {
        addressFilters.push({
          $or: [
            { "address.city": city },
            { "address.municipality": city },
          ],
        });
      }
      if (barangay) addressFilters.push({ "address.barangay": barangay });
      if (addressFilters.length) locationQuery.$and = addressFilters;

      const farmersInLocation = await User.find(locationQuery).select("_id").lean();
      query.farmerId = { $in: farmersInLocation.map((farmer) => farmer._id) };
    }

    if (species === "Cattle") {
      query.species = { $in: ["Beef", "Dairy", "Beef Cattle", "Dairy Cattle", "Cattle"] };
    } else if (species) {
      query.species = species;
    }
    if (gender) query.gender = gender;
    if (breed) query.breed = { $regex: breed, $options: "i" };
    if (status || reproductiveStatus) {
      query.reproductiveStatus = reproductiveStatusQuery(
        status || reproductiveStatus,
      );
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
      const { page: pageNum, limit: limitNum, skip } = getPagination(req.query);
 
      const sortDirection = sortOrder === "asc" ? 1 : -1;
      const safeSortBy = ["createdAt", "updatedAt", "animalId", "earTag", "species", "breed", "reproductiveStatus"].includes(sortBy)
        ? sortBy
        : "createdAt";

      const animals = await Animal.find(query)
        .populate("farmerId", "name address")
        .sort({ [safeSortBy]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .lean();
 
      const [total, cattleCount, pregnantCount, availableCount] = await Promise.all([
        Animal.countDocuments(query),
        Animal.countDocuments({
          $and: [
            query,
            { species: { $in: ["Beef", "Dairy", "Beef Cattle", "Dairy Cattle", "Cattle"] } },
          ],
        }),
        Animal.countDocuments({ $and: [query, { reproductiveStatus: "Pregnant" }] }),
        Animal.countDocuments({
          $and: [
            query,
            { reproductiveStatus: reproductiveStatusQuery("Normal") },
          ],
        }),
      ]);
 
      res.status(200).json({
        data: animals,
        animals,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
        totalPages: Math.ceil(total / limitNum),
        summary: {
          total,
          cattle: cattleCount,
          pregnant: pregnantCount,
          available: availableCount,
        },
      });
    } else {
      const animals = await Animal.find(query)
        .populate("farmerId", "name address")
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
    const { search, status, species } = req.query;
    const farmerId = req.user._id;

    const { page: pageNum, limit: limitNum, skip } = getPagination(req.query);
    const query = { farmerId, deletedAt: null };

    if (status && status !== "All") query.reproductiveStatus = status;
    if (species && species !== "All") query.species = species;
    if (search) {
      query.$or = [
        { animalId: { $regex: search, $options: "i" } },
        { earTag: { $regex: search, $options: "i" } },
        { breed: { $regex: search, $options: "i" } },
        { species: { $regex: search, $options: "i" } },
      ];
    }

    const [animals, total] = await Promise.all([
      Animal.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Animal.countDocuments(query),
    ]);

    res.status(200).json({
      data: animals,
      total,
      page: pageNum,
      limit: limitNum,
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
    const [
      animal,
      offspring,
      inseminationsList,
      calvings,
      pregnancies,
      healthRecords,
      reproductiveTasks,
    ] = await Promise.all([
      Animal.findOne({ _id: id, deletedAt: null })
        .populate("farmerId", "-password")
        .populate(
          "motherId",
          "earTag animalId breed species imageUrl reproductiveStatus",
        ),
      Animal.find({ motherId: id, deletedAt: null }).select(
        "earTag animalId breed species gender imageUrl reproductiveStatus birthDate",
      ),
      Insemination.find({ animalId: id, deletedAt: null })
        .populate("approvedBy", "name email imageUrl")
        .sort({ attemptNumber: -1 }),
      Calving.find({ animalId: id, deletedAt: null })
        .populate("pregnancyId")
        .populate("calves.animalId")
        .sort({ date: -1 }),
      Pregnancy.find({ animalId: id, deletedAt: null }).sort({
        "pregnancyDiagnosis.date": -1,
        createdAt: -1,
      }),
      HealthRequest.find({ animalId: id, deletedAt: null })
        .populate("handledBy", "name")
        .sort({ createdAt: -1 }),
      Task.find({
        animalIds: id,
        taskType: {
          $in: ["AI", "PD", "Calving", "CD"],
        },
        status: {
          $in: [
            TASK_STATUS.PENDING,
            TASK_STATUS.IN_PROGRESS,
          ],
        },
      })
        .sort({
          dueDate: 1,
          createdAt: 1,
        })
        .lean(),
    ]);
    if (!animal) {
      return res.status(404).json({
        message: "Animal not found",
      });
    }
    assertAnimalAccess(req.user, animal);
    const policyResolution = await loadPregnancyConfirmationPolicy();
    const inseminations = inseminationsList.map((insemination) => {
      const pregnancy = pregnancies.find(
        (item) =>
          item.inseminationId &&
          item.inseminationId.toString() ===
            insemination._id.toString(),
      );
      return {
        ...insemination.toObject(),
        pregnancy: pregnancy || null,
        pregnancyReadiness: getPregnancyCheckReadiness({
          insemination,
          policy: policyResolution.policy,
          species: animal.species,
        }),
      };
    });
    const activeRequest =
      inseminationsList.find((insemination) =>
        isActiveAIRequestStatus(insemination.status),
      ) || null;
    const calvedPregnancyIds = new Set(calvings.map((item) => String(item.pregnancyId?._id || item.pregnancyId)));
    const latestPregnantRecord =
      pregnancies.find(
        (pregnancy) =>
          pregnancy.pregnancyDiagnosis?.result === "Pregnant" &&
          !["completed", "lost"].includes(pregnancy.cycleStatus) &&
          !calvedPregnancyIds.has(String(pregnancy._id)),
      ) || null;
    // Pregnancy records are historical. Only treat one as active
    // while the animal itself is currently marked Pregnant.
    const activePregnancy =
      animal.reproductiveStatus ===
      ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
        ? latestPregnantRecord
        : null;
    const nextAction = resolveReproductionNextAction({
      animal,
      activeRequest,
      activePregnancy,
      tasks: reproductiveTasks,
    });
    return res.status(200).json({
      ...animal.toObject(),
      ...(calvings.length ? { expectedCalvingDate: undefined } : {}),
      offspring,
      inseminations,
      calvings,
      healthRecords,
      nextAction,
      nextActionAt: nextAction?.at || null,
    });
  } catch (error) {
    console.error("Error fetching animal details:", error);
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
        code: error.code,
      });
    }
    return res.status(500).json({
      message: "Failed to fetch animal details",
    });
  }
};

export const updateAnimalWizard = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const lifecycleFields = [
      "aiDate",
      "noOfAI",
      "estrusType",
      "sireBreed",
      "sireCode",
      "pdDate",
      "pdResult",
      "calfDate",
      "calfId",
      "calfSex",
      "calvingEase",
    ];
    const suppliedLifecycleFields = lifecycleFields.filter(
      (field) => payload[field] !== undefined,
    );
    if (suppliedLifecycleFields.length > 0) {
      return res.status(400).json({
        message:
          "Animal profile editing cannot create or change AI, pregnancy, or calving records. Use the dedicated record action instead.",
        code: "LIFECYCLE_FIELDS_NOT_ALLOWED",
        fields: suppliedLifecycleFields,
      });
    }
    
    // Step 1: Handle Animal identity
    const animal = await Animal.findOne({ _id: id, deletedAt: null });
    if (!animal) return res.status(404).json({ message: "Animal not found" });
 
    assertAnimalAccess(req.user, animal);
 
    if (payload.animalId) animal.animalId = payload.animalId;
    if (payload.earTag) animal.earTag = payload.earTag;
    if (payload.brand) animal.brand = payload.brand;
    if (payload.species) animal.species = payload.species;
    if (payload.breed) animal.breed = payload.breed;
    if (payload.color) animal.color = payload.color;
    if (payload.gender) animal.gender = payload.gender;
    if (payload.birthDate) animal.birthDate = new Date(payload.birthDate);
    
    if (payload.imageUrl) {
      if (payload.imageUrl.startsWith("data:image")) {
        try {
          const uploadResponse = await cloudinary.uploader.upload(payload.imageUrl, {
            folder: "livestock_profiles",
          });
          animal.imageUrl = uploadResponse.secure_url;
        } catch (uploadError) {
          console.error("[updateAnimalWizard IMAGE UPLOAD ERROR]", uploadError);
        }
      } else {
        animal.imageUrl = payload.imageUrl;
      }
    }

    if (!animal.barangay) {
      const farmer = await User.findById(animal.farmerId);
      if (farmer) animal.barangay = farmer.address?.barangay || "Not Provided";
    }
    
    await animal.save();

    res.status(200).json({ message: "Animal profile updated successfully", animal });
  } catch (error) {
    console.error("Wizard Update API Error:", error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
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
      Insemination.updateMany(
        { animalId: id },
        { $set: { deletedAt: deleteTime }, $unset: { activeRequestKey: 1 } },
      ),
      Calving.updateMany({ animalId: id }, { $set: { deletedAt: deleteTime } }),
      HealthRequest.updateMany(
        { animalId: id },
        { $set: { deletedAt: deleteTime }, $unset: { activeCaseKey: 1 } },
      ),
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
      outcome: submittedOutcome,
      numberOfCalves,
      calves,
      nonLivingCalves,
      technicianNote,
      taskId,
    } = req.body;

    // 1. Validate Mother & Pregnancy
    const mother = await Animal.findOne({ _id: animalId, deletedAt: null });
    if (!mother) return res.status(404).json({ message: "Mother animal not found" });

    // Permission check: Farmer can only record for their own animals
    if (req.user.role === "farmer" && mother.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized." });
    }
    if (req.user.role === "farmer" && (req.body.earlyCalvingOverride || req.body.allowEarlyCalving)) {
      return res.status(403).json({
        message: "Farmers cannot override early-calving safeguards.",
        code: "EARLY_CALVING_OVERRIDE_FORBIDDEN",
      });
    }
    if (!["farmer", "technician", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized role." });
    }

    const pregnancy = pregnancyId
      ? await Pregnancy.findOne({ _id: pregnancyId, deletedAt: null })
      : null;
    
    if (!pregnancy) return res.status(404).json({ message: "Pregnancy record not found. Please ensure the animal is confirmed pregnant first." });

    const { calving, offspring, outcome, alreadyRecorded } = await persistCalving({
      mother,
      pregnancy,
      calves,
      nonLivingCalves,
      date,
      calvingEase,
      outcome: submittedOutcome,
      numberOfCalves,
      technicianNote,
      actor: req.user,
      taskId,
    });

    // 6. Trigger Inngest & Socket
    if (!alreadyRecorded) {
      try {
        await inngest.send({
          name: "livestock/calving-recorded",
          data: {
            animalId,
            farmerId: mother.farmerId,
            calvingId: calving._id,
            numberOfCalves: offspring.length,
            offspringIds: offspring.map(c => c._id),
            outcome,
          },
        });
      } catch (inngestErr) {
        console.error("[recordCalving INNGEST ERROR]", inngestErr.message);
      }
    }

    if (!alreadyRecorded) {
      req.app.get("io").emit("dashboardUpdate", {
        type: "CALVING_RECORDED",
        motherId: animalId,
      });
    }

    res.status(alreadyRecorded ? 200 : 201).json({
      message: alreadyRecorded
        ? "This calving was already recorded. The original result has been returned."
        : ["live_birth", "mixed"].includes(outcome)
          ? "Calving and offspring registered successfully"
          : outcome === "stillbirth"
            ? "Stillbirth event recorded successfully"
            : "Pregnancy-loss event recorded successfully",
      code: alreadyRecorded ? "CALVING_ALREADY_RECORDED" : undefined,
      calving,
      offspring,
    });
  } catch (error) {
    console.error("[recordCalving ERROR]", error);
    res.status(error.status || 500).json({
      message: error.message || "Failed to record calving",
      code: error.code,
    });
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


