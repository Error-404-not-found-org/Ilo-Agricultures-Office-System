import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "./queryClient";
import * as FileSystem from "expo-file-system/legacy";
import { getApiErrorDetails } from "./api";

const QUEUE_STORAGE_KEY = "OFFLINE_MUTATION_QUEUE";
const HISTORY_STORAGE_KEY = "OFFLINE_SYNC_HISTORY";
const ID_MAP_STORAGE_KEY = "OFFLINE_ENTITY_ID_MAP";
const OFFLINE_UPLOADS_DIR = FileSystem.documentDirectory + "offline_uploads/";
let queueWriteChain: Promise<void> = Promise.resolve();

const mutateStoredQueue = async <T,>(work: (queue: QueuedMutation[]) => Promise<{ queue: QueuedMutation[]; result: T }> | { queue: QueuedMutation[]; result: T }): Promise<T> => {
  let result!: T;
  const operation = queueWriteChain.then(async () => {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const current: QueuedMutation[] = stored ? JSON.parse(stored) : [];
    const outcome = await work(current);
    result = outcome.result;
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(outcome.queue));
  });
  queueWriteChain = operation.catch(() => undefined);
  await operation;
  return result;
};

export interface QueuedMutation {
  id: string;
  idempotencyKey: string;
  payloadVersion: number;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  data: any;
  timestamp: number;
  description: string;
  status: "pending" | "syncing" | "failed" | "synced";
  retryCount: number;
  lastError?: string;
  updatedAt: number;
  filePaths?: string[]; // Track local cached file paths
  tempId?: string;
  entityType?: string;
  dependsOn?: string[];
  resultServerId?: string;
}

export const createStableId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const createTemporaryId = (entityType = "entity") => `local:${entityType}:${createStableId()}`;

const readIdMap = async (): Promise<Record<string, string>> => {
  const value = await AsyncStorage.getItem(ID_MAP_STORAGE_KEY);
  return value ? JSON.parse(value) : {};
};

const saveIdMapping = async (temporaryId: string, serverId: string) => {
  const mapping = await readIdMap();
  mapping[temporaryId] = serverId;
  await AsyncStorage.setItem(ID_MAP_STORAGE_KEY, JSON.stringify(mapping));
};

export const resolveTemporaryReferences = <T,>(value: T, mapping: Record<string, string>): T => {
  if (typeof value === "string") {
    let resolved: string = value;
    for (const [temporaryId, serverId] of Object.entries(mapping)) {
      resolved = resolved.split(temporaryId).join(serverId);
    }
    return resolved as T;
  }
  if (Array.isArray(value)) return value.map((item) => resolveTemporaryReferences(item, mapping)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, resolveTemporaryReferences(item, mapping)]),
    ) as T;
  }
  return value;
};

const findTemporaryReferences = (value: unknown): string[] => {
  const matches = JSON.stringify(value).match(/local:[a-zA-Z0-9_-]+:[a-zA-Z0-9-]+/g) || [];
  return [...new Set(matches)];
};

const extractServerId = (responseData: any): string | undefined => {
  const candidates = [responseData, responseData?.data, responseData?.animal, responseData?.user,
    responseData?.task, responseData?.request, responseData?.insemination,
    responseData?.healthRequest, responseData?.pregnancy, responseData?.calving];
  for (const candidate of candidates) {
    const id = candidate?._id || candidate?.id;
    if (typeof id === "string") return id;
  }
  return undefined;
};

export const classifySyncError = (error: any) => {
  const apiError = getApiErrorDetails(error);
  const isRestorationError = String(error?.message || "").includes("Unreadable or missing attachment");
  const retryableCodes = new Set(["IDEMPOTENCY_IN_PROGRESS", "RATE_LIMITED", "TRANSACTION_UNAVAILABLE"]);
  const retryableStatus = apiError.status === undefined || apiError.status === 408 || apiError.status === 425 || apiError.status === 429 || apiError.status >= 500;
  const retryable = !isRestorationError && (retryableCodes.has(apiError.code || "") || retryableStatus || apiError.status === 401);
  return { retryable, message: apiError.message || error?.message || "Sync failed", apiError };
};

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(OFFLINE_UPLOADS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_UPLOADS_DIR, { intermediates: true });
  }
};

const getExtensionAndMime = (base64Data: string) => {
  const matches = base64Data.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  if (matches && matches[1]) {
    const mimeType = matches[1];
    const extension = mimeType.split("/")[1] || "jpg";
    return { mimeType, extension };
  }
  return { mimeType: "image/jpeg", extension: "jpg" }; // fallback
};

