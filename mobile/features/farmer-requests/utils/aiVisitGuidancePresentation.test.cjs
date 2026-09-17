/* global __dirname */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "requestDetailPresentation.ts"),
  "utf-8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const loadedModule = { exports: {} };
new Function("require", "module", "exports", compiled)(
  require,
  loadedModule,
  loadedModule.exports,
);
const { getFarmerAIVisitGuidance } = loadedModule.exports;

test("Farmer AI visit guidance only uses the public preparation note", () => {
  const scheduledRequest = {
    status: "scheduled",
    farmerPreparationNote: "  Keep the cow secured.  ",
    technicianNote: "Private service assessment.",
  };

  assert.deepEqual(getFarmerAIVisitGuidance(scheduledRequest), {
    label: "Before the Visit",
    value: "Keep the cow secured.",
  });
});

test("Farmer AI visit guidance remains absent when only a private technician note exists", () => {
  const completedRequest = {
    status: "done",
    farmerPreparationNote: "",
    technicianNote: "Private completed-service note.",
  };

  assert.equal(getFarmerAIVisitGuidance(completedRequest), null);
});
