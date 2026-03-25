import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

export const getMyInseminations = async (req, res) => {
  try {
    const inseminations = await Insemination.find()
      .populate("animalId", "animalId earTag species breed")
      .populate("farmerId", "name")
      .sort({ createdAt: -1 });
    res.status(200).send({ inseminations });
  } catch (error) {
    console.error("Error fetching inseminations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyReInseminations = async (req, res) => {
  //  const last = await Insemination.findOne({ animalId }).sort({
  //    attemptNumber: -1,
  //  });
  //  await Insemination.create({
  //    farmerId,
  //    animalId,
  //    technicianId,
  //    attemptNumber: last.attemptNumber + 1,
  //    status: "pending",
  //    requestedBy: "farmer",
  //  });
};

export const getMyPregnancyChecks = async (req, res) => {
  try {
    const pregnancyChecks = await Pregnancy.find()
      .populate("animalId", "animalId earTag species breed")
      .populate("farmerId", "name")
      .sort({ createdAt: -1 });
    res.status(200).send({ pregnancyChecks });
  } catch (error) {
    console.error("Error fetching pregnancy checks:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyCalvings = async (req, res) => {
  try {
    const calvings = await Calving.find()
      .populate("animalId", "animalId earTag species breed")
      .populate("farmerId", "name")
      .sort({ createdAt: -1 });
    res.status(200).send({ calvings });
  } catch (error) {
    console.error("Error fetching calvings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyNotifications = async (req, res) => {
  res.status(200).send({ notifications: [] });
};

export const getMyProfile = async (req, res) => {
  try {
    const profile = await User.findById(req.user._id);
    res.status(200).send({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Post functions for technician

export const walkInInsemination = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      imageUrl,
      animalDetails,
      inseminationDetails,
    } = req.body;

    // 🔴 Basic validation first
    if (!firstName || !lastName || !animalDetails || !inseminationDetails) {
      return res.status(400).json({
        message: "Missing required farmer, animal, or insemination data",
      });
    }

    // 1️⃣ Find or create farmer
    let farmer = null;

    if (email) {
      farmer = await User.findOne({ email });
    }

    if (!farmer) {
      farmer = await User.create({
        name: `${firstName} ${lastName}`,
        phoneNumber,
        email: email || undefined,
        address,
        imageUrl: imageUrl || "",
        role: "farmer",
        isVerified: !!email,
      });

      // Send Clerk invitation only if email exists
      if (email) {
        const invitation = await clerkClient.invitations.createInvitation({
          emailAddress: email,
          publicMetadata: { invitedBySystem: true },
          redirectUrl: "https://ilo-agricultures-inseminati-p5bbd.sevalla.app/",
        });

        farmer.clerkId = invitation.userId;
        await farmer.save();
      }
    }

    // 2️⃣ Find or register animal (avoid duplicates)
    let animal = await Animal.findOne({
      farmerId: farmer._id,
      earTag: animalDetails.earTag,
    });

    if (!animal) {
      animal = await Animal.create({
        farmerId: farmer._id,
        earTag: animalDetails.earTag,
        species: animalDetails.species,
        breed: animalDetails.breed,
        color: animalDetails.color || "",
        imageUrl: animalDetails.imageUrl || "",
      });
    }

    // 3️⃣ Get last insemination attempt
    const lastAttempt = await Insemination.findOne({
      animalId: animal._id,
    }).sort({ attemptNumber: -1 });

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    // 4️⃣ Create insemination record
    const insemination = await Insemination.create({
      farmerId: farmer._id,
      animalId: animal._id,
      inseminationDate: inseminationDetails.inseminationDate,
      sireBreed: inseminationDetails.sireBreed,
      sireCode: inseminationDetails.sireCode,
      estrus: inseminationDetails.estrus,
      attemptNumber,
      status: attemptNumber === 1 ? "approved" : "pending",
      approvedBy: attemptNumber === 1 ? req.user._id : null,
    });

    return res.status(201).json({
      message:
        "Walk-in farmer, animal, and insemination registered successfully",
      farmer,
      animal,
      insemination,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to process walk-in insemination",
      error,
    });
  }
};
