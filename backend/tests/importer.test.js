import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "fixtures");

describe("PSGC Importer", () => {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  it("fails import when duplicate PSGC codes exist", () => {
    const ws_data = [
      ["10-digit PSGC", "Name", "Geographic Level"],
      ["0600000000", "Region VI (Western Visayas)", "Reg"],
      ["0603000000", "Iloilo", "Prov"],
      ["0603034000", "Oton", "Mun"],
      ["0603034000", "Oton Duplicate", "Mun"],
      ["0603028000", "Leon", "Mun"],
      ["0603041000", "San Miguel", "Mun"],
      ["0603045000", "Tigbauan", "Mun"],
      ["0603020000", "Guimbal", "Mun"],
      ["0603035000", "City of Passi", "City"],
      ["0631000000", "City of Iloilo", "City"]
    ];
    const ws = xlsx.utils.aoa_to_sheet(ws_data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "PSGC");
    const p = path.join(FIXTURES_DIR, "dup-psgc.xlsx");
    xlsx.writeFile(wb, p);

    try {
      execSync(`node scripts/import-psgc-xlsx.js --source tests/fixtures/dup-psgc.xlsx --output tests/fixtures/out.json --metadata-output tests/fixtures/meta.json --scope iloilo`, {
        cwd: path.join(__dirname, ".."),
        stdio: "pipe"
      });
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.ok(err.stderr.toString().includes("Duplicate PSGC Code found: 0603034000"));
    }
  });

  it("fails import when orphan barangays exist", () => {
    const ws_data = [
      ["10-digit PSGC", "Name", "Geographic Level"],
      ["0600000000", "Region VI (Western Visayas)", "Reg"],
      ["0603000000", "Iloilo", "Prov"],
      // Missing municipality parent!
      ["0603034001", "Orphan Bgy", "Bgy"],
      ["0603034000", "Oton", "Mun"],
      ["0603028000", "Leon", "Mun"],
      ["0603041000", "San Miguel", "Mun"],
      ["0603045000", "Tigbauan", "Mun"],
      ["0603020000", "Guimbal", "Mun"],
      ["0603035000", "City of Passi", "City"],
      ["0631000000", "City of Iloilo", "City"]
    ];
    const ws = xlsx.utils.aoa_to_sheet(ws_data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "PSGC");
    const p = path.join(FIXTURES_DIR, "orphan-psgc.xlsx");
    xlsx.writeFile(wb, p);

    try {
      execSync(`node scripts/import-psgc-xlsx.js --source tests/fixtures/orphan-psgc.xlsx --output tests/fixtures/out.json --metadata-output tests/fixtures/meta.json --scope iloilo`, {
        cwd: path.join(__dirname, ".."),
        stdio: "pipe"
      });
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.ok(err.stderr.toString().includes("Orphan barangay found"));
    }
  });

  it("metadata counts match generated JSON counts and checksums populate", () => {
    const metaPath = path.join(__dirname, "..", "src", "data", "psgc", "metadata.json");
    const dataPath = path.join(__dirname, "..", "src", "data", "psgc", "psgc-2026-q2-iloilo-scope.json");
    
    assert.ok(fs.existsSync(metaPath), "Metadata must exist");
    assert.ok(fs.existsSync(dataPath), "Dataset must exist");

    const meta = JSON.parse(fs.readFileSync(metaPath));
    const data = JSON.parse(fs.readFileSync(dataPath));

    assert.equal(meta.counts.totalRecords, data.length);
    assert.ok(meta.sourceFileSha256);
    assert.ok(meta.generatedFileSha256);
    
    // Check determinism (e.g. sorted by PSGC)
    const sortedCodes = data.map(d => d.psgcCode).sort((a, b) => a.localeCompare(b));
    for (let i = 0; i < data.length; i++) {
      assert.equal(data[i].psgcCode, sortedCodes[i], "Output is deterministic and sorted");
    }
  });
});
