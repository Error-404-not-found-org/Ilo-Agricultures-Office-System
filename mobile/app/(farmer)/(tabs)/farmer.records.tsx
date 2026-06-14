import { View, Text, RefreshControl, ActivityIndicator, StatusBar, Image, TouchableOpacity, FlatList, ScrollView, Modal } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Syringe, Tag, CalendarDays, Dog, TrendingUp, ClipboardCheck, AlertCircle, Activity as ActivityIcon, ChevronRight, User, Stethoscope, X, Info } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { format } from 'date-fns';
import { useTheme } from '@/lib/theme';
import NetInfo from '@react-native-community/netinfo';

interface Animal {
  _id: string;
  animalId: string;
  earTag?: string;
  breed: string;
  species: string;
  reproductiveStatus?: string;
}

interface Milestone {
  type: 'calving' | 'heat_check' | 'pd_check';
  title: string;
  animal?: {
    _id: string;
    earTag?: string;
    breed?: string;
    species?: string;
  };
  date: string;
  daysLeft: number;
  priority: 'high' | 'medium';
  relatedId: string;
}

interface ActivityFeedItem {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'ai' | 'health' | 'calving';
  animalId?: {
    _id: string;
    earTag?: string;
    breed?: string;
    species?: string;
  };
  details?: {
    sireBreed?: string;
    sireCode?: string;
    attemptNumber?: number;
    estrus?: string;
    status?: string;
    outcome?: string;
    technician?: string;
    technicianNote?: string;
    inseminationDate?: string;
    scheduledDate?: string;

    requestType?: string;
    symptoms?: string;
    urgency?: string;
    diagnosis?: string;
    treatment?: string;
    advice?: string;

    calvingEase?: string;
    numberOfCalves?: number;
    calves?: Array<{
      sex: string;
      earTag?: string;
      weight?: number;
    }>;
  };
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

const MilestoneCard = ({ item, onPress }: { item: Milestone, onPress?: () => void }) => {
  const { colors, isDark } = useTheme();
  const dateStr = item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'No Date';

  const isCalving = item.type === 'calving';
  const isHeat = item.type === 'heat_check';

  const badgeBg = isCalving 
    ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
    : isHeat
      ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb')
      : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff');

  const badgeColor = isCalving ? '#059669' : isHeat ? '#d97706' : '#2563eb';
  const leftBorderColor = isCalving ? '#10b981' : isHeat ? '#f59e0b' : '#3b82f6';

  let remainingText = '';
  let remainingColor = colors.textSecondary;
  if (item.daysLeft > 0) {
    remainingText = `${item.daysLeft} days left`;
    remainingColor = badgeColor;
  } else if (item.daysLeft === 0) {
    remainingText = 'TODAY';
    remainingColor = '#dc2626';
  } else {
    remainingText = `Overdue by ${Math.abs(item.daysLeft)} days`;
    remainingColor = '#dc2626';
  }

  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={onPress}
      style={{ 
        backgroundColor: colors.card, 
        borderRadius: 24, 
        padding: 16, 
        marginBottom: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: isDark ? 0 : 0.04, 
        shadowRadius: 8, 
        elevation: isDark ? 0 : 2, 
        borderWidth: 1, 
        borderColor: colors.border,
        borderLeftWidth: 5,
        borderLeftColor: leftBorderColor
      }}
    >
      <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}>
        {isCalving ? (
          <MaterialCommunityIcons name="baby-carriage" size={26} color={badgeColor} />
        ) : isHeat ? (
          <MaterialCommunityIcons name="fire" size={26} color={badgeColor} />
        ) : (
          <ClipboardCheck size={24} color={badgeColor} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 15, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
          {item.title}
        </Text>
        {item.animal && (
          <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }}>
            Tag: #{item.animal.earTag || 'No Tag'} • {item.animal.breed || 'Unknown Breed'}
          </Text>
        )}
        <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: colors.textMuted, marginTop: 4 }}>
          Target: {dateStr}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
        <View style={{ backgroundColor: remainingColor + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: remainingColor, textTransform: 'uppercase' }}>
            {remainingText}
          </Text>
        </View>
        <ChevronRight size={16} color={colors.textMuted} style={{ marginTop: 8 }} />
      </View>
    </TouchableOpacity>
  );
};

