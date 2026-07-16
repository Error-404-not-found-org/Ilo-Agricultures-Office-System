import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Task } from "../models/task.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import cloudinary from "../config/cloudinary.js";
import {
  assertCanReadUser,
  assertCanUpdateUser,
  assertUserAccess,
  assertAdmin,
  assertTechnicianOrAdmin,
} from "../policies/user.policy.js";
import { createAuditLog } from "../services/audit.service.js";
import { sendOtpSms, verifyOtpSms } from "../services/sms.service.js";
import {
  maskPhoneNumber,
  normalizePhilippineMobileNumber,
} from "../utils/phone.js";

// Structured Console Log Helper for Audit Trail
const logAdminAction = (action, admin, target, details = {}) => {
  const logObj = {
    action,
    timestamp: new Date().toISOString(),
    actingAdmin: admin
      ? {
          id: admin._id?.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }
      : null,
    target: target
      ? {
          id: target._id?.toString() || target.id,
          name: target.name,
          email: target.email,
          role: target.role,
        }
      : null,
    details,
  };
  console.log(`[AUDIT LOG] ${JSON.stringify(logObj)}`);
};

const FARM_LANDMARK_MAX_LENGTH = 80;
const FARM_DIRECTIONS_MAX_LENGTH = 250;
const LOCATION_CAPTURE_COOLDOWN_MS = 5 * 60 * 1000;
const OTP_SEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_FAILED_ATTEMPTS = 5;

const countFarmerOwnedRecords = async (farmerId) => {
  const [animals, aiRequests, healthRequests, pregnancies, calvings, tasks] =
    await Promise.all([
      Animal.countDocuments({ farmerId }),
      Insemination.countDocuments({ farmerId }),
      HealthRequest.countDocuments({ farmerId }),
      Pregnancy.countDocuments({ farmerId }),
      Calving.countDocuments({ farmerId }),
      Task.countDocuments({ farmerId }),
    ]);

  return animals + aiRequests + healthRequests + pregnancies + calvings + tasks;
};

