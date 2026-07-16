import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { Text } from "@/components/ui/Text";
import { ScreenLayout } from "@/components/ScreenLayout";
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

export default function TechnicianRequestsScreen() {
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
    { label: "All Types", value: "all" },
    { label: "AI Service", value: "ai" },
    { label: "Health Assistance", value: "health" },
    { label: "Pregnancy Verification", value: "breeding_verification" },
  ];

  const statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Claimed — Awaiting Schedule", value: "approved" },
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
      {/* Premium Header Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: isDark ? colors.card : "#fff",
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingTop: insets.top + 14,
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginRight: 12,
            padding: 8,
            backgroundColor: isDark ? "#1e293b" : "#f8fafc",
            borderRadius: 999,
          }}
        >
          <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e293b"} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            variant="black"
            size={20}
            style={{ color: colors.textPrimary, fontFamily: "Outfit_900Black" }}
          >
            Requests Board
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_500Medium",
              fontSize: 11,
              color: colors.textSecondary,
              marginTop: 1,
            }}
          >
            Claim and manage farmer-submitted service requests
          </Text>
        </View>
      </View>

      {/* Main Content Feed */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        {/* Search Input */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by farmer name or ear tag..."
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
            marginTop: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => setAssignment("unassigned")}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: "center",
              borderRadius: 8,
              backgroundColor:
                assignment === "unassigned"
                  ? isDark
                    ? "#1e293b"
                    : "#fff"
                  : "transparent",
              shadowColor: assignment === "unassigned" ? "#000" : "transparent",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: assignment === "unassigned" ? 1 : 0,
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
              Available Requests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAssignment("mine")}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: "center",
              borderRadius: 8,
              backgroundColor:
                assignment === "mine"
                  ? isDark
                    ? "#1e293b"
                    : "#fff"
                  : "transparent",
              shadowColor: assignment === "mine" ? "#000" : "transparent",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: assignment === "mine" ? 1 : 0,
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
              My Claimed Requests
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chip Bars Scroll Containers */}
        <View style={{ marginBottom: 12, marginTop: -4 }}>
          {/* Scrollable Filter Chips row 1: Type */}
          <FilterChips
            options={typeOptions}
            value={type}
            onChange={(val) => setType(val as any)}
            containerStyle={{ paddingHorizontal: 0 }}
          />

          {/* Dropdown row for advanced filters (Status, Urgency) */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <SelectDropdown
              label="Status"
              options={statusOptions}
              value={status}
              onChange={(val) => setStatus(val as any)}
            />
            <SelectDropdown
              label="Urgency"
              options={urgencyOptions}
              value={urgency}
              onChange={(val) => setUrgency(val as any)}
            />
          </View>

          {/* Sort & Near Me Row */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 8,
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
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

            <TouchableOpacity
              onPress={() => handleNearMeToggle(!nearLat)}
              disabled={locationLoading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: nearLat
                  ? colors.primary
                  : isDark
                    ? "rgba(255,255,255,0.05)"
                    : "#f3f4f6",
                borderWidth: 1,
                borderColor: nearLat ? colors.primary : colors.border,
                paddingHorizontal: 12,
                borderRadius: 12,
                height: 42,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: nearLat ? "#fff" : colors.textPrimary,
                  fontSize: 12,
                }}
              >
                {locationLoading
                  ? "Acquiring..."
                  : nearLat
                    ? "Near Me: ON"
                    : "Near Me"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Iloilo location filters */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 8,
              marginBottom: 12,
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
              />
            </View>
          </View>
        </View>

        {/* Requests Board List */}
        {isLoading && !isRefetching ? (
          <AsyncState state="loading" />
        ) : hasEmptyState ? (
          <AsyncState
            state="empty"
            title="No Requests Found"
            message="No service requests match your selected query filters."
            onAction={handleRefresh}
            actionLabel="Refresh Board"
          />
        ) : (
          <FlatList
            style={{ marginTop: 24 }}
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RequestListCard
                item={item}
                isUpdating={isUpdating}
                onAccept={() => handleAcceptRequest(item)}
                onDecline={() => handleDeclineRequest(item)}
                onPress={() => handleActionPress(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListFooterComponent={
              <Pagination
                page={page}
                totalPages={pagination.totalPages}
                onPrevious={() => setPage(page - 1)}
                onNext={() => setPage(page + 1)}
              />
            }
          />
        )}
      </View>
    </ScreenLayout>
  );
}
