import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
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
  const api = useApi();

  // Queries dbUser profile info
  const { data: dbUser } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await api.get("/user/me");
      return response.data || {};
    },
  });

  const {
    search,
    setSearch,
    type,
    setType,
    status,
    setStatus,
    urgency,
    setUrgency,
    assignment,
    setAssignment,
    page,
    setPage,
    nearLat,
    setNearLat,
    nearLng,
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
    handleUpdateStatus,
    handleDeclineForMe,
    handleClaimRequest,
    isUpdating,
  } = useTechnicianRequests();

  // Modal Action State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [advice, setAdvice] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState("");
  const [estrus, setEstrus] = useState("Natural");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const selectedItemTechId =
    selectedItem?.raw?.approvedBy?._id ||
    selectedItem?.raw?.approvedBy ||
    selectedItem?.raw?.handledBy?._id ||
    selectedItem?.raw?.handledBy ||
    null;

  const selectedItemTechName =
    selectedItem?.raw?.approvedBy?.name ||
    selectedItem?.raw?.handledBy?.name ||
    (selectedItemTechId ? "another technician" : null);

  const isSelectedAssignedToOther =
    selectedItemTechId &&
    dbUser?._id &&
    String(selectedItemTechId) !== String(dbUser._id);

  const isReadOnly =
    isSelectedAssignedToOther ||
    ["done", "resolved", "completed"].includes(
      selectedItem?.status?.toLowerCase(),
    );

  // Filter option arrays
  const typeOptions = [
    { label: "All", value: "all" },
    { label: "AI Service", value: "ai" },
    { label: "Health", value: "health" },
    { label: "Pregnancy Check", value: "breeding_verification" },
  ];

  const statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Claimed, Awaiting Schedule", value: "approved" },
    { label: "Scheduled", value: "scheduled" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
    { label: "Declined", value: "declined" },
  ];

  const assignmentOptions = [
    { label: "All Assignments", value: "all" },
    { label: "My Claimed Requests", value: "mine" },
    { label: "Available Requests", value: "unassigned" },
  ];

  const urgencyOptions = [
    { label: "All Urgency", value: "all" },
    { label: "Urgent Only", value: "urgent" },
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

  const [locationLoading, setLocationLoading] = useState(false);

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

  const handleActionPress = (item: any) => {
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

  const getAdditionalNotesOnly = (fullComment: string) => {
    if (!fullComment) return "";
    const parts = fullComment.split("Additional Notes:\n");
    if (parts.length > 1) {
      return parts[1].trim();
    }
    return fullComment;
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

  const handleAcceptRequest = async (item: any) => {
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

    let nextStatus = "";
    if (currentStatus === "scheduled") {
      nextStatus = "in-progress"; // Start
    } else {
      // For approved (Schedule) or in-progress (Complete/Resolve), open modal
      handleActionPress(item);
      return;
    }

    try {
      await handleUpdateStatus(item.id, item.type, nextStatus, {
        status: nextStatus,
        technicianNote: `Started by technician ${dbUser?.name || ""}.`,
      });
      toast.success("Request started");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedItem) return;

    let nextStatus = "";
    const currentStatus = selectedItem.status?.toLowerCase();
    const isAI =
      selectedItem.type === "insemination" || selectedItem.type === "ai";

    if (currentStatus === "pending") {
      nextStatus = "approved"; // Assign to Me
    } else if (
      currentStatus === "approved" ||
      currentStatus === "assigned" ||
      currentStatus === "triaged"
    ) {
      nextStatus = "scheduled"; // Schedule Visit
    } else if (currentStatus === "scheduled") {
      nextStatus = "in-progress"; // Start Service
    } else if (
      currentStatus === "in-progress" ||
      currentStatus === "in_progress"
    ) {
      nextStatus = isAI ? "done" : "resolved"; // Complete / Resolve
    } else {
      return;
    }

    // Validate completing AI
    if (isAI && nextStatus === "done") {
      if (!sireBreed || !sireBreed.trim()) {
        toast.error("Please select a Sire Breed.");
        return;
      }
      if (!sireCode || !sireCode.trim()) {
        toast.error("Please provide a Sire Code.");
        return;
      }
      if (!estrus || !estrus.trim()) {
        toast.error("Please select an Estrus Type.");
        return;
      }
      if (!note || !note.trim()) {
        toast.error("Please add technician notes.");
        return;
      }
    }

    // Validate resolving health check
    if (selectedItem.type === "health" && nextStatus === "resolved") {
      if (!diagnosis || !diagnosis.trim()) {
        toast.error("Please enter a diagnosis / findings.");
        return;
      }
      if (!treatment || !treatment.trim()) {
        toast.error(
          "Please log treatment or medicine given (include dosage if medicine is given).",
        );
        return;
      }
      if (!advice || !advice.trim()) {
        toast.error("Please enter advice or resolution notes.");
        return;
      }
    }

    try {
      const payload: any = {
        status: nextStatus,
        technicianNote:
          note ||
          `${nextStatus === "approved" ? "Assigned" : nextStatus === "scheduled" ? "Scheduled" : nextStatus === "in-progress" ? "Started" : "Completed"} by technician.`,
      };

      if (nextStatus === "scheduled") {
        payload.scheduledDate = scheduledDate.toISOString();
      }

      if (nextStatus === "done") {
        payload.sireBreed = sireBreed;
        payload.sireCode = sireCode;
        payload.estrus = estrus;
      }

      if (nextStatus === "resolved") {
        payload.diagnosis = diagnosis;
        payload.treatment = treatment;
        payload.advice = advice;
      }

      await handleUpdateStatus(
        selectedItem.id,
        selectedItem.type,
        nextStatus,
        payload,
      );
      toast.success("Request updated successfully");
      setModalVisible(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update request");
    }
  };

  const hasEmptyState = !isLoading && requests.length === 0;

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader
        title="Requests"
        showBackButton={showBackButton}
        variant={showBackButton ? "detail" : "top-level"}
        rightAction={
          <AppHeaderIconButton
            onPress={() =>
              router.push(
                (showBackButton
                  ? "/(technician)/technician.calendar"
                  : "/(technician)/(tabs)/technician.calendar") as any,
              )
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
                  onPress={() => setAssignment("mine")}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 8,
                    backgroundColor:
                      assignment === "mine"
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
                        assignment === "mine"
                          ? colors.primary
                          : isDark
                            ? "#94a3b8"
                            : "#64748b",
                      fontSize: 13,
                    }}
                  >
                    My Work
                    {assignment === "mine" && pagination.total > 0
                      ? `  ${pagination.total}`
                      : ""}
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
    </ScreenLayout>
  );
}
