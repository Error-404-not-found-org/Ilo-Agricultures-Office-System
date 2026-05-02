import { View, Text, RefreshControl, ActivityIndicator, StatusBar, Image, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Syringe, Tag, CalendarDays, Dog } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Animal {
  _id: string; animalId: string; earTag?: string;
  species: string; breed: string; color?: string; imageUrl?: string; birthDate?: string;
}
interface InseminationRecord {
  _id: string;
  animalId: { _id: string; animalId: string; earTag?: string; species: string; breed: string; imageUrl?: string; };
  inseminationDate?: string;
  scheduledDate?: string;
  createdAt?: string;
  sireBreed: string; sireCode: string; estrus?: string;
  status: string; attemptNumber: number;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  approved: { color: '#059669', bg: '#ecfdf5', label: 'Approved' },
  pending:  { color: '#d97706', bg: '#fffbeb', label: 'Pending'  },
  rejected: { color: '#dc2626', bg: '#fef2f2', label: 'Rejected' },
  done:     { color: '#2563eb', bg: '#eff6ff', label: 'Done'     },
};
const StatusBadge = ({ status }: { status: string }) => {
  const c = STATUS_CFG[status?.toLowerCase()] || STATUS_CFG.pending;
  return (
    <View className="px-2 py-1 rounded-full bg-slate-50 dark:bg-slate-800" style={{ backgroundColor: c.bg }}>
      <Text className="text-[11px] font-bold" style={{ color: c.color }}>{c.label}</Text>
    </View>
  );
};

