import { AuditLog } from "../models/audit-log.model.js";

export const createAuditLog = (entry) => AuditLog.create(entry);
