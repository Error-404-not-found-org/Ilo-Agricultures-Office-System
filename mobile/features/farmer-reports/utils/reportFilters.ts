import { ActivityFeedItem } from "../types/farmerReports.types";

interface FilterParams {
  records: ActivityFeedItem[];
  recordSearch: string;
  recordType: "all" | ActivityFeedItem["type"];
  recordPeriod: "all" | "30" | "90";
}

export const filterActivityRecords = ({
  records,
  recordSearch,
  recordType,
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
