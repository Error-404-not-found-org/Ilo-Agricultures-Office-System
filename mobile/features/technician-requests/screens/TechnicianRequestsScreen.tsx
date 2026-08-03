import React, { useRef, useState, useEffect } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { safeBack } from "@/utils/navigation";
import {
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner-native";
import { Text } from "@/components/ui/Text";
import { ScreenLayout } from "@/components/ScreenLayout";
import {
  AppHeaderIconButton,
  AppPageHeader,
} from "@/components/AppPageHeader";
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
import {
  AIRequestModal,
  AIRequestModalView,
} from "../components/AIRequestModal";
import type {
  RequestItem,
  VisitPeriod,
} from "../types/technicianRequests.types";
import {
  getClaimScheduleErrorMessage,
  isCanonicalWorkflowId,
} from "../utils/aiWorkflow";
import { technicianKeys } from "@/lib/queryKeys";
import {
  SearchBar,
  FilterChips,
  AsyncState,
  Pagination,
  SelectDropdown,
} from "@/components/shared";

const NEAR_ME_PREFERENCE_KEY = "technician_request_board_near_me";

type TechnicianRequestsScreenProps = {
  showBackButton?: boolean;
};

export default function TechnicianRequestsScreen({
  showBackButton = true,
}: TechnicianRequestsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();
  const scheduleSubmissionRef = useRef(false);

  const {
    search,
    setSearch,
    type,
    setType,
    assignment,
    setAssignment,
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
    isLoading,
    isRefetching,
    handleRefresh,
    handleDeclineForMe,
    handleClaimRequest,
    handleClaimAndSchedule,
    isClaimingAndScheduling,
    isUpdating,
  } = useTechnicianRequests();

  const [aiModal, setAIModal] = useState<{
    request: RequestItem;
    view: AIRequestModalView;
  } | null>(null);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filter option arrays
  const typeOptions = [
    { label: "All", value: "all" },
    { label: "AI Service", value: "ai" },
    { label: "Health", value: "health" },
    { label: "Pregnancy Check", value: "breeding_verification" },
  ];


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

  const openAIRequest = (item: RequestItem, view: AIRequestModalView) => {
    if (!isCanonicalWorkflowId(item.workflowId)) {
      toast.error("This AI request is missing its workflow identifier.");
      return;
    }
    setAIModal({ request: item, view });
  };

  const handleActionPress = (item: RequestItem | any) => {
    if (item.workflowType === "AI" || item.type === "ai") {
      if (item.workflowType !== "AI") {
        toast.error("This AI request is missing its canonical workflow contract.");
        return;
      }
      if (item.allowedAction === "CLAIM_AND_SCHEDULE") {
        openAIRequest(item, "details");
      } else if (item.allowedAction === "VIEW_RECORD") {
        router.push({
          pathname: "/(technician)/request-details",
          params: { id: item.workflowId, type: "ai", viewOnly: "true" },
        });
      } else if (item.allowedAction === "RECORD_SERVICE") {
        toast.error("Open this scheduled service from My Work.");
      } else if (item.allowedAction === "SCHEDULE_VISIT") {
        router.push({
          pathname: "/(technician)/request-details",
          params: { id: item.workflowId, type: "ai" },
        });
      } else {
        toast.error("This AI request has no available action.");
      }
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

  const handleDeclineRequest = async (item: any) => {
    if (item.type === "breeding_verification" || item.type === "task") {
      handleActionPress(item);
      return;
    }

    try {
      await handleDeclineForMe(item.id, item.type, "Declined by technician.");
      toast.success("Request hidden from your queue");
    } catch (err: any) {
      toast.error(err.message || "Failed to decline request");
    }
  };

  const handleAcceptRequest = async (item: RequestItem) => {
    if (item.workflowType === "AI" || item.type === "ai") {
      if (item.workflowType !== "AI") {
        toast.error("This AI request is missing its canonical workflow contract.");
        return;
      }
      if (item.allowedAction === "CLAIM_AND_SCHEDULE") {
        openAIRequest(item, "schedule");
      } else {
        handleActionPress(item);
      }
      return;
    }

    const currentStatus = item.status.toLowerCase();

    // Check if the request is unassigned / pending
    const isUnassigned =
      currentStatus === "pending" &&
      (!item.assignedTechnician || item.assignedTechnician === "");

    if (isUnassigned) {
      try {
        await handleClaimRequest(item.id, item.type);
        toast.success("Request claimed successfully");
      } catch (err: any) {
        toast.error(err.message || "Failed to claim request");
      }
      return;
    }

    if (item.type === "breeding_verification") {
      handleActionPress(item);
      return;
    }

    if (currentStatus === "scheduled") {
      handleActionPress(item);
      return;
    }

    // Scheduling and completion require their full forms and confirmations.
    handleActionPress(item);
  };

  const handleConfirmAISchedule = async (
    workflowId: string,
    payload: { scheduledDate: string; visitPeriod: VisitPeriod },
  ) => {
    if (scheduleSubmissionRef.current) return;
    if (!isCanonicalWorkflowId(workflowId)) {
      toast.error("This AI request has an invalid workflow identifier.");
      return;
    }
    scheduleSubmissionRef.current = true;
    try {
      await handleClaimAndSchedule(workflowId, payload);
      setAIModal(null);
      toast.success("Visit scheduled successfully.");
    } catch (error: any) {
      toast.error(getClaimScheduleErrorMessage(error));
      if (error?.response?.status === 409) {
        await handleRefresh();
        await queryClient.invalidateQueries({
          queryKey: technicianKeys.workQueue(),
        });
      }
    } finally {
      scheduleSubmissionRef.current = false;
    }
  };

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

      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Requests Board List */}
        <FlatList
          style={{ flex: 1 }}
          data={isLoading && !isRefetching ? [] : requests}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: showBackButton ? 24 : insets.bottom + 96,
          }}
          ListHeaderComponent={
            <View style={{ paddingBottom: 4 }}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Search farmer or ear tag"
                variant="directory"
              />

              {/* Segmented Control for Assignment Filter */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
                  borderRadius: 12,
                  padding: 4,
                  marginBottom: 12,
                  marginTop: 10,
                }}
              >
                <TouchableOpacity
                  onPress={() => setAssignment("unassigned")}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor:
                      assignment === "unassigned"
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
                        assignment === "unassigned"
                          ? colors.primary
                          : isDark
                            ? "#94a3b8"
                            : "#64748b",
                      fontSize: 13,
                    }}
                  >
                    Open Requests
                    {assignment === "unassigned" && pagination.total > 0
                      ? `  ${pagination.total}`
                      : ""}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    router.push("/(technician)/technician.tasks" as any)
                  }
                  style={{
                    flex: 1,
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor:
                      "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color:
                        isDark ? "#94a3b8" : "#64748b",
                      fontSize: 13,
                    }}
                  >
                    My Work
                  </Text>
                </TouchableOpacity>
              </View>

              <FilterChips
                options={typeOptions}
                value={type}
                onChange={(val) => setType(val as any)}
                containerStyle={{ paddingHorizontal: 0, marginBottom: 8 }}
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
                  {showAdvancedFilters ? "Filter requests" : "All request types"}
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
                    borderColor: showAdvancedFilters ? colors.primary : colors.border,
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

              {isLoading && !isRefetching ? <AsyncState state="loading" /> : null}
            </View>
          }
          renderItem={({ item }) => (
            <RequestListCard
              item={item}
              isUpdating={isUpdating}
              onAccept={() => handleAcceptRequest(item)}
              onDecline={() => handleDeclineRequest(item)}
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
                  assignment === "unassigned"
                    ? "No open requests"
                    : "No claimed requests yet"
                }
                message={
                  assignment === "unassigned"
                    ? "New farmer service requests will appear here."
                    : "Requests you claim or accept will appear in My Work."
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
      </View>
      <AIRequestModal
        request={aiModal?.request || null}
        initialView={aiModal?.view || "details"}
        visible={Boolean(aiModal)}
        isSubmitting={isClaimingAndScheduling}
        onClose={() => setAIModal(null)}
        onConfirm={handleConfirmAISchedule}
      />
    </ScreenLayout>
  );
}