const normalizeFarmLocationText = (value, fieldName, maxLength) => {
  if (value === undefined) return undefined;

  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  if (text.length > maxLength) {
    const message =
      fieldName === "landmark"
        ? `Farm landmark must be ${maxLength} characters or less.`
        : `Farm directions note must be ${maxLength} characters or less.`;
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }

  if (/https?:\/\/|www\./i.test(text)) {
    const error = new Error("Farm location notes cannot contain links.");
    error.statusCode = 400;
    throw error;
  }

  const compact = text.replace(/[\s.,!?'"-]/g, "");
  const uniqueCharacters = new Set(compact.toLowerCase()).size;
  const hasLetter = /[a-zA-Z]/.test(text);
  if (
    compact.length >= 4 &&
    (!hasLetter || uniqueCharacters <= 2 || /^(test|asdf|qwer|none|n\/a)$/i.test(compact))
  ) {
    const error = new Error(
      "Please enter a clear farm landmark or directions note.",
    );
    error.statusCode = 400;
    throw error;
  }

  return text;
};

const buildFarmLocationUpdate = (currentLocation, farmLocation, actor, source) => {
  const latitude = Number(farmLocation.latitude);
  const longitude = Number(farmLocation.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error("Valid farm latitude and longitude are required.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedLandmark = normalizeFarmLocationText(
    farmLocation.landmark,
    "landmark",
    FARM_LANDMARK_MAX_LENGTH,
  );
  const normalizedDirectionsNote = normalizeFarmLocationText(
    farmLocation.directionsNote,
    "directionsNote",
    FARM_DIRECTIONS_MAX_LENGTH,
  );
  const normalizedDetectedAddress = normalizeFarmLocationText(
    farmLocation.detectedAddress,
    "detectedAddress",
    160,
  );
  const isConfirmed =
    farmLocation.isConfirmed !== undefined
      ? Boolean(farmLocation.isConfirmed)
      : currentLocation?.isConfirmed || false;

  return {
    ...(currentLocation?.toObject?.() || currentLocation || {}),
    latitude,
    longitude,
    accuracy:
      farmLocation.accuracy !== undefined
        ? Number(farmLocation.accuracy)
        : currentLocation?.accuracy,
    landmark:
      normalizedLandmark !== undefined
        ? normalizedLandmark
        : currentLocation?.landmark || "",
    directionsNote:
      normalizedDirectionsNote !== undefined
        ? normalizedDirectionsNote
        : currentLocation?.directionsNote || "",
    detectedAddress:
      normalizedDetectedAddress !== undefined
        ? normalizedDetectedAddress
        : currentLocation?.detectedAddress || "",
    sameAsContactAddress:
      farmLocation.sameAsContactAddress !== undefined
        ? Boolean(farmLocation.sameAsContactAddress)
        : currentLocation?.sameAsContactAddress || false,
    isConfirmed,
    confirmedAt: isConfirmed ? new Date() : currentLocation?.confirmedAt || null,
    capturedBy: actor._id,
    capturedAt: new Date(),
    source,
  };
};

const assertLocationCaptureCooldown = (lastCapturedAt, actor, label) => {
  if (!lastCapturedAt || actor.role !== "farmer") return;
  const elapsedMs = Date.now() - new Date(lastCapturedAt).getTime();
  if (elapsedMs >= LOCATION_CAPTURE_COOLDOWN_MS) return;

  const remainingMinutes = Math.ceil(
    (LOCATION_CAPTURE_COOLDOWN_MS - elapsedMs) / 60000,
  );
  const error = new Error(
    `${label} was just updated. Please wait ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} before updating again.`,
  );
  error.statusCode = 429;
  throw error;
};

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
        deletedAt: null,
      });

      // We'll refine this: Inseminations with no pregnancy diagnostic yet
      const inseminations = await Insemination.find({
        farmerId: user._id,
        status: { $ne: "rejected" },
        deletedAt: null,
      }).select("_id");
      const insIds = inseminations.map((i) => i._id);

      const diagnoses = await Pregnancy.find({
        inseminationId: { $in: insIds },
        deletedAt: null,
      }).select("inseminationId");
      const diagnosedInsIds = diagnoses
        .filter((d) => d.inseminationId)
        .map((d) => d.inseminationId.toString());

      const pendingResults = insIds.filter(
        (id) => !diagnosedInsIds.includes(id.toString()),
      ).length;

      // 2. Active Pregnancies: Animals currently marked as "Pregnant" in the Animal model
      const activePregnancies = await Animal.countDocuments({
        farmerId: user._id,
        reproductiveStatus: "Pregnant",
        deletedAt: null,
      });

      // 3. Upcoming Calving: Confirmed pregnant and due within 30 days
      const upcomingCalvings = await Pregnancy.countDocuments({
        farmerId: user._id,
        "pregnancyDiagnosis.result": "Pregnant",
        targetCalvingDate: { $gte: now, $lte: next30Days },
        deletedAt: null,
      });

      const totalAnimals = await Animal.countDocuments({
        farmerId: user._id,
        deletedAt: null,
      });
      const totalCalves = await Calving.countDocuments({
        farmerId: user._id,
        deletedAt: null,
      });

      stats = {
        totalAnimals,
        activePregnancies,
        upcomingCalvings,
        pendingResults,
        totalCalves,
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
    const {
      firstName,
      middleName,
      lastName,
      suffix,
      email,
      phoneNumber,
      address,
      imageUrl,
      role,
    } = req.body;

    const requesterRole = req.user?.role;
    const targetRole = role || "farmer";

    if (requesterRole === "technician" && targetRole !== "farmer") {
      return res
        .status(403)
        .json({ message: "Technicians can only create Farmer accounts." });
    }
    if (requesterRole === "farmer") {
      return res
        .status(403)
        .json({ message: "Farmers cannot create accounts." });
    }

    if (targetRole === "technician" && !email) {
      return res
        .status(400)
        .json({ message: "Email is required to invite a field officer." });
    }

    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User with this email already exists." });
      }
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

    const fullName = [firstName, middleName, lastName, suffix]
      .filter(Boolean)
      .join(" ");

    let invitedUser;
    if (email) {
      // 1. Send Clerk Invitation (automatically emails the user)
      try {
        await clerkClient.invitations.createInvitation({
          emailAddress: email,
          publicMetadata: {
            role: targetRole,
            isVerified: true,
          },
        });
      } catch (clerkErr) {
        console.error("Clerk invitation failed:", clerkErr);
        return res.status(400).json({
          message:
            clerkErr.errors?.[0]?.message ||
            "Failed to send invitation via Clerk.",
        });
      }

      // 2. Pre-create user in local database
      invitedUser = await User.create({
        name: fullName,
        email,
        phoneNumber,
        address,
        imageUrl: finalImageUrl,
        role: targetRole,
        isVerified: false,
      });
    } else {
      // Create local offline user (no Clerk account/invitation)
      invitedUser = await User.create({
        name: fullName,
        phoneNumber,
        address,
        imageUrl: finalImageUrl,
        role: targetRole,
        isVerified: false,
      });
    }

    // Audit & Log Admin Action
    logAdminAction("user invited/created", req.user, invitedUser, {
      role: targetRole,
      email,
    });
    await createAuditLog({
      entityType: "User",
      entityId: invitedUser._id,
      action: "create",
      actorId: req.user?._id,
      before: null,
      after: {
        name: invitedUser.name,
        email: invitedUser.email,
        role: invitedUser.role,
        isVerified: invitedUser.isVerified,
        status: invitedUser.status,
      },
      metadata: {
        actingAdmin: req.user?.email || req.user?.name,
        targetUser: invitedUser.email || invitedUser.name,
        timestamp: new Date().toISOString(),
      },
    });

    req.app.get("io").emit("dashboardUpdate", {
      type: "FARMER_REGISTERED",
      message: `New ${targetRole} ${fullName} registered.`,
    });

    res.status(201).json({
      message: email
        ? `Invitation email sent to ${email} successfully!`
        : `${targetRole} offline profile created successfully!`,
      newUser: invitedUser,
    });
  } catch (err) {
    console.error("Error creating invited user:", err);

    // Mongoose validation errors have errors as an object map (not an array)
    if (err.name === "ValidationError" && err.errors) {
      const firstKey = Object.keys(err.errors)[0];
      const readableField = firstKey.replace("address.", ""); // e.g. "zipCode"
      const readableMessage =
        err.errors[firstKey]?.message || "Validation failed";
      return res
        .status(400)
        .json({ message: `Invalid ${readableField}: ${readableMessage}` });
    }

    // Clerk API errors have errors as an array
    const clerkMessage =
      err.errors?.[0]?.longMessage || err.errors?.[0]?.message;

    const status = err.status || 500;
    const message = clerkMessage || err.message || "Failed to create user";
    res.status(status).json({ message, clerkError: !!err.clerkError });
  }
};

