import { ActivityFeedItem } from "../types/farmerReports.types";

interface FilterParams {
  records: ActivityFeedItem[];
  recordSearch: string;
  recordType: "all" | ActivityFeedItem["type"];
  recordStatus: "all" | "open" | "completed" | "closed";
  recordPeriod: "all" | "30" | "90";
}

export const filterActivityRecords = ({
  records,
  recordSearch,
  recordType,
  recordStatus,
  recordPeriod,
}: FilterParams): ActivityFeedItem[] => {
  const query = recordSearch.trim().toLowerCase();
  const now = Date.now();
  return records.filter((record) => {
    if (recordType !== "all" && record.type !== recordType) return false;
    if (recordPeriod !== "all") {
      const recordTime = new Date(record.date).getTime();
      if (
        !Number.isFinite(recordTime) ||
        now - recordTime > Number(recordPeriod) * 86400000
      )
        return false;
    }
    const status = String(record.details?.status || "").toLowerCase();
    if (
      recordStatus === "open" &&
      ![
        "pending",
        "approved",
        "scheduled",
        "in_progress",
        "assigned",
      ].includes(status)
    )
      return false;
    if (
      recordStatus === "completed" &&
      !["done", "resolved", "completed"].includes(status)
    )
      return false;
    if (
      recordStatus === "closed" &&
      !["cancelled", "rejected"].includes(status)
    )
      return false;
    if (!query) return true;
    return [
      record.title,
      record.description,
      record.animalId?.earTag,
      record.animalId?.breed,
      record.animalId?.species,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
};
