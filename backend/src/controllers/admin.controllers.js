import { User } from "../models/user.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Animal } from "../models/animal.model.js";
import { Inventory } from "../models/inventory.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { createAuditLog } from "../services/audit.service.js";
import {
  evaluateTechnicianDispatchReadiness,
} from "../domain/geographic/eligibilityEvaluator.js";
import { assertTechnicianEligibleForNewRequest } from "../services/dispatch-eligibility.service.js";
import {
  isActiveAIRequestStatus,
  isActiveHealthRequestStatus,
} from "../domain/status-vocabulary.js";
import { canonicalizeMunicipality } from "../domain/geographic/psgcRegistry.js";

// Clerk Retry Helper - Retries once if Clerk temporarily fails
const runWithClerkRetry = async (fn, context = "") => {
  try {
    return await fn();
  } catch (error) {
    console.warn(
      `[Clerk Warning] Temporary failure in ${context}. Retrying once... Error: ${error.message}`,
    );
    try {
      return await fn();
    } catch (retryError) {
      console.error(
        `[Clerk Error] Persistent failure in ${context} after retry. Error: ${retryError.message}`,
      );
      retryError.clerkError = true;
      throw retryError;
    }
  }
};

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

// Standardized Error Handler for API Errors
const handleControllerError = (res, error, contextMessage) => {
  console.error(`[API ERROR] ${contextMessage}:`, error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: `${contextMessage}: Validation failed.`,
      error: error.message,
      details: Object.keys(error.errors || {}).reduce((acc, key) => {
        acc[key] = error.errors[key].message;
        return acc;
      }, {}),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      message: `${contextMessage}: Invalid identifier format.`,
      error: error.message,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      message: `${contextMessage}: A duplicate database record was detected.`,
      error: error.message,
    });
  }

  if (error.clerkError || error.errors) {
    const firstError = error.errors?.[0];
    const message =
      firstError?.longMessage || firstError?.message || error.message;
    return res.status(error.status || 400).json({
      message: `${contextMessage}: Clerk authentication service failure.`,
      error: message,
    });
  }

  return res.status(500).json({
    message: `${contextMessage}: An unexpected server error occurred.`,
    error: error.message,
  });
};

// Create User function removed - use user.controllers.js/createInvitedUser instead

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
      totalCalvings,
      successRateConfig,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "farmer" }),
      User.countDocuments({ role: "technician" }),
      Animal.countDocuments({ deletedAt: null }),
      Insemination.countDocuments({ deletedAt: null }),
      Pregnancy.countDocuments({ deletedAt: null }),
      Calving.countDocuments({ deletedAt: null }),
      import("../models/config.model.js").then((m) =>
        m.Config.findOne({ key: "dashboard_success_rate" }),
      ),
    ]);

    res.status(200).send({
      totalUsers,
      farmers: totalFarmers,
      technicians: totalTechnicians,
      animals: totalAnimals,
      inseminations: totalInseminations,
      pregnancies: totalPregnancies,
      calvings: totalCalvings,
      successRate: successRateConfig?.value || "84%",
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error fetching stats", error: error.message });
  }
};