const ActivityCard = ({ item, onPress }: { item: ActivityFeedItem, onPress?: () => void }) => {
  const { colors, isDark } = useTheme();
  const dateStr = item.date ? format(new Date(item.date), 'MMM dd, yyyy • h:mm a') : 'No Date';
  
  const isAI = item.type === 'ai';
  const isHealth = item.type === 'health';

  const cardColor = isDark 
    ? (isHealth ? 'rgba(239, 68, 68, 0.05)' : isAI ? 'rgba(59, 130, 246, 0.05)' : 'rgba(16, 185, 129, 0.05)')
    : (isHealth ? '#fef2f2' : isAI ? '#eff6ff' : '#f0fdf4');

  const iconColor = isHealth ? '#dc2626' : isAI ? '#2563eb' : '#b45309';

  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={onPress}
      style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 12, elevation: isDark ? 0 : 3, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: cardColor, alignItems: 'center', justifyContent: 'center' }}>
            {isAI ? (
              <Syringe size={20} color={iconColor} />
            ) : isHealth ? (
              <Stethoscope size={20} color={iconColor} />
            ) : (
              <MaterialCommunityIcons name="cow" size={24} color={iconColor} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{dateStr}</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Outfit_700Bold', color: colors.textPrimary, marginTop: 4 }}>{item.title}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }}>{item.description}</Text>
          </View>
        </View>
      </View>

      {item.animalId && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: isDark ? colors.primary : '#00643B' }}>View Animal Details →</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const DetailRow = ({ label, value, highlightColor }: { label: string, value?: string, highlightColor?: string }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: highlightColor || colors.textPrimary, textTransform: 'capitalize', textAlign: 'right', flex: 1, marginLeft: 16 }}>
        {value || 'N/A'}
      </Text>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FarmerReports() {
  const { colors, isDark } = useTheme();
  const api    = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tab, selectId } = useLocalSearchParams<{ tab?: string; selectId?: string }>();

  const [activeTab, setActiveTab] = useState<'cycles' | 'records'>(tab === 'records' ? 'records' : 'cycles');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [records, setRecords] = useState<ActivityFeedItem[]>([]);
  const [recordStats, setRecordStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0 });
  const [isLoadingMilestones, setIsLoadingMilestones] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityFeedItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    if (tab === 'records') {
      setActiveTab('records');
    } else if (tab === 'cycles' || tab === 'animals') {
      setActiveTab('cycles');
    }
  }, [tab]);

  useEffect(() => {
    if (selectId && records.length > 0) {
      const found = records.find(r => r.id === selectId);
      if (found) {
        setSelectedActivity(found);
        setIsModalVisible(true);
      }
    }
  }, [selectId, records]);

  const fetchMilestones = useCallback(async (isRefresh = false) => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      if (!isRefresh) setIsLoadingMilestones(false);
      if (isRefresh) setIsRefreshing(false);
      return;
    }

    if (!isRefresh) setIsLoadingMilestones(true);
    try {
      const res = await api.get('/user/milestones');
      const body = res.data;
      setMilestones(Array.isArray(body) ? body : (body?.data || []));
    } catch (e) {
      toast.error('Milestones sync failed');
    } finally {
      setIsLoadingMilestones(false);
      if (isRefresh) setIsRefreshing(false);
    }
  }, [api]);

  const fetchRecords = useCallback(async (isRefresh = false) => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      if (!isRefresh) setIsLoadingRecords(false);
      if (isRefresh) setIsRefreshing(false);
      return;
    }

    if (!isRefresh) setIsLoadingRecords(true);
    try {
      const res = await api.get('/user/activity');
      const data = res.data || [];
      setRecords(data);
      
      const total = data.length;
      const aiCount = data.filter((r: any) => r.type === 'ai').length;
      const healthCount = data.filter((r: any) => r.type === 'health').length;
      const calvingCount = data.filter((r: any) => r.type === 'calving').length;
      
      setRecordStats({
        total,
        approved: aiCount,
        pending: healthCount,
        rejected: calvingCount,
      });
    } catch (e) {
      toast.error('Activity sync failed');
    } finally {
      setIsLoadingRecords(false);
      if (isRefresh) setIsRefreshing(false);
    }
  }, [api]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMilestones(true);
    fetchRecords(true);
  }, [fetchMilestones, fetchRecords]);

  useEffect(() => {
    fetchMilestones();
    fetchRecords();

    const interval = setInterval(() => {
      fetchMilestones(true);
      fetchRecords(true);
    }, 10000); // Poll every 10 seconds silently
    
    return () => clearInterval(interval);
  }, [fetchMilestones, fetchRecords]);

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
              {activeTab === 'cycles' 
                ? `Tracking cycles... You have ${milestones.length} active breeding milestones. Keep an eye on upcoming calving dates!`
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
            onPress={() => setActiveTab('cycles')}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 18, alignItems: 'center', backgroundColor: activeTab === 'cycles' ? (isDark ? colors.primary : '#00643B') : 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <CalendarDays size={16} color={activeTab === 'cycles' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: activeTab === 'cycles' ? '#fff' : colors.textSecondary }}>Breeding Cycles</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('records')}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 18, alignItems: 'center', backgroundColor: activeTab === 'records' ? (isDark ? colors.primary : '#00643B') : 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <ActivityIcon size={16} color={activeTab === 'records' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: activeTab === 'records' ? '#fff' : colors.textSecondary }}>Activity Feed</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'cycles' ? (
          isLoadingMilestones ? (
            <ActivityIndicator color={isDark ? colors.primary : "#00643B"} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={milestones}
              keyExtractor={(item, index) => item.relatedId + '-' + index}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 140 }}
              renderItem={({ item }) => <MilestoneCard item={item} onPress={() => { if (item.animal?._id) router.push(`/(farmer)/animal-details?id=${item.animal._id}`); }} />}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[isDark ? colors.primary : '#00643B']} />}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.4 }}>
                  <MaterialCommunityIcons name="calendar-blank" size={60} color={colors.textMuted} />
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, marginTop: 12 }}>No active breeding cycles</Text>
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
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 140 }}
              ListHeaderComponent={
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Total', val: recordStats.total, color: isDark ? colors.primary : '#00643B', bg: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5', icon: TrendingUp },
                    { label: 'Breeding', val: recordStats.approved, color: isDark ? '#60a5fa' : '#2563eb', bg: isDark ? 'rgba(96,165,250,0.15)' : '#eff6ff', icon: Syringe },
                    { label: 'Health', val: recordStats.pending, color: isDark ? '#f87171' : '#dc2626', bg: isDark ? 'rgba(248,113,113,0.15)' : '#fef2f2', icon: Stethoscope },
                    { label: 'Calving', val: recordStats.rejected, color: isDark ? '#fbbf24' : '#b45309', bg: isDark ? 'rgba(251,191,36,0.15)' : '#fef3c7', icon: AlertCircle },
                  ].map((s, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 20, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: isDark ? colors.border : s.color + '15' }}>
                      <s.icon size={11} color={s.color} style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 16, fontFamily: 'Outfit_900Black', color: s.color }}>{s.val}</Text>
                      <Text style={{ fontSize: 7, fontFamily: 'Outfit_800ExtraBold', color: s.color, textTransform: 'uppercase' }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              }
              renderItem={({ item }) => (
                <ActivityCard 
                  item={item} 
                  onPress={() => { 
                    setSelectedActivity(item); 
                    setIsModalVisible(true); 
                  }} 
                />
              )}
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

      {/* Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 28, width: '100%', maxHeight: '80%', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8, overflow: 'hidden' }}>
            
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Info size={18} color={isDark ? colors.primary : '#00643B'} />
                <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>Record Details</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              {selectedActivity && (
                <View style={{ gap: 20 }}>
                  
                  {/* Category Header Card */}
                  <View style={{ alignItems: 'center', gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 18, 
                      backgroundColor: selectedActivity.type === 'health' 
                        ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2') 
                        : selectedActivity.type === 'ai' 
                          ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') 
                          : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#f0fdf4'), 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      {selectedActivity.type === 'ai' ? (
                        <Syringe size={26} color="#2563eb" />
                      ) : selectedActivity.type === 'health' ? (
                        <Stethoscope size={26} color="#dc2626" />
                      ) : (
                        <MaterialCommunityIcons name="cow" size={30} color="#b45309" />
                      )}
                    </View>
                    <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, textAlign: 'center' }}>
                      {selectedActivity.title}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {selectedActivity.date ? format(new Date(selectedActivity.date), 'MMMM dd, yyyy • h:mm a') : 'No Date'}
                    </Text>
                  </View>

                  {/* Animal Info */}
                  {selectedActivity.animalId && (
                    <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Subject Animal</Text>
                      <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
                        Tag: #{selectedActivity.animalId.earTag || 'No Tag'}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }}>
                        {selectedActivity.animalId.breed || 'Unknown Breed'} • {selectedActivity.animalId.species || 'Unknown Species'}
                      </Text>
                    </View>
                  )}

                  {/* Detailed Information */}
                  <View style={{ gap: 14 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Outfit_800ExtraBold', color: colors.textMuted, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 4 }}>Details</Text>
                    
                    {!selectedActivity.details ? (
                      <View style={{ padding: 12, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: isDark ? '#f87171' : '#dc2626', lineHeight: 18 }}>
                          ⚠️ Detailed data is missing from the server response. If running locally, please restart your backend server (`npm run dev`) and reload the mobile app to apply the updates.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {selectedActivity.type === 'ai' && (
                          <View style={{ gap: 10 }}>
                            <DetailRow label="Sire Breed" value={selectedActivity.details.sireBreed} />
                            <DetailRow label="Sire Code" value={selectedActivity.details.sireCode} />
                            <DetailRow label="Attempt Number" value={selectedActivity.details.attemptNumber?.toString()} />
                            <DetailRow label="Estrus Type" value={selectedActivity.details.estrus} />
                            <DetailRow label="Outcome" value={selectedActivity.details.outcome} highlightColor={selectedActivity.details.outcome?.toLowerCase() === 'success' ? '#059669' : selectedActivity.details.outcome?.toLowerCase() === 'failed' ? '#dc2626' : undefined} />
                            <DetailRow label="Technician" value={selectedActivity.details.technician} />
                          </View>
                        )}

                        {selectedActivity.type === 'health' && (
                          <View style={{ gap: 10 }}>
                            <DetailRow label="Request Type" value={selectedActivity.details.requestType} />
                            <DetailRow label="Symptoms" value={selectedActivity.details.symptoms} />
                            <DetailRow label="Urgency" value={selectedActivity.details.urgency} highlightColor={selectedActivity.details.urgency?.toLowerCase() === 'high' ? '#dc2626' : selectedActivity.details.urgency?.toLowerCase() === 'medium' ? '#d97706' : '#059669'} />
                            <DetailRow label="Diagnosis" value={selectedActivity.details.diagnosis} />
                            <DetailRow label="Treatment" value={selectedActivity.details.treatment} />
                            <DetailRow label="Medicine / Advice" value={selectedActivity.details.advice} />
                            <DetailRow label="Technician / Vet" value={selectedActivity.details.technician} />
                          </View>
                        )}

                        {selectedActivity.type === 'calving' && (
                          <View style={{ gap: 10 }}>
                            <DetailRow label="Calving Ease" value={selectedActivity.details.calvingEase} />
                            <DetailRow label="Number of Calves" value={selectedActivity.details.numberOfCalves?.toString()} />
                            <DetailRow label="Technician" value={selectedActivity.details.technician} />
                            
                            {selectedActivity.details.calves && selectedActivity.details.calves.length > 0 && (
                              <View style={{ marginTop: 8, gap: 6 }}>
                                <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: colors.textSecondary }}>Calves Registered:</Text>
                                {selectedActivity.details.calves.map((calf, index) => (
                                  <View key={index} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                                    <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>Calf #{index + 1}: {calf.sex}</Text>
                                    {calf.earTag && <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>Tag: #{calf.earTag}</Text>}
                                    {calf.weight && <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>Weight: {calf.weight} kg</Text>}
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    )}
                  </View>

                  {/* Technician Notes */}
                  {selectedActivity.details?.technicianNote && (
                    <View style={{ gap: 6, backgroundColor: isDark ? 'rgba(0, 100, 59, 0.05)' : '#f0fdf4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: isDark ? 'rgba(0, 100, 59, 0.2)' : '#d1fae5' }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Outfit_800ExtraBold', color: isDark ? '#34d399' : '#00643B', textTransform: 'uppercase' }}>Observations / Notes</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textPrimary, fontStyle: 'italic', lineHeight: 18 }}>
                        "{selectedActivity.details.technicianNote}"
                      </Text>
                    </View>
                  )}

                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={{ paddingHorizontal: 24, paddingVertical: 18, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : '#f8fafc' }}>
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: colors.textSecondary }}>Close</Text>
              </TouchableOpacity>
              
              {selectedActivity?.animalId?._id && (
                <TouchableOpacity 
                  onPress={() => {
                    setIsModalVisible(false);
                    router.push(`/(farmer)/animal-details?id=${selectedActivity.animalId?._id}`);
                  }}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: isDark ? colors.primary : '#00643B', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: '#fff' }}>View Animal</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}