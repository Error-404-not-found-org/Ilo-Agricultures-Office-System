import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import cloudinary from "../config/cloudinary.js";

// GET /api/user/me — returns the logged-in user's full MongoDB profile
export const getMe = async (req, res) => {
  try {
    // req.user is already populated by protectedRoute middleware
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    // Return their stats if they are a farmer
    let stats = {};
    if (user.role === "farmer") {
      const now = new Date();
      const next30Days = new Date();
      next30Days.setDate(now.getDate() + 30);

      // 1. Waiting for Result: Approved AI procedures that don't have a pregnancy record yet
      // OR AI requests still pending
      const waitingForResult = await Insemination.countDocuments({
        farmerId: user._id,
        status: { $in: ["pending", "approved", "done"] },
        deletedAt: null
      });
      
      // We'll refine this: Inseminations with no pregnancy diagnostic yet
      const inseminations = await Insemination.find({ 
        farmerId: user._id, 
        status: { $ne: "rejected" },
        deletedAt: null 
      }).select("_id");
      const insIds = inseminations.map(i => i._id);
      
      const diagnoses = await Pregnancy.find({ inseminationId: { $in: insIds }, deletedAt: null }).select("inseminationId");
      const diagnosedInsIds = diagnoses.map(d => d.inseminationId.toString());
      
      const pendingResults = insIds.filter(id => !diagnosedInsIds.includes(id.toString())).length;

      // 2. Active Pregnancies: Animals currently marked as "Pregnant" in the Animal model
      const activePregnancies = await Animal.countDocuments({
        farmerId: user._id,
        reproductiveStatus: "Pregnant",
        deletedAt: null
      });

      // 3. Upcoming Calving: Confirmed pregnant and due within 30 days
      const upcomingCalvings = await Pregnancy.countDocuments({
        farmerId: user._id,
        "pregnancyDiagnosis.result": "Pregnant",
        targetCalvingDate: { $gte: now, $lte: next30Days },
        deletedAt: null
      });

      const totalAnimals = await Animal.countDocuments({ farmerId: user._id, deletedAt: null });
      const totalCalves = await Calving.countDocuments({ farmerId: user._id, deletedAt: null });

      stats = { 
        totalAnimals, 
        activePregnancies, 
        upcomingCalvings, 
        pendingResults,
        totalCalves
      };
    }

    res.status(200).json({ ...user.toObject(), stats });
  } catch (error) {
    console.error("[getMe ERROR]", error);
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

    req.app.get("io").emit("dashboardUpdate", {
      type: "FARMER_REGISTERED",
      message: `New farmer ${fullName} registered.`,
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
    const { role, page, limit, search } = req.query;

    const query = {};
    if (role) query.role = role;

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // If pagination params are provided, paginate
    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      const [users, total] = await Promise.all([
        User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        User.countDocuments(query),
      ]);

      return res.status(200).json({
        data: users,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    // Fallback: return all (backwards compat)
    const users = await User.find(query).select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the user in our DB
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Attempt to delete from Clerk if clerkId exists
    if (user.clerkId) {
      try {
        await clerkClient.users.deleteUser(user.clerkId);
      } catch (clerkErr) {
        console.error("Error deleting user from Clerk:", clerkErr);
      }
    }

    // Delete associated data
    await Animal.deleteMany({ farmerId: id });
    await Insemination.deleteMany({ farmerId: id });
    await HealthRequest.deleteMany({ farmerId: id });
    await Pregnancy.deleteMany({ farmerId: id });
    await Calving.deleteMany({ farmerId: id });

    // Finally, delete the user from our DB
    await User.findByIdAndDelete(id);

    return res.status(200).json({ message: "User successfully deleted" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Internal server error while deleting user." });
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

    const emailObj = user.emailAddresses?.[0];
    const email = emailObj?.emailAddress;
    const username = user.username;

    // In free tier, users might sign up with just a Username instead of Email
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || username || "New User";
    const isVerified = emailObj?.verification?.status === "verified" || !!username;

    // 1. Search for existing sync
    let dbUser = await User.findOne({ clerkId: userId });

    // 2. Search by Email
    if (!dbUser && email) {
      dbUser = await User.findOne({ email });
    }

    // 3. Search by Name (Offline Profiles Only)
    if (!dbUser && name && name !== "New User") {
      dbUser = await User.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        clerkId: { $exists: false } // Target offline profiles
      });
    }

    if (dbUser) {
      // Merge Account
      dbUser.clerkId = userId;
      if (email && !dbUser.email) dbUser.email = email;
      dbUser.imageUrl = user.imageUrl || dbUser.imageUrl;
      dbUser.isVerified = true;
      await dbUser.save();
    } else {
      // Create Brand New Account
      dbUser = await User.create({
        clerkId: userId,
        name: name,
        email: email || undefined,
        imageUrl: user.imageUrl || "",
        isVerified: isVerified,
        role: "farmer",
      });
    }

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
        deletedAt: null
      });
      const pendingInseminations = await Insemination.countDocuments({
        approvedBy: id,
        status: "pending",
        deletedAt: null
      });
      const approvedInseminations = await Insemination.countDocuments({
        approvedBy: id,
        status: "approved",
        deletedAt: null
      });

      stats = {
        totalInseminations,
        pendingInseminations,
        approvedInseminations,
      };
    } else if (user.role === "farmer") {
      const totalInseminations = await Insemination.countDocuments({
        farmerId: id,
        deletedAt: null
      });
      const successfulInseminations = await Pregnancy.countDocuments({
        farmerId: id,
        "pregnancyDiagnosis.result": "Pregnant",
        deletedAt: null
      });
      const activePregnancies = await Animal.countDocuments({
        farmerId: id,
        reproductiveStatus: "Pregnant",
        deletedAt: null
      });

      const animalsList = await Animal.find({ farmerId: id, deletedAt: null }).sort({ createdAt: -1 }).lean();
      
      const animals = await Promise.all(animalsList.map(async (animal) => {
        const totalCalves = await Animal.countDocuments({ motherId: animal._id });
        const lastInsemination = await Insemination.findOne({ animalId: animal._id }).sort({ createdAt: -1 });
        const lastHealth = await HealthRequest.findOne({ animalId: animal._id }).sort({ createdAt: -1 });
        
        let lastServiceDate = null;
        if (lastInsemination && lastHealth) {
            lastServiceDate = lastInsemination.createdAt > lastHealth.createdAt ? lastInsemination.createdAt : lastHealth.createdAt;
        } else if (lastInsemination) {
            lastServiceDate = lastInsemination.createdAt;
        } else if (lastHealth) {
            lastServiceDate = lastHealth.createdAt;
        }

        return { ...animal, totalCalves, lastServiceDate };
      }));

      stats = {
        totalInseminations,
        successfulInseminations,
        activePregnancies,
        animals,
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
    const { name, email, phoneNumber, status, address, imageUrl } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (email !== undefined) user.email = email;
    if (phoneNumber) {
      user.phoneNumber = phoneNumber;
      if (user.address) user.address.phoneNumber = phoneNumber;
    }
    if (status) user.status = status;

    // --- PHOTO UPLOAD & CLOUDINARY CLEANUP CASCADE ---
    if (imageUrl !== undefined) {
      if (imageUrl === "" || imageUrl === null) {
        // User is deleting their profile photo
        if (user.imageUrl && user.imageUrl.includes("cloudinary.com")) {
          try {
            const oldUrlParts = user.imageUrl.split("/");
            const oldPublicIdWithExtension = oldUrlParts.slice(-2).join("/");
            const oldPublicId = oldPublicIdWithExtension.substring(0, oldPublicIdWithExtension.lastIndexOf("."));
            await cloudinary.uploader.destroy(oldPublicId);
            console.log(`[Cloudinary Cleanup] Deleted profile image: ${oldPublicId}`);
          } catch (cloudinaryError) {
            console.error("[Cloudinary Cleanup Error]", cloudinaryError);
          }
        }
        user.imageUrl = "";
      } else if (imageUrl.startsWith("data:image")) {
        // Upload new photo
        try {
          const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
            folder: "agriculture_profiles",
          });
          
          // Delete the old photo if it exists on Cloudinary
          if (user.imageUrl && user.imageUrl.includes("cloudinary.com")) {
            try {
              const oldUrlParts = user.imageUrl.split("/");
              const oldPublicIdWithExtension = oldUrlParts.slice(-2).join("/");
              const oldPublicId = oldPublicIdWithExtension.substring(0, oldPublicIdWithExtension.lastIndexOf("."));
              await cloudinary.uploader.destroy(oldPublicId);
              console.log(`[Cloudinary Cleanup] Deleted old profile image: ${oldPublicId}`);
            } catch (cloudinaryError) {
              console.error("[Cloudinary Cleanup Error]", cloudinaryError);
            }
          }

          user.imageUrl = uploadResponse.secure_url;
        } catch (err) {
          console.error("Cloudinary upload failed", err);
          return res.status(500).json({ message: "Image upload failed." });
        }
      }
    }

    // Partially update address if provided
    if (address) {
      if (!user.address) {
        user.address = address;
      } else {
        // Update fields individually to avoid overwriting the whole object incorrectly
        Object.keys(address).forEach(key => {
          user.address[key] = address[key];
        });
      }
      // Sync phoneNumber if it was provided inside address
      if (address.phoneNumber) user.phoneNumber = address.phoneNumber;
    }

    await user.save();

    req.app.get("io").emit("dashboardUpdate", {
      type: "FARMER_UPDATED",
      message: `Farmer ${user.name} profile updated.`,
      userId: id,
    });

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error updating user:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
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

    user.isVerified = true;
    await user.save();

    req.app.get("io").emit("dashboardUpdate", {
      type: "FARMER_VERIFIED",
      message: `Farmer ${user.name} is now verified.`,
      userId: user._id,
    });

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
export const updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    const userId = req.user._id;

    if (pushToken === undefined) {
      return res.status(400).json({ message: "Push token is required." });
    }

    await User.findByIdAndUpdate(userId, { pushToken });

    res.status(200).json({ message: "Push token updated successfully." });
  } catch (error) {
    console.error("[updatePushToken ERROR]", error);
    res.status(500).json({ message: "Failed to update push token." });
  }
};

export const getBreedingMilestones = async (req, res) => {
  try {
    const farmerId = req.user._id;

    // 1. Get completed inseminations with pending outcomes
    const inseminations = await Insemination.find({ 
      farmerId, 
      status: "done", 
      isSuccess: null,
      deletedAt: null
    })
      .populate("animalId", "earTag species breed")
      .sort({ createdAt: -1 });

    // 2. Get all active pregnancies (to calculate Calvings)
    const pregnancies = await Pregnancy.find({ 
      farmerId, 
      "pregnancyDiagnosis.result": "Pregnant",
      deletedAt: null
    })
      .populate("animalId", "earTag species breed")
      .sort({ targetCalvingDate: 1 });

    // 3. Get all calving records to identify pregnancies that have already calved
    const calvings = await Calving.find({ 
      farmerId, 
      deletedAt: null 
    }).select("pregnancyId");
    
    const calvedPregIds = calvings
      .map(c => c.pregnancyId?.toString())
      .filter(Boolean);

    const milestones = [];
    const now = new Date();

    // Process Pregnancies -> Upcoming Calvings (excluding already calved ones)
    pregnancies.forEach(p => {
      if (calvedPregIds.includes(p._id.toString())) return;

      if (p.targetCalvingDate) {
        const daysLeft = Math.ceil((new Date(p.targetCalvingDate).getTime() - now.getTime()) / (1000 * 3600 * 24));
        // Show Calving alerts only within 45 days of target date, or if overdue by up to 30 days
        if (daysLeft >= -30 && daysLeft <= 45) {
          milestones.push({
            type: "calving",
            title: "Upcoming Calving",
            animal: p.animalId,
            date: p.targetCalvingDate,
            daysLeft,
            priority: "high",
            relatedId: p._id
          });
        }
      }
    });

    // Process Inseminations -> Heat Checks (21 days) and PD Checks (60 days)
    inseminations.forEach(ins => {
      const aiDate = ins.inseminationDate || ins.createdAt;
      const daysSinceAI = Math.floor((now.getTime() - new Date(aiDate).getTime()) / (1000 * 3600 * 24));

      // Heat Watch (21 days) - show between day 15 and day 25 post-AI
      if (daysSinceAI >= 15 && daysSinceAI <= 25) {
        const heatDate = new Date(aiDate);
        heatDate.setDate(heatDate.getDate() + 21);
        
        milestones.push({
          type: "heat_check",
          title: "Heat Watch",
          animal: ins.animalId,
          date: heatDate,
          daysLeft: Math.ceil((heatDate.getTime() - now.getTime()) / (1000 * 3600 * 24)),
          priority: "medium",
          relatedId: ins._id
        });
      }

      // Preg-Check Due (60 days) - show between day 26 and day 90 post-AI
      if (daysSinceAI >= 26 && daysSinceAI <= 90) {
        const pdDate = new Date(aiDate);
        pdDate.setDate(pdDate.getDate() + 60);
        
        milestones.push({
          type: "pd_check",
          title: "Preg-Check Due",
          animal: ins.animalId,
          date: pdDate,
          daysLeft: Math.ceil((pdDate.getTime() - now.getTime()) / (1000 * 3600 * 24)),
          priority: "medium",
          relatedId: ins._id
        });
      }
    });

    // Sort all milestones by date (closest first)
    milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.status(200).json(milestones);
  } catch (error) {
    console.error("[getBreedingMilestones ERROR]", error);
    res.status(500).json({ message: "Failed to fetch milestones." });
  }
};

export const getMyActivityFeed = async (req, res) => {
  try {
    const isTechnicianOrAdmin = req.user.role === "technician" || req.user.role === "admin";
    const query = isTechnicianOrAdmin ? {} : { farmerId: req.user._id };

    const [inseminations, healthRequests, calvings] = await Promise.all([
      Insemination.find(query).populate("animalId", "earTag").populate("farmerId", "name").sort({ createdAt: -1 }).limit(5),
      HealthRequest.find(query).populate("animalId", "earTag").populate("farmerId", "name").sort({ createdAt: -1 }).limit(5),
      Calving.find(query).populate("animalId", "earTag").populate("farmerId", "name").sort({ createdAt: -1 }).limit(5)
    ]);

    const feed = [
      ...inseminations.map(i => ({ 
        id: i._id, 
        title: isTechnicianOrAdmin 
          ? `AI on ${i.animalId?.earTag || 'Animal'} (${i.farmerId?.name || 'Farmer'})`
          : `AI performed on ${i.animalId?.earTag || 'Animal'}`, 
        description: i.status === 'done' ? 'Completed Service' : `Status: ${i.status}`,
        date: i.createdAt, 
        type: 'ai' 
      })),
      ...healthRequests.map(h => ({ 
        id: h._id, 
        title: isTechnicianOrAdmin 
          ? `Health Check — ${h.animalId?.earTag || 'Animal'} (${h.farmerId?.name || 'Farmer'})`
          : `Health Check — ${h.animalId?.earTag || 'Animal'}`, 
        description: `Status: ${h.status}`,
        date: h.createdAt, 
        type: 'health' 
      })),
      ...calvings.map(c => ({ 
        id: c._id, 
        title: isTechnicianOrAdmin 
          ? `Calving — ${c.animalId?.earTag || 'Animal'} (${c.farmerId?.name || 'Farmer'})`
          : `Calving recorded — ${c.animalId?.earTag || 'Animal'}`, 
        description: c.calvingEase ? `Ease: ${c.calvingEase}` : 'New Calf Recorded',
        date: c.createdAt, 
        type: 'calving' 
      }))
    ];

    // Sort by most recent
    feed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.status(200).json(feed.slice(0, 10));
  } catch (error) {
    console.error("[getMyActivityFeed ERROR]", error);
    res.status(500).json({ message: "Failed to fetch activity feed." });
  }
};
