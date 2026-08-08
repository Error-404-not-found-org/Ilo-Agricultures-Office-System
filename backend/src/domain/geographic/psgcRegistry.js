import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PSGC data is loaded into memory once
let psgcData = null;
let psgcMetadata = null;

function loadPSGCData() {
  if (psgcData) return;
  
  try {
    const dataPath = path.join(__dirname, "..", "..", "data", "psgc", "psgc-2026-q2-iloilo-scope.json");
    const metaPath = path.join(__dirname, "..", "..", "data", "psgc", "metadata.json");
    
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, "utf-8");
      psgcData = JSON.parse(rawData);
    } else {
      psgcData = [];
    }

    if (fs.existsSync(metaPath)) {
      const rawMeta = fs.readFileSync(metaPath, "utf-8");
      psgcMetadata = JSON.parse(rawMeta);
    } else {
      psgcMetadata = { version: "unknown" };
    }
  } catch (error) {
    console.error("Failed to load PSGC data:", error);
    psgcData = [];
    psgcMetadata = { version: "unknown" };
  }
}

export function getPSGCVersion() {
  loadPSGCData();
  return psgcMetadata.version;
}

/**
 * Find municipality by text name and optionally province name
 * Performs a case-insensitive search
 */
export function findMunicipalityByText(localityName, provinceName) {
  loadPSGCData();
  
  if (!localityName) return null;
  
  const localityLower = localityName.trim().toLowerCase();
  const provinceLower = provinceName ? provinceName.trim().toLowerCase() : null;

  const matches = psgcData.filter((item) => {
    const isLocalityMatch = item.name.toLowerCase() === localityLower && (item.geographicLevel === 'Mun' || item.geographicLevel === 'City');
    if (!isLocalityMatch) return false;
    
    if (provinceLower) {
      const prov = psgcData.find(p => p.geographicLevel === 'Prov' && p.name.toLowerCase() === provinceLower);
      if (!prov) return false;
      return item.provinceCode === prov.psgcCode;
    }
    
    return true;
  });

  // Only return if unambiguous
  if (matches.length === 1) {
    return matches[0];
  }
  
  return null;
}

/**
 * Get municipality by exactly matching its 9-digit code
 */
export function getMunicipalityByCode(code) {
  loadPSGCData();
  if (!code) return null;
  return psgcData.find((item) => item.code === String(code)) || null;
}
