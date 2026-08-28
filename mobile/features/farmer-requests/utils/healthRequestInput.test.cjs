const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const loadTypeScriptModule = (fileName) => {
  const absolutePath = path.join(__dirname, fileName);
  const source = fs.readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const compiled = new Module(absolutePath.replace(/\.ts$/, ".js"), module);
  compiled.filename = absolutePath.replace(/\.ts$/, ".js");
  compiled.paths = Module._nodeModulePaths(__dirname);
  compiled._compile(output, compiled.filename);
  return compiled.exports;
};

const input = loadTypeScriptModule("healthRequestInput.ts");
const payloadBuilders = loadTypeScriptModule("payloadBuilders.ts");

test("Medicine preserves Diarrhea and multiple observed signs", () => {
  const requestDetails = input.buildStructuredHealthRequestDetails({
    assistanceRequested: "medicine_request",
    observedSigns: ["diarrhea", "not_eating_normally"],
    farmerDescription: "Started yesterday.",
  });

  assert.equal(requestDetails.assistanceRequested, "medicine_request");
  assert.deepEqual(requestDetails.observedSigns, [
    "diarrhea",
    "not_eating_normally",
  ]);
  const legacy = input.buildLegacyHealthRequestDetails(requestDetails);
  assert.match(legacy.symptoms, /Medicine or Dewormer/);
  assert.match(legacy.symptoms, /Diarrhea/);
  assert.match(legacy.symptoms, /Not eating normally/);
});

test("Health Concern observations and Preventive Care without signs remain valid", () => {
  assert.equal(
    input.getHealthRequestInputValidationMessage({
      assistanceRequested: "health_concern",
      observedSigns: ["weakness"],
      farmerDescription: "",
    }),
    null,
  );
  assert.equal(
    input.getHealthRequestInputValidationMessage({
      assistanceRequested: "preventive_care",
      observedSigns: [],
      farmerDescription: "",
    }),
    null,
  );
});

test("structured request details survive payload building and offline JSON storage", () => {
  const requestDetails = input.buildStructuredHealthRequestDetails({
    assistanceRequested: "medicine_request",
    observedSigns: ["diarrhea", "weakness"],
    farmerDescription: "Animal looks weak.",
  });
  const legacy = input.buildLegacyHealthRequestDetails(requestDetails);
  const payload = payloadBuilders.buildFarmerHealthRequestPayload(
    "animal-1",
    "medicine",
    legacy.symptoms,
    "medium",
    legacy.farmerNotes,
    ["photo-1"],
    requestDetails,
  );

  assert.deepEqual(payload.requestDetails, requestDetails);
  const queuedPayload = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(queuedPayload.requestDetails, requestDetails);
  assert.equal(queuedPayload.symptoms, legacy.symptoms);
  assert.equal(queuedPayload.farmerNotes, "Animal looks weak.");
});

test("structured presentation is authoritative with legacy fallback available", () => {
  const structured = input.getStructuredHealthRequestPresentation({
    requestDetails: {
      version: 1,
      assistanceRequested: "medicine_request",
      observedSigns: ["diarrhea"],
      farmerDescription: "Started yesterday.",
    },
    symptoms: "Old English blob",
  });
  assert.equal(structured.assistanceLabel, "Medicine or Dewormer");
  assert.deepEqual(structured.observedSigns, ["Diarrhea"]);
  assert.equal(structured.farmerDescription, "Started yesterday.");
  assert.equal(
    input.getStructuredHealthRequestPresentation({
      symptoms: "Historical request remains readable",
    }),
    null,
  );
});

test("Farmer urgency compatibility payload remains medium or critical", () => {
  const buildPayload = (urgency) =>
    payloadBuilders.buildFarmerHealthRequestPayload(
      "animal-1",
      "medicine",
      "Medicine or Dewormer | Observed signs: Diarrhea",
      urgency,
      "",
      [],
    );

  assert.equal(buildPayload("medium").urgency, "medium");
  assert.equal(buildPayload("critical").urgency, "critical");
});

test("Farmer Health Request detail renders normalized urgency wording", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../../app/(farmer)/health-request-detail.tsx"),
    "utf8",
  );

  assert.match(source, /getHealthUrgencyPresentation/);
  assert.doesNotMatch(source, /\{urgency\}\s+urgency/);
  assert.doesNotMatch(source, /["']medium["']/);
  assert.doesNotMatch(source, /["']critical["']/);
});
