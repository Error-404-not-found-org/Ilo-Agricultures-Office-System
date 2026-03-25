import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import cloudinary from "../config/cloudinary.js";

// GET /api/user/me — returns the logged-in user's full MongoDB profile
export const getMe = async (req, res) => {
  try {
    // req.user is already populated by protectedRoute middleware
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    // Also return their animals if they are a farmer
    let animals = [];
    if (user.role === "farmer") {
      animals = await Animal.find({ farmerId: user._id })
        .select("animalId earTag species breed")
        .sort({ createdAt: -1 });
    }

    res.status(200).json({ ...user.toObject(), animals });
  } catch (error) {
    console.error("[getMe ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your profile." });
  }
};


export const createInvitedUser = async (req, res) => {
  try {
    const { firstName, middleName, lastName, suffix, email, password, phoneNumber, address, imageUrl, role } =
      req.body;

    const requesterRole = req.user?.role;
    const targetRole = role || "farmer";

    if (requesterRole === "technician" && targetRole !== "farmer") {
      return res.status(403).json({ message: "Technicians can only create Farmer accounts." });
    }
    if (requesterRole === "farmer") {
      return res.status(403).json({ message: "Farmers cannot create accounts." });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists." });
    }

    let finalImageUrl = imageUrl || "";
    if (imageUrl && imageUrl.startsWith("data:image")) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
          folder: "agriculture_profiles",
        });
        finalImageUrl = uploadResponse.secure_url;
      } catch (err) {
        console.error("Cloudinary upload failed", err);
        return res.status(500).json({ message: "Image upload failed." });
      }
    }

    // Create real Clerk account directly (no invitation email)
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      firstName: firstName,
      lastName: lastName,
      publicMetadata: { 
        role: targetRole,
        isVerified: false 
      },
    });

    const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');

    const newUser = await User.create({
      clerkId: clerkUser.id,
      name: fullName,
      email,
      address,
      imageUrl: finalImageUrl,
      role: targetRole,
      isVerified: false,
    });

    res.status(201).json({
      message: `${targetRole} created successfully`,
      newUser,
      credentials: { email, password }, // returned once for admin to note
    });
  } catch (err) {
    console.error("Error creating invited user:", err);

    // Mongoose validation errors have errors as an object map (not an array)
    if (err.name === "ValidationError" && err.errors) {
      const firstKey = Object.keys(err.errors)[0];
      const readableField = firstKey.replace("address.", ""); // e.g. "zipCode"
      const readableMessage = err.errors[firstKey]?.message || "Validation failed";
      return res.status(400).json({ message: `Invalid ${readableField}: ${readableMessage}` });
    }

    // Clerk API errors have errors as an array
    const clerkMessage = err.errors?.[0]?.longMessage || err.errors?.[0]?.message;

    const status = err.status || 500;
    const message = clerkMessage || err.message || "Failed to create user";
    res.status(status).json({ message, clerkError: !!err.clerkError });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { role } = req.query;

    const query = {};
    if (role) {
      query.role = role;
    }

    const users = await User.find(query).select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// Admin: list all users with Clerk details (email, role, clerkId, status)
export const listAllUsersForAdmin = async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};
    const users = await User.find(query).select("-__v").lean();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error listing users for admin:", error);
    res.status(500).json({ message: "Failed to list users" });
  }
};

export const syncUser = async (req, res) => {
  try {
    const { userId } = req.auth;
    const user = await clerkClient.users.getUser(userId);

    const emailObj = user.emailAddresses[0];
    const email = emailObj?.emailAddress;

    if (!email) {
      return res.status(400).json({ message: "User has no email" });
    }

    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const isVerified = emailObj?.verification?.status === "verified";

    // Upsert user
    const dbUser = await User.findOneAndUpdate(
      { email },
      {
        clerkId: userId,
        name: name || "New User",
        imageUrl: user.imageUrl || "",
        isVerified,
        $setOnInsert: { role: "technician" }, // Default safe role if new
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Sync role from metadata if present
    if (user.publicMetadata?.role && dbUser.role !== user.publicMetadata.role) {
      dbUser.role = user.publicMetadata.role;
      await dbUser.save();
    }

    res.status(200).json({ message: "User synced", user: dbUser });
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ message: "Failed to sync user" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let stats = {};
    if (user.role === "technician") {
      const totalInseminations = await Insemination.countDocuments({
        approvedBy: id,
      });
      const pendingInseminations = await Insemination.countDocuments({
        approvedBy: id,
        status: "pending",
      });
      const approvedInseminations = await Insemination.countDocuments({
        approvedBy: id,
        status: "approved",
      });

      stats = {
        totalInseminations,
        pendingInseminations,
        approvedInseminations,
      };
    } else if (user.role === "farmer") {
      const totalInseminations = await Insemination.countDocuments({
        farmerId: id,
      });
      const animals = await Animal.find({ farmerId: id }).sort({ createdAt: -1 });

      stats = {
        totalInseminations,
        animals, // Included directly into the payload for the farmer's profile
      };
    }

    res.status(200).json({ ...user.toObject(), stats });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phoneNumber, status, address } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (email !== undefined) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (status) user.status = status;

    // Partially update address if provided
    if (address) {
      user.address = { ...user.address, ...address };
    }

    await user.save();

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

export const markVerified = async (req, res) => {
  try {
    const { userId } = req.auth;

    const user = await User.findOne({ clerkId: userId });
    if (!user) return res.status(404).json({ message: "User not found." });

    const clerkUser = await clerkClient.users.getUser(userId);

    // 1. Update Clerk Metadata
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        ...(clerkUser.publicMetadata || {}),
        isVerified: true,
      },
    });

    // 2. Update MongoDB
    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "User successfully verified.", user });
  } catch (error) {
    console.error("[markVerified ERROR]", error.message);
    res.status(500).json({ message: "Failed to verify user." });
  }
};

export const resendVerificationCode = async (req, res) => {
  try {
    const { userId } = req.auth;
    const user = await User.findOne({ clerkId: userId });
    if (!user) return res.status(404).json({ message: "User not found." });

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update Clerk Metadata
    const clerkUser = await clerkClient.users.getUser(userId);
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        ...(clerkUser.publicMetadata || {}),
        verificationCode: newCode,
      },
    });

    // Note: In production, send via email/SMS. Code is NOT logged for security.


    res.status(200).json({ message: "Verification code resent." });
  } catch (error) {
    console.error("[resendVerification ERROR]", error.message);
    res.status(500).json({ message: "Failed to resend code." });
  }
};