const enrichFarmerData = async (farmer) => {
  const farmerId = farmer._id;
  const now = new Date();

  // 1. Total Animals
  const animalsCount = await Animal.countDocuments({
    farmerId,
    deletedAt: null,
  });

  // 2. Active Cases count (Inseminations & Health Requests)
  const [activeAI, activeHealth] = await Promise.all([
    Insemination.countDocuments({
      farmerId,
      status: { $in: ["pending", "approved", "in-progress"] },
      deletedAt: null,
    }),
    HealthRequest.countDocuments({
      farmerId,
      status: {
        $in: [
          "pending",
          "triaged",
          "assigned",
          "approved",
          "scheduled",
          "in-progress",
          "in_progress",
        ],
      },
      deletedAt: null,
    }),
  ]);

  // 3. Next Scheduled Visit
  const [nextAI, nextHealth] = await Promise.all([
    Insemination.findOne({
      farmerId,
      scheduledDate: { $gte: now },
      deletedAt: null,
    })
      .sort({ scheduledDate: 1 })
      .select("scheduledDate")
      .lean(),
    HealthRequest.findOne({
      farmerId,
      scheduledDate: { $gte: now },
      deletedAt: null,
    })
      .sort({ scheduledDate: 1 })
      .select("scheduledDate")
      .lean(),
  ]);

  let nextVisit = null;
  const aiDate = nextAI?.scheduledDate;
  const healthDate = nextHealth?.scheduledDate;

  if (aiDate && healthDate) {
    nextVisit = aiDate < healthDate ? aiDate : healthDate;
  } else {
    nextVisit = aiDate || healthDate || null;
  }

  return {
    ...farmer.toObject(),
    phoneNumber: farmer.phoneNumber || farmer.address?.phoneNumber || "",
    animalsCount,
    activeCount: activeAI + activeHealth,
    nextVisit,
  };
};

