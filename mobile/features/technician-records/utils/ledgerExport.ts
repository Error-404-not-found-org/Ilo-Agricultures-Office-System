import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { toast } from "sonner-native";

export const getDisplayDate = (item: any) => {
  if (!item) return null;
  if (item.type === "insemination") {
    return (
      item.inseminationDate ||
      item.scheduledDate ||
      item.preferredDate ||
      item.createdAt
    );
  }
  if (item.type === "pregnancy") {
    return item.pregnancyDiagnosis?.date || item.date || item.createdAt;
  }
  if (item.type === "calving") {
    return item.date || item.createdAt;
  }
  if (item.type === "ai-request" || item.type === "health-request") {
    return item.preferredDate || item.scheduledDate || item.createdAt;
  }
  return item.createdAt;
};

export const handleExportCSV = async (filteredRecords: any[]) => {
  if (filteredRecords.length === 0) {
    toast.error("No records available to export.");
    return;
  }

  try {
    let csvContent =
      "Type,Activity Date,Farmer Owner,Cow/Tag ID,Breed,Status,Details\n";

    filteredRecords.forEach((item) => {
      let typeStr = "";
      switch (item.type) {
        case "insemination":
          typeStr = "AI Insemination";
          break;
        case "pregnancy":
          typeStr = "Pregnancy Check";
          break;
        case "calving":
          typeStr = "Calving / Offspring";
          break;
        case "ai-request":
          typeStr = "AI Request Visit";
          break;
        case "health-request":
          typeStr = "Health Check";
          break;
      }

      const dateRaw = getDisplayDate(item);
      const dateStr = dateRaw
        ? new Date(dateRaw).toLocaleDateString()
        : "N/A";
      const farmerName = item.farmerId?.name || "Unknown";
      const animalTag =
        item.animalId?.earTag || item.animalId?.animalId || "No Tag";
      const breed = item.animalId?.breed || "Unknown";
      const status = item.status || "COMPLETED";

      let details = "";
      if (item.type === "insemination") {
        details = `Attempt #${item.attemptNumber || 1} - Sire: ${item.sireCode || "N/A"}`;
      } else if (item.type === "health-request") {
        details = item.technicianNote || item.remarks || "No notes";
      } else if (item.type === "pregnancy") {
        details = `PD Result: ${item.pregnancyDiagnosis?.result || "Pending"}`;
      } else if (item.type === "calving") {
        details = `Ease: ${item.calvingEase || "Natural"}`;
      }

      // Clean values to prevent CSV issues
      const cleanFarmer = farmerName.replace(/"/g, '""');
      const cleanDetails = details.replace(/"/g, '""');

      csvContent += `"${typeStr}","${dateStr}","${cleanFarmer}","${animalTag}","${breed}","${status}","${cleanDetails}"\n`;
    });

    const fileUri =
      FileSystem.documentDirectory +
      `service_ledger_export_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Records / Ledger CSV",
        UTI: "public.comma-separated-values-text",
      });
      toast.success("Records CSV exported!");
    } else {
      toast.error("Sharing interface is unavailable");
    }
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate CSV export");
  }
};
