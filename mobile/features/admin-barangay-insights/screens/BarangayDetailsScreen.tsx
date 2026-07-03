import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Users, Activity, FileText } from 'lucide-react-native';
import { AsyncState, StatusBadge } from '@/components/shared';
import { ScreenLayout } from '@/components/ScreenLayout';
import { useTheme } from '@/lib/theme';
import { useBarangayDetails } from '../hooks/useBarangayDetails';

const PRIMARY = '#1e3a5f';

export default function BarangayDetailsScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { colors, isDark } = useTheme();

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    handleRefresh,
  } = useBarangayDetails(name || '');

  const [activeTab, setActiveTab] = useState<'farmers' | 'timeline' | 'technicians'>('farmers');

  if (isLoading && !isRefetching) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ marginTop: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
            Loading barangay details...
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  if (isError || !name) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={{ fontSize: 18, fontFamily: 'Outfit_700Bold', color: colors.textPrimary, marginTop: 16 }}>
            Error Loading Details
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 24, backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  // Barangay aggregated statistics for header
  const stats = {
    totalFarmers: data.farmers.length,
    totalAnimals: data.animals.length,
    pendingHealth: data.recentHealth.filter(h => h.status === 'pending').length,
    pendingAI: data.recentAI.filter(a => a.status === 'pending').length,
  };

  const headerElement = (
    <View style={{ marginBottom: 20 }}>
      {/* Scoped Barangay Stats Grid */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 24,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0 : 0.03,
          shadowRadius: 8,
          elevation: 2,
          marginBottom: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <MapPin size={18} color={PRIMARY} />
          <Text style={{ fontSize: 16, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }}>
            {name} Barangay Summary
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ width: '47%', padding: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderRadius: 14 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>
              Farmers
            </Text>
            <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, marginTop: 4 }}>
              {stats.totalFarmers}
            </Text>
          </View>

          <View style={{ width: '47%', padding: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderRadius: 14 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>
              Animals
            </Text>
            <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, marginTop: 4 }}>
              {stats.totalAnimals}
            </Text>
          </View>

          <View style={{ width: '47%', padding: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderRadius: 14 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>
              Pending Health
            </Text>
            <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, marginTop: 4 }}>
              {stats.pendingHealth}
            </Text>
          </View>

          <View style={{ width: '47%', padding: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderRadius: 14 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>
              Pending AI
            </Text>
            <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, marginTop: 4 }}>
              {stats.pendingAI}
            </Text>
          </View>
        </View>
      </View>

      {/* Tab Selectors */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(30,58,95,0.05)',
          borderRadius: 16,
          padding: 4,
          marginBottom: 16,
        }}
      >
        <TabButton
          label="Farmers"
          active={activeTab === 'farmers'}
          onPress={() => setActiveTab('farmers')}
        />
        <TabButton
          label="Timeline"
          active={activeTab === 'timeline'}
          onPress={() => setActiveTab('timeline')}
        />
        <TabButton
          label="Technicians"
          active={activeTab === 'technicians'}
          onPress={() => setActiveTab('technicians')}
        />
      </View>
    </View>
  );

  return (
    <ScreenLayout edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Screen Header Bar */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
          }}
        >
          <ArrowLeft size={18} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }}>
          {name} Insights
        </Text>
      </View>

      {/* Main List */}
      <View style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F0F4FF', paddingHorizontal: 24 }}>
        <FlatList
          data={
            activeTab === 'farmers'
              ? data.farmers
              : activeTab === 'timeline'
              ? data.timeline
              : data.technicians
          }
          keyExtractor={(item, index) => item._id || index.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
          ListHeaderComponent={headerElement}
          ListEmptyComponent={() => (
            <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="inbox-outline" size={40} color={colors.textMuted} />
              <Text style={{ fontSize: 13, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary, marginTop: 8 }}>
                No registered records in this category.
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            if (activeTab === 'farmers') {
              return <FarmerListItem item={item} animalCount={data.animals.filter(a => a.farmerId === item._id).length} />;
            }
            if (activeTab === 'timeline') {
              return <TimelineItem item={item} />;
            }
            return <TechnicianListItem item={item} />;
          }}
        />
      </View>
    </ScreenLayout>
  );
}

// ── Tab Button Helper ──────────────────────────────────────────
function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: active ? PRIMARY : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Outfit_700Bold',
          color: active ? '#fff' : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Farmer Item Row ────────────────────────────────────────────
const FarmerListItem = React.memo(function FarmerListItem({ item, animalCount }: { item: any; animalCount: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={16} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }}>
            Phone: {item.phoneNumber || '—'}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 13, fontFamily: 'Outfit_800ExtraBold', color: PRIMARY }}>
          {animalCount}
        </Text>
        <Text style={{ fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>
          Animals
        </Text>
      </View>
    </View>
  );
});

// ── Timeline Item Row ──────────────────────────────────────────
const TimelineItem = React.memo(function TimelineItem({ item }: { item: any }) {
  const { colors, isDark } = useTheme();

  const getIcon = () => {
    switch (item.type) {
      case 'insemination':
        return { name: 'needle', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
      case 'health':
        return { name: 'alert-circle-outline', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
      case 'calving':
        return { name: 'baby-carriage', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
      default:
        return { name: 'file-text-outline', color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
    }
  };

  const iconInfo = getIcon();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: iconInfo.bg, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={iconInfo.name as any} size={15} color={iconInfo.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
            {item.title}
          </Text>
        </View>
        <Text style={{ fontSize: 10, fontFamily: 'Outfit_500Medium', color: colors.textMuted }}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>
      <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, lineHeight: 16, paddingLeft: 38 }}>
        {item.description}
      </Text>
    </View>
  );
});

// ── Technician Item Row ────────────────────────────────────────
const TechnicianListItem = React.memo(function TechnicianListItem({ item }: { item: any }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="account-wrench-outline" size={18} color="#3b82f6" />
        </View>
        <View>
          <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }}>
            {item.phoneNumber || 'No Contact'}
          </Text>
        </View>
      </View>
      <StatusBadge label="Active in Area" variant="success" />
    </View>
  );
});
