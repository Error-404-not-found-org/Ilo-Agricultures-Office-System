import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "./queryClient";
import axios from "axios";

const QUEUE_STORAGE_KEY = "OFFLINE_MUTATION_QUEUE";
const HISTORY_STORAGE_KEY = "OFFLINE_SYNC_HISTORY";

export interface QueuedMutation {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  data: any;
  timestamp: number;
  description: string;
}

export const addToOfflineQueue = async (mutation: Omit<QueuedMutation, "id" | "timestamp">) => {
  try {
    const existingQueueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue: QueuedMutation[] = existingQueueStr ? JSON.parse(existingQueueStr) : [];
    
    const newMutation: QueuedMutation = {
      ...mutation,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
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
    const updatedQueue = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error("[OfflineQueue] Failed to clear item", error);
  }
};

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
    // Keep only last 50 items
    const updatedHistory = [item, ...history].slice(0, 50);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("[OfflineQueue] Failed to add to history", error);
  }
};

export const processOfflineQueue = async (api: any) => {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return;

  console.log(`[OfflineQueue] Processing ${queue.length} items...`);

  for (const item of queue) {
    try {
      await api({
        method: item.method,
        url: item.url,
        data: item.data,
      });
      
      console.log(`[OfflineQueue] Successfully synced: ${item.description}`);
      await addToHistory(item);
      await clearQueueItem(item.id);
    } catch (error: any) {
      // If it's a 4xx error, it might be invalid data, so we might want to clear it anyway 
      // or keep it to show the user. For now, we only clear on success or permanent failure.
      if (error.response?.status >= 400 && error.response?.status < 500) {
        console.error(`[OfflineQueue] Permanent error for ${item.description}:`, error.message);
        await clearQueueItem(item.id);
      } else {
        console.warn(`[OfflineQueue] Retrying later for ${item.description}:`, error.message);
        break; // Stop processing the rest if it's a network/server error
      }
    }
  }

  // Refresh all queries to show latest data from server
  queryClient.invalidateQueries();
};
