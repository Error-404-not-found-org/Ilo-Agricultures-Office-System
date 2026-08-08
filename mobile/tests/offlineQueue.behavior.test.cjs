const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Mock state
let storage = {};
let apiCalls = [];
let invalidatedQueries = [];

const Module = require("node:module");
const originalRequire = Module.prototype.require;
let mockActiveUser = "user_A"; // dynamic mock user

Module.prototype.require = function (request) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      default: {
        getItem: async (key) => storage[key] || null,
        setItem: async (key, val) => { storage[key] = val; },
      }
    };
  }
  if (request === "expo-file-system/legacy") {
    return {
      documentDirectory: "file:///mock/dir/",
      readAsStringAsync: async () => "",
      writeAsStringAsync: async () => {},
      deleteAsync: async () => {},
    };
  }
  if (request.endsWith("./api")) {
    return {
      getApiErrorDetails: (err) => ({ message: err.message })
    };
  }
  if (request.endsWith("./queryClient")) {
    return {
      queryClient: {
        getQueryData: () => ({ _id: mockActiveUser, role: "farmer" }),
        invalidateQueries: (q) => { invalidatedQueries.push(q); }
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Compile the TS file on the fly
const ts = require("typescript");
const fs = require("fs");
const tsCode = fs.readFileSync(path.join(__dirname, "../lib/offlineQueue.ts"), "utf-8");
const jsCode = ts.transpileModule(tsCode, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

const m = new Module(path.join(__dirname, "offlineQueue.js"), module);
m.filename = path.join(__dirname, "offlineQueue.js");
m.paths = Module._nodeModulePaths(__dirname);
m._compile(jsCode, m.filename);
const { addToOfflineQueue, getOfflineQueue, processOfflineQueue } = m.exports;

test("Offline Queue Isolation Contract (Behavioral)", async (t) => {
  // Clear state
  storage = {};
  apiCalls = [];
  let executeOfflineMutationCalls = 0;

  // Fake API instance
  const mockApi = async (config) => {
    apiCalls.push(config);
    return { data: { success: true } };
  };
  mockApi.request = mockApi;

  await t.test("Queue creation fails safely without ownerUserId", async () => {
    await assert.rejects(
      addToOfflineQueue({
        url: "/test",
        method: "POST",
        payload: { test: 1 }
      } /* missing ownerUserId */),
      /Cannot queue offline mutation without an authoritative ownerUserId/
    );
  });

  await t.test("User A queues and syncs", async () => {
    storage = {};
    apiCalls = [];
    const item = await addToOfflineQueue({
      url: "/sync1",
      method: "POST",
      payload: { data: "A" },
      ownerUserId: "user_A",
      ownerRole: "farmer"
    });
    assert.strictEqual(item.ownerUserId, "user_A");
    
    // Simulate processOfflineQueue as user A
    await processOfflineQueue(mockApi, () => "user_A");
    assert.strictEqual(apiCalls.length, 1);
    assert.strictEqual(apiCalls[0].url, "/sync1");
  });

  await t.test("User A queues, signs out, User B signs in, no API call occurs", async () => {
    storage = {};
    apiCalls = [];
    
    // User A queues an item
    await addToOfflineQueue({
      url: "/sync2",
      method: "POST",
      payload: { data: "A2" },
      ownerUserId: "user_A",
      ownerRole: "farmer"
    });

    // Process as User B
    await processOfflineQueue(mockApi, () => "user_B");
    
    // No API calls should happen
    assert.strictEqual(apiCalls.length, 0);

    // The mismatched item remains stored and attempts do not increment
    const queue = await getOfflineQueue();
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].retryCount, 0, "Attempts should not increment for mismatch");
  });

  await t.test("User A signs back in and sync resumes", async () => {
    // Keep storage from previous test (item owned by user_A)
    assert.strictEqual((await getOfflineQueue()).length, 1);
    
    // Process as User A
    await processOfflineQueue(mockApi, () => "user_A");
    
    assert.strictEqual(apiCalls.length, 1);
    assert.strictEqual(apiCalls[0].url, "/sync2");
    
    // Queue should be empty now
    assert.strictEqual((await getOfflineQueue()).length, 0);
  });

  await t.test("Legacy unowned item remains blocked", async () => {
    storage = {};
    apiCalls = [];
    
    // Inject a legacy item manually
    const legacyItem = {
      id: "legacy1",
      url: "/legacy",
      method: "POST",
      payload: {},
      retryCount: 0,
      createdAt: new Date().toISOString()
    };
    storage["OFFLINE_MUTATION_QUEUE"] = JSON.stringify([legacyItem]);
    
    // Try to process with any user
    await processOfflineQueue(mockApi, () => "user_A");
    
    assert.strictEqual(apiCalls.length, 0);
    const queue = await getOfflineQueue();
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].retryCount, 0, "Attempts should not increment for legacy");
  });

  await t.test("A blocked User A item does not prevent a later User B item from syncing", async () => {
    storage = {};
    apiCalls = [];
    
    // Queue an item for User A
    await addToOfflineQueue({
      url: "/syncA",
      method: "POST",
      payload: {},
      ownerUserId: "user_A",
      ownerRole: "farmer"
    });
    
    // Queue an item for User B
    await addToOfflineQueue({
      url: "/syncB",
      method: "POST",
      payload: {},
      ownerUserId: "user_B",
      ownerRole: "farmer"
    });
    
    // Process as User B
    await processOfflineQueue(mockApi, () => "user_B");
    
    assert.strictEqual(apiCalls.length, 1);
    assert.strictEqual(apiCalls[0].url, "/syncB");
    
    const queue = await getOfflineQueue();
    // User A's item should remain
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].ownerUserId, "user_A");
  });

  await t.test("Stable idempotency key survives block and retry", async () => {
    storage = {};
    apiCalls = [];
    
    const item = await addToOfflineQueue({
      url: "/syncIdempotent",
      method: "POST",
      payload: {},
      ownerUserId: "user_A",
      ownerRole: "farmer"
    });
    const key = item.idempotencyKey;
    
    // Block it as user B
    await processOfflineQueue(mockApi, () => "user_B");
    let queue = await getOfflineQueue();
    assert.strictEqual(queue[0].idempotencyKey, key);
    
    // Resume as user A
    await processOfflineQueue(mockApi, () => "user_A");
    assert.strictEqual(apiCalls.length, 1);
    assert.strictEqual(apiCalls[0].headers["Idempotency-Key"], key);
  });

  await t.test("Account switch during processing", async () => {
    storage = {};
    apiCalls = [];
    invalidatedQueries = [];
    mockActiveUser = "user_A"; // Reset active user

    // Queue 2 items for User A
    await addToOfflineQueue({ url: "/syncA1", method: "POST", payload: {}, ownerUserId: "user_A", ownerRole: "farmer", entityType: "animal" });
    await addToOfflineQueue({ url: "/syncA2", method: "POST", payload: {}, ownerUserId: "user_A", ownerRole: "farmer", entityType: "animal" });

    // Mock API that changes the active user after the first request
    const mockSwitchApi = async (config) => {
      apiCalls.push(config);
      if (config.url === "/syncA1") {
         mockActiveUser = "user_B"; // Change identity during processing loop!
      }
      return { data: { success: true } };
    };
    mockSwitchApi.request = mockSwitchApi;

    // Use a getter to reflect the dynamic identity!
    await processOfflineQueue(mockSwitchApi, () => mockActiveUser);

    // Only the first API call should have been made
    assert.strictEqual(apiCalls.length, 1);
    assert.strictEqual(apiCalls[0].url, "/syncA1");

    // The second item should have been blocked and remained pending/blocked
    const queue = await getOfflineQueue();
    assert.strictEqual(queue.length, 1);
    // Find the one that was blocked
    const blockedItem = queue[0];
    assert.strictEqual(blockedItem.url, "/syncA2");
    assert.ok(blockedItem);
    assert.strictEqual(blockedItem.ownerUserId, "user_A");
    assert.match(blockedItem.lastError, /Account identity mismatch/);

    // Because the identity switched to user_B DURING the first request, 
    // the query cache for user_A's item should NOT have been invalidated for user_B!
    assert.strictEqual(invalidatedQueries.length, 0);
  });
});
