import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Calendar, X } from "lucide-react-native";

import { AppHeaderIconButton, AppPageHeader } from "@/components/AppPageHeader";
import { FilterChips, SearchBar } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { safeBack } from "@/utils/navigation";
import { RecordList } from "../components/RecordList";
import { DateRangeSelector } from "../components/DateRangeSelector";
import { useTechnicianRecords } from "../hooks/useTechnicianRecords";

export default function TechnicianRecordsScreen({
  showBackButton = true,
  farmerId,
}: {
  showBackButton?: boolean;
  farmerId?: string;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    refetchAll,
    isLoading,
    isRefetching,
    isLoadingMore,
    hasMoreRecords,
    loadMoreRecords,
    searchQuery,
    setSearchQuery,
    selectedFilter,
    setSelectedFilter,
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
    recordsTotal,
    filteredRecords,
    clearDateRange,
  } = useTechnicianRecords(farmerId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader
        title="Records"
        showBackButton={showBackButton}
        onBack={() =>
          farmerId
            ? router.back()
            : safeBack("/(technician)/(tabs)/technician.dashboard")
        }
        variant={showBackButton ? "detail" : "top-level"}
        rightAction={
          <AppHeaderIconButton
            onPress={() => setShowCalendarModal(true)}
            accessibilityLabel="Filter records by date"
            selected={Boolean(startDate || endDate)}
          >
            <Calendar size={18} color={colors.primary} />
          </AppHeaderIconButton>
        }
      />

      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search farmer, animal tag, or status"
            variant="directory"
          />
        </View>

        {(startDate || endDate) && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              backgroundColor: colors.warningContainer,
              borderWidth: 1,
              borderColor: colors.warningBorder,
              paddingHorizontal: 12,
              borderRadius: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Calendar size={16} color={colors.warningForeground} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.warningForeground,
                }}
              >
                {startDate ? startDate.toLocaleDateString() : "Start date"} –{" "}
                {endDate ? endDate.toLocaleDateString() : "End date"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={clearDateRange}
              accessibilityRole="button"
              accessibilityLabel="Clear date range"
              style={{
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} color={colors.warningForeground} />
            </TouchableOpacity>
          </View>
        )}

        <FilterChips
          options={[
            { label: "All", value: "All" },
            { label: "AI", value: "AI" },
            { label: "Pregnancy", value: "Pregnancy" },
            { label: "Calving", value: "Calving" },
            { label: "Health", value: "Health" },
            { label: "Notes", value: "Notes" },
          ]}
          value={selectedFilter}
          onChange={(value) => setSelectedFilter(value as any)}
          containerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
        />

        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text
            style={{
              fontFamily: "Outfit_500Medium",
              color: colors.textSecondary,
              fontSize: 12,
            }}
          >
            Showing {filteredRecords.length} of {recordsTotal} records
          </Text>
        </View>

        <RecordList
          isLoading={isLoading}
          isRefetching={isRefetching}
          onRefresh={refetchAll}
          filteredRecords={filteredRecords}
          openDetails={(item: any) => {
            const itemAnimalId =
              typeof item.animalId === "string"
                ? item.animalId
                : item.animalId?._id || item.animalId?.id;
            const itemSourceId = item.sourceId || item.id || item._id;
            const itemSourceKind = item.recordKind;

            router.push({
              pathname: "/(technician)/record-details",
              params: {
                animalId: String(itemAnimalId || ""),
                sourceId: String(itemSourceId || ""),
                sourceKind: String(itemSourceKind || ""),
                recordId: String(itemSourceId || ""),
                recordType: String(itemSourceKind || item.type || ""),
              },
            });
          }}
          isLoadingMore={isLoadingMore}
          hasMoreRecords={Boolean(hasMoreRecords)}
          onLoadMore={() => loadMoreRecords()}
          recordsTotal={recordsTotal}
        />
      </View>

      <DateRangeSelector
        visible={showCalendarModal}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setShowCalendarModal(false)}
        onSelectStart={(date: Date) => setStartDate(date)}
        onSelectEnd={(date: Date) => setEndDate(date)}
        onClear={clearDateRange}
        showStartPicker={showStartPicker}
        showEndPicker={showEndPicker}
        setShowStartPicker={setShowStartPicker}
        setShowEndPicker={setShowEndPicker}
      />
    </View>
  );
}
