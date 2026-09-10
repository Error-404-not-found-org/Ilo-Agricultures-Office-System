const normalizeFieldName = (field) =>
  String(field || "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const BLOCKED_AUDIT_FIELDS = new Set([
  "password",
  "passwordhash",
  "temporarypassword",
  "otp",
  "otpcode",
  "token",
  "accesstoken",
  "refreshtoken",
  "pushtoken",
  "clerkid",
  "clerkuserid",
  "linkedclerkid",
  "invitationid",
  "clerkinvitationid",
  "email",
  "emailaddress",
  "normalizedemail",
  "phone",
  "phonenumber",
  "normalizedphonenumber",
  "actingadmin",
  "targetuser",
  "note",
  "notes",
  "techniciannote",
  "techniciannotes",
  "clinicalnote",
  "clinicalnotes",
  "farmernotes",
  "resolutionnotes",
  "findings",
  "locationaddress",
  "error",
  "errormessage",
  "internalerror",
  "stack",
  "stacktrace",
]);

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const sanitizeAuditValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([field]) => !BLOCKED_AUDIT_FIELDS.has(normalizeFieldName(field)))
      .map(([field, nestedValue]) => [field, sanitizeAuditValue(nestedValue)]),
  );
};

export const sanitizeAuditEntry = (entry) => ({
  ...entry,
  ...(Object.hasOwn(entry, "before")
    ? { before: sanitizeAuditValue(entry.before) }
    : {}),
  ...(Object.hasOwn(entry, "after")
    ? { after: sanitizeAuditValue(entry.after) }
    : {}),
  ...(Object.hasOwn(entry, "metadata")
    ? { metadata: sanitizeAuditValue(entry.metadata) }
    : {}),
});
