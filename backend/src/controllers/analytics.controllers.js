import { Insemination } from "../models/insemination.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import mongoose from "mongoose";

export const getMyPerformance = async (req, res) => {
  try {
    const technicianId = req.user._id;

    // 1. AI Stats
    const aiStats = await Insemination.aggregate([
      { $match: { approvedBy: new mongoose.Types.ObjectId(technicianId) } },
      {
        $group: {
          _id: null,
          totalAI: { $sum: 1 },
          successfulAI: { $sum: { $cond: [{ $eq: ["$isSuccess", true] }, 1, 0] } },
          failedAI: { $sum: { $cond: [{ $eq: ["$isSuccess", false] }, 1, 0] } },
          pendingPD: { $sum: { $cond: [{ $eq: ["$isSuccess", null] }, 1, 0] } }
        }
      }
    ]);

    // 2. Health Stats
    const healthStats = await HealthRequest.aggregate([
      { $match: { handledBy: new mongoose.Types.ObjectId(technicianId) } },
      {
        $group: {
          _id: null,
          totalResolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          totalInProgress: { $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] } }
        }
      }
    ]);

    // 3. Monthly Activity (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyActivity = await Insemination.aggregate([
      { 
        $match: { 
          approvedBy: new mongoose.Types.ObjectId(technicianId),
          createdAt: { $gte: sixMonthsAgo }
        } 
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.status(200).json({
      ai: aiStats[0] || { totalAI: 0, successfulAI: 0, failedAI: 0, pendingPD: 0 },
      health: healthStats[0] || { totalResolved: 0, totalInProgress: 0 },
      trends: monthlyActivity
    });
  } catch (error) {
    console.error("My Performance Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch your performance analytics" });
  }
};

/**
 * GET /api/analytics/technician-performance
 * Returns conception rates and activity counts per technician
 */
export const getTechnicianPerformance = async (req, res) => {
  try {
    const stats = await Insemination.aggregate([
      {
        $group: {
          _id: "$technicianId",
          totalAI: { $sum: 1 },
          successfulAI: { 
            $sum: { $cond: [{ $eq: ["$isSuccess", true] }, 1, 0] } 
          },
          failedAI: { 
            $sum: { $cond: [{ $eq: ["$isSuccess", false] }, 1, 0] } 
          },
          pendingPD: { 
            $sum: { $cond: [{ $eq: ["$isSuccess", null] }, 1, 0] } 
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "technician"
        }
      },
      { $unwind: { path: "$technician", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ["$technician.name", "Unknown Technician"] },
          totalAI: 1,
          successfulAI: 1,
          failedAI: 1,
          pendingPD: 1,
          successRate: {
            $cond: [
              { $gt: ["$totalAI", 0] },
              { $multiply: [{ $divide: ["$successfulAI", "$totalAI"] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { successRate: -1 } }
    ]);

    res.status(200).json(stats);
  } catch (error) {
    console.error("Technician Performance Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch performance analytics" });
  }
};

/**
 * GET /api/analytics/regional-heatmap
 * Returns density of animals and health alerts by barangay/location
 */
export const getRegionalHeatmap = async (req, res) => {
  try {
    // 1. Animal density by location
    const animalDensity = await Animal.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "farmerId",
          foreignField: "_id",
          as: "farmer"
        }
      },
      { $unwind: "$farmer" },
      {
        $group: {
          _id: "$farmer.address.barangay",
          count: { $sum: 1 },
          species: { $addToSet: "$species" }
        }
      },
      { $project: { barangay: "$_id", count: 1, species: 1, _id: 0 } }
    ]);

    // 2. Health issues by location
    const healthDensity = await HealthRequest.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "farmerId",
          foreignField: "_id",
          as: "farmer"
        }
      },
      { $unwind: "$farmer" },
      {
        $group: {
          _id: "$farmer.address.barangay",
          issueCount: { $sum: 1 },
          urgencyHigh: { $sum: { $cond: [{ $eq: ["$urgency", "high"] }, 1, 0] } }
        }
      },
      { $project: { barangay: "$_id", issueCount: 1, urgencyHigh: 1, _id: 0 } }
    ]);

    res.status(200).json({
      animalDensity,
      healthDensity
    });
  } catch (error) {
    console.error("Regional Heatmap Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch regional heatmap data" });
  }
};

/**
 * GET /api/analytics/growth-trends
 * Returns monthly registration and success trends
 */
export const getGrowthTrends = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trends = await Animal.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          newRegistrations: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.status(200).json(trends);
  } catch (error) {
    console.error("Growth Trends Analytics Error:", error);
    res.status(500).json({ message: "Failed to fetch growth trends" });
  }
};
