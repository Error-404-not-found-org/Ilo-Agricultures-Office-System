import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "./queryClient";
import * as FileSystem from "expo-file-system/legacy";

const QUEUE_STORAGE_KEY = "OFFLINE_MUTATION_QUEUE";
const HISTORY_STORAGE_KEY = "OFFLINE_SYNC_HISTORY";
const OFFLINE_UPLOADS_DIR = FileSystem.documentDirectory + "offline_uploads/";

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
}

export const createStableId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

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

export const addToOfflineQueue = async (mutation: Omit<QueuedMutation, "id" | "timestamp" | "idempotencyKey" | "payloadVersion" | "status" | "retryCount" | "updatedAt">) => {
  try {
    const existingQueueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue: QueuedMutation[] = existingQueueStr ? JSON.parse(existingQueueStr) : [];
    
    // Process payload to extract base64 images to local files
    const { data: cleanData, filePaths } = await cacheImagesInPayload(mutation.data);
    
    const newMutation: QueuedMutation = {
      ...mutation,
      data: cleanData,
      filePaths: filePaths.length > 0 ? filePaths : undefined,
      id: createStableId(),
      idempotencyKey: createStableId(),
      payloadVersion: 1,
      timestamp: Date.now(),
      status: "pending",
      retryCount: 0,
      updatedAt: Date.now(),
    };
    
    queue.push(newMutation);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    return newMutation;
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
    const queue = await getOfflineQueue();
    const item = queue.find((entry) => entry.id === id);
    if (item?.filePaths) {
      for (const path of item.filePaths) {
        await deleteLocalFile(path);
      }
    }
    const updatedQueue = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error("[OfflineQueue] Failed to clear item", error);
  }
};

export const updateQueueItem = async (id: string, patch: Partial<QueuedMutation>) => {
  const queue = await getOfflineQueue();
  const updatedQueue = queue.map((item) => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item);
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));
  return updatedQueue.find((item) => item.id === id);
};

export const retryQueueItem = async (id: string) => updateQueueItem(id, { status: "pending", lastError: undefined });

export const discardQueueItem = clearQueueItem;

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
        const payloadData = await restoreImagesInPayload(item.data);
        
        await api({
          method: item.method,
          url: item.url,
          data: payloadData,
          headers: { "Idempotency-Key": item.idempotencyKey },
        });
        
        console.log(`[OfflineQueue] Successfully synced: ${item.description}`);
        await addToHistory({ ...item, status: "synced", updatedAt: Date.now() });
        await clearQueueItem(item.id);
      } catch (error: any) {
        const isRestorationError = error.message && error.message.includes("Unreadable or missing attachment");
        const isConflict = error.response?.status === 409; // Idempotency conflict/in-progress
        
        const message = error.response?.data?.message || error.message || "Sync failed";
        const isPermanent = (error.response?.status >= 400 && error.response?.status < 500 && !isConflict) || isRestorationError;
        const newRetryCount = item.retryCount + 1;
        const maxRetriesReached = newRetryCount >= 5;

        const willFail = isPermanent || maxRetriesReached;

        await updateQueueItem(item.id, {
          status: willFail ? "failed" : "pending",
          retryCount: newRetryCount,
          lastError: willFail ? `Failed permanently: ${message}` : message,
        });

        console.error(`[OfflineQueue] Sync failed for ${item.description}: ${message}. Status set to: ${willFail ? "failed" : "pending"}`);
        
        // If it's a transient server error, stop processing subsequent queue items to preserve order
        if (!isPermanent) break;
      }
    }

    // Refresh all queries to show latest data from server
    queryClient.invalidateQueries();
  } finally {
    isProcessingQueue = false;
  }
};
