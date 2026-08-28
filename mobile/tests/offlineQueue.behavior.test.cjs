const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

let storage = {};
let deletedFiles = [];
let invalidatedQueries = [];
let persisterRemovals = 0;

class MockQueryClient {
  constructor() {
    this.clearCalls = 0;
    this.data = new Map();
  }
  clear() { this.clearCalls += 1; this.data.clear(); }
  setQueryData(key, value) { this.data.set(JSON.stringify(key), value); }
}

const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === "@react-native-async-storage/async-storage") {
    return { default: {
      getItem: async (key) => storage[key] ?? null,
      setItem: async (key, value) => { storage[key] = value; },
      removeItem: async (key) => { delete storage[key]; },
    } };
  }
  if (request === "expo-file-system/legacy") {
    return {
      documentDirectory: "file:///mock/",
      EncodingType: { Base64: "base64" },
      getInfoAsync: async () => ({ exists: true }),
      makeDirectoryAsync: async () => {},
      readAsStringAsync: async () => "",
      writeAsStringAsync: async () => {},
      deleteAsync: async (file) => { deletedFiles.push(file); },
    };
  }
  if (request.endsWith("./api")) {
    return { getApiErrorDetails: (error) => ({
      status: error?.response?.status,
      code: error?.response?.data?.code,
      message: error?.message || "Sync failed",
    }) };
  }
  if (request.endsWith("./queryClient")) {
    return { queryClient: { invalidateQueries: async (options) => {
      invalidatedQueries.push(options);
    } } };
  }
  if (request.endsWith("./queryKeys")) {
    return {
      aiRequestKeys: { all: ["ai-requests"] },
      animalKeys: { all: ["animals"] },
      animalRecordKeys: { all: ["animal-records"] },
      healthRequestKeys: { all: ["health-requests"] },
      technicianKeys: {
        tasks: () => ["technician", "tasks"],
        workQueue: () => ["technician", "work-queue"],
        dashboard: () => ["technician", "dashboard"],
        requests: () => ["technician", "requests"],
        records: () => ["technician", "records"],
      },
    };
  }
  if (request === "@tanstack/react-query") {
    return {
      QueryClient: MockQueryClient,
      onlineManager: { setEventListener: () => {} },
    };
  }
  if (request === "@tanstack/query-async-storage-persister") {
    return { createAsyncStoragePersister: () => ({
      persistClient: async () => {},
      restoreClient: async () => undefined,
      removeClient: async () => {
        persisterRemovals += 1;
        delete storage.REACT_QUERY_OFFLINE_CACHE;
      },
    }) };
  }
  if (request === "@react-native-community/netinfo") {
    return { default: { addEventListener: () => () => {} } };
  }
  if (request === "react-native") {
    return { Platform: { OS: "web" } };
  }
  return originalRequire.apply(this, arguments);
};