// ─── Animal Card ──────────────────────────────────────────────────────────────
const AnimalCard = ({ item, onPress }: { item: Animal, onPress?: () => void }) => (
  <TouchableOpacity activeOpacity={0.8} onPress={onPress} className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-slate-700 flex-row gap-3" style={{ elevation: 2 }}>
    <View className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 items-center justify-center">
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={{ width: 48, height: 48, borderRadius: 10 }} resizeMode="cover" />
      ) : (
        <Dog size={22} color="#00643B" />
      )}
    </View>
    <View className="flex-1 justify-center">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-[14px] font-bold text-gray-800 dark:text-white">{item.animalId}</Text>
        {item.earTag && (
          <View className="flex-row items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
            <Tag size={10} color="#00643B" />
            <Text className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">{item.earTag}</Text>
          </View>
        )}
      </View>
      <Text className="text-xs text-gray-500 dark:text-slate-400 mb-1">{item.species} — {item.breed}</Text>
      <View className="flex-row items-center gap-3">
        {item.color && <Text className="text-xs text-gray-400">· {item.color}</Text>}
        {item.birthDate && (
          <Text className="text-xs text-gray-400">
            · Born: {format(new Date(item.birthDate), 'MMM dd, yyyy')}
          </Text>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

// ─── Insemination Record Card ─────────────────────────────────────────────────
const RecordCard = ({ item, onPress }: { item: InseminationRecord, onPress?: () => void }) => {
  const animal = item.animalId;
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-slate-700 flex-row gap-3" style={{ elevation: 2 }}>
      <View className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 items-center justify-center">
        {animal?.imageUrl ? (
          <Image source={{ uri: animal.imageUrl }} style={{ width: 48, height: 48, borderRadius: 10 }} resizeMode="cover" />
        ) : <Syringe size={22} color="#00643B" />}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[13px] font-bold text-gray-800 dark:text-white">Attempt #{item.attemptNumber} — {animal?.species || '—'}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text className="text-xs text-gray-500 dark:text-slate-400 mb-1">{animal?.animalId}{animal?.earTag ? ` · ${animal.earTag}` : ''}</Text>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <CalendarDays size={11} color="#9ca3af" />
            <Text className="text-xs text-gray-400">
              {format(new Date(item.inseminationDate || item.scheduledDate || item.createdAt || new Date()), 'MMM dd, yyyy')}
            </Text>
          </View>
          {item.sireBreed ? <Text className="text-xs text-gray-400">· {item.sireBreed}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FarmerRecords() {
  const api    = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'animals' | 'records'>('animals');

  // Animals Pagination State
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalPage, setAnimalPage] = useState(1);
  const [totalAnimals, setTotalAnimals] = useState(0);
  const [hasMoreAnimals, setHasMoreAnimals] = useState(true);
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(false);
  const [isRefreshingAnimals, setIsRefreshingAnimals] = useState(false);

  // Records Pagination State
  const [records, setRecords] = useState<InseminationRecord[]>([]);
  const [recordStats, setRecordStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });
  const [recordPage, setRecordPage] = useState(1);
  const [hasMoreRecords, setHasMoreRecords] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isRefreshingRecords, setIsRefreshingRecords] = useState(false);

  // Fetch Animals
  const fetchAnimals = useCallback(async (pageToLoad = 1, isRefresh = false) => {
    if (isRefresh) setIsRefreshingAnimals(true);
    else if (pageToLoad === 1) setIsLoadingAnimals(true);

    try {
      const res = await api.get(`/animals/my?page=${pageToLoad}&limit=10`);
      const newAnimals = res.data.data;
      
      if (pageToLoad === 1) {
        setAnimals(newAnimals);
      } else {
        setAnimals(prev => [...prev, ...newAnimals]);
      }
      
      setTotalAnimals(res.data.total);
      setHasMoreAnimals(pageToLoad < res.data.totalPages);
      setAnimalPage(pageToLoad);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not load your animals.');
    } finally {
      setIsLoadingAnimals(false);
      setIsRefreshingAnimals(false);
    }
  }, [api]);

  // Fetch Records
  const fetchRecords = useCallback(async (pageToLoad = 1, isRefresh = false) => {
    if (isRefresh) setIsRefreshingRecords(true);
    else if (pageToLoad === 1) setIsLoadingRecords(true);

    try {
      const res = await api.get(`/insemination/my?page=${pageToLoad}&limit=10`);
      const newRecords = res.data.data;
      
      if (pageToLoad === 1) {
        setRecords(newRecords);
      } else {
        setRecords(prev => [...prev, ...newRecords]);
      }
      
      const stats = res.data.stats || { total: res.data.total, approved: 0, pending: 0 };
      setRecordStats({
        ...stats,
        rejected: (stats.total || 0) - (stats.approved || 0) - (stats.pending || 0)
      });
      setHasMoreRecords(pageToLoad < res.data.totalPages);
      setRecordPage(pageToLoad);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not load your records.');
    } finally {
      setIsLoadingRecords(false);
      setIsRefreshingRecords(false);
    }
  }, [api]);

  // Initial load
  useEffect(() => {
    fetchAnimals(1, false);
    fetchRecords(1, false);
  }, [fetchAnimals, fetchRecords]);

  // Load More Handlers
  const handleLoadMoreAnimals = () => {
    if (!isLoadingAnimals && hasMoreAnimals) {
      fetchAnimals(animalPage + 1, false);
    }
  };

  const handleLoadMoreRecords = () => {
    if (!isLoadingRecords && hasMoreRecords) {
      fetchRecords(recordPage + 1, false);
    }
  };

  // Refresh Handlers
  const handleRefreshAnimals = () => fetchAnimals(1, true);
  const handleRefreshRecords = () => fetchRecords(1, true);

  const TAB_BTN = (id: 'animals' | 'records', label: string, count: number) => (
    <TouchableOpacity
      key={id}
      onPress={() => setActiveTab(id)}
      className={`flex-1 py-3 rounded-2xl items-center flex-row justify-center gap-2 ${activeTab === id ? 'bg-[#00643B]' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700'}`}
    >
      <Text className={`font-bold text-sm ${activeTab === id ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`}>{label}</Text>
      <View className={`px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-white/30' : 'bg-gray-100 dark:bg-slate-700'}`}>
        <Text className={`text-[11px] font-bold ${activeTab === id ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`}>{count}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = (hasMore: boolean) => {
    if (!hasMore) return <View className="h-20" />;
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#00643B" />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[200px] bg-[#00643B]" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-5 z-10">
        <Text className="text-[22px] font-bold text-white">My Records</Text>
        <Text className="text-emerald-100 text-sm">Animals & insemination history</Text>
      </View>

      {/* Main Card */}
      <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950 rounded-t-[32px] px-5 pt-5" style={{ elevation: 8 }}>
        {/* Tab switcher */}
        <View className="flex-row gap-2 mb-4">
          {TAB_BTN('animals', '🐄 Animals', totalAnimals)}
          {TAB_BTN('records', '💉 Records', recordStats.total)}
        </View>

        {activeTab === 'animals' ? (
            isLoadingAnimals && animalPage === 1 ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#00643B" />
              </View>
            ) : animals.length === 0 ? (
              <ScrollView refreshControl={<RefreshControl refreshing={isRefreshingAnimals} onRefresh={handleRefreshAnimals} colors={['#00643B']} />}>
                  <View className="items-center py-20 gap-3">
                    <Dog size={48} color="#d1d5db" />
                    <Text className="text-gray-400 font-semibold text-base">No animals registered yet</Text>
                    <Text className="text-gray-300 text-sm text-center">Tap the + button to register your first animal.</Text>
                  </View>
              </ScrollView>
            ) : (
              <FlatList
                data={animals}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => <AnimalCard item={item} onPress={() => router.push(`/(farmer)/animal-details?id=${item._id}`)} />}
                onEndReached={handleLoadMoreAnimals}
                onEndReachedThreshold={0.3}
                refreshControl={<RefreshControl refreshing={isRefreshingAnimals} onRefresh={handleRefreshAnimals} colors={['#00643B']} />}
                ListFooterComponent={renderFooter(hasMoreAnimals)}
              />
            )
        ) : (
            isLoadingRecords && recordPage === 1 ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#00643B" />
              </View>
            ) : records.length === 0 ? (
              <ScrollView refreshControl={<RefreshControl refreshing={isRefreshingRecords} onRefresh={handleRefreshRecords} colors={['#00643B']} />}>
                  <View className="items-center py-20 gap-3">
                    <Syringe size={48} color="#d1d5db" />
                    <Text className="text-gray-400 font-semibold text-base">No insemination records yet</Text>
                    <Text className="text-gray-300 text-sm text-center">Records appear here once a technician logs an AI procedure.</Text>
                  </View>
              </ScrollView>
            ) : (
              <FlatList
                data={records}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <View className="flex-row gap-2 mb-4">
                    {[
                      { label: 'Total',    val: recordStats.total,    color: '#00643B', bg: '#ecfdf5' },
                      { label: 'Approved', val: recordStats.approved, color: '#059669', bg: '#d1fae5' },
                      { label: 'Pending',  val: recordStats.pending,  color: '#d97706', bg: '#fffbeb' },
                      { label: 'Rejected', val: recordStats.rejected, color: '#dc2626', bg: '#fef2f2' },
                    ].map(s => (
                      <View key={s.label} className="flex-1 rounded-xl py-3 items-center" style={{ backgroundColor: s.bg }}>
                        <Text className="text-lg font-black" style={{ color: s.color }}>{s.val}</Text>
                        <Text className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                }
                renderItem={({ item }) => <RecordCard item={item} onPress={() => router.push(`/(farmer)/animal-details?id=${item.animalId._id}`)} />}
                onEndReached={handleLoadMoreRecords}
                onEndReachedThreshold={0.3}
                refreshControl={<RefreshControl refreshing={isRefreshingRecords} onRefresh={handleRefreshRecords} colors={['#00643B']} />}
                ListFooterComponent={renderFooter(hasMoreRecords)}
              />
            )
        )}
      </View>
    </View>
  );
}