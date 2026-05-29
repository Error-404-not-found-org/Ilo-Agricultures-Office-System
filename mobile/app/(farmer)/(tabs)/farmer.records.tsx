import { View, Text, RefreshControl, ActivityIndicator, StatusBar, Image, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Syringe, Tag, CalendarDays, Dog, TrendingUp, ClipboardCheck, AlertCircle, Activity as ActivityIcon, ChevronRight, User } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { format } from 'date-fns';
import { useTheme } from '@/lib/theme';

interface Animal {
  _id: string;
  animalId: string;
  earTag?: string;
  breed: string;
  species: string;
  reproductiveStatus?: string;
}

interface InseminationRecord {
  _id: string;
  animalId: Animal;
  inseminationDate: string;
  status: 'pending' | 'approved' | 'rejected';
  attemptNumber: number;
  sireBreed: string;
  sireCode: string;
  approvedBy?: { name: string };
}

const STATUS_CFG: Record<string, { color: string, bg: string, label: string }> = {
  pending:  { color: '#d97706', bg: '#fffbeb', label: 'Processing' },
  approved: { color: '#059669', bg: '#d1fae5', label: 'Accepted' },
  rejected: { color: '#dc2626', bg: '#fef2f2', label: 'Rejected' },
  cancelled: { color: '#64748b', bg: '#f1f5f9', label: 'Cancelled' },
  done:     { color: '#00643B', bg: '#ecfdf5', label: 'Completed' },
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const { colors, isDark } = useTheme();
  const c = STATUS_CFG[status?.toLowerCase()] || STATUS_CFG.pending;
  
  const bgColor = isDark ? (c.color === '#00643B' ? 'rgba(52,211,153,0.15)' : c.color + '22') : c.bg;
  const textColor = isDark ? (c.color === '#00643B' ? '#34d399' : c.color === '#059669' ? '#34d399' : c.color === '#dc2626' ? '#f87171' : c.color) : c.color;

  return (
    <View style={{ backgroundColor: bgColor, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
      <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: textColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</Text>
    </View>
  );
};

const AnimalCard = ({ item, onPress }: { item: Animal, onPress?: () => void }) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={onPress}
      style={{ backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8, elevation: isDark ? 0 : 2, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
         <MaterialCommunityIcons name="cow" size={30} color={isDark ? colors.primary : "#059669"} />
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>{item.animalId}</Text>
          {item.reproductiveStatus === 'Pregnant' && (
            <View style={{ backgroundColor: isDark ? 'rgba(124,58,237,0.15)' : '#f5f3ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Outfit_800ExtraBold', color: isDark ? '#a78bfa' : '#7c3aed', textTransform: 'uppercase' }}>Pregnant</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }}>
          {item.species} • {item.breed} {item.earTag ? `• #${item.earTag}` : ''}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

const RecordCard = ({ item, onPress }: { item: InseminationRecord, onPress?: () => void }) => {
  const { colors, isDark } = useTheme();
  const animal = item.animalId;
  const dateStr = item.inseminationDate ? format(new Date(item.inseminationDate), 'MMM dd, yyyy') : 'No Date';
  
  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={onPress}
      style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 12, elevation: isDark ? 0 : 3, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? colors.background : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarDays size={20} color={colors.textSecondary} />
          </View>
          <View>
            <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{dateStr}</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textPrimary, marginTop: 2 }}>{animal?.animalId || 'Animal Profile'}</Text>
          </View>
        </View>
        <StatusBadge status={item.status} />
      </View>
      
      <View style={{ backgroundColor: isDark ? colors.background : '#f8fafc', borderRadius: 16, padding: 12, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
         <View>
            <Text style={{ fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>Sire / Breed</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: colors.textSecondary, marginTop: 2 }}>{item.sireCode || 'AI-S1'} / {item.sireBreed}</Text>
         </View>
         <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>Attempt</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: isDark ? colors.primary : '#00643B', marginTop: 2 }}>#{item.attemptNumber}</Text>
         </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
            <User size={12} color={isDark ? colors.primary : "#059669"} />
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
            Handled by <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>{item.approvedBy?.name || 'Technician'}</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={onPress}>
           <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: isDark ? colors.primary : '#00643B' }}>Details</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FarmerReports() {
  const { colors, isDark } = useTheme();
  const api    = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'animals' | 'records'>('animals');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [records, setRecords] = useState<InseminationRecord[]>([]);
  const [recordStats, setRecordStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnimals = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoadingAnimals(true);
    try {
      const res = await api.get('/animals/my');
      const body = res.data;
      setAnimals(Array.isArray(body) ? body : (body?.data || []));
    } catch (e) {
      toast.error('Cattle sync failed');
    } finally {
      setIsLoadingAnimals(false);
      if (isRefresh) setIsRefreshing(false);
    }
  }, [api]);

  const fetchRecords = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoadingRecords(true);
    try {
      const res = await api.get('/insemination/my');
      setRecords(res.data.data || []);
      if (res.data.stats) setRecordStats(res.data.stats);
    } catch (e) {
      toast.error('Activity sync failed');
    } finally {
      setIsLoadingRecords(false);
      if (isRefresh) setIsRefreshing(false);
    }
  }, [api]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAnimals(true);
    fetchRecords(true);
  }, [fetchAnimals, fetchRecords]);

  useEffect(() => {
    fetchAnimals();
    fetchRecords();

    const interval = setInterval(() => {
      fetchAnimals(true);
      fetchRecords(true);
    }, 10000); // Poll every 10 seconds silently
    
    return () => clearInterval(interval);
  }, [fetchAnimals, fetchRecords]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium Header */}
      <View style={{ paddingTop: insets.top + 20, backgroundColor: '#00643B', paddingBottom: 100, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Outfit_500Medium', fontSize: 13 }}>Production Dashboard</Text>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 28 }}>Reports Center</Text>
          </View>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
            <ClipboardCheck color="#fff" size={24} />
          </View>
        </View>

        {/* Improved Moowie Insight Card */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 60, height: 60 }}>
            <Image 
              source={{ uri: 'https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png' }} 
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 14 }}>Moowie Analysis</Text>
            <Text style={{ color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.8)', fontFamily: 'Outfit_500Medium', fontSize: 11, lineHeight: 15, marginTop: 2 }}>
              {activeTab === 'animals' 
                ? `Scanning your herd... You have ${animals.length} cattle registered. Check their breeding cycles for optimal production!`
                : `Analyzing history... ${recordStats.total} total attempts found. Your success rate is looking promising!`}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, marginTop: -60, paddingHorizontal: 24 }}>
        {/* Tab Switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 24, padding: 6, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 10, elevation: 4, borderWidth: isDark ? 1 : 0, borderColor: colors.border }}>
          <TouchableOpacity 
            onPress={() => setActiveTab('animals')}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 18, alignItems: 'center', backgroundColor: activeTab === 'animals' ? (isDark ? colors.primary : '#00643B') : 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <Dog size={16} color={activeTab === 'animals' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: activeTab === 'animals' ? '#fff' : colors.textSecondary }}>Cattle Hub</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('records')}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 18, alignItems: 'center', backgroundColor: activeTab === 'records' ? (isDark ? colors.primary : '#00643B') : 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <ActivityIcon size={16} color={activeTab === 'records' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: activeTab === 'records' ? '#fff' : colors.textSecondary }}>Activity Feed</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'animals' ? (
          isLoadingAnimals ? (
            <ActivityIndicator color={isDark ? colors.primary : "#00643B"} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={animals}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <AnimalCard item={item} onPress={() => router.push(`/(farmer)/animal-details?id=${item._id}`)} />}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[isDark ? colors.primary : '#00643B']} />}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.4 }}>
                  <MaterialCommunityIcons name="cow-off" size={60} color={colors.textMuted} />
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, marginTop: 12 }}>No cattle found</Text>
                </View>
              }
            />
          )
        ) : (
          isLoadingRecords ? (
            <ActivityIndicator color={isDark ? colors.primary : "#00643B"} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={records}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Total', val: recordStats.total, color: isDark ? colors.primary : '#00643B', bg: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5', icon: TrendingUp },
                    { label: 'Active', val: recordStats.approved, color: isDark ? '#34d399' : '#059669', bg: isDark ? 'rgba(52,211,153,0.15)' : '#f0fdf4', icon: ClipboardCheck },
                    { label: 'Wait', val: recordStats.pending, color: isDark ? '#fbbf24' : '#d97706', bg: isDark ? 'rgba(251,191,36,0.15)' : '#fffbeb', icon: ActivityIcon },
                    { label: 'Closed', val: recordStats.rejected, color: isDark ? colors.textSecondary : '#64748b', bg: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', icon: AlertCircle },
                  ].map((s, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 20, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: isDark ? colors.border : s.color + '15' }}>
                      <s.icon size={11} color={s.color} style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 16, fontFamily: 'Outfit_900Black', color: s.color }}>{s.val}</Text>
                      <Text style={{ fontSize: 7, fontFamily: 'Outfit_800ExtraBold', color: s.color, textTransform: 'uppercase' }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              }
              renderItem={({ item }) => <RecordCard item={item} onPress={() => router.push(`/(farmer)/animal-details?id=${item.animalId?._id}`)} />}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[isDark ? colors.primary : '#00643B']} />}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.4 }}>
                  <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color={colors.textMuted} />
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, marginTop: 12 }}>No records found</Text>
                </View>
              }
            />
          )
        )}
      </View>
    </View>
  );
}