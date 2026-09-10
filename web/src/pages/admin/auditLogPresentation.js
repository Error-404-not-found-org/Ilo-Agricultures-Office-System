const actionPresentation = [
  [
    "System Data Export Started",
    ["backup_started", "system_data_export.started"],
  ],
  [
    "System Data Export Completed",
    ["backup_completed", "system_data_export.completed"],
  ],
  ["System Data Export Failed", ["backup_failed", "system_data_export.failed"]],
  ["Technician Account Created", ["create_technician", "technician.created"]],
  [
    "Technician Invitation Resent",
    ["resend_technician_invitation", "technician.invitation_resent"],
  ],
  [
    "Farmer Invitation Resent",
    ["resend_farmer_invitation", "farmer.invitation_resent"],
  ],
  ["User Account Created", ["create", "user.created"]],
  ["User Account Deactivated", ["delete", "user.deactivated"]],
  ["User Account Suspended", ["suspend", "user.suspended"]],
  ["User Account Reactivated", ["reactivate", "user.reactivated"]],
  ["User Account Verified", ["verify", "user.verified"]],
  ["User Role Updated", ["update_role", "user.role_updated"]],
  ["User Password Reset", ["reset_password", "user.password_reset"]],
  [
    "User Metadata Synchronized",
    ["sync_user_metadata", "user.metadata_synchronized"],
  ],
  ["User Profile Claimed", ["claim_profile", "user.profile_claimed"]],
  ["Request Reassigned", ["admin_reassigned_request", "request.reassigned"]],
  ["AI Service Recorded", ["RECORD_AI_SERVICE", "ai.service_recorded"]],
  [
    "Previous AI Record Added",
    ["RECORD_PREVIOUS_AI_HISTORY", "ai.previous_history_recorded"],
  ],
  [
    "Previous AI Record Added and Tracking Continued",
    ["RECORD_PREVIOUS_AI_CONTINUE_TRACKING", "ai.previous_tracking_continued"],
  ],
  ["AI Record Archived", ["delete_insemination", "ai.record_archived"]],
  [
    "Farmer Breeding Observation Reported",
    ["farmer_breeding_observation_reported", "ai.farmer_observation_reported"],
  ],
  [
    "Technician Breeding Observation Recorded",
    [
      "technician_breeding_observation_recorded",
      "ai.technician_observation_recorded",
    ],
  ],
  [
    "Breeding Observation Verified",
    ["verify_breeding_observation", "ai.observation_verified"],
  ],
  [
    "Health Service Completed",
    ["RESOLVE_HEALTH_REQUEST", "health.service_completed"],
  ],
  [
    "Walk-in Health Record Created",
    ["CREATE_WALKIN_HEALTH", "health.walkin_record_created"],
  ],
  [
    "Health Advice Provided",
    ["health_advice_provided", "health.advice_provided"],
  ],
  [
    "Health Office Pickup Completed",
    ["health_office_pickup_provided", "health.office_pickup_completed"],
  ],
  ["Health Request Triaged", ["triaged", "health.triaged"]],
  [
    "Health Follow-up Scheduled",
    ["follow_up_scheduled", "health.follow_up_scheduled"],
  ],
  [
    "Pregnancy Diagnosis Recorded",
    ["record_pregnancy_diagnosis", "pregnancy.diagnosis_recorded"],
  ],
  [
    "Pregnancy Recheck Recorded",
    ["record_pregnancy_continuation_recheck", "pregnancy.recheck_recorded"],
  ],
  [
    "Pregnancy Record Corrected",
    ["correct_pregnancy_record", "pregnancy.record_corrected"],
  ],
  [
    "Calving Record Created",
    ["create_calving_record", "calving.record_created"],
  ],
  [
    "Calving Record Corrected",
    ["correct_calving_record", "calving.record_corrected"],
  ],
  [
    "Cancellation Requested",
    ["CANCEL_REQUEST", "request.cancellation_requested"],
  ],
  ["Request Cancelled", ["CANCEL", "request.cancelled"]],
  [
    "Cancellation Approved",
    ["CANCEL_APPROVED", "request.cancellation_approved"],
  ],
  [
    "Cancellation Rejected",
    ["CANCEL_REJECTED", "request.cancellation_rejected"],
  ],
  ["Animal Status Updated", ["status_update", "animal.status_updated"]],
];

const normalizeAction = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const actionLabelByAlias = new Map(
  actionPresentation.flatMap(([label, aliases]) =>
    aliases.map((alias) => [normalizeAction(alias), label]),
  ),
);

