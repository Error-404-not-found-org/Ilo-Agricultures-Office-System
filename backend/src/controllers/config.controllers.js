import { Config } from "../models/config.model.js";

// GET /api/config — Get public configuration (Holiday status)
export const getConfig = async (req, res) => {
  try {
    const holidayConfig = await Config.findOne({ key: "isHoliday" });
    res.status(200).json({
      isHoliday: holidayConfig ? holidayConfig.value : false,
    });
  } catch (error) {
    console.error("[getConfig ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch configuration." });
  }
};

// POST /api/config/holiday — Toggle holiday mode (Technician/Admin only)
export const toggleHoliday = async (req, res) => {
  try {
    const { isHoliday } = req.body;
    
    if (typeof isHoliday !== "boolean") {
      return res.status(400).json({ message: "isHoliday must be a boolean." });
    }

    const config = await Config.findOneAndUpdate(
      { key: "isHoliday" },
      { value: isHoliday },
      { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({
      message: `Holiday mode ${isHoliday ? "enabled" : "disabled"}.`,
      isHoliday: config.value,
    });
  } catch (error) {
    console.error("[toggleHoliday ERROR]", error.message);
    res.status(500).json({ message: "Failed to update holiday mode." });
  }
};
