import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import { SearchBar, AsyncState, FilterChips, StatusBadge, SelectDropdown } from '@/components/shared';
import { ScreenLayout } from '@/components/ScreenLayout';
import { useTheme } from '@/lib/theme';
import { useBarangayInsights } from '../hooks/useBarangayInsights';
import { BarangayInsightItem } from '../services/barangayInsights.service';

const PRIMARY = '#1e3a5f';
const FILTERS = ['All', 'High Activity', 'Needs Attention', 'Low Records', 'Health Alerts', 'AI Performance'];

export default function BarangayInsightsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const {
    summary,
    priorityBarangays,
    filteredBarangays,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    municipalityFilter,
    setMunicipalityFilter,
    municipalityOptions,
    districtFilter,
    setDistrictFilter,
    districtOptions,
    showDistrictFilter,
    selectedLocationLabel,
    isLoading,
    isError,
    isRefetching,
    handleRefresh,
  } = useBarangayInsights();

  const municipalityDropdownOptions = React.useMemo(
    () => municipalityOptions.map((option) => ({ label: option, value: option })),
    [municipalityOptions],
  );

  const districtDropdownOptions = React.useMemo(
    () => districtOptions.map((option) => ({ label: option, value: option })),
    [districtOptions],
  );

  const handleBarangayPress = (barangayName: string) => {
    router.push({
      pathname: '/(admin)/barangay-details' as any,
      params: { name: barangayName }
    });
  };

  const headerElement = (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, marginBottom: 16 }}>
        Barangay Insights
      </Text>

      {/* 1. Oton Summary Header Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 6 }}
        style={{ marginBottom: 20 }}
      >
        <SummaryCard
          title="Tracked"
          value={summary.totalBarangays}
          icon="map-marker"
          color="#3b82f6"
          bg="rgba(59,130,246,0.1)"
        />
        <SummaryCard
          title="Farmers"
          value={summary.totalFarmers}
          icon="account-group"
          color="#10b981"
          bg="rgba(16,185,129,0.1)"
        />
        <SummaryCard
          title="Animals"
          value={summary.totalAnimals}
          icon="cow"
          color="#8b5cf6"
          bg="rgba(139,92,246,0.1)"
        />
        <SummaryCard
          title="Pregnancies"
          value={summary.activePregnancies}
          icon="heart-pulse"
          color="#ec4899"
          bg="rgba(236,72,153,0.1)"
        />
        <SummaryCard
          title="Pending Req"
          value={summary.pendingRequests}
          icon="alert-circle"
          color="#f59e0b"
          bg="rgba(245,158,11,0.1)"
        />
      </ScrollView>

      {/* 2. Priority Barangays Section */}
      {priorityBarangays.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: 'Outfit_800ExtraBold',
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 10,
              marginLeft: 4,
            }}
          >
            Priority Barangays (Action Needed)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {priorityBarangays.map((item) => (
              <PriorityBarangayCard
                key={[item.municipality || item.city, item.district, item.barangay].filter(Boolean).join("-")}
                item={item}
                onPress={() => handleBarangayPress(item.barangay)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 3. Search and Filters */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search barangay, city, or district..."
      />

      <FilterChips
        options={FILTERS}
        value={activeFilter}
        onChange={setActiveFilter}
        containerStyle={{ paddingHorizontal: 0, marginBottom: 16 }}
      />

      <View style={{ marginBottom: 12 }}>
        <SelectDropdown
          label="Municipality / City"
          options={municipalityDropdownOptions}
          value={municipalityFilter}
          onChange={(value) => {
            setMunicipalityFilter(value);
            setDistrictFilter("All");
          }}
          searchable
        />
      </View>

      {showDistrictFilter && (
        <View style={{ marginBottom: 16 }}>
          <SelectDropdown
            label="District / Area"
            options={districtDropdownOptions}
            value={districtFilter}
            onChange={setDistrictFilter}
            searchable
          />
        </View>
      )}

      {/* Result Count */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary }}>
          Showing {filteredBarangays.length} areas in {selectedLocationLabel}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenLayout edges={[]}>
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[220px]" style={{ backgroundColor: PRIMARY }} />
      <Header />

      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? colors.background : '#F0F4FF',
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingHorizontal: 24,
          paddingTop: 24,
          marginTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 15,
        }}
      >
        <FlatList
          data={isLoading ? [] : filteredBarangays}
          keyExtractor={(item) => [item.municipality || item.city, item.district, item.barangay].filter(Boolean).join("-")}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
          ListHeaderComponent={headerElement}
          ListEmptyComponent={() => {
            if (isLoading) return <AsyncState state="loading" />;
            if (isError) return <AsyncState state="error" message="Failed to load insights." onAction={handleRefresh} />;
            return <AsyncState state="empty" title="No barangays found" message="Try searching or adjusting filters." />;
          }}
          renderItem={({ item }) => (
            <BarangayCard
              item={item}
              onPress={() => handleBarangayPress(item.barangay)}
            />
          )}
        />
      </View>
    </ScreenLayout>
  );
}