const readableFallback = (value, fallback) => {
  const normalized = String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) return fallback;

  return normalized
    .replace(/\bai\b/g, "AI")
    .replace(/\bid\b/g, "ID")
    .replace(/(^|\s)\p{L}/gu, (match) => match.toUpperCase());
};

export const AUDIT_ENTITY_OPTIONS = [
  { value: "all", label: "All activity" },
  { value: "User", label: "User" },
  { value: "Animal", label: "Animal" },
  { value: "AIRequest", label: "AI Request" },
  { value: "Insemination", label: "AI / Insemination" },
  { value: "HealthRequest", label: "Health" },
  { value: "Pregnancy", label: "Pregnancy" },
  { value: "Calving", label: "Calving" },
  { value: "System", label: "System" },
  { value: "Task", label: "Task" },
];

const entityLabels = new Map(
  AUDIT_ENTITY_OPTIONS.map(({ value, label }) => [value, label]),
);

export const formatAuditAction = (action) =>
  actionLabelByAlias.get(normalizeAction(action)) ||
  readableFallback(action, "Administrative Activity");

export const formatAuditEntity = (entityType) =>
  entityLabels.get(entityType) || readableFallback(entityType, "Other");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const resolveAuditActionSearch = (search) => {
  const trimmed = String(search || "").trim();
  if (!trimmed) return undefined;
  const normalizedSearch = trimmed.toLowerCase();
  const matchingAliases = actionPresentation
    .filter(
      ([label, aliases]) =>
        label.toLowerCase().includes(normalizedSearch) ||
        aliases.some((alias) => alias.toLowerCase().includes(normalizedSearch)),
    )
    .flatMap(([, aliases]) => aliases);

  if (!matchingAliases.length) return trimmed;
  return `^(?:${matchingAliases.map(escapeRegex).join("|")})$`;
};

const normalizedField = (field) =>
  String(field || "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const meaningfulDetailFields = new Map([
  ["name", "Name"],
  ["targetname", "Affected user"],
  ["username", "Affected user"],
  ["farmername", "Farmer"],
  ["technicianname", "Technician"],
  ["animalname", "Animal"],
  ["animaltag", "Animal tag"],
  ["eartag", "Animal tag"],
  ["status", "Status"],
  ["oldstatus", "Previous status"],
  ["previousstatus", "Previous status"],
  ["newstatus", "New status"],
  ["role", "Role"],
  ["oldrole", "Previous role"],
  ["previousrole", "Previous role"],
  ["newrole", "New role"],
  ["reason", "Reason"],
  ["cancellationreason", "Cancellation reason"],
  ["correctionreason", "Correction reason"],
  ["result", "Result"],
  ["outcome", "Outcome"],
  ["requesttype", "Request type"],
  ["servicetype", "Service type"],
  ["recordtype", "Record type"],
  ["failurecategory", "Result category"],
]);

const formatDetailValue = (value) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const values = value.filter((item) =>
      ["string", "number", "boolean"].includes(typeof item),
    );
    return values.length ? values.join(", ") : null;
  }
  if (["string", "number"].includes(typeof value) && value !== "") {
    return String(value);
  }
  return null;
};

export const getMeaningfulAuditDetails = (value) => {
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([field, nested]) => {
    const label = meaningfulDetailFields.get(normalizedField(field));
    const formattedValue = label ? formatDetailValue(nested) : null;
    const current =
      label && formattedValue !== null
        ? [{ label, value: formattedValue }]
        : [];

    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return [...current, ...getMeaningfulAuditDetails(nested)];
    }
    return current;
  });
};

export const getAuditDescription = (log) => {
  const actor = log?.actorId?.name || "System";
  const target = log?.after?.name;
  const action = normalizeAction(log?.action);

  if (action === "create_technician" && target) {
    return `${actor} created technician ${target}.`;
  }
  if (action === "resend_technician_invitation" && target) {
    return `${actor} resent the invitation for technician ${target}.`;
  }
  if ((action === "create" || action === "user.created") && target) {
    const role = readableFallback(log?.after?.role, "user").toLowerCase();
    return `${actor} created ${role} ${target}.`;
  }
  return null;
};

export const getAuditDetailSections = (log) =>
  [
    ["Before", getMeaningfulAuditDetails(log?.before)],
    ["After", getMeaningfulAuditDetails(log?.after)],
    ["Details", getMeaningfulAuditDetails(log?.metadata)],
  ]
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
