import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from "react-native";
import Header from "@/components/Header";
import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AsyncState, StatusBadge, SearchBar, FilterChips, Pagination } from "@/components/shared";
import { useTheme } from "@/lib/theme";
import { useAdminRecords } from "../hooks/useAdminRecords";
import { AdminRecordsSummary } from "../components/AdminRecordsSummary";
import { DateRangeSelector } from "../components/DateRangeSelector";
import { ScreenLayout } from '@/components/ScreenLayout';

const PRIMARY = "#1e3a5f";
const TABS = ["Inseminations", "Pregnancies", "Calvings"];

export default function AdminRecordsScreen() {
  const { colors, isDark } = useTheme();
  const {
    activeTab,
    setActiveTab,
    currentData,
    totalRecordsCount,
    isLoading,
    isRefreshing,
    isError,
    searchQuery,
    setSearchQuery,
    page,
    totalPages,
    handleNextPage,
    handlePreviousPage,
    totalInseminations,
    totalPregnancies,
    totalCalvings,
    successRate,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    showCalendarModal,
    setShowCalendarModal,
    showStartPicker,
    setShowStartPicker,
    showEndPicker,
    setShowEndPicker,
    clearDateRange,
    handleExport,
    isExporting,
    handleRefresh,
  } = useAdminRecords();

  const headerElement = (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary, marginBottom: 16 }}>
        Records Registry
      </Text>
      <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: -10, marginBottom: 16 }}>
        Review and export official insemination, pregnancy, and calving records.
      </Text>

      {/* Aggregate Summary Widget */}
      <AdminRecordsSummary
        totalInseminations={totalInseminations}
        totalPregnancies={totalPregnancies}
        totalCalvings={totalCalvings}
        successRate={successRate}
      />

      {/* Global Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search tag, owner, sire, status..."
      />

      {/* Tab Filter Chips */}
      <FilterChips
        options={TABS}
        value={TABS[activeTab]}
        onChange={(val) => setActiveTab(TABS.indexOf(val))}
        containerStyle={{ paddingHorizontal: 0, marginBottom: 16 }}
      />

      {/* Export & Date Range Actions Row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Choose record date range"
          onPress={() => setShowCalendarModal(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: startDate || endDate ? "rgba(30,58,95,0.1)" : colors.card,
            borderWidth: 1,
            borderColor: startDate || endDate ? PRIMARY : colors.border,
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            minHeight: 44,
            gap: 6,
          }}
        >
          <MaterialCommunityIcons name="calendar" size={16} color={startDate || endDate ? PRIMARY : colors.textSecondary} />
          <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: startDate || endDate ? PRIMARY : colors.textSecondary }}>
            {startDate || endDate ? "Date Range Active" : "Date Filter"}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Export CSV"
            accessibilityState={{ disabled: isExporting }}
            disabled={isExporting}
            onPress={() => handleExport("csv")}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              minHeight: 44,
              flexDirection: 'row',
              alignItems: "center",
              gap: 4,
              opacity: isExporting ? 0.5 : 1,
            }}
          >
            <MaterialCommunityIcons name="file-delimited" size={14} color="#16a34a" />
            <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary }}>CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Export Excel"
            accessibilityState={{ disabled: isExporting }}
            disabled={isExporting}
            onPress={() => handleExport("excel")}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              minHeight: 44,
              flexDirection: 'row',
              alignItems: "center",
              gap: 4,
              opacity: isExporting ? 0.5 : 1,
            }}
          >
            <MaterialCommunityIcons name="file-excel" size={14} color="#10b981" />
            <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary }}>Excel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Export PDF"
            accessibilityState={{ disabled: isExporting }}
            disabled={isExporting}
            onPress={() => handleExport("pdf")}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              minHeight: 44,
              flexDirection: 'row',
              alignItems: "center",
              gap: 4,
              opacity: isExporting ? 0.5 : 1,
            }}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={14} color="#ef4444" />
            <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textSecondary }}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Result Count Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary }}>
          Showing {currentData.length} of {totalRecordsCount} records
        </Text>
        {totalPages > 1 && (
          <Text style={{ fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: colors.textMuted }}>
            Page {page} of {totalPages}
          </Text>
        )}
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
          data={isLoading ? [] : currentData}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />
          }
          ListHeaderComponent={headerElement}
          ListEmptyComponent={() => {
            if (isLoading) return <AsyncState state="loading" />;
            if (isError) return <AsyncState state="error" message="Failed to load records." onAction={handleRefresh} />;
            return (
              <AsyncState
                state="empty"
                title="No records found"
                message={`There are no registered ${TABS[activeTab].toLowerCase()} records yet.`}
              />
            );
          }}
          renderItem={({ item }) => (
            <RecordCard
              item={item}
              activeTab={activeTab}
            />
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrevious={handlePreviousPage}
                onNext={handleNextPage}
              />
            ) : null
          }
        />
      </View>

      {/* Date Range Modal */}
      <DateRangeSelector
        visible={showCalendarModal}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setShowCalendarModal(false)}
        onSelectStart={setStartDate}
        onSelectEnd={setEndDate}
        onClear={clearDateRange}
        showStartPicker={showStartPicker}
        showEndPicker={showEndPicker}
        setShowStartPicker={setShowStartPicker}
        setShowEndPicker={setShowEndPicker}
      />
    </ScreenLayout>
  );
}

// ── Record Card Component ──────────────────────────────────────
interface RecordCardProps {
  item: any;
  activeTab: number;
}

function RecordCard({ item, activeTab }: RecordCardProps) {
  const { colors, isDark } = useTheme();

  const getIconName = () => {
    switch (activeTab) {
      case 0:
        return "needle";
      case 1:
        return "baby-face-outline";
      case 2:
        return "cow";
      default:
        return "file-document-outline";
    }
  };

  return (
    <View
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(30,58,95,0.2)' : '#e0e9f5',
          }}
        >
          <MaterialCommunityIcons name={getIconName()} size={22} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
            {item.animalId?.earTag || item.animalId?.animalId || "No Tag/ID"}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary, marginTop: 2 }}>
            Farmer: {item.farmerId?.name || "Unassigned"}
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: colors.textMuted }}>
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
        </Text>
      </View>

      {/* Details Box */}
      <View
        style={{
          gap: 8,
          padding: 14,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
          borderRadius: 16,
        }}
      >
        {activeTab === 0 && (
          <View style={{ gap: 4 }}>
            {item.inseminationDate && (
              <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
                Date:{" "}
                <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
                  {new Date(item.inseminationDate).toLocaleDateString()}
                </Text>
              </Text>
            )}
            {item.sireCode && (
              <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
                Sire:{" "}
                <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
                  {item.sireCode}
                </Text>
              </Text>
            )}
            {item.status && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <StatusBadge label={item.status} />
              </View>
            )}
          </View>
        )}

        {activeTab === 1 && (
          <View style={{ gap: 4 }}>
            {item.pregnancyDiagnosis?.date && (
              <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
                Check Date:{" "}
                <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
                  {new Date(item.pregnancyDiagnosis.date).toLocaleDateString()}
                </Text>
              </Text>
            )}
            {item.pregnancyDiagnosis?.result && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <StatusBadge label={item.pregnancyDiagnosis.result} />
              </View>
            )}
          </View>
        )}

        {activeTab === 2 && (
          <View style={{ gap: 4 }}>
            {item.date && (
              <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
                Calving Date:{" "}
                <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </Text>
            )}
            {item.calfSex && (
              <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.textSecondary }}>
                Calf Sex:{" "}
                <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textPrimary }}>
                  {item.calfSex}
                </Text>
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
