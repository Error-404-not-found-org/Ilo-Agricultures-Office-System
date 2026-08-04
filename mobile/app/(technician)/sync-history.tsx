import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, Clock, Cloud, History, Info, RefreshCw, Trash2 } from 'lucide-react-native';
import {
  discardQueueItem,
  getOfflineQueue,
  getSyncHistory,
  QueuedMutation,
  retryQueueItem,
  processOfflineQueue,
} from '@/lib/offlineQueue';
import SafeScreen from '@/components/safeScreen';
import { format } from 'date-fns';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useApi } from '@/lib/api';

export default function SyncHistoryScreen() {
  const router = useRouter();
  const api = useApi();
  const [pending, setPending] = useState<QueuedMutation[]>([]);
  const [history, setHistory] = useState<QueuedMutation[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'synced'>('pending');
  const [discardTarget, setDiscardTarget] = useState<QueuedMutation | null>(null);

  const loadData = useCallback(async () => {
    const q = await getOfflineQueue();
    const h = await getSyncHistory();
    setPending(q);
    setHistory(h);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const discard = (item: QueuedMutation) => {
    setDiscardTarget(item);
  };

  const confirmDiscard = async () => {
    if (!discardTarget) return;
    await discardQueueItem(discardTarget.id);
    setDiscardTarget(null);
    loadData();
  };

  return (
    <SafeScreen>
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-slate-100 dark:active:bg-slate-800">
            <ArrowLeft size={24} color="#64748b" />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-lg font-black text-slate-800 dark:text-white">Sync Center</Text>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Offline Log & Queue</Text>
          </View>
          <View className="w-8" />
        </View>

        {/* Tab Switcher */}
        <View className="flex-row bg-white dark:bg-slate-900 mx-6 mt-6 rounded-2xl p-1 shadow-sm border border-slate-100 dark:border-slate-800">
          <TouchableOpacity 
            onPress={() => setActiveTab('pending')}
            className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${activeTab === 'pending' ? 'bg-[#00643B]' : ''}`}
          >
            <Cloud size={16} color={activeTab === 'pending' ? 'white' : '#94a3b8'} />
            <Text className={`font-bold ${activeTab === 'pending' ? 'text-white' : 'text-slate-500'}`}>
              Queue ({pending.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('synced')}
            className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${activeTab === 'synced' ? 'bg-[#00643B]' : ''}`}
          >
            <History size={16} color={activeTab === 'synced' ? 'white' : '#94a3b8'} />
            <Text className={`font-bold ${activeTab === 'synced' ? 'text-white' : 'text-slate-500'}`}>
              History ({history.length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6 mt-6" showsVerticalScrollIndicator={false}>
          {activeTab === 'pending' ? (
            pending.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={48} color="#10b981" />} title="All Synced" subtitle="Your offline queue is empty. All activities are safely on the server." />
            ) : (
              pending.map((item) => (
                <SyncItem
                  key={item.id}
                  item={item}
                  status="pending"
                  onRetry={async () => {
                    await retryQueueItem(item.id);
                    await processOfflineQueue(api);
                    await loadData();
                  }}
                  onDiscard={() => discard(item)}
                />
              ))
            )
          ) : (
            history.length === 0 ? (
              <EmptyState icon={<History size={48} color="#cbd5e1" />} title="No History" subtitle="Synchronized activities will appear here once they are uploaded." />
            ) : (
              history.map((item) => <SyncItem key={item.id} item={item} status="synced" />)
            )
          )}
        </ScrollView>
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
      </View>
    </SafeScreen>
  );
}

const SyncItem = ({
  item,
  status,
  onRetry,
  onDiscard,
}: {
  item: QueuedMutation,
  status: 'pending' | 'synced',
  onRetry?: () => void,
  onDiscard?: () => void,
}) => (
  <View className="bg-white dark:bg-slate-900 rounded-3xl p-5 mb-4 border border-slate-100 dark:border-slate-800 shadow-sm">
    <View className="flex-row justify-between items-start mb-3">
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <View className={`px-2 py-0.5 rounded-md ${status === 'pending' ? item.status === 'failed' ? 'bg-red-100' : 'bg-amber-100' : 'bg-emerald-100'}`}>
            <Text className={`text-[9px] font-black uppercase ${status === 'pending' ? item.status === 'failed' ? 'text-red-700' : 'text-amber-700' : 'text-emerald-700'}`}>
              {status === 'pending' ? item.status === 'failed' ? 'Failed' : 'In Queue' : 'Uploaded'}
            </Text>
          </View>
          <Text className="text-[10px] font-bold text-slate-400">
            {format(item.timestamp, 'MMM dd, h:mm a')}
          </Text>
        </View>
        <Text className="text-base font-bold text-slate-800 dark:text-white">{item.description}</Text>
        {item.lastError ? (
          <Text className="text-[11px] font-medium text-red-500 mt-1 leading-4">
            {item.lastError}
          </Text>
        ) : null}
      </View>
      <View className="p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl">
        {status === 'pending' ? <Clock size={20} color={item.status === 'failed' ? '#ef4444' : '#f59e0b'} /> : <CheckCircle2 size={20} color="#10b981" />}
      </View>
    </View>
    
    <View className="flex-row items-center gap-3 pt-3 border-t border-slate-50 dark:border-slate-800">
      <View className="flex-row items-center gap-1">
        <Info size={12} color="#94a3b8" />
        <Text className="text-[11px] font-medium text-slate-400 uppercase tracking-tighter">Endpoint: {item.url}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Text className="text-[11px] font-medium text-slate-400 uppercase tracking-tighter">Method: {item.method}</Text>
      </View>
    </View>
    {status === 'pending' ? (
      <View className="flex-row justify-end gap-3 mt-4">
        <TouchableOpacity
          onPress={onDiscard}
          accessibilityRole="button"
          accessibilityLabel={`Discard ${item.description}`}
          className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700"
        >
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={`Retry ${item.description}`}
          className="h-11 px-4 flex-row items-center justify-center rounded-xl bg-[#00643B]"
        >
          <RefreshCw size={14} color="white" />
          <Text className="text-white ml-2 text-[11px] font-black uppercase">Retry</Text>
        </TouchableOpacity>
      </View>
    ) : null}
  </View>
);

const EmptyState = ({ icon, title, subtitle }: { icon: any, title: string, subtitle: string }) => (
  <View className="items-center justify-center py-20 px-8">
    <View className="mb-4">{icon}</View>
    <Text className="text-xl font-bold text-slate-800 dark:text-white text-center">{title}</Text>
    <Text className="text-sm text-slate-400 dark:text-slate-500 text-center mt-2 leading-5">{subtitle}</Text>
  </View>
);
