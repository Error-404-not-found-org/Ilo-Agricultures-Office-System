const idOf = (value: any) => {
  const resolved = value?._id ?? value;
  return resolved == null ? null : String(resolved);
};

const recordIdentity = (record: any, index: number) => {
  const kind = String(record.recordKind || record.type || "record");

  if (kind === "medical_record") {
    const healthRequestId = idOf(record.healthRequestId);
    if (healthRequestId) return `health:${healthRequestId}`;
  }

  if (kind === "health_request") {
    const requestId = idOf(record._id || record.id);
    if (requestId) return `health:${requestId}`;
  }

  const recordId = idOf(record._id || record.id);
  if (recordId) return `${kind}:${recordId}`;

  return `${kind}:fallback:${record.recordDate || record.createdAt || index}:${record.title || ""}`;
};

export const deduplicateAnimalRecords = (records: any[]) => {
  const recordsByIdentity = new Map<string, any>();

  records.forEach((record, index) => {
    const identity = recordIdentity(record, index);
    const existing = recordsByIdentity.get(identity);
    const existingKind = existing?.recordKind || existing?.type;
    const nextKind = record.recordKind || record.type;

    if (
      !existing ||
      (existingKind === "health_request" && nextKind === "medical_record")
    ) {
      recordsByIdentity.set(identity, record);
    }
  });

  return Array.from(recordsByIdentity.values());
};