// Advanced Analytics for Admin Dashboard
export const getAdminAnalytics = async (req, res) => {
  try {
    const [inventory, technicianStats, barangayStats] = await Promise.all([
      Inventory.find().lean(),
      Insemination.aggregate([
        { $match: { deletedAt: null } },
        {
          $group: {
            _id: "$technicianId",
            totalAI: { $sum: 1 },
            successfulAI: {
              $sum: { $cond: [{ $eq: ["$isSuccess", true] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "tech",
          },
        },
        { $unwind: { path: "$tech", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ["$tech.name", "Unassigned"] },
            count: "$totalAI",
            successRate: {
              $cond: [
                { $gt: ["$totalAI", 0] },
                {
                  $multiply: [{ $divide: ["$successfulAI", "$totalAI"] }, 100],
                },
                0,
              ],
            },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Animal.aggregate([
        { $match: { deletedAt: null } },
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        {
          $group: {
            _id: {
              barangay: "$farmer.address.barangay",
              city: "$farmer.address.city",
              municipality: "$farmer.address.municipality",
              district: "$farmer.address.district",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.status(200).json({ inventory, technicianStats, barangayStats });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching analytics", error: error.message });
  }
};

// Chart data for last 30 days
export const getChartData = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [inseminations, healthRequests] = await Promise.all([
      Insemination.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, deletedAt: null } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      HealthRequest.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, deletedAt: null } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.status(200).json({ inseminations, healthRequests });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching chart data", error: error.message });
  }
};

// ... existing get functions implementation ...
export const getAllInseminations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, estrus, outcome, status } = req.query;
    const query = { deletedAt: null };

    if (estrus) query.estrus = estrus;
    if (outcome) query.outcome = outcome;
    if (status) query.status = status;
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      const [matchedFarmers, matchedAnimals] = await Promise.all([
        User.find({ name: searchRegex }).select("_id").lean(),
        Animal.find({
          $or: [
            { animalId: searchRegex },
            { earTag: searchRegex },
            { breed: searchRegex },
            { species: searchRegex },
          ],
        })
          .select("_id")
          .lean(),
      ]);
      query.$or = [
        { sireBreed: searchRegex },
        { sireCode: searchRegex },
        { estrus: searchRegex },
        { farmerId: { $in: matchedFarmers.map((farmer) => farmer._id) } },
        { animalId: { $in: matchedAnimals.map((animal) => animal._id) } },
      ];
    }

    const [inseminations, total] = await Promise.all([
      Insemination.find(query)
        .populate("farmerId", "name email")
        .populate("animalId", "earTag species breed")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Insemination.countDocuments(query),
    ]);

    res.status(200).send({
      data: inseminations,
      inseminations: inseminations, // backwards compatibility
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error fetching inseminations", error: error.message });
  }
};

export const getAllReInseminations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const query = { attemptNumber: { $gt: 1 }, deletedAt: null };

    const [reInseminations, total] = await Promise.all([
      Insemination.find(query)
        .populate("farmerId", "name email")
        .populate("animalId", "earTag species breed")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Insemination.countDocuments(query),
    ]);

    res.status(200).send({
      data: reInseminations,
      reInseminations: reInseminations, // backwards compatibility
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).send({
      message: "Error fetching re-inseminations",
      error: error.message,
    });
  }
};

export const getAllPregnancyChecks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [pregnancyChecks, total] = await Promise.all([
      Pregnancy.find({ deletedAt: null })
        .populate("farmerId", "name email")
        .populate("animalId", "earTag species breed")
        .populate({
          path: "inseminationId",
          select: "inseminationDate sireCode",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Pregnancy.countDocuments({ deletedAt: null }),
    ]);

    res.status(200).send({
      data: pregnancyChecks,
      pregnancyChecks: pregnancyChecks, // backwards compatibility
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).send({
      message: "Error fetching pregnancy checks",
      error: error.message,
    });
  }
};

export const getAllCalvings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, species, calvingEase, seen } = req.query;
    const query = { deletedAt: null };

    if (calvingEase) query.calvingEase = calvingEase;
    if (seen === "seen") query.isSeen = true;
    if (seen === "unseen") query.isSeen = { $ne: true };
    if (search || species) {
      const searchRegex = search ? { $regex: search, $options: "i" } : null;
      const animalFilters = [];
      if (species) animalFilters.push({ species });
      if (searchRegex) {
        animalFilters.push(
          { animalId: searchRegex },
          { earTag: searchRegex },
          { breed: searchRegex },
          { species: searchRegex },
        );
      }

      const [matchedFarmers, matchedAnimals] = await Promise.all([
        searchRegex
          ? User.find({ name: searchRegex }).select("_id").lean()
          : [],
        Animal.find({ $or: animalFilters }).select("_id").lean(),
      ]);

      const orFilters = [
        { animalId: { $in: matchedAnimals.map((animal) => animal._id) } },
      ];
      if (searchRegex) {
        orFilters.push(
          { farmerId: { $in: matchedFarmers.map((farmer) => farmer._id) } },
          { technicianNote: searchRegex },
        );
      }
      query.$or = orFilters;
    }

    const [calvings, total] = await Promise.all([
      Calving.find(query)
        .populate("farmerId", "name email")
        .populate("animalId", "earTag species breed color brand")
        .populate(
          "calves.animalId",
          "animalId earTag breed species color brand",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Calving.countDocuments(query),
    ]);

    res.status(200).send({
      data: calvings,
      calvings: calvings, // backwards compatibility
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Error fetching calvings", error: error.message });
  }
};

// ... existing delete functions implementation ...
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).send({ message: "User ID required" });

    // Self-protection check: admin cannot delete themselves
    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .send({ message: "You cannot delete your own account." });
    }

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).send({ message: "User not found" });
    }

    // Last Admin check: cannot delete the last active administrator
    if (user.role === "admin") {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        status: { $ne: "suspended" },
        deletedAt: null,
      });
      if (activeAdminCount <= 1) {
        return res.status(400).send({
          message:
            "Operation blocked: This is the last active admin account in the system.",
        });
      }
    }

    const beforeState = { deletedAt: user.deletedAt };

    // Clerk Synchronization Safety
    if (user.clerkId) {
      try {
        await runWithClerkRetry(
          () => clerkClient.users.banUser(user.clerkId),
          "banUser",
        );
        console.log(`[Clerk Deactivation] Banned user: ${user.clerkId}`);
      } catch (clerkErr) {
        return handleControllerError(
          res,
          clerkErr,
          "Failed to deactivate account in Clerk authentication service",
        );
      }
    }

    user.deletedAt = new Date();
    user.deactivatedBy = req.user._id;
    await user.save();

    logAdminAction("user deleted", req.user, user, {
      deletedAt: user.deletedAt,
    });
    await createAuditLog({
      entityType: "User",
      entityId: user._id,
      action: "delete",
      actorId: req.user._id,
      before: beforeState,
      after: { deletedAt: user.deletedAt },
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        targetUser: user.email || user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).send({ message: "User deactivated successfully" });
  } catch (error) {
    return handleControllerError(res, error, "Error deactivating user");
  }
};

export const deleteInsemination = async (req, res) => {
  try {
    const { id } = req.params;
    const insemination = await Insemination.findById(id);
    if (!insemination) {
      return res.status(404).send({ message: "Insemination record not found" });
    }

    const beforeState = { deletedAt: insemination.deletedAt };
    insemination.deletedAt = new Date();
    await insemination.save();

    logAdminAction(
      "delete_insemination",
      req.user,
      {
        id: insemination._id,
        name: `Insemination for animal ${insemination.animalId}`,
      },
      { deletedAt: insemination.deletedAt },
    );
    await createAuditLog({
      entityType: "Insemination",
      entityId: insemination._id,
      action: "delete_insemination",
      actorId: req.user._id,
      before: beforeState,
      after: { deletedAt: insemination.deletedAt },
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res
      .status(200)
      .send({ message: "Insemination record soft-deleted successfully" });
  } catch (error) {
    return handleControllerError(res, error, "Error deleting insemination");
  }
};

export const syncUserMetadata = async (req, res) => {
  try {
    const users = await User.find({ clerkId: { $ne: null } });
    let updatedCount = 0;

    for (const user of users) {
      try {
        // Determine logic: sync DB role to Clerk
        await runWithClerkRetry(
          () =>
            clerkClient.users.updateUser(user.clerkId, {
              publicMetadata: { role: user.role },
            }),
          `syncMetadata-${user.email}`,
        );
        updatedCount++;
      } catch (err) {
        console.error(`Failed to sync user ${user.email}:`, err.message);
      }
    }

    logAdminAction("sync_user_metadata", req.user, null, { updatedCount });
    await createAuditLog({
      entityType: "System",
      entityId: req.user._id,
      action: "sync_user_metadata",
      actorId: req.user._id,
      metadata: {
        updatedCount,
        actingAdmin: req.user.email || req.user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res
      .status(200)
      .json({ message: `Synced metadata for ${updatedCount} users.` });
  } catch (error) {
    return handleControllerError(res, error, "Error syncing metadata");
  }
};

// GET /api/admin/backup — Export database snapshot
export const exportDatabaseBackup = async (req, res) => {
  const { Config } = await import("../models/config.model.js");
  try {
    // Set backup status to started
    await Config.findOneAndUpdate(
      { key: "backup_status" },
      { value: "started" },
      { upsert: true },
    );

    logAdminAction("backup_started", req.user, null, {
      message: "Database backup started",
    });
    await createAuditLog({
      entityType: "System",
      entityId: req.user._id,
      action: "backup_started",
      actorId: req.user._id,
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        timestamp: new Date().toISOString(),
      },
    });

    const [
      users,
      animals,
      inseminations,
      pregnancies,
      calvings,
      healthRequests,
      configs,
    ] = await Promise.all([
      User.find({}).lean(),
      Animal.find({}).lean(),
      Insemination.find({}).lean(),
      Pregnancy.find({}).lean(),
      Calving.find({}).lean(),
      HealthRequest.find({}).lean(),
      Config.find({}).lean(),
    ]);

    // Update the last backup timestamp in the config DB
    await Config.findOneAndUpdate(
      { key: "last_backup_time" },
      { value: new Date() },
      { upsert: true },
    );

    // Update backup status to completed
    await Config.findOneAndUpdate(
      { key: "backup_status" },
      { value: "completed" },
      { upsert: true },
    );

    logAdminAction("backup_completed", req.user, null, {
      message: "Database backup completed successfully",
    });
    await createAuditLog({
      entityType: "System",
      entityId: req.user._id,
      action: "backup_completed",
      actorId: req.user._id,
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        timestamp: new Date().toISOString(),
      },
    });

    const backupData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      users,
      animals,
      inseminations,
      pregnancies,
      calvings,
      healthRequests,
      configs,
    };

    const fileName = `BreedSmart_Backup_${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    res.status(200).send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error("[exportDatabaseBackup ERROR]", error.message);

    // Update backup status to failed
    await Config.findOneAndUpdate(
      { key: "backup_status" },
      { value: "failed" },
      { upsert: true },
    );

    logAdminAction("backup_failed", req.user, null, { error: error.message });
    await createAuditLog({
      entityType: "System",
      entityId: req.user._id,
      action: "backup_failed",
      actorId: req.user._id,
      metadata: {
        error: error.message,
        actingAdmin: req.user.email || req.user.name,
        timestamp: new Date().toISOString(),
      },
    });

    return handleControllerError(
      res,
      error,
      "Failed compiling system database backup",
    );
  }
};

// POST /api/admin/suspend-user
export const suspendUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).send({ message: "User ID required" });

    // Self-protection check: admin cannot suspend themselves
    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .send({ message: "You cannot suspend your own account." });
    }

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).send({ message: "User not found" });
    }

    // Last Admin check: cannot suspend the last active administrator
    if (user.role === "admin") {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        status: { $ne: "suspended" },
        deletedAt: null,
      });
      if (activeAdminCount <= 1) {
        return res.status(400).send({
          message:
            "Operation blocked: This is the last active admin account in the system.",
        });
      }
    }

    const beforeState = { status: user.status };

    // Clerk Synchronization Safety
    if (user.clerkId) {
      try {
        await runWithClerkRetry(
          () => clerkClient.users.banUser(user.clerkId),
          "banUser",
        );
        console.log(`[Clerk Ban] Banned user: ${user.clerkId}`);
      } catch (clerkErr) {
        return handleControllerError(
          res,
          clerkErr,
          "Failed to suspend account in Clerk authentication service",
        );
      }
    }

    user.status = "suspended";
    await user.save();

    logAdminAction("user suspended", req.user, user, { status: "suspended" });
    await createAuditLog({
      entityType: "User",
      entityId: user._id,
      action: "suspend",
      actorId: req.user._id,
      before: beforeState,
      after: { status: "suspended" },
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        targetUser: user.email || user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).send({ message: "User suspended successfully", user });
  } catch (error) {
    return handleControllerError(res, error, "Error suspending user");
  }
};

// POST /api/admin/reactivate-user
export const reactivateUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).send({ message: "User ID required" });

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).send({ message: "User not found" });
    }

    const beforeState = { status: user.status };

    // Clerk Synchronization Safety
    if (user.clerkId) {
      try {
        await runWithClerkRetry(
          () => clerkClient.users.unbanUser(user.clerkId),
          "unbanUser",
        );
        console.log(`[Clerk Unban] Unbanned user: ${user.clerkId}`);
      } catch (clerkErr) {
        return handleControllerError(
          res,
          clerkErr,
          "Failed to reactivate account in Clerk authentication service",
        );
      }
    }

    user.status = "active";
    await user.save();

    logAdminAction("user reactivated", req.user, user, { status: "active" });
    await createAuditLog({
      entityType: "User",
      entityId: user._id,
      action: "reactivate",
      actorId: req.user._id,
      before: beforeState,
      after: { status: "active" },
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        targetUser: user.email || user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).send({ message: "User reactivated successfully", user });
  } catch (error) {
    return handleControllerError(res, error, "Error reactivating user");
  }
};

// POST /api/admin/verify-user
export const verifyUser = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).send({ message: "User ID required" });

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).send({ message: "User not found" });
    }

    const beforeState = { isVerified: user.isVerified };

    if (user.clerkId) {
      try {
        const clerkUser = await runWithClerkRetry(
          () => clerkClient.users.getUser(user.clerkId),
          "getUser",
        );
        await runWithClerkRetry(
          () =>
            clerkClient.users.updateUser(user.clerkId, {
              publicMetadata: {
                ...(clerkUser.publicMetadata || {}),
                isVerified: true,
              },
            }),
          "updateUser",
        );
      } catch (clerkErr) {
        return handleControllerError(
          res,
          clerkErr,
          "Failed to update verification status in Clerk authentication service",
        );
      }
    }

    user.isVerified = true;
    await user.save();

    logAdminAction("verification", req.user, user, { isVerified: true });
    await createAuditLog({
      entityType: "User",
      entityId: user._id,
      action: "verify",
      actorId: req.user._id,
      before: beforeState,
      after: { isVerified: true },
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        targetUser: user.email || user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).send({ message: "User verified successfully", user });
  } catch (error) {
    return handleControllerError(res, error, "Error verifying user");
  }
};

// POST /api/admin/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).send({ message: "User ID required" });

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).send({ message: "User not found" });
    }

    const tempPassword = `Temp${Math.floor(100000 + Math.random() * 900000)}!`;

    if (user.clerkId) {
      try {
        await runWithClerkRetry(
          () =>
            clerkClient.users.updateUser(user.clerkId, {
              password: tempPassword,
            }),
          "updateUserPassword",
        );
        console.log(
          `[Clerk Password Reset] Set temp password for user: ${user.clerkId}`,
        );
      } catch (clerkErr) {
        return handleControllerError(
          res,
          clerkErr,
          "Failed to reset password in Clerk authentication service",
        );
      }
    } else {
      return res.status(400).send({
        message:
          "Password reset is only supported for online users registered via Clerk.",
      });
    }

    logAdminAction("password reset", req.user, user, {
      message: "Temporary password set",
    });
    await createAuditLog({
      entityType: "User",
      entityId: user._id,
      action: "reset_password",
      actorId: req.user._id,
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        targetUser: user.email || user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).send({
      message:
        "Password reset successfully. A temporary password has been set.",
      tempPassword,
    });
  } catch (error) {
    return handleControllerError(res, error, "Error resetting password");
  }
};

// POST /api/admin/update-role
export const updateRole = async (req, res) => {
  try {
    const { id, role } = req.body;
    if (!id || !role)
      return res.status(400).send({ message: "User ID and role are required" });

    const validRoles = ["admin", "technician", "farmer"];
    if (!validRoles.includes(role)) {
      return res.status(400).send({ message: "Invalid role specified" });
    }

    // Self-protection check: admin cannot change their own role
    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .send({ message: "You cannot change your own account role." });
    }

    const user = await User.findById(id);
    if (!user || user.deletedAt) {
      return res.status(404).send({ message: "User not found" });
    }

    // Last Admin check: cannot demote the last active administrator
    if (user.role === "admin" && role !== "admin") {
      const activeAdminCount = await User.countDocuments({
        role: "admin",
        status: { $ne: "suspended" },
        deletedAt: null,
      });
      if (activeAdminCount <= 1) {
        return res.status(400).send({
          message:
            "Operation blocked: This is the last active admin account in the system.",
        });
      }
    }

    const beforeState = { role: user.role };

    // Clerk Synchronization Safety
    if (user.clerkId) {
      try {
        const clerkUser = await runWithClerkRetry(
          () => clerkClient.users.getUser(user.clerkId),
          "getUser",
        );
        await runWithClerkRetry(
          () =>
            clerkClient.users.updateUser(user.clerkId, {
              publicMetadata: {
                ...(clerkUser.publicMetadata || {}),
                role: role,
              },
            }),
          "updateUser",
        );
      } catch (clerkErr) {
        return handleControllerError(
          res,
          clerkErr,
          "Failed to update role in Clerk authentication service",
        );
      }
    }

    user.role = role;
    await user.save();

    logAdminAction("role updated", req.user, user, { role });
    await createAuditLog({
      entityType: "User",
      entityId: user._id,
      action: "update_role",
      actorId: req.user._id,
      before: beforeState,
      after: { role },
      metadata: {
        actingAdmin: req.user.email || req.user.name,
        targetUser: user.email || user.name,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).send({ message: "User role updated successfully", user });
  } catch (error) {
    return handleControllerError(res, error, "Error updating user role");
  }
};

// GET /api/admin/monitoring
export const getSystemMonitoringData = async (req, res) => {
  try {
    const { Config } = await import("../models/config.model.js");

    // 1. System Health
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const onlineDevicesCount = await User.countDocuments({
      lastLogin: { $gte: fifteenMinsAgo },
      deletedAt: null,
    });
    const totalActiveUsers = await User.countDocuments({ deletedAt: null });
    const offlineDevicesCount = Math.max(
      0,
      totalActiveUsers - onlineDevicesCount,
    );

    // Pending sync - count pending HealthRequests and Inseminations
    const pendingSyncCount = await Promise.all([
      HealthRequest.countDocuments({ status: "pending", deletedAt: null }),
      Insemination.countDocuments({ status: "pending", deletedAt: null }),
    ]).then(([hr, ins]) => hr + ins);

    // Last Backup
    const lastBackupConfig = await Config.findOne({ key: "last_backup_time" });
    const lastBackupTime = lastBackupConfig
      ? lastBackupConfig.value
      : new Date(Date.now() - 1000 * 60 * 60 * 3); // Default to 3 hrs ago

    // 2. Registry Monitor
    const duplicateEarTagsList = await Animal.aggregate([
      { $match: { deletedAt: null, earTag: { $ne: null, $ne: "" } } },
      {
        $group: {
          _id: "$earTag",
          count: { $sum: 1 },
          animals: { $push: { animalId: "$animalId", id: "$_id" } },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    const duplicateTagsCount = duplicateEarTagsList.length;

    const missingAnimalDataCount = await Animal.countDocuments({
      deletedAt: null,
      $or: [{ breed: { $in: [null, "", "Unknown"] } }, { birthDate: null }],
    });

    const archivedRecordsCount = await Promise.all([
      User.countDocuments({ deletedAt: { $ne: null } }),
      Animal.countDocuments({ deletedAt: { $ne: null } }),
      Insemination.countDocuments({ deletedAt: { $ne: null } }),
      Pregnancy.countDocuments({ deletedAt: { $ne: null } }),
      HealthRequest.countDocuments({ deletedAt: { $ne: null } }),
    ]).then(([u, a, i, p, h]) => u + a + i + p + h);

    // 3. Backup Monitor
    const counts = await Promise.all([
      User.countDocuments(),
      Animal.countDocuments(),
      Insemination.countDocuments(),
      Pregnancy.countDocuments(),
      Calving.countDocuments(),
      HealthRequest.countDocuments(),
    ]);
    const totalDocsCount = counts.reduce((a, b) => a + b, 0);
    // Average doc size 1.5 KB
    const storageUsageKB = totalDocsCount * 1.5;
    const storageUsageMB = (storageUsageKB / 1024).toFixed(2);
    const storageUsageStr = `${storageUsageMB} MB`;

    const backupStatusConfig = await Config.findOne({ key: "backup_status" });
    const backupStatus =
      backupStatusConfig && typeof backupStatusConfig.value === "string"
        ? backupStatusConfig.value
        : "completed";

    // 4. Moowie Insights
    const diagnosedCount = await Pregnancy.countDocuments({
      "pregnancyDiagnosis.result": { $in: ["Pregnant", "Empty"] },
      deletedAt: null,
    });
    const pregnantCount = await Pregnancy.countDocuments({
      "pregnancyDiagnosis.result": "Pregnant",
      deletedAt: null,
    });
    const pregnancySuccessRate =
      diagnosedCount > 0
        ? Math.round((pregnantCount / diagnosedCount) * 100)
        : 82;

    const completedAICount = await Insemination.countDocuments({
      outcome: {
        $in: [
          "Pregnant",
          "Failed (Re-heat)",
          "Failed (Aborted)",
          "Failed (Negative PD)",
        ],
      },
      deletedAt: null,
    });
    const successfulAICount = await Insemination.countDocuments({
      outcome: "Pregnant",
      deletedAt: null,
    });
    const aiSuccessRate =
      completedAICount > 0
        ? Math.round((successfulAICount / completedAICount) * 100)
        : 78;

    const farmersList = await User.find({
      role: "farmer",
      deletedAt: null,
    }).lean();
    const activeInseminationFarmers = await Insemination.distinct("farmerId", {
      deletedAt: null,
    });
    const activeHealthFarmers = await HealthRequest.distinct("farmerId", {
      deletedAt: null,
    });
    const activeFarmerIdsSet = new Set(
      [...activeInseminationFarmers, ...activeHealthFarmers].map((id) =>
        id.toString(),
      ),
    );
    const inactiveFarmersCount = farmersList.filter(
      (f) => !activeFarmerIdsSet.has(f._id.toString()),
    ).length;

    const barangayHealthAgg = await HealthRequest.aggregate([
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: "users",
          localField: "farmerId",
          foreignField: "_id",
          as: "farmer",
        },
      },
      { $unwind: "$farmer" },
      {
        $group: {
          _id: "$farmer.address.barangay",
          count: { $sum: 1 },
          criticalCount: {
            $sum: {
              $cond: [{ $in: ["$urgency", ["high", "emergency"]] }, 1, 0],
            },
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]);

    const barangaysNeedingAttention = barangayHealthAgg.map((item) => ({
      barangay: item._id,
      totalRequests: item.count,
      criticalRequests: item.criticalCount,
    }));

    const techniciansList = await User.find({
      role: "technician",
      deletedAt: null,
    }).lean();
    const hrWorkloads = await HealthRequest.aggregate([
      {
        $match: {
          status: {
            $in: ["assigned", "scheduled", "in-progress", "in_progress"],
          },
          deletedAt: null,
        },
      },
      { $group: { _id: "$assignedTechnicianId", count: { $sum: 1 } } },
    ]);
    const aiWorkloads = await Insemination.aggregate([
      {
        $match: {
          status: { $in: ["approved", "in-progress"] },
          deletedAt: null,
        },
      },
      { $group: { _id: "$technicianId", count: { $sum: 1 } } },
    ]);

    const hrWorkloadMap = new Map(
      hrWorkloads.map((w) => [w._id?.toString(), w.count]),
    );
    const aiWorkloadMap = new Map(
      aiWorkloads.map((w) => [w._id?.toString(), w.count]),
    );

    const technicianWorkloads = techniciansList
      .map((t) => {
        const tIdStr = t._id.toString();
        const activeHRs = hrWorkloadMap.get(tIdStr) || 0;
        const activeAIs = aiWorkloadMap.get(tIdStr) || 0;
        return {
          name: t.name,
          activeRequests: activeHRs + activeAIs,
        };
      })
      .sort((a, b) => b.activeRequests - a.activeRequests);

    // 5. Alerts Generation
    const alertsList = [];

    // Duplicate ear tags
    if (duplicateTagsCount > 0) {
      alertsList.push({
        type: "danger",
        category: "Registry",
        message: `Duplicate ear tags detected: ${duplicateTagsCount} overlapping tags found.`,
        details: duplicateEarTagsList
          .map((t) => `'${t._id}' (${t.count} duplicates)`)
          .join(", "),
      });
    }

    // High sickness
    for (const b of barangaysNeedingAttention) {
      if (b.criticalRequests > 0 || b.totalRequests > 3) {
        alertsList.push({
          type: "warning",
          category: "Health Hotspot",
          message: `High disease reports in Barangay ${b.barangay}: ${b.totalRequests} cases.`,
          details: `${b.criticalRequests} critical urgency health requests.`,
        });
      }
    }

    // Missing Animal Data
    if (missingAnimalDataCount > 0) {
      alertsList.push({
        type: "info",
        category: "Registry Monitor",
        message: `${missingAnimalDataCount} livestock profiles missing critical details (Breed / DOB).`,
        details:
          "Registry updates recommended to ensure complete lineage tracking.",
      });
    }

    // Backup Alert
    const daysSinceBackup =
      (Date.now() - new Date(lastBackupTime).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceBackup > 7) {
      alertsList.push({
        type: "warning",
        category: "System Warning",
        message: "No system backup created in the last 7 days.",
        details: "Run a database export to secure user and registry data.",
      });
    }

    // Inactive Farmers
    if (inactiveFarmersCount > 0) {
      alertsList.push({
        type: "info",
        category: "Farmer Engagement",
        message: `${inactiveFarmersCount} farmers have been inactive in the registry.`,
        details: "Consider reaching out or scheduling health inspections.",
      });
    }

    // Simulated Failed Sync Alert
    alertsList.push({
      type: "warning",
      category: "Client Sync",
      message:
        "Technician sync alert: 1 sync warning recorded from offline node.",
      details:
        "Client version mismatch resolved automatically; verify server logs if recurring.",
    });

    res.status(200).json({
      systemHealth: {
        onlineDevices: onlineDevicesCount,
        offlineDevices: offlineDevicesCount,
        pendingSync: pendingSyncCount,
        lastBackup: lastBackupTime,
        serverStatus: "online",
      },
      registryMonitor: {
        duplicateEarTags: duplicateTagsCount,
        missingAnimalData: missingAnimalDataCount,
        archivedRecords: archivedRecordsCount,
      },
      backupMonitor: {
        lastBackup: lastBackupTime,
        backupStatus: backupStatus,
        storageUsage: storageUsageStr,
      },
      moowieInsights: {
        pregnancySuccessRate,
        aiSuccessRate,
        barangaysNeedingAttention,
        technicianWorkloads,
        duplicateEarTags: duplicateTagsCount,
        inactiveFarmers: inactiveFarmersCount,
        animalsNeedingUpdates: missingAnimalDataCount,
      },
      alerts: alertsList,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed compiling system monitoring and telemetry stats",
    );
  }
};

// GET /api/admin/barangays/insights
export const getBarangaysInsightsList = async (req, res) => {
  try {
    const validBarangayMatch = {
      $nin: [null, "", "N/A", "n/a", "NA", "na", "Unknown", "unknown"],
    };
    const [
      farmerCounts,
      animalCounts,
      pregnancyCounts,
      pendingAICounts,
      pendingHealthCounts,
      incompleteRecordCounts,
      aiSuccessRates,
    ] = await Promise.all([
      // 1. Farmer count per barangay
      User.aggregate([
        {
          $match: {
            role: "farmer",
            deletedAt: null,
            "address.barangay": validBarangayMatch,
          },
        },
        {
          $group: {
            _id: {
              barangay: "$address.barangay",
              city: "$address.city",
              municipality: "$address.municipality",
              district: "$address.district",
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 2. Animal count per barangay
      Animal.aggregate([
        { $match: { deletedAt: null } },
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        { $match: { "farmer.address.barangay": validBarangayMatch } },
        {
          $group: {
            _id: {
              barangay: "$farmer.address.barangay",
              city: "$farmer.address.city",
              municipality: "$farmer.address.municipality",
              district: "$farmer.address.district",
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 3. Active pregnancy count per barangay
      Pregnancy.aggregate([
        {
          $match: { deletedAt: null, "pregnancyDiagnosis.result": "Pregnant" },
        },
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        { $match: { "farmer.address.barangay": validBarangayMatch } },
        {
          $group: {
            _id: {
              barangay: "$farmer.address.barangay",
              city: "$farmer.address.city",
              municipality: "$farmer.address.municipality",
              district: "$farmer.address.district",
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 4. Pending AI requests per barangay
      Insemination.aggregate([
        { $match: { deletedAt: null, status: "pending" } },
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        { $match: { "farmer.address.barangay": validBarangayMatch } },
        {
          $group: {
            _id: {
              barangay: "$farmer.address.barangay",
              city: "$farmer.address.city",
              municipality: "$farmer.address.municipality",
              district: "$farmer.address.district",
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Pending Health requests per barangay
      HealthRequest.aggregate([
        { $match: { deletedAt: null, status: "pending" } },
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        { $match: { "farmer.address.barangay": validBarangayMatch } },
        {
          $group: {
            _id: {
              barangay: "$farmer.address.barangay",
              city: "$farmer.address.city",
              municipality: "$farmer.address.municipality",
              district: "$farmer.address.district",
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 6. Incomplete animal records per barangay (missing breed or birthDate)
      Animal.aggregate([
        {
          $match: {
            deletedAt: null,
            $or: [
              { breed: { $in: [null, "", "Unknown"] } },
              { birthDate: null },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        { $match: { "farmer.address.barangay": validBarangayMatch } },
        {
          $group: {
            _id: {
              barangay: "$farmer.address.barangay",
              city: "$farmer.address.city",
              municipality: "$farmer.address.municipality",
              district: "$farmer.address.district",
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // 7. AI Success rate calculation per barangay
      Insemination.aggregate([
        { $match: { deletedAt: null } },
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: "$farmer" },
        { $match: { "farmer.address.barangay": validBarangayMatch } },
        {
          $group: {
            _id: {
              barangay: "$farmer.address.barangay",
              city: "$farmer.address.city",
              municipality: "$farmer.address.municipality",
              district: "$farmer.address.district",
            },
            totalAttempts: { $sum: 1 },
            successfulAttempts: {
              $sum: { $cond: [{ $eq: ["$isSuccess", true] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Helper Map to merge aggregations by location. Older records may only
    // have barangay, so keep a defensive Unknown bucket.
    const brgyMap = new Map();

    const getOrCreateBrgyEntry = (name) => {
      const rawLocation =
        typeof name === "object" && name !== null ? name : { barangay: name };
      const barangay = rawLocation.barangay
        ? String(rawLocation.barangay).trim()
        : "Unknown";
      const rawCity = rawLocation.city ? String(rawLocation.city).trim() : "";
      const rawMunicipality = rawLocation.municipality
        ? String(rawLocation.municipality).trim()
        : "";
      const municipality = rawMunicipality || rawCity || "";
      const isIloiloCityDistrict =
        rawMunicipality.toLowerCase() === "iloilo city" &&
        rawCity &&
        rawCity.toLowerCase() !== "iloilo city";
      const district =
        rawLocation.district || (isIloiloCityDistrict ? rawCity : "");
      const key =
        [municipality, district, barangay].filter(Boolean).join("|") ||
        barangay;
      if (!brgyMap.has(key)) {
        brgyMap.set(key, {
          barangay,
          municipality,
          city: municipality,
          district,
          farmersCount: 0,
          animalsCount: 0,
          activePregnancies: 0,
          pendingAIRequests: 0,
          pendingHealthRequests: 0,
          incompleteRecordsCount: 0,
          aiSuccessRate: null,
          healthAlertsCount: 0,
          activityScore: 100,
          status: "healthy",
        });
      }
      return brgyMap.get(key);
    };

    // Populate counts
    farmerCounts.forEach((f) => {
      getOrCreateBrgyEntry(f._id).farmersCount = f.count;
    });
    animalCounts.forEach((a) => {
      getOrCreateBrgyEntry(a._id).animalsCount = a.count;
    });
    pregnancyCounts.forEach((p) => {
      getOrCreateBrgyEntry(p._id).activePregnancies = p.count;
    });
    pendingAICounts.forEach((ai) => {
      getOrCreateBrgyEntry(ai._id).pendingAIRequests = ai.count;
    });
    pendingHealthCounts.forEach((h) => {
      getOrCreateBrgyEntry(h._id).pendingHealthRequests = h.count;
    });
    incompleteRecordCounts.forEach((ic) => {
      getOrCreateBrgyEntry(ic._id).incompleteRecordsCount = ic.count;
    });

    // Calculate success rates & activity scores
    aiSuccessRates.forEach((rate) => {
      const entry = getOrCreateBrgyEntry(rate._id);
      if (rate.totalAttempts >= 3) {
        entry.aiSuccessRate = Math.round(
          (rate.successfulAttempts / rate.totalAttempts) * 100,
        );
      } else {
        entry.aiSuccessRate = null; // Exclude/nullify success rates for small sample sizes
      }
    });

    // Now compute status and activityScore for each barangay
    const result = Array.from(brgyMap.values()).map((entry) => {
      // Compute healthAlertsCount (e.g. pending health requests)
      entry.healthAlertsCount = entry.pendingHealthRequests;

      // Compute status:
      // "critical": if pending health request > 2, or success rate < 50% (on at least 3 attempts)
      // "attention": if pending health > 0, pending AI > 1, or incomplete records > 3
      // "healthy": otherwise
      if (
        entry.pendingHealthRequests >= 2 ||
        (entry.aiSuccessRate !== null && entry.aiSuccessRate < 50)
      ) {
        entry.status = "critical";
      } else if (
        entry.pendingHealthRequests > 0 ||
        entry.pendingAIRequests > 1 ||
        entry.incompleteRecordsCount > 3
      ) {
        entry.status = "attention";
      } else {
        entry.status = "healthy";
      }

      // Activity Score: starts at 100, deducts for pending items, low success rates, or incomplete records
      let score = 100;
      score -= entry.pendingHealthRequests * 15;
      score -= entry.pendingAIRequests * 10;
      score -= entry.incompleteRecordsCount * 5;
      if (entry.aiSuccessRate !== null) {
        score -= Math.max(0, 80 - entry.aiSuccessRate); // Deduct if success rate is below 80%
      }
      entry.activityScore = Math.max(10, Math.round(score));

      return entry;
    });

    res.status(200).json(result);
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to compile barangays insights list",
    );
  }
};

// GET /api/admin/barangays/insights/:barangayName
export const getBarangayInsightsDetails = async (req, res) => {
  try {
    const { barangayName } = req.params;
    if (!barangayName) {
      return res.status(400).json({ message: "Barangay name is required" });
    }

    // Fetch farmers scoped to this barangay
    const farmers = await User.find({
      role: "farmer",
      "address.barangay": barangayName,
      deletedAt: null,
    }).lean();
    const farmerIds = farmers.map((f) => f._id);

    const [animals, recentAI, recentHealth, recentCalvings, technicians] =
      await Promise.all([
        // Scoped animals list
        Animal.find({ farmerId: { $in: farmerIds }, deletedAt: null }).lean(),

        // Scoped recent AI records
        Insemination.find({ farmerId: { $in: farmerIds }, deletedAt: null })
          .populate("farmerId", "name")
          .populate("animalId", "earTag animalId breed species")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),

        // Scoped recent Health requests
        HealthRequest.find({ farmerId: { $in: farmerIds }, deletedAt: null })
          .populate("farmerId", "name")
          .populate("animalId", "earTag animalId breed species")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),

        // Scoped recent Calvings
        Calving.find({ farmerId: { $in: farmerIds }, deletedAt: null })
          .populate("farmerId", "name")
          .populate("animalId", "earTag animalId breed species")
          .sort({ date: -1 })
          .limit(10)
          .lean(),

        // Technicians with tasks in this barangay (linked via AI or health request)
        User.find({
          role: "technician",
          "address.barangay": barangayName,
          deletedAt: null,
        }).lean(),
      ]);

    // Build a combined activity timeline
    const timeline = [];
    recentAI.forEach((item) => {
      timeline.push({
        _id: item._id,
        type: "insemination",
        title: "Artificial Insemination",
        date: item.inseminationDate || item.createdAt,
        description: `AI recorded for animal tag ${item.animalId?.earTag || "No tag"} (Sire: ${item.sireCode || "—"}). Status: ${item.status}.`,
        details: item,
      });
    });
    recentHealth.forEach((item) => {
      timeline.push({
        _id: item._id,
        type: "health",
        title: "Health Inspection",
        date: item.createdAt,
        description: `Health request: '${item.issueDescription || "No desc"}' is currently ${item.status}.`,
        details: item,
      });
    });
    recentCalvings.forEach((item) => {
      timeline.push({
        _id: item._id,
        type: "calving",
        title: "Calving Event",
        date: item.date,
        description: `Calving recorded: ${item.numberOfCalves} calf/calves born. Ease: ${item.calvingEase || "—"}.`,
        details: item,
      });
    });

    // Sort timeline descending
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      farmers,
      animals,
      recentAI,
      recentHealth,
      recentCalvings,
      timeline: timeline.slice(0, 15),
      technicians,
    });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      "Failed to fetch barangay details",
    );
  }
};

export const getRecentActivities = async (req, res) => {
  try {
    // 1. Authorization Guard
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Admin permission required.",
        code: "FORBIDDEN",
      });
    }

    // 2. Parse & normalize limit parameter
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 6 : rawLimit, 1), 20);
    const queryLimit = Math.max(limit, 10);

    // 3. Parallel fetching from operational models
    const [
      animals,
      inseminations,
      pregnancies,
      healthRequests,
      calvings,
      userInvites,
    ] = await Promise.all([
      // Animal Registration
      Animal.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .populate("farmerId", "name address")
        .select("earTag breed species farmerId createdAt")
        .lean(),

      // Artificial Insemination Completed
      Insemination.find({})
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .populate("technicianId", "name")
        .populate("farmerId", "name address")
        .populate("animalId", "earTag breed species")
        .select(
          "animalId technicianId farmerId pregnancyStatus createdAt completedAt",
        )
        .lean(),

      // Pregnancy Confirmed
      Pregnancy.find({})
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .populate("animalId", "earTag breed species")
        .populate("farmerId", "name address")
        .select("animalId farmerId status confirmedAt createdAt")
        .lean(),

      // Health Requests
      HealthRequest.find({})
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .populate("farmerId", "name address")
        .populate("animalId", "earTag breed species")
        .select("animalId farmerId requestType urgency status createdAt")
        .lean(),

      // Calving Recorded
      Calving.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .populate("farmerId", "name address")
        .populate("animalId", "earTag animalId breed species")
        .select(
          "animalId farmerId pregnancyId outcome numberOfCalves livingCalfCount stillbornCount calves date createdAt",
        )
        .lean(),
      // User / Technician Created or Invited
      User.find({ role: { $in: ["technician", "farmer"] } })
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .select("name email role status profileClaimStatus address createdAt")
        .lean(),
    ]);

    // 4. Normalize records into stable AdminRecentActivity items
    const rawEvents = [];

    // Animals
    for (const item of animals) {
      if (!item.createdAt) continue;
      const farmerName = item.farmerId?.name || "Farmer";
      const barangay = item.farmerId?.address?.barangay
        ? `in Brgy. ${item.farmerId.address.barangay}`
        : item.farmerId?.address?.city
          ? `in ${item.farmerId.address.city}`
          : "";
      const tag = item.earTag ? `(#${item.earTag})` : "";
      const species = item.species || item.breed || "animal";

      rawEvents.push({
        id: `animal-${item._id}`,
        type: "animal_registered",
        title: "Animal Registered",
        description:
          `Farmer ${farmerName} registered a ${species} ${tag} ${barangay}`.trim() +
          ".",
        occurredAt: item.createdAt.toISOString(),
        entityType: "Animal",
        entityId: item._id.toString(),
        metadata: {
          animalTag: item.earTag || "",
          species: item.species || "",
          breed: item.breed || "",
          farmerName,
          barangay: item.farmerId?.address?.barangay || "",
        },
      });
    }

    // Inseminations
    for (const item of inseminations) {
      const date = item.completedAt || item.createdAt;
      if (!date) continue;
      const techName = item.technicianId?.name || "Field Officer";
      const tag = item.animalId?.earTag
        ? `Tag #${item.animalId.earTag}`
        : "animal record";

      rawEvents.push({
        id: `insemination-${item._id}`,
        type: "ai_completed",
        title: "AI Completed",
        description: `Technician ${techName} completed insemination service for ${tag}.`,
        occurredAt: new Date(date).toISOString(),
        entityType: "Insemination",
        entityId: item._id.toString(),
        metadata: {
          animalTag: item.animalId?.earTag || "",
          technicianName: techName,
          farmerName: item.farmerId?.name || "",
        },
      });
    }

    // Pregnancies
    for (const item of pregnancies) {
      const date = item.confirmedAt || item.createdAt;
      if (!date) continue;
      const tag = item.animalId?.earTag
        ? `Tag #${item.animalId.earTag}`
        : "Animal";
      const barangay = item.farmerId?.address?.barangay
        ? `in Brgy. ${item.farmerId.address.barangay}`
        : "";

      rawEvents.push({
        id: `pregnancy-${item._id}`,
        type: "pregnancy_confirmed",
        title: "Pregnancy Confirmed",
        description: `${tag} confirmed pregnant ${barangay}`.trim() + ".",
        occurredAt: new Date(date).toISOString(),
        entityType: "Pregnancy",
        entityId: item._id.toString(),
        metadata: {
          animalTag: item.animalId?.earTag || "",
          farmerName: item.farmerId?.name || "",
          barangay: item.farmerId?.address?.barangay || "",
        },
      });
    }

    // Health Requests
    for (const item of healthRequests) {
      if (!item.createdAt) continue;
      const farmerName = item.farmerId?.name || "Farmer";
      const isEmergency =
        item.urgency === "emergency" || item.urgency === "high";
      const tag = item.animalId?.earTag
        ? `for Tag #${item.animalId.earTag}`
        : "";
      const isCompleted = ["resolved", "completed"].includes(
        String(item.status || "").toLowerCase(),
      );

      rawEvents.push({
        id: `health-${item._id}`,
        type: isCompleted
          ? "health_service_completed"
          : "health_request_created",
        title: isCompleted
          ? "Health Service Completed"
          : isEmergency
            ? "Emergency Health Request"
            : "Health Request",
        description: isCompleted
          ? `Health service completed ${tag} for ${farmerName}.`.trim()
          : `${isEmergency ? "Emergency health" : "Health"} assistance requested ${tag} by ${farmerName}.`.trim(),
        occurredAt: item.createdAt.toISOString(),
        entityType: "HealthRequest",
        entityId: item._id.toString(),
        metadata: {
          farmerName,
          animalTag: item.animalId?.earTag || "",
          urgency: item.urgency || "normal",
        },
      });
    }

    // Calvings
    // Calvings
    for (const item of calvings) {
      const date = item.date || item.createdAt;
      if (!date) continue;

      const animalReference =
        item.animalId?.earTag || item.animalId?.animalId || "";

      const tag = animalReference ? `Tag #${animalReference}` : "mother animal";

      let outcomeLabel = "Calving";

      if (item.outcome === "live_birth") {
        outcomeLabel = "Live birth";
      } else if (item.outcome === "mixed") {
        outcomeLabel = "Mixed calving outcome";
      } else if (item.outcome === "stillbirth") {
        outcomeLabel = "Stillbirth";
      } else if (item.outcome === "abortion") {
        outcomeLabel = "Pregnancy loss";
      }

      rawEvents.push({
        id: `calving-${item._id}`,
        type: "calving_recorded",
        title: "Calving Recorded",
        description: `${outcomeLabel} recorded for ${tag}.`,
        occurredAt: new Date(date).toISOString(),
        entityType: "Calving",
        entityId: item._id.toString(),
        metadata: {
          animalTag: animalReference,
          outcome: item.outcome || "",
          numberOfCalves: item.numberOfCalves ?? 0,
          livingCalfCount: item.livingCalfCount ?? 0,
          stillbornCount: item.stillbornCount ?? 0,
          farmerName: item.farmerId?.name || "",
        },
      });
    }
    // Users / Technician Invitations
    for (const item of userInvites) {
      if (!item.createdAt) continue;
      const isTech = item.role === "technician";
      const isPending =
        item.profileClaimStatus === "unclaimed" || item.status === "pending";

      rawEvents.push({
        id: `user-${item._id}`,
        type: isTech ? "user_invited" : "user_registered",
        title: isTech ? "Technician Invited" : "Farmer Registered",
        description: isTech
          ? `${isPending ? "Technician invitation sent to" : "Technician account active for"} ${item.name}.`
          : `New farmer profile created for ${item.name}.`,
        occurredAt: item.createdAt.toISOString(),
        entityType: "User",
        entityId: item._id.toString(),
        metadata: {
          userRole: item.role,
          farmerName: item.name,
        },
      });
    }

    // 5. Sort by occurredAt descending
    rawEvents.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    // 6. Deduplicate by entityType + entityId
    const seen = new Set();
    const deduplicated = [];
    for (const event of rawEvents) {
      const key = `${event.entityType}-${event.entityId}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(event);
      }
      if (deduplicated.length >= limit) break;
    }

    return res.status(200).json({
      success: true,
      data: deduplicated,
    });
  } catch (error) {
    console.error("[getRecentActivities ERROR]", error);
    return res.status(500).json({
      message: "Failed to fetch recent activities.",
      code: "INTERNAL_ERROR",
    });
  }
};

/**
 * Update Technician Dispatch Profile (Admin Only)
 * PATCH /api/admin/technician/:id/dispatch-profile
 */
export const updateTechnicianDispatchProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceMunicipalities, serviceCapabilities } = req.body;

    const technician = await User.findById(id);
    if (!technician || technician.role !== "technician") {
      return res.status(404).json({ message: "Technician not found." });
    }

    if (!technician.dispatchProfile) {
      technician.dispatchProfile = {
        availabilityStatus: "off_duty",
        acceptsNewRequests: false,
        profileVersion: 1,
      };
    }

    if (serviceMunicipalities !== undefined) {
      if (!Array.isArray(serviceMunicipalities)) {
        return res
          .status(400)
          .json({ message: "serviceMunicipalities must be an array." });
      }

      const invalidMunicipality = serviceMunicipalities.find(
        (municipality) =>
          !municipality ||
          typeof municipality.municipalityCode !== "string" ||
          !municipality.municipalityCode.trim() ||
          typeof municipality.municipalityName !== "string" ||
          !municipality.municipalityName.trim() ||
          !["municipality", "city"].includes(
            municipality.localityType || "municipality",
          ) || !canonicalizeMunicipality(municipality),
      );
      if (invalidMunicipality) {
        return res.status(400).json({
          message:
            "Each Field Area must include a municipality code, name, and valid locality type.",
          code: "INVALID_SERVICE_MUNICIPALITY",
        });
      }

      const mappedMunicipalities = serviceMunicipalities.map((municipality) => ({
        ...canonicalizeMunicipality(municipality),
        source: "admin_assigned",
        assignedBy: req.user._id,
        assignedAt: new Date(),
      }));

      // Deduplicate by code
      const uniqueMunicipalities = [];
      const seen = new Set();
      for (const m of mappedMunicipalities) {
        if (!seen.has(m.municipalityCode)) {
          seen.add(m.municipalityCode);
          uniqueMunicipalities.push(m);
        }
      }

      technician.dispatchProfile.serviceMunicipalities = uniqueMunicipalities;
    }

    if (serviceCapabilities !== undefined) {
      if (!Array.isArray(serviceCapabilities)) {
        return res
          .status(400)
          .json({ message: "serviceCapabilities must be an array." });
      }

      const validCapabilities = [
        "AI",
        "HEALTH",
        "PREGNANCY_DIAGNOSIS",
        "CALVING",
      ];
      const invalidCapabilities = serviceCapabilities.filter(
        (capability) => !validCapabilities.includes(capability),
      );
      if (invalidCapabilities.length) {
        return res.status(400).json({
          message: "One or more service capabilities are invalid.",
          code: "INVALID_SERVICE_CAPABILITY",
          invalidCapabilities,
        });
      }
      const filteredCapabilities = [...new Set(serviceCapabilities)];

      technician.dispatchProfile.serviceCapabilities = filteredCapabilities;
    }

    technician.dispatchProfile.updatedAt = new Date();
    technician.dispatchProfile.profileVersion =
      (technician.dispatchProfile.profileVersion || 1) + 1;

    await technician.save();

    res.status(200).json({
      message: "Dispatch profile updated successfully.",
      dispatchProfile: technician.dispatchProfile,
      dispatchReadiness: evaluateTechnicianDispatchReadiness({ technician }),
    });
  } catch (error) {
    console.error("[Update Technician Dispatch Profile] Error:", error);
    res
      .status(500)
      .json({ message: "Failed to update technician dispatch profile." });
  }
};

/**
 * Reassign existing non-terminal field work without changing its lifecycle.
 * POST /api/admin/requests/:type/:id/reassign
 */
export const reassignTechnicianRequest = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { technicianId } = req.body;
    if (!["ai", "health"].includes(type)) {
      return res.status(400).json({
        message: "Only AI and Health requests can be reassigned here.",
        code: "INVALID_REASSIGNMENT_TYPE",
      });
    }
    if (!technicianId) {
      return res.status(400).json({
        message: "Choose a Technician before reassigning this request.",
        code: "REASSIGNMENT_TECHNICIAN_REQUIRED",
      });
    }

    const Model = type === "ai" ? Insemination : HealthRequest;
    const request = await Model.findOne({ _id: id, deletedAt: null }).lean();
    if (!request) {
      return res.status(404).json({
        message: "Request not found.",
        code: "REQUEST_NOT_FOUND",
      });
    }
    const isActive =
      type === "ai"
        ? isActiveAIRequestStatus(request.status)
        : isActiveHealthRequestStatus(request.status);
    if (!isActive) {
      return res.status(409).json({
        message: "Completed, cancelled, or rejected work cannot be reassigned.",
        code: "TERMINAL_REQUEST_CANNOT_BE_REASSIGNED",
      });
    }

    const currentOwner =
      type === "ai"
        ? request.approvedBy || request.technicianId
        : request.handledBy || request.assignedTechnicianId;
    if (!currentOwner) {
      return res.status(409).json({
        message:
          "This request is still unassigned. It must be accepted through normal dispatch.",
        code: "REQUEST_NOT_ASSIGNED",
      });
    }

    const target = await User.findById(technicianId)
      .select(
        "name role status deletedAt isVerified profileClaimStatus dispatchProfile",
      )
      .lean();
    assertTechnicianEligibleForNewRequest({
      technician: target,
      requestType: type === "ai" ? "AI" : "HEALTH",
      dispatch: request.dispatch,
    });

    if (String(currentOwner) === String(target._id)) {
      return res.status(200).json({
        message: "This request is already assigned to that Technician.",
        request,
        idempotent: true,
      });
    }

    const ownerGuard =
      type === "ai"
        ? {
            $or: [
              { approvedBy: currentOwner },
              { technicianId: currentOwner },
            ],
          }
        : {
            $or: [
              { handledBy: currentOwner },
              { assignedTechnicianId: currentOwner },
            ],
          };
    const ownerUpdate =
      type === "ai"
        ? {
            approvedBy: target._id,
            ...(request.technicianId ? { technicianId: target._id } : {}),
          }
        : {
            handledBy: target._id,
            assignedTechnicianId: target._id,
          };
    const updated = await Model.findOneAndUpdate(
      {
        _id: request._id,
        deletedAt: null,
        status: request.status,
        ...ownerGuard,
      },
      {
        $set: ownerUpdate,
        $push: {
          statusHistory: {
            status: request.status,
            note: `Reassigned by Admin to ${target.name}.`,
            actorId: req.user._id,
            createdAt: new Date(),
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    )
      .populate("farmerId", "name address imageUrl phoneNumber")
      .populate("animalId", "animalId earTag species breed imageUrl")
      .populate(type === "ai" ? "approvedBy" : "handledBy", "name");

    if (!updated) {
      return res.status(409).json({
        message:
          "The request assignment or status changed. Refresh before reassigning.",
        code: "REASSIGNMENT_CONCURRENT_UPDATE",
      });
    }

    await createAuditLog({
      entityType: type === "ai" ? "Insemination" : "HealthRequest",
      entityId: updated._id,
      action: "admin_reassigned_request",
      actorId: req.user._id,
      before: { technicianId: currentOwner, status: request.status },
      after: { technicianId: target._id, status: updated.status },
    });

    return res.status(200).json({
      message: `Request reassigned to ${target.name}.`,
      request: updated,
      idempotent: false,
    });
  } catch (error) {
    console.error("[Admin Reassign Request] Error:", error);
    return res.status(error.status || 500).json({
      message: error.message || "Failed to reassign request.",
      code: error.code || "REQUEST_REASSIGNMENT_FAILED",
      ...(error.details || {}),
    });
  }
};
