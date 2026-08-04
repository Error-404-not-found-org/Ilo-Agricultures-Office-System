import { AuditLog } from "../models/audit-log.model.js";

export const createAuditLog = (entry, options = undefined) => {
  if (options?.session) {
    return AuditLog.create([entry], options).then(([log]) => log);
  }
  return AuditLog.create(entry);
};
