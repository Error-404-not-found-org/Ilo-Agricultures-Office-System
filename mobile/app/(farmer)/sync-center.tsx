import React, { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { RefreshCw, Trash2, WifiOff } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@/lib/theme";
import {
  discardQueueItem,
  getOfflineQueue,
  getSyncHistory,
  retryQueueItem,
  processOfflineQueue,
  type QueuedMutation,
} from "@/lib/offlineQueue";
import {
  FarmerScreen,
  AsyncState,
  SectionHeader,
  StatusBadge,
} from "@/features/farmer-ui/components";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useApi } from "@/lib/api";
import { AppPageHeader } from "@/components/AppPageHeader";

export default function FarmerSyncCenter() {
  const api = useApi();
  const { colors } = useTheme();
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [history, setHistory] = useState<QueuedMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [discardTarget, setDiscardTarget] = useState<QueuedMutation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, synced] = await Promise.all([
        getOfflineQueue(),
        getSyncHistory(),
      ]);
      setQueue(pending);
      setHistory(synced);
    } catch (error) {
      console.error("Failed to load sync center data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const discard = (item: QueuedMutation) => setDiscardTarget(item);

  const confirmDiscard = async () => {
    if (!discardTarget) return;
    await discardQueueItem(discardTarget.id);
    setDiscardTarget(null);
    load();
  };

  return (
    <FarmerScreen scroll contentContainerStyle={{ paddingBottom: 48 }}>
      <AppPageHeader title="Sync Center" subtitle="Offline changes and recent synchronization activity" />

      {loading ? (
        <AsyncState state="loading" />
      ) : (
        <View className="p-5">
          <SectionHeader title={`Pending changes (${queue.length})`} />
          {queue.length === 0 ? (
            <AsyncState
              state="empty"
              title="Everything is synced"
              message="Offline changes will appear here when they are waiting for a connection."
            />
          ) : (
            queue.map((item) => (
              <View
                key={item.id}
                className="p-3.5 mb-3 border"
                style={{
                  borderRadius: 8,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-start">
                  <WifiOff size={18} color={colors.warning} />
                  <View className="flex-1 ml-2">
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 13,
                      }}
                    >
                      {item.description}
                    </Text>
                    <Text
                      className="mt-1"
                      style={{
                        color: colors.textMuted,
                        fontFamily: "Outfit_500Medium",
                        fontSize: 10,
                      }}
                    >
                      Retry {item.retryCount || 0} ·{" "}
                      {item.lastError || "Waiting for connection"}
                    </Text>
                  </View>
                  <StatusBadge label={item.status} />
                </View>
                <View className="flex-row justify-end gap-3 mt-3">
                  <TouchableOpacity
                    onPress={() => discard(item)}
                    className="w-9 h-9 items-center justify-center border"
                    style={{ borderRadius: 8, borderColor: colors.border }}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await retryQueueItem(item.id);
                      await processOfflineQueue(api);
                      await load();
                    }}
                    className="h-9 px-3 flex-row items-center justify-center"
                    style={{
                      borderRadius: 8,
                      backgroundColor: colors.primary,
                    }}
                  >
                    <RefreshCw size={14} color="white" />
                    <Text
                      className="text-white ml-1.5"
                      style={{ fontFamily: "Outfit_700Bold", fontSize: 10 }}
                    >
                      Retry
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {history.length ? (
            <View className="mt-5">
              <SectionHeader title="Recently synced" />
              {history.slice(0, 10).map((item) => (
                <View
                  key={`${item.id}-${item.updatedAt}`}
                  className="py-3 border-b flex-row justify-between"
                  style={{ borderBottomColor: colors.border }}
                >
                  <Text
                    className="flex-1"
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 11,
                    }}
                  >
                    {item.description}
                  </Text>
                  <StatusBadge label="synced" />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
      <ConfirmationModal
        visible={!!discardTarget}
        onClose={() => setDiscardTarget(null)}
        onConfirm={confirmDiscard}
        title="Discard Pending Change?"
        message={discardTarget?.description || "This queued change will be removed and will not sync later."}
        confirmText="Discard"
        cancelText="Keep"
        isDestructive
      />
    </FarmerScreen>
  );
}