export const getUsers = async (req, res) => {
  try {
    const {
      role,
      page,
      limit,
      search,
      barangay,
      status,
      city,
      accountStatus,
    } = req.query;

    const query = { deletedAt: null };

    if (req.user.role === "farmer") {
      if (role && !["technician", "veterinarian"].includes(role)) {
        return res
          .status(403)
          .json({
            message:
              "Forbidden - farmers can only query technicians or veterinarians.",
          });
      }
      if (!role) {
        query.role = { $in: ["technician", "veterinarian"] };
      } else {
        query.role = role;
      }
    } else {
      if (role) query.role = role;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }
    if (barangay) query["address.barangay"] = barangay;
    if (city) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { "address.city": city },
            { "address.municipality": city },
          ],
        },
      ];
    }
    if (accountStatus && accountStatus !== "all") {
      const supportedAccountStatuses = new Set([
        "connected",
        "no_app_account",
        "profile_only",
        "blocked",
      ]);

      if (!supportedAccountStatuses.has(accountStatus)) {
        return res.status(400).json({ message: "Invalid account status filter." });
      }

      const withoutRealClerkAccount = {
        $or: [
          { clerkId: { $exists: false } },
          { clerkId: null },
          { clerkId: "" },
          { clerkId: { $regex: /^manual_/ } },
        ],
      };

      let accountStatusFilter;
      if (accountStatus === "connected") {
        accountStatusFilter = {
          $and: [
            { profileClaimStatus: { $ne: "blocked" } },
            {
              $or: [
                { profileClaimStatus: "claimed" },
                {
                  clerkId: {
                    $exists: true,
                    $nin: [null, ""],
                    $not: /^manual_/,
                  },
                },
              ],
            },
          ],
        };
      } else if (accountStatus === "no_app_account") {
        accountStatusFilter = {
          $and: [
            withoutRealClerkAccount,
            {
              $or: [
                { profileClaimStatus: "unclaimed" },
                {
                  registeredByTechnician: true,
                  email: { $in: [null, ""] },
                },
              ],
            },
          ],
        };
      } else if (accountStatus === "profile_only") {
        accountStatusFilter = {
          $and: [
            withoutRealClerkAccount,
            {
              profileClaimStatus: {
                $nin: ["claimed", "unclaimed", "blocked"],
              },
            },
            {
              $nor: [
                {
                  registeredByTechnician: true,
                  email: { $in: [null, ""] },
                },
              ],
            },
          ],
        };
      } else {
        accountStatusFilter = { profileClaimStatus: "blocked" };
      }

      query.$and = [...(query.$and || []), accountStatusFilter];
    }
    if (status === "active") query.isVerified = true;
    if (status === "inactive") query.isVerified = { $ne: true };

    let selectFields = "-password";
    if (req.user.role === "farmer") {
      selectFields = "name role status imageUrl email phoneNumber address";
    }

    // If pagination params are provided, paginate
    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      const [users, total] = await Promise.all([
        User.find(query)
          .select(selectFields)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        User.countDocuments(query),
      ]);

      let responseData = users;
      if (req.user.role !== "farmer" && role === "farmer") {
        responseData = await Promise.all(users.map((u) => enrichFarmerData(u)));
      }

      return res.status(200).json({
        data: responseData,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    // Fallback: return all (backwards compat)
    const users = await User.find(query)
      .select(selectFields)
      .sort({ createdAt: -1 });

    let responseData = users;
    if (req.user.role !== "farmer" && role === "farmer") {
      responseData = await Promise.all(users.map((u) => enrichFarmerData(u)));
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    assertAdmin(req.user);

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).json({ message: "User not found" });
    }

    // Attempt to suspend/deactivate Clerk user
    if (user.clerkId) {
      try {
        await clerkClient.users.banUser(user.clerkId);
        console.log(`[Clerk Deactivation] Banned user: ${user.clerkId}`);
      } catch (clerkErr) {
        console.error("Error suspending user in Clerk:", clerkErr);
      }
    }

    // Soft delete the user, keeping associated data intact
    user.deletedAt = new Date();
    user.deactivatedBy = req.user._id;
    await user.save();

    return res.status(200).json({ message: "User successfully deactivated" });
  } catch (error) {
    console.error("Error deactivating user:", error);
    const status = error.status || 500;
    return res
      .status(status)
      .json({
        message:
          error.message || "Internal server error while deactivating user.",
      });
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

export const getArchivedUsers = async (req, res) => {
  try {
    assertAdmin(req.user);
    const { role } = req.query;
    const query = { deletedAt: { $ne: null } };
    if (role && role !== "all") query.role = role;

    const users = await User.find(query)
      .select("-__v")
      .sort({ deletedAt: -1 })
      .lean();

    res.status(200).json({ data: users });
  } catch (error) {
    console.error("[getArchivedUsers ERROR]", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Failed to fetch archived users." });
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
    const name =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      username ||
      "New User";
    const isVerified =
      emailObj?.verification?.status === "verified" || !!username;

    // 1. Search for existing sync
    let dbUser = await User.findOne({ clerkId: userId });

    // 2. Search by Email
    if (!dbUser && email) {
      dbUser = await User.findOne({ email });
    }

    // 3. Search by Name (Offline Profiles Only)
    if (!dbUser && name && name !== "New User") {
      dbUser = await User.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        clerkId: { $exists: false }, // Target offline profiles
      });
    }

    if (dbUser) {
      // Merge Account
      dbUser.clerkId = userId;
      if (email && !dbUser.email) dbUser.email = email;
      dbUser.imageUrl = user.imageUrl || dbUser.imageUrl;
      dbUser.isVerified = true;
      dbUser.lastLogin = new Date();
      await dbUser.save();
    } else {
      // Create Brand New Account
      const role =
        email &&
        process.env.ADMIN_EMAIL &&
        email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
          ? "admin"
          : "farmer";
      dbUser = await User.create({
        clerkId: userId,
        name: name,
        email: email || undefined,
        imageUrl: user.imageUrl || "",
        isVerified: isVerified,
        role: role,
        lastLogin: new Date(),
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

    if (!user || (user.deletedAt && req.user.role !== "admin")) {
      return res.status(404).json({ message: "User not found" });
    }

    assertCanReadUser(req.user, user);

    let stats = {};
    let assignedAnimals = [];
    let serviceHistory = [];
    let loginHistory = [];
    let activityHistory = [];

    // Fetch Audit logs
    try {
      const { AuditLog } = await import("../models/audit-log.model.js");
      activityHistory = await AuditLog.find({
        $or: [{ actorId: id }, { entityId: id }],
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
    } catch (err) {
      console.error("Error fetching activity history:", err);
    }

    // Fetch Clerk active sessions/login history if clerkId exists
    if (user.clerkId) {
      try {
        const { clerkClient } = await import("@clerk/clerk-sdk-node");
        const sessions = await clerkClient.sessions.getSessionList({
          userId: user.clerkId,
        });
        loginHistory = sessions.map((s) => ({
          id: s.id,
          status: s.status,
          lastActiveAt: s.lastActiveAt,
          expireAt: s.expireAt,
          userAgent: s.latestActivity?.userAgent || "Unknown Device",
          ipAddress: s.latestActivity?.ipAddress || "Unknown IP",
        }));
      } catch (err) {
        console.error("Error fetching Clerk sessions:", err);
      }
    }

    if (user.role === "technician" || user.role === "veterinarian") {
      const totalInseminations = await Insemination.countDocuments({
        approvedBy: id,
        deletedAt: null,
      });
      const pendingInseminations = await Insemination.countDocuments({
        approvedBy: id,
        status: "pending",
        deletedAt: null,
      });
      const approvedInseminations = await Insemination.countDocuments({
        approvedBy: id,
        status: "approved",
        deletedAt: null,
      });

      stats = {
        totalInseminations,
        pendingInseminations,
        approvedInseminations,
      };

      // Assigned Animals: Animals that this tech did insemination or health request on
      const insAnimalIds = await Insemination.find({
        approvedBy: id,
        deletedAt: null,
      }).distinct("animalId");
      const healthAnimalIds = await HealthRequest.find({
        handledBy: id,
        deletedAt: null,
      }).distinct("animalId");
      const uniqueAnimalIds = [
        ...new Set([...insAnimalIds, ...healthAnimalIds].map(String)),
      ];
      assignedAnimals = await Animal.find({
        _id: { $in: uniqueAnimalIds },
        deletedAt: null,
      }).lean();

      // Service History
      const insHistory = await Insemination.find({
        approvedBy: id,
        deletedAt: null,
      })
        .populate("animalId", "earTag breed species")
        .sort({ createdAt: -1 })
        .lean();
      const healthHistory = await HealthRequest.find({
        handledBy: id,
        deletedAt: null,
      })
        .populate("animalId", "earTag breed species")
        .sort({ createdAt: -1 })
        .lean();
      serviceHistory = [
        ...insHistory.map((i) => ({ ...i, type: "ai" })),
        ...healthHistory.map((h) => ({ ...h, type: "health" })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (user.role === "farmer") {
      const totalInseminations = await Insemination.countDocuments({
        farmerId: id,
        deletedAt: null,
      });
      const successfulInseminations = await Pregnancy.countDocuments({
        farmerId: id,
        "pregnancyDiagnosis.result": "Pregnant",
        deletedAt: null,
      });
      const activePregnancies = await Animal.countDocuments({
        farmerId: id,
        reproductiveStatus: "Pregnant",
        deletedAt: null,
      });

      const animalsList = await Animal.find({ farmerId: id, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean();

      const animals = await Promise.all(
        animalsList.map(async (animal) => {
          const totalCalves = await Animal.countDocuments({
            motherId: animal._id,
          });
          const lastInsemination = await Insemination.findOne({
            animalId: animal._id,
          }).sort({ createdAt: -1 });
          const lastHealth = await HealthRequest.findOne({
            animalId: animal._id,
          }).sort({ createdAt: -1 });

          let lastServiceDate = null;
          if (lastInsemination && lastHealth) {
            lastServiceDate =
              lastInsemination.createdAt > lastHealth.createdAt
                ? lastInsemination.createdAt
                : lastHealth.createdAt;
          } else if (lastInsemination) {
            lastServiceDate = lastInsemination.createdAt;
          } else if (lastHealth) {
            lastServiceDate = lastHealth.createdAt;
          }

          return { ...animal, totalCalves, lastServiceDate };
        }),
      );

      stats = {
        totalInseminations,
        successfulInseminations,
        activePregnancies,
        animals,
      };

      assignedAnimals = animals;

      // Service History
      const insHistory = await Insemination.find({
        farmerId: id,
        deletedAt: null,
      })
        .populate("animalId", "earTag breed species")
        .sort({ createdAt: -1 })
        .lean();
      const healthHistory = await HealthRequest.find({
        farmerId: id,
        deletedAt: null,
      })
        .populate("animalId", "earTag breed species")
        .sort({ createdAt: -1 })
        .lean();
      const taskHistory = await Task.find({ farmerId: id })
        .populate("animalIds", "earTag animalId breed species")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      serviceHistory = [
        ...insHistory.map((i) => ({ ...i, type: "ai" })),
        ...healthHistory.map((h) => ({ ...h, type: "health" })),
        ...taskHistory.map((t) => ({
          ...t,
          type: "task",
          animalId: t.animalIds?.[0] || null,
          details: {
            taskType: t.taskType,
            notes: t.notes,
            dueDate: t.dueDate,
          },
        })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Fetch custom technician field notes
      var fieldNotes = [];
      try {
        const { FieldNote } = await import("../models/field-note.model.js");
        fieldNotes = await FieldNote.find({
          $or: [
            { farmerId: id },
            { farmerName: { $regex: new RegExp(`^${user.name}$`, "i") } },
          ],
          deletedAt: null,
        })
          .populate("technicianId", "name")
          .sort({ createdAt: -1 })
          .lean();
      } catch (err) {
        console.error("Error fetching field notes:", err);
      }
    }

    res.status(200).json({
      ...user.toObject(),
      stats,
      assignedAnimals,
      serviceHistory,
      loginHistory,
      activityHistory,
      fieldNotes: fieldNotes || [],
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phoneNumber, status, role, address, imageUrl, farmLocation } =
      req.body;

    const user = await User.findById(id);

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: "User not found" });
    }

    assertCanUpdateUser(req.user, user, req.body);

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
            const oldPublicId = oldPublicIdWithExtension.substring(
              0,
              oldPublicIdWithExtension.lastIndexOf("."),
            );
            await cloudinary.uploader.destroy(oldPublicId);
            console.log(
              `[Cloudinary Cleanup] Deleted profile image: ${oldPublicId}`,
            );
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
              const oldPublicId = oldPublicIdWithExtension.substring(
                0,
                oldPublicIdWithExtension.lastIndexOf("."),
              );
              await cloudinary.uploader.destroy(oldPublicId);
              console.log(
                `[Cloudinary Cleanup] Deleted old profile image: ${oldPublicId}`,
              );
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
      if (address.locationCapture) {
        assertLocationCaptureCooldown(
          user.address?.locationCapturedAt,
          req.user,
          "Contact address location",
        );
      }
      const addressUpdate = { ...address };
      delete addressUpdate.locationCapture;
      if (addressUpdate.detectedAddress !== undefined) {
        addressUpdate.detectedAddress = normalizeFarmLocationText(
          addressUpdate.detectedAddress,
          "detectedAddress",
          160,
        );
      }
      if (address.locationCapture) {
        addressUpdate.locationCapturedAt = new Date();
      }
      if (!user.address) {
        user.address = addressUpdate;
      } else {
        // Update fields individually to avoid overwriting the whole object incorrectly
        Object.keys(addressUpdate).forEach((key) => {
          user.address[key] = addressUpdate[key];
        });
      }
      // Sync phoneNumber if it was provided inside address
      if (addressUpdate.phoneNumber) user.phoneNumber = addressUpdate.phoneNumber;
    }

    if (farmLocation !== undefined) {
      if (farmLocation === null) {
        user.farmLocation = null;
      } else {
        if (farmLocation.locationCapture) {
          assertLocationCaptureCooldown(
            user.farmLocation?.capturedAt,
            req.user,
            "Farm location",
          );
        }
        user.farmLocation = buildFarmLocationUpdate(
          user.farmLocation,
          farmLocation,
          req.user,
          req.user.role === "farmer" ? "farmer_current_location" : "manual",
        );
      }
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
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
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
      deletedAt: null,
    })
      .populate("animalId", "animalId earTag species breed")
      .sort({ createdAt: -1 });

    // 2. Get all active pregnancies (to calculate Calvings)
    const pregnancies = await Pregnancy.find({
      farmerId,
      "pregnancyDiagnosis.result": "Pregnant",
      deletedAt: null,
    })
      .populate("animalId", "animalId earTag species breed")
      .sort({ targetCalvingDate: 1 });

    // 3. Get all calving records to identify pregnancies that have already calved
    const calvings = await Calving.find({
      farmerId,
      deletedAt: null,
    }).select("pregnancyId");

    const calvedPregIds = calvings
      .map((c) => c.pregnancyId?.toString())
      .filter(Boolean);

    const milestones = [];
    const now = new Date();

    // Process Pregnancies -> Upcoming Calvings (excluding already calved ones)
    pregnancies.forEach((p) => {
      if (calvedPregIds.includes(p._id.toString())) return;

      if (p.targetCalvingDate) {
        const daysLeft = Math.ceil(
          (new Date(p.targetCalvingDate).getTime() - now.getTime()) /
            (1000 * 3600 * 24),
        );
        // Show Calving alerts only within 45 days of target date, or if overdue by up to 30 days
        if (daysLeft >= -30 && daysLeft <= 45) {
          milestones.push({
            type: "calving",
            title: "Upcoming Calving",
            animal: p.animalId,
            date: p.targetCalvingDate,
            daysLeft,
            priority: "high",
            relatedId: p._id,
          });
        }
      }
    });

    // Process Inseminations -> Heat Checks (21 days) and PD Checks (60 days)
    inseminations.forEach((ins) => {
      const aiDate = ins.inseminationDate || ins.createdAt;
      const daysSinceAI = Math.floor(
        (now.getTime() - new Date(aiDate).getTime()) / (1000 * 3600 * 24),
      );

      // Heat Watch (21 days) - show between day 15 and day 25 post-AI
      if (daysSinceAI >= 15 && daysSinceAI <= 25) {
        const heatDate = new Date(aiDate);
        heatDate.setDate(heatDate.getDate() + 21);

        milestones.push({
          type: "heat_check",
          title: "Heat Watch",
          animal: ins.animalId,
          date: heatDate,
          daysLeft: Math.ceil(
            (heatDate.getTime() - now.getTime()) / (1000 * 3600 * 24),
          ),
          priority: "medium",
          relatedId: ins._id,
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
          daysLeft: Math.ceil(
            (pdDate.getTime() - now.getTime()) / (1000 * 3600 * 24),
          ),
          priority: "medium",
          relatedId: ins._id,
        });
      }
    });

    // Sort all milestones by date (closest first)
    milestones.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    res.status(200).json(milestones);
  } catch (error) {
    console.error("[getBreedingMilestones ERROR]", error);
    res.status(500).json({ message: "Failed to fetch milestones." });
  }
};

export const getMyActivityFeed = async (req, res) => {
  try {
    const isTechnicianOrAdmin =
      req.user.role === "technician" || req.user.role === "admin";
    const query = isTechnicianOrAdmin ? {} : { farmerId: req.user._id };

    const [inseminations, healthRequests, calvings] = await Promise.all([
      Insemination.find(query)
        .populate("animalId", "animalId earTag breed species")
        .populate("farmerId", "name")
        .populate("technicianId", "name")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .limit(5),
      HealthRequest.find(query)
        .populate("animalId", "animalId earTag breed species")
        .populate("farmerId", "name")
        .populate("handledBy", "name")
        .sort({ createdAt: -1 })
        .limit(5),
      Calving.find(query)
        .populate("animalId", "animalId earTag breed species")
        .populate("farmerId", "name")
        .populate("technicianId", "name")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const feed = [
      ...inseminations.map((i) => ({
        id: i._id,
        title:
          i.status === "done"
            ? isTechnicianOrAdmin
              ? `AI performed on ${i.animalId?.animalId || i.animalId?.earTag || "Animal"} (${i.farmerId?.name || "Farmer"})`
              : `AI performed on ${i.animalId?.animalId || i.animalId?.earTag || "Animal"}`
            : isTechnicianOrAdmin
              ? `AI requested for ${i.animalId?.animalId || i.animalId?.earTag || "Animal"} (${i.farmerId?.name || "Farmer"})`
              : `AI requested for ${i.animalId?.animalId || i.animalId?.earTag || "Animal"}`,
        description: i.deletedAt
          ? "Cancelled Request"
          : i.status === "done"
            ? "Completed Service"
            : i.status === "rejected"
              ? "Declined by Technician"
              : `Status: ${i.status}`,
        date: i.createdAt,
        type: "ai",
        animalId: i.animalId,
        details: {
          sireBreed: i.sireBreed || "N/A",
          sireCode: i.sireCode || "N/A",
          attemptNumber: i.attemptNumber || 1,
          estrus: i.estrus || "Natural",
          status: i.deletedAt ? "cancelled" : i.status,
          outcome: i.outcome || "Pending",
          technician: i.technicianId?.name || i.approvedBy?.name || "Pending",
          technicianNote: i.technicianNote || "No notes logged.",
          inseminationDate: i.inseminationDate,
          scheduledDate: i.scheduledDate || i.preferredDate,
        },
      })),
      ...healthRequests.map((h) => ({
        id: h._id,
        title: isTechnicianOrAdmin
          ? `Health Check — ${h.animalId?.animalId || h.animalId?.earTag || "Animal"} (${h.farmerId?.name || "Farmer"})`
          : `Health Check — ${h.animalId?.animalId || h.animalId?.earTag || "Animal"}`,
        description: h.deletedAt
          ? "Cancelled Request"
          : h.status === "resolved"
            ? "Completed checkup"
            : h.status === "rejected"
              ? "Declined by Technician"
              : `Status: ${h.status}`,
        date: h.createdAt,
        type: "health",
        animalId: h.animalId,
        details: {
          requestType: h.requestType || "checkup",
          symptoms: h.symptoms || "N/A",
          urgency: h.urgency || "medium",
          status: h.deletedAt ? "cancelled" : h.status,
          diagnosis: h.diagnosis || "No diagnosis logged.",
          treatment: h.treatment || "No treatment logged.",
          advice: h.advice || "No advice logged.",
          technician: h.handledBy?.name || "Pending",
          technicianNote: h.technicianNote || "No notes logged.",
          scheduledDate: h.scheduledDate || h.preferredDate,
        },
      })),
      ...calvings.map((c) => ({
        id: c._id,
        title: isTechnicianOrAdmin
          ? `Calving — ${c.animalId?.animalId || c.animalId?.earTag || "Animal"} (${c.farmerId?.name || "Farmer"})`
          : `Calving recorded — ${c.animalId?.animalId || c.animalId?.earTag || "Animal"}`,
        description: c.calvingEase
          ? `Ease: ${c.calvingEase}`
          : "New Calf Recorded",
        date: c.createdAt,
        type: "calving",
        animalId: c.animalId,
        details: {
          calvingEase: c.calvingEase || "Natural",
          numberOfCalves: c.numberOfCalves || 1,
          calves: c.calves || [],
          technician: c.technicianId?.name || "Technician",
          technicianNote: c.technicianNote || "No notes logged.",
          date: c.date,
        },
      })),
    ];

    // Sort by most recent
    feed.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    res.status(200).json(feed.slice(0, 10));
  } catch (error) {
    console.error("[getMyActivityFeed ERROR]", error);
    res.status(500).json({ message: "Failed to fetch activity feed." });
  }
};

export const restoreUser = async (req, res) => {
  try {
    assertAdmin(req.user);
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.deletedAt) {
      return res.status(400).json({ message: "User is not deactivated" });
    }

    // Unban User in Clerk
    if (user.clerkId) {
      try {
        await clerkClient.users.unbanUser(user.clerkId);
        console.log(`[Clerk Restoration] Unbanned user: ${user.clerkId}`);
      } catch (clerkErr) {
        console.error("Error unbanning user in Clerk:", clerkErr);
      }
    }

    user.deletedAt = null;
    user.deactivatedBy = undefined;
    await user.save();

    res.status(200).json({ message: "User successfully restored", data: user });
  } catch (error) {
    console.error("[restoreUser ERROR]", error);
    res
      .status(500)
      .json({ message: "Failed to restore user", error: error.message });
  }
};

export const sendPhoneOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const phone = normalizePhilippineMobileNumber(
      phoneNumber || req.user?.phoneNumber,
    );

    const currentVerification = req.user.phoneVerification || {};
    const lastSentAt = currentVerification.lastOtpSentAt
      ? new Date(currentVerification.lastOtpSentAt).getTime()
      : 0;
    const elapsedMs = Date.now() - lastSentAt;

    if (lastSentAt && elapsedMs < OTP_SEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_SEND_COOLDOWN_MS - elapsedMs) / 1000);
      return res.status(429).json({
        message: `Please wait ${waitSeconds} second(s) before requesting another OTP.`,
        code: "OTP_COOLDOWN",
        retryAfterSeconds: waitSeconds,
      });
    }

    await sendOtpSms(phone.local);

    req.user.phoneVerification = {
      ...(req.user.phoneVerification?.toObject?.() ||
        req.user.phoneVerification ||
        {}),
      pendingPhoneNumber: phone.local,
      pendingNormalizedPhoneNumber: phone.normalized,
      lastOtpSentAt: new Date(),
      failedAttempts: 0,
    };
    await req.user.save();

    res.status(200).json({
      message: "OTP sent successfully.",
      data: {
        phoneNumber: maskPhoneNumber(phone.local),
        expiresInMinutes: 5,
      },
    });
  } catch (error) {
    console.error("[sendPhoneOtp ERROR]", error.message);
    res.status(error.statusCode || 500).json({
      message: error.message || "Failed to send OTP.",
      code: error.statusCode === 503 ? "SMS_NOT_AVAILABLE" : "OTP_SEND_FAILED",
    });
  }
};

export const verifyPhoneOtp = async (req, res) => {
  try {
    const { phoneNumber, otpCode } = req.body;
    const phone = normalizePhilippineMobileNumber(
      phoneNumber || req.user?.phoneVerification?.pendingPhoneNumber,
    );
    const currentVerification = req.user.phoneVerification || {};

    if (
      currentVerification.pendingNormalizedPhoneNumber &&
      currentVerification.pendingNormalizedPhoneNumber !== phone.normalized
    ) {
      return res.status(400).json({
        message: "This OTP was requested for a different phone number.",
        code: "OTP_PHONE_MISMATCH",
      });
    }

    if ((currentVerification.failedAttempts || 0) >= OTP_MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({
        message: "Too many failed OTP attempts. Please request a new code.",
        code: "OTP_TOO_MANY_ATTEMPTS",
      });
    }

    try {
      await verifyOtpSms(phone.local, otpCode);
    } catch (error) {
      req.user.phoneVerification = {
        ...(req.user.phoneVerification?.toObject?.() ||
          req.user.phoneVerification ||
          {}),
        failedAttempts: (currentVerification.failedAttempts || 0) + 1,
      };
      await req.user.save();
      throw error;
    }

    const matchingPhoneUsers = await User.find({
      _id: { $ne: req.user._id },
      role: "farmer",
      deletedAt: null,
      $or: [
        { phoneNumber: phone.local },
        { normalizedPhoneNumber: phone.normalized },
      ],
    });

    const unclaimedProfiles = matchingPhoneUsers.filter((user) => {
      const hasRealClerkId =
        user.clerkId && !String(user.clerkId).startsWith("manual_");
      const isLegacyManualProfile =
        user.clerkId &&
        String(user.clerkId).startsWith("manual_") &&
        !user.email;
      return (
        (user.registeredByTechnician || isLegacyManualProfile) &&
        (user.profileClaimStatus === "unclaimed" ||
          (isLegacyManualProfile && user.profileClaimStatus !== "claimed")) &&
        !hasRealClerkId
      );
    });

    const alreadyLinkedProfiles = matchingPhoneUsers.filter(
      (user) => !unclaimedProfiles.some((profile) => profile._id.equals(user._id)),
    );

    if (alreadyLinkedProfiles.length > 0) {
      return res.status(409).json({
        message:
          "This phone number is already linked to another account. Please contact your technician or the office.",
        code: "PHONE_ALREADY_LINKED",
      });
    }

    if (unclaimedProfiles.length > 1) {
      return res.status(409).json({
        message:
          "This phone number matches multiple farmer profiles. Please contact your technician or the office for verification.",
        code: "PHONE_MULTIPLE_PROFILES",
      });
    }

    if (unclaimedProfiles.length === 1 && req.user.role === "farmer") {
      const existingProfile = unclaimedProfiles[0];
      const currentUserRecordCount = await countFarmerOwnedRecords(req.user._id);

      if (currentUserRecordCount > 0) {
        return res.status(409).json({
          message:
            "This account already has records. Please contact the office before linking another farmer profile.",
          code: "CURRENT_ACCOUNT_HAS_RECORDS",
        });
      }

      const currentUser = req.user;
      const clerkId = currentUser.clerkId;
      const email = currentUser.email;
      const imageUrl = currentUser.imageUrl;

      currentUser.clerkId = undefined;
      currentUser.deletedAt = new Date();
      currentUser.deactivatedBy = currentUser._id;
      await currentUser.save();

      existingProfile.clerkId = clerkId;
      if (email && !existingProfile.email) existingProfile.email = email;
      existingProfile.imageUrl = imageUrl || existingProfile.imageUrl;
      existingProfile.phoneNumber = phone.local;
      existingProfile.normalizedPhoneNumber = phone.normalized;
      if (existingProfile.address) existingProfile.address.phoneNumber = phone.local;
      existingProfile.isVerified = true;
      existingProfile.status = "active";
      existingProfile.profileClaimStatus = "claimed";
      existingProfile.profileClaimedAt = new Date();
      existingProfile.profileClaimedByClerkId = clerkId || "";
      existingProfile.phoneVerification = {
        ...(existingProfile.phoneVerification?.toObject?.() ||
          existingProfile.phoneVerification ||
          {}),
        pendingPhoneNumber: "",
        pendingNormalizedPhoneNumber: "",
        isVerified: true,
        verifiedAt: new Date(),
        failedAttempts: 0,
      };
      await existingProfile.save();

      await createAuditLog({
        entityType: "User",
        entityId: existingProfile._id,
        action: "claim_profile",
        actorId: existingProfile._id,
        before: {
          profileClaimStatus: "unclaimed",
          placeholderUserId: currentUser._id,
        },
        after: {
          profileClaimStatus: "claimed",
          linkedClerkId: clerkId,
          phoneNumber: phone.local,
        },
      });

      return res.status(200).json({
        message: "Phone verified and existing farmer profile linked.",
        data: {
          phoneNumber: maskPhoneNumber(phone.local),
          isVerified: true,
          linkedExistingProfile: true,
          user: existingProfile,
        },
      });
    }

    req.user.phoneNumber = phone.local;
    req.user.normalizedPhoneNumber = phone.normalized;
    if (req.user.address) req.user.address.phoneNumber = phone.local;
    req.user.phoneVerification = {
      ...(req.user.phoneVerification?.toObject?.() || req.user.phoneVerification || {}),
      pendingPhoneNumber: "",
      pendingNormalizedPhoneNumber: "",
      isVerified: true,
      verifiedAt: new Date(),
      failedAttempts: 0,
    };
    await req.user.save();

    res.status(200).json({
      message: "Phone number verified successfully.",
      data: {
        phoneNumber: maskPhoneNumber(phone.local),
        isVerified: true,
        linkedExistingProfile: false,
      },
    });
  } catch (error) {
    console.error("[verifyPhoneOtp ERROR]", error.message);
    res.status(error.statusCode || 400).json({
      message: error.message || "Invalid or expired OTP code.",
      code: "OTP_VERIFY_FAILED",
    });
  }
};

export const updateFarmerProfileByTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { address, phoneNumber, farmLocation } = req.body;

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "farmer") {
      return res
        .status(403)
        .json({ message: "Technicians can only update farmer profiles." });
    }

    const allowedKeys = ["address", "phoneNumber", "farmLocation"];
    const extraKeys = Object.keys(req.body).filter(
      (k) => !allowedKeys.includes(k),
    );
    if (extraKeys.length > 0) {
      return res.status(400).json({
        message: `Forbidden updates detected: ${extraKeys.join(", ")}. Only address and phoneNumber can be updated by technicians.`,
      });
    }

    if (phoneNumber) {
      user.phoneNumber = phoneNumber;
      if (user.address) user.address.phoneNumber = phoneNumber;
    }

    if (address) {
      if (address.locationCapture) {
        assertLocationCaptureCooldown(
          user.address?.locationCapturedAt,
          req.user,
          "Contact address location",
        );
      }
      user.address = {
        ...(user.address?.toObject?.() || user.address || {}),
        street:
          address.street !== undefined ? address.street : user.address?.street,
        barangay:
          address.barangay !== undefined
            ? address.barangay
            : user.address?.barangay,
        city: address.city !== undefined ? address.city : user.address?.city,
        province:
          address.province !== undefined
            ? address.province
            : user.address?.province,
        houseNumber:
          address.houseNumber !== undefined
            ? address.houseNumber
            : user.address?.houseNumber,
        detectedAddress:
          address.detectedAddress !== undefined
            ? normalizeFarmLocationText(address.detectedAddress, "detectedAddress", 160)
            : user.address?.detectedAddress,
        coordinates:
          address.coordinates !== undefined
            ? address.coordinates
            : user.address?.coordinates,
        locationCapturedAt: address.locationCapture
          ? new Date()
          : user.address?.locationCapturedAt,
      };
    }

    if (farmLocation !== undefined) {
      if (farmLocation === null) {
        user.farmLocation = null;
      } else {
        if (farmLocation.locationCapture) {
          assertLocationCaptureCooldown(
            user.farmLocation?.capturedAt,
            req.user,
            "Farm location",
          );
        }
        user.farmLocation = buildFarmLocationUpdate(
          user.farmLocation,
          farmLocation,
          req.user,
          "technician_current_location",
        );
      }
    }

    await user.save();

    res.status(200).json({
      message: "Farmer profile successfully updated by technician",
      data: user,
    });
  } catch (error) {
    console.error("[updateFarmerProfileByTechnician ERROR]", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to update farmer profile." });
  }
};
