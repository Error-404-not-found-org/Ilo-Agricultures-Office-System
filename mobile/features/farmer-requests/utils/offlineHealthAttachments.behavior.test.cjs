const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const storage = new Map();
const files = new Map();
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === "@react-native-async-storage/async-storage") {
    return { default: {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async (key) => { storage.delete(key); },
    } };
  }
  if (request === "expo-file-system/legacy") {
    return {
      documentDirectory: "file:///mock/",
      EncodingType: { Base64: "base64" },
      getInfoAsync: async (uri) => ({ exists: uri.endsWith("/") || files.has(uri) }),
      makeDirectoryAsync: async () => {},
      writeAsStringAsync: async (uri, value) => { files.set(uri, value); },
      readAsStringAsync: async (uri) => files.get(uri),
      deleteAsync: async (uri) => { files.delete(uri); },
    };
  }
  if (request.endsWith("./api")) {
    return { getApiErrorDetails: (error) => ({ message: error.message }) };
  }
  if (request.endsWith("./queryClient")) {
    return { queryClient: { invalidateQueries: async () => {} } };
  }
  if (request.endsWith("./queryKeys")) {
    return {
      aiRequestKeys: { all: ["ai-requests"] },
      animalKeys: { all: ["animals"] },
      animalRecordKeys: { all: ["animal-records"] },
      healthRequestKeys: { all: ["health-requests"] },
      technicianKeys: { tasks: () => [], workQueue: () => [], dashboard: () => [], requests: () => [], records: () => [] },
    };
  }
  return originalRequire.apply(this, arguments);
};

const testDirectory = path.join(process.cwd(), "features/farmer-requests/utils");
const source = fs.readFileSync(path.join(process.cwd(), "lib/offlineQueue.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const queueModule = new Module(path.join(testDirectory, "offlineQueue-health-attachments.js"), module);
queueModule.filename = path.join(testDirectory, "offlineQueue-health-attachments.js");
queueModule.paths = Module._nodeModulePaths(testDirectory);
queueModule._compile(compiled, queueModule.filename);
Module.prototype.require = originalRequire;

const { addToOfflineQueue, getOfflineQueue, processOfflineQueue } = queueModule.exports;

test("Farmer Health offline queue persists and replays multiple attachment images", async () => {
  storage.clear();
  files.clear();
  const photos = ["YQ==", "Yg==", "Yw=="].map((value) => `data:image/jpeg;base64,${value}`);
  const payload = { observation: "weakness", photos, imageUrl: photos[0] };
  const item = await addToOfflineQueue({
    url: "/health-request", method: "POST", data: payload,
    description: "Create health request", ownerUserId: "farmer-A", ownerRole: "farmer",
  });
  assert.equal(item.filePaths.length, 4);
  assert.equal(files.size, 4);
  assert.equal((await getOfflineQueue()).length, 1);

  const dispatched = [];
  await processOfflineQueue(async (request) => {
    dispatched.push(request);
    return { data: { id: "server-health-id" } };
  }, "farmer-A", () => "farmer-A");

  assert.equal(dispatched.length, 1);
  assert.deepEqual(dispatched[0].data.photos, photos);
  assert.equal(dispatched[0].data.imageUrl, photos[0]);
  assert.equal((await getOfflineQueue()).length, 0);
  assert.equal(files.size, 0);
});