const saveBase64ToFile = async (base64Data: string): Promise<string> => {
  await ensureDirExists();
  const { extension } = getExtensionAndMime(base64Data);
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${extension}`;
  const fileUri = OFFLINE_UPLOADS_DIR + filename;
  
  // Extract clean base64 data if it contains a data URI scheme prefix
  const cleanBase64 = base64Data.includes("base64,")
    ? base64Data.split("base64,")[1]
    : base64Data;
    
  await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
};

const readBase64FromFile = async (fileUri: string): Promise<string> => {
  const extension = fileUri.split(".").pop() || "jpg";
  const mimeType = `image/${extension === "jpeg" || extension === "jpg" ? "jpeg" : extension}`;
  const base64Clean = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeType};base64,${base64Clean}`;
};

const deleteLocalFile = async (fileUri: string) => {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (err) {
    console.error(`[OfflineQueue] Failed to delete local file: ${fileUri}`, err);
  }
};

const isBase64Image = (str: any): boolean => {
  return typeof str === "string" && str.startsWith("data:image/") && str.includes(";base64,");
};

export const cacheImagesInPayload = async (data: any): Promise<{ data: any, filePaths: string[] }> => {
  const filePaths: string[] = [];
  
  const traverseAndReplace = async (obj: any): Promise<any> => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") {
      // Only cache validated data:image/<type>;base64 values. Never treat arbitrary long strings as images.
      if (isBase64Image(obj)) {
        try {
          const filePath = await saveBase64ToFile(obj);
          filePaths.push(filePath);
          return `local-cached-file://${filePath}`;
        } catch (e) {
          console.error("[OfflineQueue] Failed to write image to filesystem", e);
          return obj;
        }
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      const newArr = [];
      for (const item of obj) {
        newArr.push(await traverseAndReplace(item));
      }
      return newArr;
    }
    
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = await traverseAndReplace(obj[key]);
    }
    return newObj;
  };
  
  const processedData = await traverseAndReplace(data);
  return { data: processedData, filePaths };
};

export const restoreImagesInPayload = async (data: any): Promise<any> => {
  const traverseAndRestore = async (obj: any): Promise<any> => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") {
      if (typeof obj === "string" && obj.startsWith("local-cached-file://")) {
        const filePath = obj.replace("local-cached-file://", "");
        try {
          // If a cached attachment is missing or unreadable, throw an error
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (!fileInfo.exists) {
            throw new Error(`File does not exist at ${filePath}`);
          }
          return await readBase64FromFile(filePath);
        } catch (e: any) {
          console.error(`[OfflineQueue] Failed to restore image from file path: ${filePath}`, e);
          throw new Error(`Unreadable or missing attachment at path ${filePath}: ${e.message}`);
        }
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      const newArr = [];
      for (const item of obj) {
        newArr.push(await traverseAndRestore(item));
      }
      return newArr;
    }
    
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = await traverseAndRestore(obj[key]);
    }
    return newObj;
  };
  
  return await traverseAndRestore(data);
};

export const addToOfflineQueue = async (
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "idempotencyKey" | "payloadVersion" | "status" | "retryCount" | "updatedAt"> & {
    idempotencyKey?: string;
  },
) => {
  try {
    // Process payload to extract base64 images to local files
    const { data: cleanData, filePaths } = await cacheImagesInPayload(mutation.data);
    return await mutateStoredQueue((queue) => {
      const referencedTempIds = findTemporaryReferences({ url: mutation.url, data: cleanData });
      const inferredDependencies = queue
        .filter((item) => item.tempId && referencedTempIds.includes(item.tempId))
        .map((item) => item.id);
      const newMutation: QueuedMutation = {
        ...mutation, data: cleanData,
        filePaths: filePaths.length > 0 ? filePaths : undefined,
        id: createStableId(),
        idempotencyKey: mutation.idempotencyKey || createStableId(),
        payloadVersion: 2,
        timestamp: Date.now(), status: "pending", retryCount: 0, updatedAt: Date.now(),
        dependsOn: [...new Set([...(mutation.dependsOn || []), ...inferredDependencies])],
      };
      return { queue: [...queue, newMutation], result: newMutation };
    });
  } catch (error) {
    console.error("[OfflineQueue] Failed to add mutation", error);
    throw error;
  }
};

export const getOfflineQueue = async (): Promise<QueuedMutation[]> => {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error("[OfflineQueue] Failed to get queue", error);
    return [];
  }
};

export const clearQueueItem = async (id: string) => {
  try {
    const item = await mutateStoredQueue((queue) => ({
      queue: queue.filter((entry) => entry.id !== id),
      result: queue.find((entry) => entry.id === id),
    }));
    if (item?.filePaths) {
      for (const path of item.filePaths) {
        await deleteLocalFile(path);
      }
    }
  } catch (error) {
    console.error("[OfflineQueue] Failed to clear item", error);
  }
};

export const discardQueueItem = async (id: string) => {
  const queue = await getOfflineQueue();
  const dependents = queue.filter((item) => item.dependsOn?.includes(id));
  await clearQueueItem(id);
  for (const dependent of dependents) {
    await updateQueueItem(dependent.id, {
      status: "failed",
      lastError: "Dependency was discarded before it could sync.",
    });
  }
};

