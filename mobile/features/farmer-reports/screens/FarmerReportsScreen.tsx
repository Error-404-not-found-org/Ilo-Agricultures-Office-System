import React from "react";
import {
  View,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFarmerReports } from "../hooks/useFarmerReports";
import ReportsHeader from "../components/ReportsHeader";
import MilestoneCard from "../components/MilestoneCard";
import ActivityCard from "../components/ActivityCard";
import type { ActivityFeedItem } from "../types/farmerReports.types";

const RECORD_TYPE_FILTERS: {
  label: string;
  value: "all" | ActivityFeedItem["type"];
}[] = [
  { label: "All", value: "all" },
  { label: "AI services", value: "ai" },
  { label: "Health", value: "health" },
  { label: "Pregnancy", value: "pregnancy" },
  { label: "Calving", value: "calving" },
];

export const FarmerReportsScreen = () => {
  const {
    colors,
    isDark,
    router,
    activeBento,
    milestones,
    records,
    isLoadingMilestones,
    isLoadingRecords,
    isChangingRecordsPage,
    recordsPage,
    recordsTotalPages,
    recordsTotal,
    isRefreshing,
    recordType,
    setRecordType,
    filteredRecords,
    onRefresh,
    goToRecordsPage,
    handleExportPDF,
  } = useFarmerReports();
  const recordsListRef = React.useRef<FlatList<ActivityFeedItem>>(null);

  const handleRecordsPageChange = async (page: number) => {
    await goToRecordsPage(page);
    recordsListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderHeader = () => {
    const primaryColor = isDark ? colors.primary : "#00643B";

    return (
      <View style={{ paddingTop: 0 }}>
        <ReportsHeader onExport={handleExportPDF} />
        {activeBento !== "pregnancy" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -24, marginBottom: 20 }}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingRight: 32,
              gap: 8,
            }}
          >
            {RECORD_TYPE_FILTERS.map((filter) => {
              const selected = recordType === filter.value;

              return (
                <TouchableOpacity
                  key={filter.value}
                  onPress={() => setRecordType(filter.value)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Filter records by ${filter.label}`}
                  style={{
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: selected ? primaryColor : colors.border,
                    backgroundColor: selected ? primaryColor : colors.card,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#fff" : colors.textSecondary,
                      fontFamily: selected
                        ? "Outfit_700Bold"
                        : "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
        <View
          style={{
            flexDirection: "row",
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
              : `${recordsTotal} ${recordsTotal === 1 ? "record" : "records"} found`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? colors.card : "#fff"}
      />

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
            ref={recordsListRef}
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 16,
                    paddingBottom: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleRecordsPageChange(recordsPage - 1)}
                    disabled={recordsPage === 1 || isChangingRecordsPage}
                    accessibilityRole="button"
                    accessibilityLabel="Previous records page"
                    accessibilityState={{
                      disabled: recordsPage === 1 || isChangingRecordsPage,
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity:
                        recordsPage === 1 || isChangingRecordsPage ? 0.4 : 1,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-left"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>

                  <View style={{ minWidth: 112, alignItems: "center" }}>
                    {isChangingRecordsPage ? (
                      <ActivityIndicator
                        size="small"
                        color={isDark ? colors.primary : "#00643B"}
                      />
                    ) : (
                      <>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            color: colors.textPrimary,
                          }}
                        >
                          Page {recordsPage} of {recordsTotalPages}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            fontSize: 11,
                            color: colors.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          10 records per page
                        </Text>
                      </>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRecordsPageChange(recordsPage + 1)}
                    disabled={
                      recordsPage === recordsTotalPages || isChangingRecordsPage
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Next records page"
                    accessibilityState={{
                      disabled:
                        recordsPage === recordsTotalPages ||
                        isChangingRecordsPage,
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity:
                        recordsPage === recordsTotalPages ||
                        isChangingRecordsPage
                          ? 0.4
                          : 1,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color={colors.textPrimary}
                    />
                  </TouchableOpacity>
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
