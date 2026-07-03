import React from "react";
import { View, FlatList, RefreshControl, ActivityIndicator, Text, TouchableOpacity, StatusBar } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFarmerReports } from "../hooks/useFarmerReports";
import ReportsHeader from "../components/ReportsHeader";
import MoowieAnalysisCard from "../components/MoowieAnalysisCard";
import ReportsBentoGrid from "../components/ReportsBentoGrid";
import MonthlySummaryCard from "../components/MonthlySummaryCard";
import RecordFilters from "../components/RecordFilters";
import MilestoneCard from "../components/MilestoneCard";
import ActivityCard from "../components/ActivityCard";
import RecordDetailModal from "../components/RecordDetailModal";

export const FarmerReportsScreen = () => {
  const {
    colors,
    isDark,
    insets,
    router,
    activeBento,
    setActiveBento,
    milestones,
    records,
    recordStats,
    isLoadingMilestones,
    isLoadingRecords,
    isRefreshing,
    selectedActivity,
    setSelectedActivity,
    isModalVisible,
    setIsModalVisible,
    recordSearch,
    setRecordSearch,
    setRecordType,
    recordStatus,
    setRecordStatus,
    recordPeriod,
    setRecordPeriod,
    filteredRecords,
    onRefresh,
    handleExportPDF,
  } = useFarmerReports();

  const renderHeader = () => {
    return (
      <View style={{ paddingTop: 0 }}>
        <ReportsHeader insets={insets} onExport={handleExportPDF}>
          <MoowieAnalysisCard
            activeBento={activeBento}
            milestonesCount={milestones.length}
            totalRecordsCount={recordStats.total}
          />
        </ReportsHeader>

        <ReportsBentoGrid
          activeBento={activeBento}
          onBentoPress={(bento, recordType) => {
            setActiveBento(bento);
            setRecordType(recordType);
          }}
          recordStats={recordStats}
          milestonesCount={milestones.length}
        />

        <MonthlySummaryCard
          pendingCount={records.filter((r) => r.details?.status === "pending").length}
          totalCount={records.length}
        />

        {/* Section Header */}
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
              ? "Breeding Cycles"
              : "Recent Activity"}
          </Text>
          {activeBento !== "all" && (
            <TouchableOpacity
              onPress={() => {
                setActiveBento("all");
                setRecordType("all");
              }}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                backgroundColor: isDark ? "rgba(0,100,59,0.15)" : "#ecfdf5",
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_700Bold",
                  color: isDark ? colors.primary : "#00643B",
                }}
              >
                Clear Filter
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {activeBento !== "pregnancy" && (
          <RecordFilters
            recordSearch={recordSearch}
            setRecordSearch={setRecordSearch}
            recordStatus={recordStatus}
            setRecordStatus={setRecordStatus}
            recordPeriod={recordPeriod}
            setRecordPeriod={setRecordPeriod}
          />
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

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
                  setSelectedActivity(item);
                  setIsModalVisible(true);
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
          />
        )}
      </View>

      <RecordDetailModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        selectedActivity={selectedActivity}
        onViewAnimal={(animalId) => {
          setIsModalVisible(false);
          router.push(`/(farmer)/animal-details?id=${animalId}`);
        }}
      />
    </View>
  );
};

export default FarmerReportsScreen;