export const updateQueueItem = async (id: string, patch: Partial<QueuedMutation>) => {
  return mutateStoredQueue((queue) => {
    const updatedQueue = queue.map((item) => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item);
    return { queue: updatedQueue, result: updatedQueue.find((item) => item.id === id) };
  });
};

export const retryQueueItem = async (id: string) => updateQueueItem(id, { status: "pending", lastError: undefined });

export const getSyncHistory = async (): Promise<QueuedMutation[]> => {
  try {
    const historyStr = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    return historyStr ? JSON.parse(historyStr) : [];
  } catch (error) {
    console.error("[OfflineQueue] Failed to get history", error);
    return [];
  }
};

export const addToHistory = async (item: QueuedMutation) => {
  try {
    const history = await getSyncHistory();
    // Preserve useful sync history without retaining broken local file references
    const historyItem = { ...item, filePaths: undefined };
    const updatedHistory = [historyItem, ...history].slice(0, 50);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("[OfflineQueue] Failed to add to history", error);
  }
};

let isProcessingQueue = false;

export const processOfflineQueue = async (api: any) => {
  if (isProcessingQueue) {
    console.log("[OfflineQueue] Sync already in progress, skipping concurrent run.");
    return;
  }
  isProcessingQueue = true;

  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return;

    // 1. Recover stale syncing items after an app restart
    const stuckItems = queue.filter((item) => item.status === "syncing");
    for (const item of stuckItems) {
      await updateQueueItem(item.id, { status: "pending", lastError: "Interrupted sync recovered" });
    }

    // Refresh queue after recovery
    const activeQueue = await getOfflineQueue();
    const now = Date.now();

    console.log(`[OfflineQueue] Processing ${activeQueue.length} items...`);

    for (const item of activeQueue) {
      if (item.status === "failed" || item.status === "synced") continue;

      const currentQueue = await getOfflineQueue();
      const dependencies = (item.dependsOn || []).map((id) => currentQueue.find((entry) => entry.id === id));
      if (dependencies.some((dependency) => dependency?.status === "failed")) {
        await updateQueueItem(item.id, { status: "failed", lastError: "A required earlier change failed to sync." });
        continue;
      }
      if (dependencies.some((dependency) => dependency && dependency.status !== "synced")) continue;

      // 2. Exponential backoff checking
      if (item.status === "pending" && item.retryCount > 0) {
        const backoffDelay = Math.min(30000, 1000 * Math.pow(2, item.retryCount));
        if (now - item.updatedAt < backoffDelay) {
          console.log(`[OfflineQueue] Item ${item.description} is in backoff, skipping.`);
          continue;
        }
      }

      try {
        await updateQueueItem(item.id, { status: "syncing" });
        
        // Restore local file URIs back to base64 data for API payload
        // If file is missing or unreadable, this will throw an error
        const idMap = await readIdMap();
        const payloadData = resolveTemporaryReferences(await restoreImagesInPayload(item.data), idMap);
        const resolvedUrl = resolveTemporaryReferences(item.url, idMap);
        
        const response = await api({
          method: item.method,
          url: resolvedUrl,
          data: payloadData,
          headers: { "Idempotency-Key": item.idempotencyKey },
        });
        const serverId = item.tempId ? extractServerId(response?.data) : undefined;
        if (item.tempId && !serverId) {
          throw new Error("The server did not return an ID for this offline-created record.");
        }
        if (item.tempId && serverId) await saveIdMapping(item.tempId, serverId);
        
        console.log(`[OfflineQueue] Successfully synced: ${item.description}`);
        await addToHistory({ ...item, status: "synced", resultServerId: serverId, updatedAt: Date.now() });
        await clearQueueItem(item.id);
      } catch (error: any) {
        const { retryable, message, apiError } = classifySyncError(error);

        // Authentication can recover after Clerk refreshes the session. Do not
        // consume the retry budget or permanently fail user data while signed out.
        if (apiError.status === 401) {
          await updateQueueItem(item.id, {
            status: "pending",
            lastError: "Sign in again to continue syncing this change.",
          });
          break;
        }

        const newRetryCount = item.retryCount + 1;
        const maxRetriesReached = newRetryCount >= 5;

        const willFail = !retryable || maxRetriesReached;

        await updateQueueItem(item.id, {
          status: willFail ? "failed" : "pending",
          retryCount: newRetryCount,
          lastError: willFail ? `Failed permanently: ${message}` : message,
        });

        console.error(`[OfflineQueue] Sync failed for ${item.description}: ${message}. Status set to: ${willFail ? "failed" : "pending"}`);
        
        // If it's a transient server error, stop processing subsequent queue items to preserve order
        if (retryable) break;
      }
    }

    // Refresh all queries to show latest data from server
    queryClient.invalidateQueries();
  } finally {
    isProcessingQueue = false;
  }
};