// ── Summary Card Component ─────────────────────────────────────
interface SummaryCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  bg: string;
}

const SummaryCard = React.memo(function SummaryCard({ title, value, icon, color, bg }: SummaryCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        minWidth: 105,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0 : 0.02,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      </View>
      <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary, marginTop: 2 }}>
        {title}
      </Text>
    </View>
  );
});

// ── Priority Barangay Card Component ───────────────────────────
interface PriorityCardProps {
  item: BarangayInsightItem;
  onPress: () => void;
}

const PriorityBarangayCard = React.memo(function PriorityBarangayCard({ item, onPress }: PriorityCardProps) {
  const { colors, isDark } = useTheme();
  const alertColor = item.status === "critical" ? "#ef4444" : "#f59e0b";
  const alertBg = item.status === "critical" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)";

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        width: 170,
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1.5,
        borderColor: alertColor,
        shadowColor: alertColor,
        shadowOpacity: isDark ? 0 : 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, fontFamily: 'Outfit_700Bold', color: colors.textPrimary, flex: 1, paddingRight: 8 }}
        >
          {item.barangay}
        </Text>
        <View
          style={{
            backgroundColor: alertBg,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
            maxWidth: 76,
          }}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ fontSize: 8, fontFamily: 'Outfit_800ExtraBold', color: alertColor, textTransform: 'uppercase' }}
          >
            {item.status}
          </Text>
        </View>
      </View>
      {(item.municipality || item.city || item.district) && (
        <Text
          numberOfLines={1}
          style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, marginTop: -4, marginBottom: 8 }}
        >
          {[item.district, item.municipality || item.city].filter(Boolean).join(", ")}
        </Text>
      )}

      <View style={{ gap: 6, marginBottom: 8 }}>
        {item.pendingHealthRequests > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#ef4444" />
            <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
              {item.pendingHealthRequests} Pending Health
            </Text>
          </View>
        )}
        {item.pendingAIRequests > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="needle" size={13} color="#f59e0b" />
            <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
              {item.pendingAIRequests} Pending AI
            </Text>
          </View>
        )}
        {item.incompleteRecordsCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="file-alert-outline" size={13} color="#64748b" />
            <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
              {item.incompleteRecordsCount} Incomplete Rec
            </Text>
          </View>
        )}
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted }}>
          Activity Score
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontFamily: 'Outfit_800ExtraBold',
            color: item.activityScore > 75 ? '#10b981' : item.activityScore > 45 ? '#f59e0b' : '#ef4444',
          }}
        >
          {item.activityScore}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ── Barangay List Card Component ───────────────────────────────
interface BarangayCardProps {
  item: BarangayInsightItem;
  onPress: () => void;
}

const BarangayCard = React.memo(function BarangayCard({ item, onPress }: BarangayCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0 : 0.03,
        shadowRadius: 8,
        elevation: isDark ? 0 : 2,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, paddingRight: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(30,58,95,0.2)' : '#e0e9f5',
            }}
          >
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={PRIMARY} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 17, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
              {item.barangay}
            </Text>
            {(item.municipality || item.city || item.district) && (
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, marginTop: 2 }}>
                {[item.district, item.municipality || item.city].filter(Boolean).join(", ")}
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexShrink: 0, maxWidth: 92 }}>
          <StatusBadge
            label={item.status}
            variant={item.status === 'healthy' ? 'success' : item.status === 'attention' ? 'warning' : 'danger'}
            size={9}
          />
        </View>
      </View>

      {/* Stats Grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          padding: 14,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
          borderRadius: 16,
        }}
      >
        <StatRowItem label="Farmers" value={item.farmersCount} width="45%" />
        <StatRowItem label="Animals" value={item.animalsCount} width="45%" />
        <StatRowItem label="Active Preg" value={item.activePregnancies} width="45%" />
        <StatRowItem
          label="AI Success"
          value={item.aiSuccessRate !== null ? `${item.aiSuccessRate}%` : '—'}
          width="45%"
        />
      </View>

      {/* Activity Score Section */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="speedometer" size={14} color={colors.textSecondary} />
          <Text style={{ fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary }}>
            Barangay Activity Score
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 50,
              height: 6,
              borderRadius: 3,
              backgroundColor: isDark ? '#334155' : '#e2e8f0',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${item.activityScore}%`,
                height: '100%',
                backgroundColor: item.activityScore > 75 ? '#10b981' : item.activityScore > 45 ? '#f59e0b' : '#ef4444',
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Outfit_800ExtraBold',
              color: item.activityScore > 75 ? '#10b981' : item.activityScore > 45 ? '#f59e0b' : '#ef4444',
            }}
          >
            {item.activityScore}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Helper grid item
function StatRowItem({ label, value, width }: { label: string; value: string | number; width: any }) {
  const { colors } = useTheme();
  return (
    <View style={{ width }}>
      <Text style={{ fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.textPrimary, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
