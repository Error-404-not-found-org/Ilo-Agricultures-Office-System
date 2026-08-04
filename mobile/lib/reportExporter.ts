import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

const escapeHtml = (unsafe: any): string => {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export interface ReportRow {
  type: "AI" | "PD" | "CD" | "HL";
  animalId: string;
  earTag: string;
  brand: string;
  species: string;
  breed: string;
  color: string;
  address: string;
  farmer: string;
  date: string;
  noOfAi?: number;
  estrus?: string;
  sireBreed?: string;
  sireCode?: string;
  pdDate?: string;
  pdResult?: string;
  cdDate?: string;
  cdNum?: number;
  cdId?: string;
  cdSex?: string;
  cdEase?: string;
  barangay?: string;
}

export const generatePDF = async (
  data: ReportRow[],
  month: string,
  year: string,
  region: string = "VI",
  province: string = "ILOILO",
  municipality: string = "",
  submittedDate: string = "",
  preparedBy: string = "",
  notedBy: string = "",
  preparedByTitle: string = "Provincial AI Coordinator",
  notedByTitle: string = "Acting Supervising Agriculturist",
) => {
  const tableRows = data
    .map(
      (row, index) => `
    <tr>
      <td class="center">${escapeHtml(row.type)}</td>
      <td class="center">${index + 1}</td>
      <td>${escapeHtml(row.animalId)}</td>
      <td>${escapeHtml(row.earTag)}</td>
      <td>${escapeHtml(row.brand)}</td>
      <td>${escapeHtml(row.species)}</td>
      <td>${escapeHtml(row.breed)}</td>
      <td>${escapeHtml(row.color)}</td>
      <td>${escapeHtml(row.address)}</td>
      <td>${escapeHtml(row.farmer)}</td>
      <td class="center">${escapeHtml(row.date)}</td>
      <td class="center">${escapeHtml(row.noOfAi)}</td>
      <td class="center">${escapeHtml(row.estrus)}</td>
      <td class="center">${escapeHtml(row.sireBreed)}</td>
      <td class="center">${escapeHtml(row.sireCode)}</td>
      <td class="center">${escapeHtml(row.pdDate)}</td>
      <td class="center">${escapeHtml(row.pdResult)}</td>
      <td class="center">${escapeHtml(row.cdDate)}</td>
      <td class="center">${escapeHtml(row.cdNum)}</td>
      <td class="center">${escapeHtml(row.cdId)}</td>
      <td class="center">${escapeHtml(row.cdSex)}</td>
      <td class="center">${escapeHtml(row.cdEase)}</td>
    </tr>
  `,
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }

          @page {
            size: A4 landscape;
            margin: 10mm 12mm;
          }

          body {
            font-family: Arial, sans-serif;
            font-size: 7.5pt;
            color: #000;
            padding: 10mm 12mm;
          }

          /* ── TOP META ── */
          .top-meta {
            display: flex;
            justify-content: space-between;
            font-size: 7pt;
            margin-bottom: 4px;
          }
          .top-meta .form-no { font-style: italic; }

          /* ── AGENCY HEADER ── */
          .agency-header {
            text-align: center;
            margin-bottom: 6px;
            line-height: 1.4;
          }
          .agency-header .da-label {
            font-size: 9pt;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .agency-header .bureau-line {
            font-size: 6.5pt;
          }
          .agency-header .program-title {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 2px;
          }

          /* ── REGION / PROVINCE / MUNICIPALITY ── */
          .location-block {
            font-size: 7pt;
            margin-bottom: 6px;
            line-height: 1.6;
          }
          .location-block .loc-row {
            display: flex;
            gap: 6px;
          }
          .location-block .loc-label { font-weight: normal; }
          .location-block .loc-value {
            font-weight: bold;
            border-bottom: 1px solid #000;
            min-width: 80px;
          }

          /* ── REPORT PERIOD ── */
          .report-period {
            text-align: center;
            font-size: 8pt;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .report-period .sub-title {
            font-size: 7pt;
            font-weight: normal;
          }
          .period-line {
            text-align: center;
            font-size: 7.5pt;
            margin-bottom: 6px;
          }
          .period-line span {
            border-bottom: 1px solid #000;
            display: inline-block;
            min-width: 60px;
            font-weight: bold;
          }

          /* ── SUBMITTED DATE ── */
          .submitted-line {
            text-align: right;
            font-size: 7pt;
            margin-bottom: 4px;
          }
          .submitted-line span {
            border-bottom: 1px solid #000;
            display: inline-block;
            min-width: 100px;
          }

          /* ── TABLE ── */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 6.5pt;
            margin-bottom: 8px;
          }
          th, td {
            border: 0.5pt solid #000;
            padding: 2px 3px;
            vertical-align: middle;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
          }
          td { text-align: left; }
          td.center { text-align: center; }

          /* group header rows */
          .th-group {
            background-color: #d8d8d8;
            font-size: 7pt;
            font-weight: bold;
            text-align: center;
          }
          .th-sub {
            background-color: #f0f0f0;
            font-size: 6pt;
            font-weight: bold;
            text-align: center;
          }

          /* ── LEGEND ── */
          .legend {
            font-size: 6.5pt;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .legend .legend-title { font-weight: bold; }

          /* ── SIGNATORIES ── */
          .signatories {
            display: flex;
            justify-content: flex-end;
            gap: 60px;
            margin-top: 10px;
            font-size: 7.5pt;
          }
          .signatory-block {
            text-align: center;
            min-width: 140px;
          }
          .signatory-block .sig-label {
            font-size: 6.5pt;
            margin-bottom: 18px;
          }
          .signatory-block .sig-name {
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: 2px;
            font-size: 7.5pt;
            text-transform: uppercase;
          }
          .signatory-block .sig-title {
            font-size: 6.5pt;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>

        <!-- Top meta row -->
        <div class="top-meta">
          <div class="form-no">UNIP Form No.2 (Revised)</div>
          <div></div>
        </div>

        <!-- Agency header -->
        <div class="agency-header">
          <div class="da-label">Department of Agriculture</div>
          <div class="bureau-line">Bureau of Animal Industry – Livestock Development Council – National Dairy Authority – Philippine Carabao Center</div>
          <div class="bureau-line">DA Regional Field Units – Local Government Units</div>
          <div class="program-title">Unified National Artificial Insemination Program</div>
        </div>

        <!-- Location block (left-aligned) -->
        <div class="location-block">
          <div class="loc-row">
            <span class="loc-label">Region</span>
            <span class="loc-value">${escapeHtml(region)}</span>
          </div>
          <div class="loc-row">
            <span class="loc-label">Province</span>
            <span class="loc-value">${escapeHtml(province)}</span>
          </div>
          <div class="loc-row">
            <span class="loc-label">Municipality/City</span>
            <span class="loc-value">${escapeHtml(municipality)}</span>
          </div>
        </div>

        <!-- Report period -->
        <div class="report-period">Monthly Accomplish Report</div>
        <div class="period-line">
          For the Month of&nbsp;<span>${escapeHtml(month)}</span>&nbsp;,&nbsp;<span>${escapeHtml(year)}</span>
        </div>

        <!-- Submitted date -->
        <div class="submitted-line">
          Submitted Date&nbsp;<span>${escapeHtml(submittedDate)}</span>
        </div>

        <!-- Main table -->
        <table>
          <thead>
            <!-- Row 1: section group headers -->
            <tr>
              <th rowspan="2" style="width:18px;">Data</th>
              <th rowspan="2" style="width:16px;">No.</th>
              <th colspan="7" class="th-group">Animal Identification</th>
              <th rowspan="2" style="width:60px;">Farmer</th>
              <th colspan="5" class="th-group">Artificial Insemination</th>
              <th colspan="2" class="th-group">Pregnancy Diagnosis</th>
              <th colspan="5" class="th-group">Calving / Offspring</th>
            </tr>
            <!-- Row 2: sub-column headers -->
            <tr>
              <!-- Animal ID -->
              <th style="width:26px;" class="th-sub">Animal ID No.</th>
              <th style="width:22px;" class="th-sub">Ear Tag No.</th>
              <th style="width:22px;" class="th-sub">Brand</th>
              <th style="width:30px;" class="th-sub">Species</th>
              <th style="width:28px;" class="th-sub">Breed</th>
              <th style="width:28px;" class="th-sub">Color</th>
              <th style="width:50px;" class="th-sub">Address</th>
              <!-- AI -->
              <th style="width:30px;" class="th-sub">Date</th>
              <th style="width:18px;" class="th-sub">No. of AI</th>
              <th style="width:22px;" class="th-sub">Estrus</th>
              <th style="width:28px;" class="th-sub">Sire Breed</th>
              <th style="width:28px;" class="th-sub">Sire Code</th>
              <!-- PD -->
              <th style="width:30px;" class="th-sub">Date</th>
              <th style="width:30px;" class="th-sub">Result</th>
              <!-- CD -->
              <th style="width:30px;" class="th-sub">Date</th>
              <th style="width:16px;" class="th-sub">No. of Calving</th>
              <th style="width:26px;" class="th-sub">Calf ID No.</th>
              <th style="width:16px;" class="th-sub">Sex</th>
              <th style="width:30px;" class="th-sub">Calving Ease</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <!-- Ensure at least 20 rows visible even if data is sparse -->
            ${Array.from({ length: Math.max(0, 20 - data.length) })
              .map(
                () => `
              <tr>
                ${Array(22).fill('<td style="height:14px;">&nbsp;</td>').join("")}
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <!-- Legend -->
        <div class="legend">
          <div class="legend-title">&lt;Items&gt;</div>
          <div>Data: AI, PD, CD</div>
          <div>(ID) Species: Beef, Dairy, Carabao</div>
          <div>(ID) Breed: Dam's breed &nbsp;ex. Native etc…</div>
          <div>(ID) Color: Dam's color &nbsp;ex. White etc…</div>
          <div>(AI) Estrus: Natural, Synchronize</div>
          <div>(PD) Result: Pregnancy, Empty</div>
          <div>(CD) Calving ease: Abortion, Natural, Difficult, Stillbirth</div>
          <div>* If a dam delivers twin, please use two &lt;Calf ID No.&gt; &amp; &lt;Sex&gt; columns for the calves.</div>
        </div>

        <!-- Signatories -->
        <div class="signatories">
          <div class="signatory-block">
            <div class="sig-label">Prepared by:</div>
            <div class="sig-name">${escapeHtml(preparedBy)}</div>
            <div class="sig-title">${escapeHtml(preparedByTitle)}</div>
          </div>
          <div class="signatory-block">
            <div class="sig-label">Noted by:</div>
            <div class="sig-name">${escapeHtml(notedBy)}</div>
            <div class="sig-title">${escapeHtml(notedByTitle)}</div>
          </div>
        </div>

      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 841,
    height: 595,
  });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `UNIP Report ${month} ${year}`,
  });
};

export const generateExcel = async (data: ReportRow[], filename: string) => {
  // Build rows with proper UNIP headers
  const headers = [
    "Data",
    "No.",
    "Animal ID No.",
    "Ear Tag No.",
    "Brand",
    "Species",
    "Breed",
    "Color",
    "Address",
    "Farmer",
    "AI Date",
    "No. of AI",
    "Estrus",
    "Sire Breed",
    "Sire Code",
    "PD Date",
    "PD Result",
    "CD Date",
    "No. of Calving",
    "Calf ID",
    "Sex",
    "Calving Ease",
  ];

  const rows = data.map((row, index) => ({
    Data: row.type,
    "No.": index + 1,
    "Animal ID No.": row.animalId,
    "Ear Tag No.": row.earTag,
    Brand: row.brand,
    Species: row.species,
    Breed: row.breed,
    Color: row.color,
    Address: row.address,
    Farmer: row.farmer,
    "AI Date": row.date,
    "No. of AI": row.noOfAi,
    Estrus: row.estrus,
    "Sire Breed": row.sireBreed,
    "Sire Code": row.sireCode,
    "PD Date": row.pdDate,
    "PD Result": row.pdResult,
    "CD Date": row.cdDate,
    "No. of Calving": row.cdNum,
    "Calf ID": row.cdId,
    Sex: row.cdSex,
    "Calving Ease": row.cdEase,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "UNIP Report");

  // Column widths
  worksheet["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length + 2, 12),
  }));

  const wbout = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const uri = `${FileSystem.cacheDirectory}${filename}.xlsx`;

  await FileSystem.writeAsStringAsync(uri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Sharing.shareAsync(uri, {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: `UNIP Excel ${filename}`,
  });
};