const source = fs.readFileSync(path.join(__dirname, "../lib/offlineQueue.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const queueModule = new Module(path.join(__dirname, "offlineQueue.js"), module);
queueModule.filename = path.join(__dirname, "offlineQueue.js");
queueModule.paths = Module._nodeModulePaths(__dirname);
queueModule._compile(compiled, queueModule.filename);

const {
  addToHistory, addToOfflineQueue, discardQueueItem, getOfflineQueue,
  getOfflineQueueForOwner, getPendingCountForOwner, getSyncHistoryForOwner,
  processOfflineQueue, resolveTemporaryReferencesForOwner, retryQueueItem,
  updateQueueItem,
} = queueModule.exports;

const querySource = fs.readFileSync(path.join(__dirname, "../lib/queryClient.ts"), "utf8");
const queryCompiled = ts.transpileModule(querySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const queryModule = new Module(path.join(__dirname, "queryClient.js"), module);
queryModule.filename = path.join(__dirname, "queryClient.js");
queryModule.paths = Module._nodeModulePaths(__dirname);
queryModule._compile(queryCompiled, queryModule.filename);

const queued = (overrides = {}) => ({
  url: "/health-request", method: "POST",
  data: { observation: "weakness" },
  description: "Create health request",
  ownerUserId: "farmer-A", ownerRole: "farmer", ...overrides,
});
const reset = () => { storage = {}; deletedFiles = []; invalidatedQueries = []; };

test("offline queue enforces account ownership end to end", async (t) => {
  await t.test("owner is required and legacy ownerless work remains parked", async () => {
    reset();
    await assert.rejects(addToOfflineQueue({
      url: "/health-request", method: "POST", data: {}, description: "Legacy",
    }), /authoritative ownerUserId/);
    storage.OFFLINE_MUTATION_QUEUE = JSON.stringify([{
      id: "legacy", idempotencyKey: "legacy-key", payloadVersion: 1,
      url: "/legacy", method: "POST", data: {}, description: "Legacy",
      status: "pending", retryCount: 0, timestamp: 1, updatedAt: 1,
    }]);
    let calls = 0;
    await processOfflineQueue(async () => { calls += 1; }, "farmer-A", () => "farmer-A");
    assert.equal(calls, 0);
    assert.equal((await getOfflineQueue()).length, 1);
  });

  await t.test("queue and successful history are isolated by owner and role", async () => {
    reset();
    const farmerItem = await addToOfflineQueue(queued());
    const technicianItem = await addToOfflineQueue(queued({
      url: "/tasks/task-1/complete", ownerUserId: "technician-B", ownerRole: "technician",
    }));
    await addToHistory({ ...farmerItem, status: "synced" });
    assert.deepEqual((await getOfflineQueueForOwner("farmer-A")).map((i) => i.id), [farmerItem.id]);
    assert.deepEqual((await getOfflineQueueForOwner("technician-B")).map((i) => i.id), [technicianItem.id]);
    assert.equal((await getOfflineQueueForOwner("farmer-C")).length, 0);
    assert.equal((await getSyncHistoryForOwner("technician-B")).length, 0);
    const history = await getSyncHistoryForOwner("farmer-A");
    assert.equal(history[0].ownerUserId, "farmer-A");
    assert.equal(history[0].idempotencyKey, farmerItem.idempotencyKey);
  });

  await t.test("retry/discard mismatch cannot mutate work or delete attachments", async () => {
    reset();
    const item = await addToOfflineQueue(queued({ filePaths: ["file:///mock/a.jpg"] }));
    await updateQueueItem(item.id, "farmer-A", { status: "failed", lastError: "Network failed" });
    assert.equal(await retryQueueItem(item.id, "technician-B"), undefined);
    assert.equal(await discardQueueItem(item.id, "technician-B"), false);
    const retained = (await getOfflineQueue())[0];
    assert.equal(retained.status, "failed");
    assert.equal(retained.ownerUserId, "farmer-A");
    assert.deepEqual(deletedFiles, []);
  });

  await t.test("runtime patches cannot change immutable ownership", async () => {
    reset();
    const item = await addToOfflineQueue(queued());
    await updateQueueItem(item.id, "farmer-A", {
      ownerUserId: "technician-B", ownerRole: "technician", status: "failed",
    });
    const stored = (await getOfflineQueue())[0];
    assert.equal(stored.ownerUserId, "farmer-A");
    assert.equal(stored.ownerRole, "farmer");
    assert.equal(stored.status, "failed");
  });

  await t.test("no owner and another resolved owner never dispatch A work", async () => {
    reset();
    await addToOfflineQueue(queued());
    let calls = 0;
    const api = async () => { calls += 1; return { data: {} }; };
    await processOfflineQueue(api, undefined, () => undefined);
    await processOfflineQueue(api, "technician-B", () => "technician-B");
    assert.equal(calls, 0);
    assert.equal((await getOfflineQueue())[0].retryCount, 0);
  });

  await t.test("returning owner resumes same idempotent operation after restart", async () => {
    reset();
    const item = await addToOfflineQueue(queued({ idempotencyKey: "stable-operation-key" }));
    const restartState = JSON.stringify(storage);
    await processOfflineQueue(async () => ({ data: {} }), "farmer-B", () => "farmer-B");
    storage = JSON.parse(restartState);
    const calls = [];
    await processOfflineQueue(async (config) => {
      calls.push(config); return { data: { ok: true } };
    }, "farmer-A", () => "farmer-A");
    assert.equal(calls[0].headers["Idempotency-Key"], item.idempotencyKey);
    assert.equal((await getOfflineQueueForOwner("farmer-A")).length, 0);
    assert.equal((await getSyncHistoryForOwner("farmer-A")).length, 1);
  });

  await t.test("identity change stops all remaining operations", async () => {
    reset();
    await addToOfflineQueue(queued({ url: "/first" }));
    await addToOfflineQueue(queued({ url: "/second" }));
    let activeOwner = "farmer-A";
    const calls = [];
    await processOfflineQueue(async (config) => {
      calls.push(config.url); activeOwner = "technician-B"; return { data: {} };
    }, "farmer-A", () => activeOwner);
    assert.deepEqual(calls, ["/first"]);
    const retained = await getOfflineQueueForOwner("farmer-A");
    assert.equal(retained.length, 1);
    assert.equal(retained[0].url, "/second");
    assert.equal(retained[0].status, "pending");
    assert.equal(invalidatedQueries.length, 0);
  });

  await t.test("restart recovery mutates only the authenticated owner's work", async () => {
    reset();
    const a = await addToOfflineQueue(queued({ url: "/a" }));
    const b = await addToOfflineQueue(queued({ url: "/b", ownerUserId: "farmer-B" }));
    await updateQueueItem(a.id, "farmer-A", { status: "syncing" });
    await updateQueueItem(b.id, "farmer-B", { status: "syncing" });
    await processOfflineQueue(async () => ({ data: {} }), "farmer-B", () => "farmer-B");
    const all = await getOfflineQueue();
    assert.equal(all.find((i) => i.id === a.id).status, "syncing");
    assert.equal(all.find((i) => i.id === b.id), undefined);
  });

  await t.test("header helper counts only current owner pending/failed work", async () => {
    reset();
    const a = await addToOfflineQueue(queued());
    await addToOfflineQueue(queued({ ownerUserId: "technician-B" }));
    await updateQueueItem(a.id, "farmer-A", { status: "failed" });
    assert.equal(await getPendingCountForOwner("farmer-A"), 1);
    assert.equal(await getPendingCountForOwner("technician-B"), 1);
    assert.equal(await getPendingCountForOwner(undefined), 0);
  });

  await t.test("temporary ID mappings cannot cross account boundaries", async () => {
    reset();
    await addToOfflineQueue(queued({
      url: "/animals", tempId: "local:animal:shared-looking-id", entityType: "animal",
    }));
    await processOfflineQueue(async () => ({ data: { _id: "server-animal-A" } }),
      "farmer-A", () => "farmer-A");
    assert.equal(await resolveTemporaryReferencesForOwner(
      "farmer-A", "local:animal:shared-looking-id"), "server-animal-A");
    assert.equal(await resolveTemporaryReferencesForOwner(
      "farmer-B", "local:animal:shared-looking-id"), "local:animal:shared-looking-id");
  });

  await t.test("unowned legacy ID maps fail closed instead of resolving or dispatching", async () => {
    reset();
    storage.OFFLINE_ENTITY_ID_MAP = JSON.stringify({
      "local:animal:legacy": "server-animal-from-unknown-owner",
    });
    assert.equal(
      await resolveTemporaryReferencesForOwner("farmer-A", "local:animal:legacy"),
      "local:animal:legacy",
    );
    await addToOfflineQueue(queued({
      url: "/animals/local:animal:legacy/health",
      method: "PATCH",
    }));
    let calls = 0;
    await processOfflineQueue(async () => {
      calls += 1;
      return { data: {} };
    }, "farmer-A", () => "farmer-A");
    assert.equal(calls, 0);
    const retained = (await getOfflineQueueForOwner("farmer-A"))[0];
    assert.equal(retained.status, "failed");
    assert.match(retained.lastError, /Unresolved temporary reference/);
  });
});

test("query cache switching and Clear Cache preserve retained offline work", async () => {
  const {
    clearDownloadableAppCache,
    clearQueryCacheIdentity,
    establishQueryCacheOwner,
    queryClient,
  } = queryModule.exports;
  storage = {
    BREEDSMART_QUERY_CACHE_OWNER: "farmer-A",
    REACT_QUERY_OFFLINE_CACHE: "private-cache-A",
    OFFLINE_MUTATION_QUEUE: "retained-owner-work",
    OFFLINE_SYNC_HISTORY: "retained-owner-history",
    OFFLINE_ENTITY_ID_MAP: "retained-owner-id-map",
  };
  persisterRemovals = 0;

  assert.equal(await establishQueryCacheOwner({
    ownerUserId: "farmer-A",
    bootstrapQueryKey: ["mongodb-user", "clerk-A"],
    bootstrapData: { user: { _id: "farmer-A" } },
  }), false);
  assert.equal(queryClient.clearCalls, 0);

  assert.equal(await establishQueryCacheOwner({
    ownerUserId: "technician-B",
    bootstrapQueryKey: ["mongodb-user", "clerk-B"],
    bootstrapData: { user: { _id: "technician-B" } },
  }), true);
  assert.equal(queryClient.clearCalls, 1);
  assert.equal(persisterRemovals, 1);
  assert.equal(storage.BREEDSMART_QUERY_CACHE_OWNER, "technician-B");
  assert.deepEqual(
    queryClient.data.get(JSON.stringify(["mongodb-user", "clerk-B"])),
    { user: { _id: "technician-B" } },
  );

  await clearDownloadableAppCache();
  assert.equal(storage.BREEDSMART_QUERY_CACHE_OWNER, "technician-B");
  assert.equal(storage.OFFLINE_MUTATION_QUEUE, "retained-owner-work");
  assert.equal(storage.OFFLINE_SYNC_HISTORY, "retained-owner-history");
  assert.equal(storage.OFFLINE_ENTITY_ID_MAP, "retained-owner-id-map");

  await clearQueryCacheIdentity();
  assert.equal(storage.BREEDSMART_QUERY_CACHE_OWNER, undefined);
  assert.equal(storage.OFFLINE_MUTATION_QUEUE, "retained-owner-work");
  assert.equal(storage.OFFLINE_SYNC_HISTORY, "retained-owner-history");
});
