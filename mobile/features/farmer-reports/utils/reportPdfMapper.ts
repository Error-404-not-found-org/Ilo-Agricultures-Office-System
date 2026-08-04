import { format } from "date-fns";
import type { ReportRow } from "@/lib/reportExporter";
import type { ActivityFeedItem } from "../types/farmerReports.types";

export const mapRecordsToReportRows = (
  records: ActivityFeedItem[],
  farmerName: string
): ReportRow[] => {
  return records.map((item) => {
    const dateStr = item.date ? format(new Date(item.date), "MM/dd/yyyy") : "—";

    let rowType: "AI" | "PD" | "CD" | "HL" = "HL";
    if (item.type === "ai") rowType = "AI";
    else if (item.type === "calving") rowType = "CD";

    const row: ReportRow = {
      type: rowType,
      animalId: item.animalId?._id || "—",
      earTag: item.animalId?.earTag || "—",
      brand: "—",
      species: item.animalId?.species || "—",
      breed: item.animalId?.breed || "—",
      color: "—",
      address: "—",
      farmer: farmerName,
      barangay: "—",
      date: dateStr,
    };

    if (item.type === "ai") {
      row.noOfAi = item.details?.attemptNumber;
      row.estrus = item.details?.estrus || "NH";
      row.sireBreed = item.details?.sireBreed || "—";
      row.sireCode = item.details?.sireCode || "—";

      if (item.details?.outcome) {
        row.pdDate = dateStr;
        row.pdResult = item.details.outcome;
      }
    } else if (item.type === "calving") {
      row.cdDate = dateStr;
      row.cdNum = item.details?.numberOfCalves;
      row.cdSex = item.details?.calves?.[0]?.sex || "—";
      row.cdEase = item.details?.calvingEase || "—";
    } else if (item.type === "health") {
      row.sireBreed = item.details?.requestType || "Check-up";
      row.sireCode = item.details?.status?.toUpperCase() || "COMPLETED";
    }

    return row;
  });
};
