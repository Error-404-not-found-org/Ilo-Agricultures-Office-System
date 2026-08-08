import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex").toUpperCase();
}

const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i += 2) {
  argMap[args[i]] = args[i + 1];
}

const sourcePath = argMap["--source"];
const outputPath = argMap["--output"];
const metadataOutput = argMap["--metadata-output"];
const scope = argMap["--scope"];

if (!sourcePath || !outputPath || !metadataOutput || !scope) {
  console.error(
    "Usage: node import-psgc-xlsx.js --source <path> --output <path> --metadata-output <path> --scope <scope>"
  );
  process.exit(1);
}

if (scope !== "iloilo") {
  console.error("Only scope 'iloilo' is supported in this importer.");
  process.exit(1);
}

console.log(`Starting import from ${sourcePath}...`);
const originalChecksum = calculateChecksum(sourcePath);
console.log(`Original Workbook Checksum: ${originalChecksum}`);

const workbook = xlsx.readFile(sourcePath);
let sheetName = workbook.SheetNames.find(s => s.toUpperCase() === "PSGC");
if (!sheetName) sheetName = workbook.SheetNames[0]; // Fallback
console.log(`Using sheet: ${sheetName}`);
const sheet = workbook.Sheets[sheetName];

const jsonData = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false, header: 1 });
if (!jsonData || jsonData.length === 0) {
  console.error("No data found in the workbook.");
  process.exit(1);
}

// Find header row and column names
let headerRowIdx = -1;
let psgcCodeCol = -1,
  correspondenceCodeCol = -1,
  nameCol = -1,
  levelCol = -1,
  regionCol = -1,
  provinceCol = -1,
  munCol = -1,
  bgyCol = -1;

for (let i = 0; i < jsonData.length; i++) {
  const row = jsonData[i];
  for (let c = 0; c < row.length; c++) {
    const val = row[c] ? row[c].toString().toLowerCase() : "";
    if (psgcCodeCol === -1 && (val.includes("10-digit") || val === "psgc code" || val.includes("psgc"))) {
      psgcCodeCol = c;
    }
    if (correspondenceCodeCol === -1 && (val.includes("correspondence") || val.includes("9-digit"))) {
      correspondenceCodeCol = c;
    }
    if (nameCol === -1 && val === "name") {
      nameCol = c;
    }
    if (levelCol === -1 && (val === "geographic level" || val === "level")) {
      levelCol = c;
    }
  }
  
  if (psgcCodeCol !== -1 && nameCol !== -1 && levelCol !== -1) {
    headerRowIdx = i;
    break;
  }
}

if (headerRowIdx === -1) {
  console.error("Could not find required columns in the workbook.");
  process.exit(1);
}

console.log(`Found headers at row ${headerRowIdx + 1}`);

// Now read actual data rows
const dataRows = jsonData.slice(headerRowIdx + 1);

let regionCode = null;
let provinceCode = null;
let municipalityCode = null;
let parentPsgcCode = null;

const iloiloScope = [];
let insideIloilo = false;
let currentProvince = "";

const counts = {
  regions: 0,
  provinces: 0,
  highlyUrbanizedCities: 0,
  componentCities: 0,
  municipalities: 0,
  barangays: 0,
  totalRecords: 0,
};

let regionVICode = null;

