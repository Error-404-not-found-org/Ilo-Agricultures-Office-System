import { AuditLog } from "../models/audit-log.model.js";

export const listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const skip = (page - 1) * limit;
    const query = {};

    if (req.query.entityType && req.query.entityType !== "all") {
      query.entityType = req.query.entityType;
    }
    if (req.query.action) {
      query.action = { $regex: req.query.action, $options: "i" };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("actorId", "name role email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      data: logs,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[listAuditLogs ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch audit logs." });
  }
};
