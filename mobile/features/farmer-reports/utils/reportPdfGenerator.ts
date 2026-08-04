import { format } from "date-fns";
import type { ActivityFeedItem } from "../types/farmerReports.types";

const clean = (value: unknown) =>
  String(value || "N/A").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
      char
    ] || char,
  );

const formatReportDate = (value?: string) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : format(date, "MMMM dd, yyyy - h:mm a");
};

export function generateSingleRecordPdfHtml(record: ActivityFeedItem): string {
  const animal: any = record.animalId || {};
  const dateVal = record.date ? format(new Date(record.date), "MMMM dd, yyyy") : "N/A";
  
  let title = "Livestock Service Record";
  let subtitle = "Iloilo Livestock Breeding Record";
  let disclaimer = "Generated from BreedSmart. This report documents recorded livestock management events.";
  let rows: [string, string][] = [];

  if (record.type === "ai") {
    title = "Artificial Insemination Report";
    disclaimer = "Generated from BreedSmart. This report documents recorded artificial insemination service and follow-up outcomes.";
    
    rows = [
      ["Animal Tag / ID", animal.earTag || animal.animalId || "N/A"],
      ["Breed", animal.breed || "N/A"],
      ["Species", animal.species || "N/A"],
      ["Request Status", record.details?.status || "Not recorded"],
      ["Requested", formatReportDate(record.details?.requestedAt)],
      ["Preferred Visit", formatReportDate(record.details?.preferredDate)],
      ["Scheduled Visit", formatReportDate(record.details?.scheduledDate)],
      ["A.I. Performed", formatReportDate(record.details?.serviceDate || record.date)],
      ["Attempt Number", record.details?.attemptNumber?.toString() || "1"],
      ["Sire Breed", record.details?.sireBreed || "N/A"],
      ["Sire Code", record.details?.sireCode || "N/A"],
      ["Estrus Type", record.details?.estrus || "N/A"],
      ["Technician", record.details?.technician || "N/A"],
      ["Technician Contact", record.details?.technicianPhone || "Not provided"],
      ["A.I. Outcome", record.details?.outcome || "Pending"],
      ["Outcome Verification", record.details?.outcomeVerificationStatus || "Pending"],
      ["Outcome Confirmed", formatReportDate(record.details?.outcomeConfirmedAt)],
    ];

    if (record.details?.previousAttemptNumber) {
      rows.push([
        "Previous Attempt",
        `Attempt ${record.details.previousAttemptNumber} on ${formatReportDate(record.details.previousAttemptDate)}`,
      ]);
    }

    if (record.details?.technicianNote) {
      rows.push(["Technician Notes", record.details.technicianNote]);
    }
  } else if (record.type === "health") {
    title = "Animal Health Assistance Report";
    disclaimer = "Generated from BreedSmart. This report documents recorded assistance and does not replace veterinary certification.";
    
    rows = [
      ["Animal Tag / ID", animal.earTag || animal.animalId || "N/A"],
      ["Breed", animal.breed || "N/A"],
      ["Species", animal.species || "N/A"],
      ["Service Date", dateVal],
      ["Concern / Request Type", (record.details?.requestType || "Check-up").replaceAll("_", " ")],
      ["Symptoms", record.details?.symptoms || "N/A"],
      ["Urgency", record.details?.urgency || "N/A"],
      ["Diagnosis", record.details?.diagnosis || "N/A"],
      ["Treatment", record.details?.treatment || "N/A"],
      ["Medicine / Advice", record.details?.advice || "N/A"],
      ["Technician / Vet", record.details?.technician || "N/A"],
    ];

    if (record.details?.technicianNote) {
      rows.push(["Technician Notes", record.details.technicianNote]);
    }
  } else if (record.type === "calving") {
    title = "Calving & Offspring Report";
    disclaimer = "Generated from BreedSmart. This report documents calving events and registered offspring details.";
    
    rows = [
      ["Mother Animal Tag / ID", animal.earTag || animal.animalId || "N/A"],
      ["Calving Date", dateVal],
      ["Calving Ease", record.details?.calvingEase || "N/A"],
      ["Number of Calves", record.details?.numberOfCalves?.toString() || "1"],
      ["Technician", record.details?.technician || "N/A"],
    ];

    if (record.details?.calves && record.details.calves.length > 0) {
      const calfList = record.details.calves
        .map((c, i) => `Calf #${i + 1}: ${c.sex}${c.earTag ? ` (Tag: #${c.earTag})` : ""}`)
        .join(", ");
      rows.push(["Registered Calves", calfList]);
    }

    if (record.details?.technicianNote) {
      rows.push(["Technician Notes", record.details.technicianNote]);
    }
  }

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<div style="border-bottom:1px solid #eee;padding:12px 0;display:flex;justify-content:space-between;align-items:flex-start;">
          <span style="color:#667069;font-weight:bold;font-size:12px;text-transform:uppercase;width:35%;">${clean(label)}</span>
          <span style="color:#17201a;font-size:14px;width:60%;text-align:right;word-break:break-word;">${clean(value)}</span>
        </div>`
    )
    .join("");

  return `
    <html>
      <body style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;padding:32px;color:#17201a;background-color:#fff;">
        <div style="border-bottom:3px solid #00643B;padding-bottom:16px;margin-bottom:24px;">
          <h1 style="color:#00643B;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">BreedSmart</h1>
          <p style="color:#667069;margin:4px 0 0 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${subtitle}</p>
        </div>
        <div style="margin-bottom:28px;">
          <h2 style="color:#17201a;margin:0 0 8px 0;font-size:20px;font-weight:700;">${title}</h2>
          <p style="color:#667069;margin:0;font-size:12px;">Report Generated: ${format(new Date(), "MMMM dd, yyyy - h:mm a")}</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px 24px;margin-bottom:32px;background-color:#f8fafc;">
          ${rowsHtml}
        </div>
        <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:40px;">
          <p style="font-size:11px;color:#667069;line-height:16px;margin:0;">${disclaimer}</p>
        </div>
      </body>
    </html>
  `;
}
