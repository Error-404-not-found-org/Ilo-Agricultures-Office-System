const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ts = require("typescript");
const fs = require("fs");
const Module = require("node:module");

// Compile the TS file on the fly
const tsCode = fs.readFileSync(path.join(__dirname, "../features/farmer-requests/utils/payloadBuilders.ts"), "utf-8");
const jsCode = ts.transpileModule(tsCode, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

const m = new Module(path.join(__dirname, "payloadBuilders.js"), module);
m.filename = path.join(__dirname, "payloadBuilders.js");
m.paths = Module._nodeModulePaths(__dirname);
m._compile(jsCode, m.filename);
const { buildFarmerAIRequestPayload, buildFarmerHealthRequestPayload } = m.exports;

test("Farmer Request Payload Builders", async (t) => {
  await t.test("AI Builder produces canonical fields and omits scheduling fields", () => {
    const payload = buildFarmerAIRequestPayload(
      "ANIMAL_123",
      null,
      "Needs check",
      ["Restless", "Vocalizing"],
      [{ id: "Restless", label: "Restless Behavior" }, { id: "Vocalizing", label: "Vocalizing" }]
    );

    assert.strictEqual(payload.animalId, "ANIMAL_123");
    assert.deepStrictEqual(payload.heatSigns, ["Restless", "Vocalizing"]);
    assert.ok(payload.comment.includes("Needs check"));
    assert.strictEqual(payload.imageUrl, null); // optional parameter not passed
    assert.strictEqual("preferredDate" in payload, false);
    assert.strictEqual("preferredTime" in payload, false);
    assert.strictEqual("scheduledDate" in payload, false);
    assert.strictEqual("scheduledAt" in payload, false);
    assert.strictEqual("visitPeriod" in payload, false);
    assert.strictEqual("serviceStartedAt" in payload, false);
  });

  await t.test("AI Builder trims strings and includes imageUrl", () => {
    const payload = buildFarmerAIRequestPayload(
      "ANIMAL_123",
      "http://image.url",
      " Needs check ",
      ["Restless"],
      [{ id: "Restless", label: "Restless Behavior" }]
    );

    assert.ok(payload.comment.includes("Needs check"));
    assert.strictEqual(payload.imageUrl, "http://image.url");
  });

  await t.test("Health Builder produces canonical fields and omits scheduling fields", () => {
    const payload = buildFarmerHealthRequestPayload(
      "ANIMAL_456",
      "disease",
      " Coughing ",
      "high",
      " Needs vet ",
      ["photo1", "photo2"]
    );

    assert.strictEqual(payload.animalId, "ANIMAL_456");
    assert.strictEqual(payload.requestType, "disease");
    assert.strictEqual(payload.symptoms, "Coughing");
    assert.strictEqual(payload.urgency, "high");
    assert.strictEqual(payload.farmerNotes, "Needs vet");
    assert.deepStrictEqual(payload.photos, ["photo1", "photo2"]);
    
    assert.strictEqual("preferredDate" in payload, false);
    assert.strictEqual("preferredTime" in payload, false);
    assert.strictEqual("scheduledDate" in payload, false);
    assert.strictEqual("scheduledAt" in payload, false);
    assert.strictEqual("visitPeriod" in payload, false);
    assert.strictEqual("serviceStartedAt" in payload, false);
  });

  await t.test("Health Builder limits photos to 5 and blocks sixth", () => {
    const payload = buildFarmerHealthRequestPayload(
      "ANIMAL_456",
      "disease",
      "symptoms",
      "medium",
      "notes",
      ["1", "2", "3", "4", "5", "6"]
    );

    assert.strictEqual(payload.photos.length, 5);
    assert.deepStrictEqual(payload.photos, ["1", "2", "3", "4", "5"]);
  });
});
