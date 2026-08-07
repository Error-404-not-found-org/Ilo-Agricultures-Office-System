import React, { useState, useEffect } from "react";
import { View, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { CalendarDays, SlidersHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner-native";
import { Text } from "@/components/ui/Text";
import { ScreenLayout } from "@/components/ScreenLayout";
import { AppHeaderIconButton, AppPageHeader } from "@/components/AppPageHeader";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ILOILO_CITY_BARANGAYS_BY_DISTRICT,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "@/constants/address";

import { useTechnicianRequests } from "../hooks/useTechnicianRequests";
import { RequestListCard } from "../components/RequestListCard";
import TechnicianMyWorkPanel from "../components/TechnicianMyWorkPanel";
import { RequestWorkFilterChips } from "../components/RequestWorkBadge";
import type { RequestItem } from "../types/technicianRequests.types";
import { isCanonicalWorkflowId } from "../utils/aiWorkflow";
import { OPEN_REQUEST_FILTERS } from "../utils/requestWorkPresentation";
import {
  SearchBar,
  AsyncState,
  Pagination,
  SelectDropdown,
} from "@/components/shared";

const NEAR_ME_PREFERENCE_KEY = "technician_request_board_near_me";

type TechnicianRequestsScreenProps = {
  showBackButton?: boolean;
};

type RequestSection = "openRequests" | "myWork";

export default function TechnicianRequestsScreen({
  showBackButton = true,
}: TechnicianRequestsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { section } = useLocalSearchParams<{
    section?: string | string[];
  }>();
  const normalizedSection = Array.isArray(section) ? section[0] : section;

  const {
    search,
    setSearch,
    type,
    setType,
    page,
    setPage,
    nearLat,
    setNearLat,
    setNearLng,
    sortBy,
    setSortBy,
    municipality,
    setMunicipality,
    barangay,
    setBarangay,
    requests,
    pagination,
    openRequestCounts,
    areOpenRequestCountsLoading,
    isLoading,
    isRefetching,
    handleRefresh,
  } = useTechnicianRequests();
  const [activeSection, setActiveSection] =
    useState<RequestSection>("openRequests");

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    setActiveSection(
      normalizedSection === "myWork" ? "myWork" : "openRequests",
    );
  }, [normalizedSection]);

  const sortOptions = [
    { label: "Newest First", value: "newest" },
    { label: "Nearest First", value: "distance" },
    { label: "Preferred Date", value: "preferredDate" },
    { label: "Oldest First", value: "oldest" },
  ];

  const municipalityOptions = React.useMemo(
    () => [
      { label: "All municipalities", value: "" },
      ...ILOILO_MUNICIPALITY_OPTIONS.map((name) => ({
        label: name,
        value: name,
      })),
    ],
    [],
  );

  const barangayOptions = React.useMemo(() => {
    if (!municipality) {
      return [{ label: "All barangays", value: "" }];
    }

    if (municipality === ILOILO_CITY_NAME) {
      return [
        { label: "All barangays", value: "" },
        ...Object.entries(ILOILO_CITY_BARANGAYS_BY_DISTRICT).flatMap(
          ([district, barangays]) =>
            barangays.map((name) => ({
              label: `${name} · ${district}`,
              value: `${name} (${district})`,
            })),
        ),
      ];
    }

    return [
      { label: "All barangays", value: "" },
      ...getIloiloBarangayOptions(municipality).map((name) => ({
        label: name,
        value: name,
      })),
    ];
  }, [municipality]);

  const [, setLocationLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const restoreNearMePreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem(
          NEAR_ME_PREFERENCE_KEY,
        );
        if (savedPreference !== "true") return;

        const { status: foregroundStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (foregroundStatus !== "granted") return;

        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!isMounted || !currentLoc?.coords) return;

        setNearLat(String(currentLoc.coords.latitude));
        setNearLng(String(currentLoc.coords.longitude));
        setSortBy("distance");
      } catch (error) {
        console.warn("Unable to restore Near Me preference:", error);
      }
    };

    restoreNearMePreference();
    return () => {
      isMounted = false;
    };
    // Restore this device preference once whenever the screen is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNearMeToggle = async (enable: boolean) => {
    if (!enable) {
      setNearLat(null);
      setNearLng(null);
      setSortBy("newest");
      await AsyncStorage.setItem(NEAR_ME_PREFERENCE_KEY, "false");
      toast.success("Location filtering disabled.");
      return;
    }

    try {
      setLocationLoading(true);
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        toast.error("Location permission denied. Keeping normal board active.");
        setNearLat(null);
        setNearLng(null);
        setSortBy("newest");
        return;
      }

      const currentLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (currentLoc?.coords) {
        setNearLat(String(currentLoc.coords.latitude));
        setNearLng(String(currentLoc.coords.longitude));
        setSortBy("distance");
        await AsyncStorage.setItem(NEAR_ME_PREFERENCE_KEY, "true");
        toast.success("Location retrieved! Sorting by nearby distance.");
      } else {
        toast.error("Failed to acquire location coordinates.");
      }
    } catch (err: any) {
      console.error("Error getting location:", err);
      toast.error("Unable to retrieve location: " + err.message);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleActionPress = (item: RequestItem | any) => {
    if (item.workflowType === "AI" || item.type === "ai") {
      const canonicalWorkflowId = item.workflowId || item.id || item._id;
      if (!isCanonicalWorkflowId(canonicalWorkflowId)) {
        toast.error("This AI request is missing its workflow identifier.");
        return;
      }
      router.push({
        pathname: "/(technician)/request-details",
        params: {
          id: canonicalWorkflowId,
          workflowId: canonicalWorkflowId,
          type: "ai",
          ...(item.allowedAction === "VIEW_RECORD" ? { viewOnly: "true" } : {}),
        },
      });
      return;
    }

    if (item.type === "breeding_verification" || item.type === "task") {
      router.push(
        `/(technician)/task-details?id=${item.id || item._id}` as any,
      );
      return;
    }

    const type = item.type === "health" ? "health" : "ai";
    router.push({
      pathname: "/(technician)/request-details",
      params: {
        id: item.id || item._id,
        type,
      },
    });
  };

  const selectSection = (nextSection: RequestSection) => {
    setActiveSection(nextSection);
    router.setParams({ section: nextSection });
  };

  const hasOpenRequestFilters = Boolean(
    search.trim() ||
      type !== "all" ||
      municipality ||
      barangay ||
      nearLat ||
      sortBy !== "newest",
  );

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader
        title="Requests"
        showBackButton={showBackButton}
        onBack={() => safeBack("/(technician)/(tabs)/technician.dashboard")}
        variant={showBackButton ? "detail" : "top-level"}
        rightAction={
          <AppHeaderIconButton
            onPress={() =>
              router.push("/(technician)/technician.calendar" as any)
            }
            accessibilityLabel="Open visit schedule"
          >
            <CalendarDays size={19} color={colors.primary} />
          </AppHeaderIconButton>
        }
      />

      <View style={{ flex: 1, paddingTop: 16 }}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
            borderRadius: 12,
            padding: 4,
            marginBottom: 12,
            marginHorizontal: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => selectSection("openRequests")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === "openRequests" }}
            accessibilityLabel="Open Requests section"
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              backgroundColor:
                activeSection === "openRequests"
                  ? isDark
                    ? "#1e293b"
                    : "#fff"
                  : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                color:
                  activeSection === "openRequests"
                    ? colors.primary
                    : isDark
                      ? "#94a3b8"
                      : "#64748b",
                fontSize: 13,
              }}
            >
              Open Requests
              {!areOpenRequestCountsLoading &&
              openRequestCounts.all !== undefined
                ? `  ${openRequestCounts.all}`
                : ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => selectSection("myWork")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === "myWork" }}
            accessibilityLabel="My Work section"
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              backgroundColor:
                activeSection === "myWork"
                  ? isDark
                    ? "#1e293b"
                    : "#fff"
                  : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                color:
                  activeSection === "myWork"
                    ? colors.primary
                    : isDark
                      ? "#94a3b8"
                      : "#64748b",
                fontSize: 13,
              }}
            >
              My Work
            </Text>
          </TouchableOpacity>
        </View>

        {activeSection === "openRequests" ? (
          <FlatList
          style={{ flex: 1 }}
          data={isLoading && !isRefetching ? [] : requests}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: showBackButton ? 24 : insets.bottom + 96,
            paddingHorizontal: 16,
          }}
          ListHeaderComponent={
            <View style={{ paddingBottom: 4 }}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Search farmer or ear tag"
                variant="directory"
              />

              <RequestWorkFilterChips
                options={OPEN_REQUEST_FILTERS}
                value={type}
                onChange={setType}
                counts={openRequestCounts}
                countsLoading={areOpenRequestCountsLoading}
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {showAdvancedFilters
                    ? "Filter requests"
                    : "All request types"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAdvancedFilters((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showAdvancedFilters
                      ? "Hide request filters"
                      : "Show request filters"
                  }
                  accessibilityState={{ expanded: showAdvancedFilters }}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: showAdvancedFilters
                      ? colors.primary
                      : colors.border,
                    backgroundColor: showAdvancedFilters
                      ? isDark
                        ? "rgba(16,185,129,0.14)"
                        : colors.tint
                      : colors.card,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <SlidersHorizontal size={17} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 12,
                    }}
                  >
                    Filters
                  </Text>
                </TouchableOpacity>
              </View>

              {showAdvancedFilters ? (
                <View style={{ marginBottom: 12 }}>
                  {/* Sort By Row */}
                  <View style={{ marginTop: 4 }}>
                    <SelectDropdown
                      label="Sort By"
                      options={sortOptions}
                      value={sortBy}
                      highlightSelection={false}
                      onChange={async (val) => {
                        if (val === "distance") {
                          await handleNearMeToggle(true);
                        } else {
                          if (nearLat) {
                            await handleNearMeToggle(false);
                          }
                          setSortBy(val as any);
                        }
                      }}
                    />
                  </View>

                  {/* Location filters (Municipality & Barangay) */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginTop: 12,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <SelectDropdown
                        label="Municipality"
                        options={municipalityOptions}
                        value={municipality}
                        onChange={(value) => {
                          setMunicipality(value);
                          setBarangay("");
                        }}
                        searchable
                        flex={1}
                      />
                    </View>
                    <View
                      style={{
                        flex: 1,
                        minWidth: 0,
                        opacity: municipality ? 1 : 0.5,
                      }}
                      pointerEvents={municipality ? "auto" : "none"}
                    >
                      <SelectDropdown
                        label="Barangay"
                        options={barangayOptions}
                        value={barangay}
                        onChange={setBarangay}
                        searchable
                        flex={1}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {isLoading && !isRefetching ? (
                <AsyncState state="loading" />
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <RequestListCard
              item={item}
              onPress={() => handleActionPress(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            isLoading || isRefetching ? null : (
              <AsyncState
                state="empty"
                title={
                  hasOpenRequestFilters
                    ? "No open requests match this filter."
                    : "No open requests."
                }
                onAction={handleRefresh}
                actionLabel="Refresh"
                style={{ paddingVertical: 32 }}
              />
            )
          }
          ListFooterComponent={
            !isLoading && pagination.totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={pagination.totalPages}
                onPrevious={() => setPage(page - 1)}
                onNext={() => setPage(page + 1)}
              />
            ) : null
          }
          />
        ) : (
          <TechnicianMyWorkPanel />
        )}
      </View>
    </ScreenLayout>
  );
}
