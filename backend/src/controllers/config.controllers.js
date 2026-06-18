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

// GET /api/config/settings — Retrieve configuration settings parameters
export const getConfigSettings = async (req, res) => {
  try {
    const keys = ["pregnancyWindowDays", "maxAttemptLimit", "emailNotificationEnabled", "smsNotificationEnabled", "registered_breeds"];
    const configs = await Config.find({ key: { $in: keys } });
    
    const configMap = {};
    configs.forEach(c => {
      configMap[c.key] = c.value;
    });

    res.status(200).json({
      pregnancyWindowDays: configMap["pregnancyWindowDays"] !== undefined ? configMap["pregnancyWindowDays"] : "60",
      maxAttemptLimit: configMap["maxAttemptLimit"] !== undefined ? configMap["maxAttemptLimit"] : "3",
      emailNotificationEnabled: configMap["emailNotificationEnabled"] !== undefined ? configMap["emailNotificationEnabled"] : true,
      smsNotificationEnabled: configMap["smsNotificationEnabled"] !== undefined ? configMap["smsNotificationEnabled"] : true,
      registered_breeds: configMap["registered_breeds"] !== undefined ? configMap["registered_breeds"] : [
        "Brahman",
        "Holstein",
        "Simmental",
        "Angus",
        "Hereford"
      ]
    });
  } catch (error) {
    console.error("[getConfigSettings ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch configurations." });
  }
};

// POST /api/config/settings — Update configuration settings parameters
export const updateConfigSettings = async (req, res) => {
  try {
    const { pregnancyWindowDays, maxAttemptLimit, emailNotificationEnabled, smsNotificationEnabled, registered_breeds } = req.body;
    
    const updates = [];
    if (pregnancyWindowDays !== undefined) {
      updates.push(Config.findOneAndUpdate({ key: "pregnancyWindowDays" }, { value: String(pregnancyWindowDays) }, { upsert: true }));
    }
    if (maxAttemptLimit !== undefined) {
      updates.push(Config.findOneAndUpdate({ key: "maxAttemptLimit" }, { value: String(maxAttemptLimit) }, { upsert: true }));
    }
    if (emailNotificationEnabled !== undefined) {
      updates.push(Config.findOneAndUpdate({ key: "emailNotificationEnabled" }, { value: Boolean(emailNotificationEnabled) }, { upsert: true }));
    }
    if (smsNotificationEnabled !== undefined) {
      updates.push(Config.findOneAndUpdate({ key: "smsNotificationEnabled" }, { value: Boolean(smsNotificationEnabled) }, { upsert: true }));
    }
    if (registered_breeds !== undefined) {
      updates.push(Config.findOneAndUpdate({ key: "registered_breeds" }, { value: registered_breeds }, { upsert: true }));
    }

    await Promise.all(updates);

    res.status(200).json({ message: "Configuration settings updated successfully." });
  } catch (error) {
    console.error("[updateConfigSettings ERROR]", error.message);
    res.status(500).json({ message: "Failed to update configuration settings." });
  }
};
