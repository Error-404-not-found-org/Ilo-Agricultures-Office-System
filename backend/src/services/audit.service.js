import { AuditLog } from "../models/audit-log.model.js";
import { sanitizeAuditEntry } from "../domain/audit-log-sanitization.js";

export const createAuditLog = (entry, options = undefined) => {
  const sanitizedEntry = sanitizeAuditEntry(entry);
  if (options?.session) {
    return AuditLog.create([sanitizedEntry], options).then(([log]) => log);
  }
  return AuditLog.create(sanitizedEntry);
};