// The PSA data is usually ordered hierarchically.
// Region VI -> Province -> Municipalities -> Barangays
// Highly Urbanized Cities (Iloilo City) usually follow Region or Province.
for (const row of dataRows) {
  let pCode = row[psgcCodeCol]?.toString().trim();
  let cCode = correspondenceCodeCol !== -1 ? row[correspondenceCodeCol]?.toString().trim() : null;
  const name = row[nameCol]?.toString().trim();
  const level = row[levelCol]?.toString().trim();

  if (!pCode || !name || !level) continue;

  if (pCode.length === 9) {
    pCode = "0" + pCode;
  }

  const isRegion = level.toUpperCase() === "REG";
  const isProv = level.toUpperCase() === "PROV";
  const isCity = level.toUpperCase() === "CITY";
  const isHUC = isCity && name.toUpperCase().includes("HIGHLY URBANIZED");
  const isMun = level.toUpperCase() === "MUN";
  const isBgy = level.toUpperCase() === "BGY";

  if (isRegion) {
    insideIloilo = false;
    regionCode = pCode;
    parentPsgcCode = null;
    if (/\bREGION VI\b/.test(name.toUpperCase())) {
      regionVICode = pCode;
      counts.regions++;
      iloiloScope.push({
        psgcCode: pCode,
        correspondenceCode: cCode,
        name,
        geographicLevel: "Reg",
        regionCode,
        provinceCode: null,
        municipalityCode: null,
        parentPsgcCode: null,
      });
      counts.totalRecords++;
    }
    continue;
  }

  if (regionCode === regionVICode) {
    if (isProv) {
      if (name.toUpperCase().includes("ILOILO")) {
        insideIloilo = true;
        provinceCode = pCode;
        parentPsgcCode = regionCode;
        counts.provinces++;
        iloiloScope.push({
          psgcCode: pCode,
          correspondenceCode: cCode,
          name,
          geographicLevel: "Prov",
          regionCode,
          provinceCode,
          municipalityCode: null,
          parentPsgcCode,
        });
        counts.totalRecords++;
      } else {
        insideIloilo = false;
      }
      continue;
    }

    // Check for province-level Highly Urbanized Cities (HUCs)
    // HUCs in PSA data typically have codes ending in 000000 but are not the province code.
    if (pCode.endsWith("000000") && pCode !== "0603000000") {
        // If it's a Province-level entity (HUC) that is NOT Iloilo Province
        if (isCity && name.toUpperCase() === "CITY OF ILOILO") {
          insideIloilo = true;
          provinceCode = null; 
          municipalityCode = pCode;
          parentPsgcCode = regionCode;
          counts.highlyUrbanizedCities++;
          iloiloScope.push({
            psgcCode: pCode,
            correspondenceCode: cCode,
            name,
            geographicLevel: "City",
            regionCode,
            provinceCode,
            municipalityCode,
            parentPsgcCode,
          });
          counts.totalRecords++;
        } else {
          insideIloilo = false;
        }
        continue;
    }
  }

  if (insideIloilo) {
    if (isMun || isCity) {
      municipalityCode = pCode;
      parentPsgcCode = provinceCode || regionCode;
      if (isCity) {
        counts.componentCities++;
      } else {
        counts.municipalities++;
      }
      iloiloScope.push({
        psgcCode: pCode,
        correspondenceCode: cCode,
        name,
        geographicLevel: isCity ? "City" : "Mun",
        regionCode,
        provinceCode,
        municipalityCode,
        parentPsgcCode,
      });
      counts.totalRecords++;
    } else if (isBgy) {
      parentPsgcCode = municipalityCode;
      if (!parentPsgcCode) {
        console.error(`Orphan barangay found: ${name} (${pCode})`);
        process.exit(1);
      }
      counts.barangays++;
      iloiloScope.push({
        psgcCode: pCode,
        correspondenceCode: cCode,
        name,
        geographicLevel: "Bgy",
        regionCode,
        provinceCode,
        municipalityCode,
        parentPsgcCode,
      });
      counts.totalRecords++;
    }
  }
}

// Validation Requirements
const knownLocations = [
  "Oton",
  "Leon",
  "San Miguel",
  "Tigbauan",
  "Guimbal",
  "City of Passi",
  "City of Iloilo",
];

const foundNames = iloiloScope.map((i) => i.name.toUpperCase());
for (const loc of knownLocations) {
  if (!foundNames.includes(loc.toUpperCase())) {
    console.error(`Missing required locality: ${loc}`);
    process.exit(1);
  }
}

// Sort deterministically by PSGC Code
iloiloScope.sort((a, b) => a.psgcCode.localeCompare(b.psgcCode));

// Check for duplicates
const seenCodes = new Set();
for (const record of iloiloScope) {
  if (seenCodes.has(record.psgcCode)) {
    console.error(`Duplicate PSGC Code found: ${record.psgcCode}`);
    process.exit(1);
  }
  seenCodes.add(record.psgcCode);
}

fs.writeFileSync(outputPath, JSON.stringify(iloiloScope, null, 2));

const generatedChecksum = calculateChecksum(outputPath);

const metadata = {
  dataset: "Philippine Standard Geographic Code",
  release: "2026-Q2",
  effectiveDate: "2026-06-30",
  sourceAuthority: "Philippine Statistics Authority",
  sourceFileName: path.basename(sourcePath),
  sourceFileSha256: originalChecksum,
  generatedFileSha256: generatedChecksum,
  generatedAt: new Date().toISOString(),
  scope: ["Province of Iloilo", "City of Iloilo"],
  counts,
};

fs.writeFileSync(metadataOutput, JSON.stringify(metadata, null, 2));

console.log("Extraction complete!");
console.log(`Generated JSON Path: ${outputPath}`);
console.log(`Generated JSON Checksum: ${generatedChecksum}`);
console.log(JSON.stringify(counts, null, 2));
