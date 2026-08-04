import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { toast } from "sonner-native";

export const getRecordDisplayDate = (item: any) => {
  if (!item) return "";
  const rawDate = item.inseminationDate || item.pregnancyDiagnosis?.date || item.date || item.createdAt;
  return rawDate ? new Date(rawDate).toLocaleDateString() : "—";
};

export const getRecordDetails = (item: any) => {
  if (!item) return "";
  if (item.sireCode) {
    return `Sire: ${item.sireCode}`;
  }
  if (item.pregnancyDiagnosis?.result) {
    return `Result: ${item.pregnancyDiagnosis.result}`;
  }
  if (item.calfSex) {
    return `Calf Sex: ${item.calfSex}`;
  }
  return "—";
};

export const handleExportCSV = async (records: any[], category: string) => {
  if (records.length === 0) {
    toast.error("No records available to export.");
    return;
  }

  try {
    let csvContent = "Category,Date,Farmer Owner,Cow/Tag ID,Breed,Status,Details\n";

    records.forEach((item) => {
      const dateStr = getRecordDisplayDate(item);
      const farmerName = item.farmerId?.name || "Unknown";
      const animalTag = item.animalId?.earTag || item.animalId?.animalId || "No Tag";
      const breed = item.animalId?.breed || "Mixed";
      const status = item.status || item.pregnancyDiagnosis?.result || "Completed";
      const details = getRecordDetails(item);

      // Clean values
      const cleanFarmer = farmerName.replace(/"/g, '""');
      const cleanDetails = details.replace(/"/g, '""');

      csvContent += `"${category}","${dateStr}","${cleanFarmer}","${animalTag}","${breed}","${status}","${cleanDetails}"\n`;
    });

    const fileUri = FileSystem.documentDirectory + `records_${category.toLowerCase()}_export_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: `Export ${category} CSV`,
        UTI: "public.comma-separated-values-text",
      });
      toast.success("CSV Exported successfully!");
    } else {
      toast.error("Sharing interface is unavailable");
    }
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate CSV export");
  }
};

export const handleExportExcel = async (records: any[], category: string) => {
  if (records.length === 0) {
    toast.error("No records available to export.");
    return;
  }

  try {
    let htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"/><style>td { border: 0.5pt solid #c0c0c0; padding: 4px; }</style></head>
    <body>
      <h2>BreedSmart System Export - ${category} Records</h2>
      <table border="1">
        <tr style="background-color: #1e3a5f; color: white; font-weight: bold;">
          <th>Category</th>
          <th>Date</th>
          <th>Farmer Owner</th>
          <th>Cow/Tag ID</th>
          <th>Breed</th>
          <th>Status</th>
          <th>Details</th>
        </tr>`;

    records.forEach((item) => {
      const dateStr = getRecordDisplayDate(item);
      const farmerName = item.farmerId?.name || "Unknown";
      const animalTag = item.animalId?.earTag || item.animalId?.animalId || "No Tag";
      const breed = item.animalId?.breed || "Mixed";
      const status = item.status || item.pregnancyDiagnosis?.result || "Completed";
      const details = getRecordDetails(item);

      htmlContent += `<tr>
        <td>${category}</td>
        <td>${dateStr}</td>
        <td>${farmerName}</td>
        <td>${animalTag}</td>
        <td>${breed}</td>
        <td>${status}</td>
        <td>${details}</td>
      </tr>`;
    });

    htmlContent += `</table></body></html>`;

    const fileUri = FileSystem.documentDirectory + `records_${category.toLowerCase()}_export_${Date.now()}.xls`;
    await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.ms-excel",
        dialogTitle: `Export ${category} Excel`,
      });
      toast.success("Excel sheet exported!");
    } else {
      toast.error("Sharing interface is unavailable");
    }
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate Excel export");
  }
};

export const handleExportPDF = async (records: any[], category: string) => {
  if (records.length === 0) {
    toast.error("No records available to export.");
    return;
  }

  try {
    let htmlContent = `<html>
    <head>
      <style>
        body { font-family: sans-serif; padding: 20px; color: #333; }
        h1 { color: #1e3a5f; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #1e3a5f; color: white; }
        .meta { font-size: 12px; color: #666; margin-bottom: 20px; text-align: right; }
      </style>
    </head>
    <body>
      <h1>BreedSmart Unified Records Report</h1>
      <div class="meta">Category: <b>${category}</b> | Generated: ${new Date().toLocaleDateString()}</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Farmer Owner</th>
            <th>Cow/Tag ID</th>
            <th>Breed</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>`;

    records.forEach((item) => {
      const dateStr = getRecordDisplayDate(item);
      const farmerName = item.farmerId?.name || "Unknown";
      const animalTag = item.animalId?.earTag || item.animalId?.animalId || "No Tag";
      const breed = item.animalId?.breed || "Mixed";
      const status = item.status || item.pregnancyDiagnosis?.result || "Completed";
      const details = getRecordDetails(item);

      htmlContent += `<tr>
        <td>${dateStr}</td>
        <td>${farmerName}</td>
        <td>${animalTag}</td>
        <td>${breed}</td>
        <td>${status}</td>
        <td>${details}</td>
      </tr>`;
    });

    htmlContent += `</tbody></table></body></html>`;

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Export ${category} PDF Report`,
      });
      toast.success("PDF Report generated!");
    } else {
      toast.error("Sharing interface is unavailable");
    }
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate PDF report");
  }
};
