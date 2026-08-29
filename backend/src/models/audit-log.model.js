import mongoose from "mongoose";
import { sanitizeAuditValue } from "../domain/audit-log-sanitization.js";

const AuditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    before: { type: mongoose.Schema.Types.Mixed, set: sanitizeAuditValue },
    after: { type: mongoose.Schema.Types.Mixed, set: sanitizeAuditValue },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      set: sanitizeAuditValue,
    },
  },
  { timestamps: true },
);

AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
