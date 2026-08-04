import { ActivityFeedItem } from "../types/farmerReports.types";

interface FilterParams {
  records: ActivityFeedItem[];
  recordSearch: string;
  recordType: "all" | ActivityFeedItem["type"];
}

export const filterActivityRecords = ({
  records,
  recordSearch,
  recordType,
}: FilterParams): ActivityFeedItem[] => {
  const query = recordSearch.trim().toLowerCase();

  return records.filter((record) => {
    if (recordType !== "all" && record.type !== recordType) return false;

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
