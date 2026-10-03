const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const mobileRoot = process.cwd();
const pickerSource = fs.readFileSync(path.join(mobileRoot, "lib/imagePickerHelper.ts"), "utf8");

const pickerCalls = [];
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === "expo-image-picker") return {
    requestMediaLibraryPermissionsAsync: async () => ({ status: "granted" }),
    launchImageLibraryAsync: async (options) => {
      pickerCalls.push(options);
      return { canceled: false, assets: [{ uri: "file:///wide-animal.jpg", width: 1600, height: 900, base64: "YQ==", mimeType: "image/jpeg" }] };
    },
  };
  if (request === "expo-image-manipulator") return {};
  if (request === "sonner-native") return { toast: { error: () => {} } };
  if (request === "./attachmentPickerOptions") return { getAttachmentPickerOptions: () => ({}) };
  return originalRequire.apply(this, arguments);
};
const helperModule = new Module(path.join(mobileRoot, "lib/imagePickerHelper.test.js"), module);
helperModule.filename = path.join(mobileRoot, "lib/imagePickerHelper.test.js");
helperModule.paths = Module._nodeModulePaths(path.join(mobileRoot, "lib"));
helperModule._compile(ts.transpileModule(pickerSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, helperModule.filename);
Module.prototype.require = originalRequire;
const { pickImageFromSource } = helperModule.exports;

const photoPickerCall = (relativePath) => {
  const source = fs.readFileSync(path.join(mobileRoot, relativePath), "utf8");
  const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "pickImageFromSource") {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return calls.map((call) => ({
    source: call.arguments[0]?.getText(file),
    options: call.arguments[1]?.getText(file),
  }));
};

test("active Farmer Add Animal selects one uncropped photo", () => {
  assert.deepEqual(photoPickerCall("features/animals/screens/AddAnimalScreen.tsx"), [
    { source: "source", options: "{ allowsEditing: false }" },
  ]);
});

test("active Technician Add Animal selects one uncropped photo", () => {
  assert.deepEqual(photoPickerCall("app/(technician)/register-animal.tsx"), [
    { source: "source", options: "{ allowsEditing: false }" },
  ]);
});

test("profile-style single-photo picker retains crop by default", () => {
  assert.match(pickerSource, /allowsEditing\s*=\s*true/);
  assert.deepEqual(photoPickerCall("app/(technician)/register-client.tsx"), [
    { source: "source", options: "{ aspect: [1, 1] }" },
  ]);
});

test("single-image helper returns the original wide asset when animal crop is disabled", async () => {
  pickerCalls.length = 0;
  const animalImage = await pickImageFromSource("library", { allowsEditing: false });
  assert.equal(animalImage.uri, "file:///wide-animal.jpg");
  assert.equal(animalImage.base64, "data:image/jpeg;base64,YQ==");
  assert.equal(pickerCalls[0].allowsEditing, false);
  assert.notEqual(pickerCalls[0].allowsMultipleSelection, true);

  await pickImageFromSource("library");
  assert.equal(pickerCalls[1].allowsEditing, true);
  assert.notEqual(pickerCalls[1].allowsMultipleSelection, true);
});

test("Health and AI retain their separate multi-image attachment picker", () => {
  for (const route of ["app/(farmer)/report-sickness/index.tsx", "app/(farmer)/request-ai/index.tsx"]) {
    const source = fs.readFileSync(path.join(mobileRoot, route), "utf8");
    assert.match(source, /pickAttachmentsFromSource\(source, remainingAttachmentSlots\(photos\.length\)\)/);
  }
});
