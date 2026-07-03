import type { OfflineMutation } from "@/types";

export type OfflineQueueItem = OfflineMutation;

export interface OfflineQueueSummary {
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
}
