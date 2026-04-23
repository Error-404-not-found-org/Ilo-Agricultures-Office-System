import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StatusBar, Image, TouchableOpacity, FlatList } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Syringe, CheckCircle2, Clock, XCircle, Tag, CalendarDays, Dog } from 'lucide-react-native';
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
    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: c.bg }}>
      <Text className="text-[11px] font-bold" style={{ color: c.color }}>{c.label}</Text>
    </View>
  );
};

// ─── Animal Card ──────────────────────────────────────────────────────────────
const AnimalCard = ({ item }: { item: Animal }) => (
  <View className="bg-white rounded-2xl mb-3 overflow-hidden border border-gray-100 flex-row" style={{ elevation: 2 }}>
    {/* Photo */}
    <View className="w-20 bg-emerald-50 items-center justify-center">
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={{ width: 80, height: 90 }} resizeMode="cover" />
      ) : (
        <Dog size={28} color="#00643B" />
      )}
    </View>
    {/* Info */}
    <View className="flex-1 p-3 justify-center gap-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-[14px] font-bold text-gray-800">{item.animalId}</Text>
        {item.earTag && (
          <View className="flex-row items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
            <Tag size={10} color="#00643B" />
            <Text className="text-[10px] text-emerald-700 font-semibold">{item.earTag}</Text>
          </View>
        )}
      </View>
      <Text className="text-xs text-gray-500 font-medium">{item.species} — {item.breed}</Text>
      {item.color && <Text className="text-xs text-gray-400">Color: {item.color}</Text>}
      {item.birthDate && (
        <Text className="text-xs text-gray-400">
          Born: {format(new Date(item.birthDate), 'MMM dd, yyyy')}
        </Text>
      )}
    </View>
  </View>
);

// ─── Insemination Record Card ─────────────────────────────────────────────────
const RecordCard = ({ item }: { item: InseminationRecord }) => {
  const animal = item.animalId;
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 flex-row gap-3" style={{ elevation: 2 }}>
      <View className="w-12 h-12 rounded-xl bg-emerald-50 items-center justify-center">
        {animal?.imageUrl ? (
          <Image source={{ uri: animal.imageUrl }} style={{ width: 48, height: 48, borderRadius: 10 }} resizeMode="cover" />
        ) : <Syringe size={22} color="#00643B" />}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[13px] font-bold text-gray-800">Attempt #{item.attemptNumber} — {animal?.species || '—'}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text className="text-xs text-gray-500 mb-1">{animal?.animalId}{animal?.earTag ? ` · ${animal.earTag}` : ''}</Text>
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
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FarmerRecords() {
  const api    = useApi();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'animals' | 'records'>('animals');
  const [animals, setAnimals]     = useState<Animal[]>([]);
  const [records, setRecords]     = useState<InseminationRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [profileRes, recordsRes] = await Promise.all([
        api.get('/user/me'),
        api.get('/insemination/my'),
      ]);
      setAnimals(profileRes.data.animals || []);
      setRecords(recordsRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not load your data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const TAB_BTN = (id: 'animals' | 'records', label: string, count: number) => (
    <TouchableOpacity
      key={id}
      onPress={() => setActiveTab(id)}
      className={`flex-1 py-3 rounded-2xl items-center flex-row justify-center gap-2 ${activeTab === id ? 'bg-[#00643B]' : 'bg-white border border-gray-200'}`}
    >
      <Text className={`font-bold text-sm ${activeTab === id ? 'text-white' : 'text-gray-500'}`}>{label}</Text>
      <View className={`px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-white/30' : 'bg-gray-100'}`}>
        <Text className={`text-[11px] font-bold ${activeTab === id ? 'text-white' : 'text-gray-500'}`}>{count}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[200px] bg-[#00643B]" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-5 z-10">
        <Text className="text-[22px] font-bold text-white">My Records</Text>
        <Text className="text-emerald-100 text-sm">Animals & insemination history</Text>
      </View>

      {/* Main Card */}
      <View className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-5 pt-5" style={{ elevation: 8 }}>
        {/* Tab switcher */}
        <View className="flex-row gap-2 mb-4">
          {TAB_BTN('animals', '🐄 Animals', animals.length)}
          {TAB_BTN('records', '💉 Records', records.length)}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#00643B" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} colors={['#00643B']} />
            }
          >
            {activeTab === 'animals' ? (
              animals.length === 0 ? (
                <View className="items-center py-20 gap-3">
                  <Dog size={48} color="#d1d5db" />
                  <Text className="text-gray-400 font-semibold text-base">No animals registered yet</Text>
                  <Text className="text-gray-300 text-sm text-center">Tap the + button to register your first animal.</Text>
                </View>
              ) : (
                animals.map(a => <AnimalCard key={a._id} item={a} />)
              )
            ) : (
              records.length === 0 ? (
                <View className="items-center py-20 gap-3">
                  <Syringe size={48} color="#d1d5db" />
                  <Text className="text-gray-400 font-semibold text-base">No insemination records yet</Text>
                  <Text className="text-gray-300 text-sm text-center">Records appear here once a technician logs an AI procedure.</Text>
                </View>
              ) : (
                <>
                  {/* Summary row */}
                  <View className="flex-row gap-2 mb-4">
                    {[
                      { label: 'Total',    val: records.length,                                      color: '#00643B', bg: '#ecfdf5' },
                      { label: 'Approved', val: records.filter(r => r.status === 'approved').length, color: '#059669', bg: '#d1fae5' },
                      { label: 'Pending',  val: records.filter(r => r.status === 'pending').length,  color: '#d97706', bg: '#fef3c7' },
                    ].map(s => (
                      <View key={s.label} className="flex-1 rounded-xl py-3 items-center" style={{ backgroundColor: s.bg }}>
                        <Text className="text-lg font-black" style={{ color: s.color }}>{s.val}</Text>
                        <Text className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                  {records.map(r => <RecordCard key={r._id} item={r} />)}
                </>
              )
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}