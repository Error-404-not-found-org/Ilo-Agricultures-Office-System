type OfficialRecordDateInput = {
  [key: string]: unknown;
  recordKind?: string;
  type?: string;
  recordDate?: string | null;
  inseminationDate?: string | null;
  pregnancyDiagnosis?: { date?: string | null } | null;
  date?: string | null;
} | null | undefined;

export function getOfficialRecordDate(item: OfficialRecordDateInput): string | null {
  if (!item) return null;
  if (Object.prototype.hasOwnProperty.call(item, "recordDate")) {
    return item.recordDate || null;
  }

  switch (item.recordKind || item.type) {
    case "insemination":
      return item.inseminationDate || null;
    case "pregnancy":
      return item.pregnancyDiagnosis?.date || null;
    case "calving":
    case "medical_record":
      return item.date || null;
    default:
      return null;
  }
}
