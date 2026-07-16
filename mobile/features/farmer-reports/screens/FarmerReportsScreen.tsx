import React from "react";
import { View, FlatList, RefreshControl, ActivityIndicator, Text, TouchableOpacity, StatusBar } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFarmerReports } from "../hooks/useFarmerReports";
import ReportsHeader from "../components/ReportsHeader";
import ReportsBentoGrid from "../components/ReportsBentoGrid";
import MonthlySummaryCard from "../components/MonthlySummaryCard";
import RecordFilters from "../components/RecordFilters";
import MilestoneCard from "../components/MilestoneCard";
import ActivityCard from "../components/ActivityCard";

export const FarmerReportsScreen = () => {
  const {
    colors,
    isDark,
    router,
    activeBento,
    setActiveBento,
    milestones,
    records,
    recordStats,
    isLoadingMilestones,
    isLoadingRecords,
    isLoadingMoreRecords,
    hasMoreRecords,
    recordsTotal,
    isRefreshing,
    recordSearch,
    setRecordSearch,
    recordType,
    setRecordType,
    recordPeriod,
    setRecordPeriod,
    resetFilters,
    filteredRecords,
    onRefresh,
    loadMoreRecords,
    handleExportPDF,
  } = useFarmerReports();

  const renderHeader = () => {
    return (
      <View style={{ paddingTop: 0 }}>
        <ReportsHeader onExport={handleExportPDF} />

        <MonthlySummaryCard totalCount={recordStats.total} />

        <ReportsBentoGrid
          activeBento={activeBento}
          onBentoPress={(bento, recordType) => {
            setActiveBento(bento);
            setRecordType(recordType);
          }}
          recordStats={recordStats}
          milestonesCount={milestones.length}
        />

        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 20,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textPrimary,
            }}
          >
            Find a record
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              fontFamily: "Outfit_500Medium",
              color: colors.textSecondary,
              marginTop: 3,
            }}
          >
            Search by animal or narrow the list by date.
          </Text>
        </View>

        {activeBento !== "pregnancy" && (
          <RecordFilters
            recordSearch={recordSearch}
            setRecordSearch={setRecordSearch}
            recordPeriod={recordPeriod}
            setRecordPeriod={setRecordPeriod}
          />
        )}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textPrimary,
            }}
          >
            {activeBento === "pregnancy"
              ? "Breeding cycles"
              : `${filteredRecords.length} ${filteredRecords.length === 1 ? "record" : "records"} found`}
          </Text>
          {(activeBento !== "all" ||
            recordType !== "all" ||
            recordPeriod !== "all" ||
            recordSearch.trim()) && (
            <TouchableOpacity
              onPress={resetFilters}
              accessibilityRole="button"
              accessibilityLabel="Reset all record filters"
              style={{
                minHeight: 40,
                paddingVertical: 9,
                paddingHorizontal: 14,
                backgroundColor: isDark ? "rgba(0,100,59,0.15)" : "#ecfdf5",
                borderRadius: 12,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_700Bold",
                  color: isDark ? colors.primary : "#00643B",
                }}
              >
                Reset filters
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? colors.card : "#fff"} />

      <View style={{ flex: 1 }}>
        {activeBento === "pregnancy" ? (
          <FlatList
            data={isLoadingMilestones ? [] : milestones}
            keyExtractor={(item, index) => item.relatedId + "-" + index}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: 140,
              flexGrow: 1,
            }}
            ListHeaderComponent={renderHeader}
            renderItem={({ item }) => (
              <MilestoneCard
                item={item}
                onPress={() => {
                  if (item.animal?._id)
                    router.push(
                      `/(farmer)/animal-details?id=${item.animal._id}`,
                    );
                }}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[isDark ? colors.primary : "#00643B"]}
              />
            }
            ListEmptyComponent={
              isLoadingMilestones ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 40,
                  }}
                >
                  <ActivityIndicator
                    size="large"
                    color={isDark ? colors.primary : "#00643B"}
                  />
                </View>
              ) : (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    paddingVertical: 40,
                    opacity: 0.4,
                  }}
                >
                  <MaterialCommunityIcons
                    name="calendar-blank"
                    size={60}
                    color={colors.textMuted}
                  />
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: colors.textSecondary,
                      marginTop: 12,
                    }}
                  >
                    No active breeding cycles
                  </Text>
                </View>
              )
            }
          />
        ) : (
          <FlatList
            data={isLoadingRecords ? [] : filteredRecords}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: 140,
              flexGrow: 1,
            }}
            ListHeaderComponent={renderHeader}
            renderItem={({ item }) => (
              <ActivityCard
                item={item}
                onPress={() => {
                  router.push({
                    pathname: "/(farmer)/animal-record-detail",
                    params: {
                      animalId: item.animalId?._id || "",
                      recordId: item.id,
                      recordType: item.type,
                    },
                  });
                }}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[isDark ? colors.primary : "#00643B"]}
              />
            }
            ListEmptyComponent={
              isLoadingRecords ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 40,
                  }}
                >
                  <ActivityIndicator
                    size="large"
                    color={isDark ? colors.primary : "#00643B"}
                  />
                </View>
              ) : (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    paddingVertical: 40,
                    opacity: 0.4,
                  }}
                >
                  <MaterialCommunityIcons
                    name="clipboard-text-off-outline"
                    size={60}
                    color={colors.textMuted}
                  />
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: colors.textSecondary,
                      marginTop: 12,
                    }}
                  >
                    No records found
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              records.length > 0 ? (
                <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 10 }}>
                  {hasMoreRecords ? (
                    <TouchableOpacity
                      onPress={loadMoreRecords}
                      disabled={isLoadingMoreRecords}
                      style={{
                        minWidth: 150,
                        minHeight: 44,
                        borderRadius: 14,
                        paddingHorizontal: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isDark ? "rgba(16,185,129,0.14)" : "#ecfdf5",
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(52,211,153,0.3)" : "#a7f3d0",
                      }}
                    >
                      {isLoadingMoreRecords ? (
                        <ActivityIndicator size="small" color={isDark ? colors.primary : "#00643B"} />
                      ) : (
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: isDark ? colors.primary : "#00643B" }}>
                          Load more records
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 11, color: colors.textMuted }}>
                      All {recordsTotal} records loaded
                    </Text>
                  )}
                </View>
              ) : null
            }
          />
        )}
      </View>

    </View>
  );
};

export default FarmerReportsScreen;
