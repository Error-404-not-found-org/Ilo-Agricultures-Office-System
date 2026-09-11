/* global __dirname */
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

test("Sick or Injured Animal and Unusual behavior presentation are canonical Farmer options", () => {
  const requestDetails = input.buildStructuredHealthRequestDetails({
    assistanceRequested: "health_concern",
    observedSigns: ["abnormal_behavior"],
    farmerDescription: "Not feeling well.",
  });

  assert.equal(requestDetails.assistanceRequested, "health_concern");
  assert.deepEqual(requestDetails.observedSigns, ["abnormal_behavior"]);
  const legacy = input.buildLegacyHealthRequestDetails(requestDetails);
  assert.match(legacy.symptoms, /Sick or Injured Animal/);
  assert.match(legacy.symptoms, /Unusual behavior/);

  const structured = input.getStructuredHealthRequestPresentation({
    requestDetails,
  });
  assert.equal(structured.assistanceLabel, "Sick or Injured Animal");
  assert.deepEqual(structured.observedSigns, ["Unusual behavior"]);
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

test("Farmer note presentation never reuses structured legacy headings", () => {
  assert.equal(
    input.getHealthRequestFarmerNote({
      requestDetails: {
        version: 1,
        assistanceRequested: "health_concern",
        observedSigns: ["abnormal_behavior"],
        farmerDescription: "Restless since this morning.",
      },
      symptoms:
        "Assistance requested:\nSick or Injured Animal\n\nObserved signs:\n• Unusual behavior",
    }),
    "Restless since this morning.",
  );
  assert.equal(
    input.getHealthRequestFarmerNote({
      symptoms:
        "Assistance requested:\nSick or Injured Animal\n\nObserved signs:\n• Unusual behavior\n\nDescription:\nRestless since this morning.",
    }),
    "Restless since this morning.",
  );
  assert.equal(
    input.getHealthRequestFarmerNote({
      symptoms:
        "Assistance requested:\nSick or Injured Animal\n\nObserved signs:\n• Unusual behavior",
    }),
    "",
  );
});

test("Technician My Work separates Health details from the explicit service action", () => {
  const requestCard = fs.readFileSync(
    path.join(
      __dirname,
      "../../technician-requests/components/RequestListCard.tsx",
    ),
    "utf8",
  );
  const myWorkPanel = fs.readFileSync(
    path.join(
      __dirname,
      "../../technician-requests/components/TechnicianMyWorkPanel.tsx",
    ),
    "utf8",
  );

  assert.match(requestCard, /onActionPress\?: \(\) => void/);
  assert.match(requestCard, /onPress=\{onActionPress \|\| onPress\}/);
  assert.match(myWorkPanel, /pathname: "\/\(technician\)\/health-log"/);
  assert.match(myWorkPanel, /startService: "true"/);
  assert.match(myWorkPanel, /onActionPress=\{\(\) => performWorkItem\(t\)\}/);
  assert.match(myWorkPanel, /pathname: "\/\(technician\)\/request-details"/);
});

test("request-linked Health mode loads canonical context without card Farmer or Animal params", () => {
  const recordHealthScreen = fs.readFileSync(
    path.join(
      __dirname,
      "../../technician-health-recording/screens/RecordHealthScreen.tsx",
    ),
    "utf8",
  );

  assert.match(recordHealthScreen, /routeMode === "request-linked"/);
  assert.match(recordHealthScreen, /routeSource === "task"/);
  assert.match(
    recordHealthScreen,
    /enabled: mode\.kind === "request-linked" && !!actualRequestId/,
  );
  assert.match(recordHealthScreen, /request\?\.farmerId : selectedFarmer/);
  assert.match(recordHealthScreen, /request\?\.animalId : selectedAnimal/);
  assert.match(recordHealthScreen, /mode\.kind === "direct" \? \(/);
  assert.match(recordHealthScreen, /<FarmerAnimalPickers/);
  assert.match(recordHealthScreen, /<DirectHealthForm/);
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
