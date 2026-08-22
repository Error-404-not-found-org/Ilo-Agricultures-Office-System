import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Syringe,
  Stethoscope,
  Clock,
  Trash2,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { ScreenLayout } from "@/components/ScreenLayout";
import { FarmerRequestHeader } from "@/features/farmer-requests/components/FarmerRequestHeader";
import {
  formatVisitSchedule,
  getRequestText,
  getFarmerRequestListStatusLabel,
  mapFarmerRequestFilterStatus,
} from "@/features/farmer-requests/utils/requestDetailPresentation";

type MyRequestsProps = {
  showBackButton?: boolean;
};

export default function MyRequests({ showBackButton = true }: MyRequestsProps) {
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : "#00643B";

  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("all");
  const [allRequests, setAllRequests] = React.useState<any[]>([]);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [deleteInfo, setDeleteInfo] = React.useState<{
    id: string;
    type: string;
    animalTag: string;
    isCancel: boolean;
    isScheduled: boolean;
  } | null>(null);
  const [reasonModalVisible, setReasonModalVisible] = React.useState(false);
  const [cancellationReason, setCancellationReason] = React.useState("");
  const [pendingCancelInfo, setPendingCancelInfo] = React.useState<{
    id: string;
    type: string;
    animalTag: string;
  } | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = React.useState(false);

  const {
    data: aiData,
    isLoading: loadingAi,
    isRefetching: refetchingAi,
    refetch: refetchAi,
  } = useQuery({
    queryKey: ["farmer", "ai-requests", page, status],
    queryFn: async () => {
      const aiStatus = mapFarmerRequestFilterStatus("ai", status);
      const res = await api.get(
        `/ai-request/my?page=${page}&limit=10&status=${aiStatus}`,
      );
      return res.data;
    },
  });

  const {
    data: healthData,
    isLoading: loadingHealth,
    isRefetching: refetchingHealth,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["farmer", "health-requests", page, status],
    queryFn: async () => {
      const healthStatus = mapFarmerRequestFilterStatus("health", status);

      const res = await api.get(
        `/health-request/my?page=${page}&limit=10&status=${healthStatus}`,
      );
      return res.data;
    },
  });

  React.useEffect(() => {
    if (aiData?.data || healthData?.data) {
      const aiItems = (aiData?.data || []).map((r: any) => ({
        ...r,
        type: "ai",
      }));
      const healthItems = (healthData?.data || []).map((r: any) => ({
        ...r,
        type: "health",
      }));

      const combined = [...aiItems, ...healthItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      if (page === 1) {
        setAllRequests(combined);
      } else {
        setAllRequests((prev) => {
          const existingIds = new Set(prev.map((p) => `${p.type}-${p._id}`));
          const uniqueNew = combined.filter(
            (c) => !existingIds.has(`${c.type}-${c._id}`),
          );
          return [...prev, ...uniqueNew].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
      }
    }
  }, [aiData, healthData, page, status]);

  const isLoading = (loadingAi && page === 1) || (loadingHealth && page === 1);
  const isRefetching = refetchingAi || refetchingHealth;

  const hasMore =
    aiData?.page < aiData?.pages || healthData?.page < healthData?.pages;

  const onRefresh = () => {
    setPage(1);
    refetchAi();
    refetchHealth();
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
    setAllRequests([]);
  };

  const loadMore = () => {
    if (hasMore && !isLoading && !isRefetching) {
      setPage((prev) => prev + 1);
    }
  };

  const STATUS_FILTERS = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Scheduled", value: "scheduled" },
    { label: "In Progress", value: "in-progress" },
    { label: "Completed", value: "completed" },
    { label: "Pending Cancellation", value: "pending_cancellation" },
  ];

  const handleDelete = (
    id: string,
    type: string,
    animalTag: string,
    isCancel: boolean,
    isScheduled: boolean,
  ) => {
    setDeleteInfo({ id, type, animalTag, isCancel, isScheduled });
    if (isCancel && isScheduled) {
      // Scheduled cancellation requires a reason — show reason modal
      setPendingCancelInfo({ id, type, animalTag });
      setCancellationReason("");
      setReasonModalVisible(true);
    } else {
      setModalVisible(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteInfo) return;
    const { id, type, isCancel } = deleteInfo;
    if (isCancel) {
      // Direct cancel (pending/approved)
      const endpoint =
        type === "ai"
          ? `/ai-request/${id}/cancel`
          : `/health-request/${id}/cancel`;
      try {
        await api.patch(endpoint, {});
        toast.success("Request cancelled successfully");
        queryClient.invalidateQueries({ queryKey: ["farmer", "ai-requests"] });
        queryClient.invalidateQueries({
          queryKey: ["farmer", "health-requests"],
        });
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to cancel request");
      }
    } else {
      const endpoint =
        type === "ai"
          ? `/ai-request/${id}/dismiss`
          : `/health-request/${id}/dismiss`;
      try {
        await api.patch(endpoint);
        setAllRequests((current) =>
          current.filter(
            (request) => !(request._id === id && request.type === type),
          ),
        );
        toast.success("Request removed from your history.");
        queryClient.invalidateQueries({ queryKey: ["farmer", "ai-requests"] });
        queryClient.invalidateQueries({
          queryKey: ["farmer", "health-requests"],
        });
      } catch (err: any) {
        toast.error(
          err.response?.data?.message ||
            "Failed to remove the request from your history.",
        );
      }
    }
  };

  const handleConfirmScheduledCancel = async () => {
    if (!pendingCancelInfo) return;
    if (!cancellationReason.trim()) {
      toast.error("Please provide a reason for cancellation.");
      return;
    }
    setIsSubmittingCancel(true);
    const { id, type } = pendingCancelInfo;
    const endpoint =
      type === "ai"
        ? `/ai-request/${id}/cancel`
        : `/health-request/${id}/cancel`;
    try {
      await api.patch(endpoint, { reason: cancellationReason.trim() });
      toast.success(
        "Cancellation request submitted. Awaiting technician review.",
      );
      setReasonModalVisible(false);
      setCancellationReason("");
      setPendingCancelInfo(null);
      queryClient.invalidateQueries({ queryKey: ["farmer", "ai-requests"] });
      queryClient.invalidateQueries({
        queryKey: ["farmer", "health-requests"],
      });
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to submit cancellation request",
      );
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
          text: isDark ? "#fbbf24" : "#92400E",
        };
      case "approved":
      case "assigned":
      case "triaged":
        return {
          bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
          text: isDark ? "#34d399" : "#065F46",
        };
      case "scheduled":
        return {
          bg: isDark ? "rgba(2, 132, 199, 0.15)" : "#E0F2FE",
          text: isDark ? "#38bdf8" : "#0369A1",
        };
      case "in-progress":
      case "in_progress":
        return {
          bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
          text: isDark ? "#60a5fa" : "#1E40AF",
        };
      case "done":
      case "resolved":
      case "completed":
        return {
          bg: isDark ? "rgba(107, 114, 128, 0.15)" : "#F1F5F9",
          text: isDark ? "#9ca3af" : "#475569",
        };
      case "rejected":
      case "cancelled":
        return {
          bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
          text: isDark ? "#f87171" : "#991B1B",
        };
      default:
        return {
          bg: isDark ? "rgba(107, 114, 128, 0.15)" : "#F1F5F9",
          text: isDark ? "#9ca3af" : "#475569",
        };
    }
  };

  const getAdditionalNotesOnly = (fullComment: string) => {
    if (!fullComment) return "";
    const parts = fullComment.split("Additional Notes:\n");
    if (parts.length > 1) {
      return parts[1].trim();
    }
    if (fullComment.includes("Observed Heat Signs:\n")) {
      return "";
    }
    return fullComment;
  };

  return (
    <ScreenLayout>
      <FarmerRequestHeader
        title="Service Requests"
        includeSafeTop={false}
        showBackButton={showBackButton}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 150,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={primaryColor}
          />
        }
      >
        {/* Status Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-8 -mx-1"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => handleStatusChange(f.value)}
              className="px-6 py-2.5 rounded-full mr-3 border"
              style={{
                backgroundColor:
                  status === f.value
                    ? isDark
                      ? colors.primary
                      : "#00643B"
                    : colors.card,
                borderColor:
                  status === f.value
                    ? isDark
                      ? colors.primary
                      : "#00643B"
                    : colors.border,
              }}
            >
              <Text
                className="text-[12px] font-outfit-semibold tracking-widest"
                style={{
                  color: status === f.value ? "#fff" : colors.textSecondary,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text
          className="text-sm font-black uppercase tracking-widest mb-4"
          style={{ color: colors.textPrimary }}
        >
          Service Request Activity
        </Text>

        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : allRequests.length > 0 ? (
          allRequests.map((req: any) => {
            const isHealth = req.type === "health";
            const isPendingCancellation =
              req.cancellationStatus === "requested";
            const displayedStatus = isPendingCancellation
              ? "pending_cancellation"
              : req.status;
            const statusStyle = getStatusColor(displayedStatus);
            const canCancelDirectly =
              ["pending", "approved"].includes(req.status) &&
              !isPendingCancellation;
            const canRequestCancellation =
              req.status === "scheduled" && !isPendingCancellation;
            const canRemove = ["rejected", "cancelled"].includes(req.status);
            const canDelete =
              canCancelDirectly || canRequestCancellation || canRemove;
            const scheduledVisit = formatVisitSchedule(
              req.scheduledDate,
              req.visitPeriod,
            );
            const legacyPreferredDate = formatVisitSchedule(
              req.preferredDate,
              null,
            );
            const requestStatusLabel =
              getFarmerRequestListStatusLabel(displayedStatus);
            const animalImage = getRequestText(req.animalId?.imageUrl);
            const animalIdentity = getRequestText(
              req.animalId?.earTag || req.animalId?.animalId,
            );
            const animalBreed = getRequestText(req.animalId?.breed);
            const hasAnimalSummary = Boolean(
              animalImage || animalIdentity || animalBreed,
            );
            const attemptNumber = Number.isFinite(req.attemptNumber)
              ? req.attemptNumber
              : null;
            const isResolvedHealth =
              isHealth &&
              ["resolved", "done", "completed"].includes(req.status);
            const healthRequestTitle =
              isResolvedHealth && req.handlingMethod === "advice"
                ? "Health Advice"
                : isResolvedHealth && req.handlingMethod === "office_pickup"
                  ? "Office Pickup"
                  : "Health Request";
            const healthSymptoms = Array.isArray(req.symptoms)
              ? req.symptoms.map(getRequestText).filter(Boolean).join(", ")
              : getRequestText(req.symptoms || req.comment || req.reason);
            const farmerNotes = getRequestText(req.farmerNotes);
            const assignedTechnician = getRequestText(
              req.approvedBy?.name ||
                req.handledBy?.name ||
                req.technicianId?.name,
            );
            // Filter for pending_cancellation tab
            if (status === "pending_cancellation" && !isPendingCancellation)
              return null;
            if (
              status === "in-progress" &&
              !["in-progress", "in_progress"].includes(req.status)
            ) {
              return null;
            }

            return (
              <View
                key={`${req.type}-${req._id}`}
                className="rounded-[32px] p-5 mb-5 border shadow-sm"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-10 h-10 rounded-2xl items-center justify-center ${isHealth ? "bg-orange-50 dark:bg-orange-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}
                    >
                      {isHealth ? (
                        <Stethoscope
                          size={20}
                          color={isDark ? "#f97316" : "#9A3412"}
                        />
                      ) : (
                        <Syringe
                          size={20}
                          color={isDark ? colors.primary : "#00643B"}
                        />
                      )}
                    </View>
                    <View>
                      <Text
                        className="text-[15px] font-black"
                        style={{ color: colors.textPrimary }}
                      >
                        {isHealth ? healthRequestTitle : "AI Insemination"}
                      </Text>
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: colors.textMuted }}
                      >
                        {format(new Date(req.createdAt), "MMM d, yyyy")}
                      </Text>
                    </View>
                  </View>

                  <View
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: statusStyle.bg }}
                  >
                    <Text
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: statusStyle.text }}
                    >
                      {requestStatusLabel}
                    </Text>
                  </View>
                </View>

                {/* Animal Info */}
                {hasAnimalSummary ? (
                  <View
                    className="p-4 rounded-2xl flex-row items-center justify-between mb-4"
                    style={{
                      backgroundColor: isDark ? colors.background : "#f8fafc",
                    }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center border"
                        style={{
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        }}
                      >
                        {animalImage ? (
                          <Image
                            source={{ uri: animalImage }}
                            className="w-8 h-8 rounded-lg"
                          />
                        ) : isHealth ? (
                          <Stethoscope size={18} color={colors.textMuted} />
                        ) : (
                          <Syringe size={18} color={colors.textMuted} />
                        )}
                      </View>
                      <View>
                        <Text
                          className="text-[13px] font-bold"
                          style={{ color: colors.textPrimary }}
                        >
                          {animalIdentity}
                        </Text>
                        {animalBreed ? (
                          <Text
                            className="text-[10px]"
                            style={{ color: colors.textMuted }}
                          >
                            {animalBreed}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {!isHealth && attemptNumber !== null && (
                      <View className="items-end">
                        <Text
                          className="text-[10px] font-bold uppercase"
                          style={{ color: colors.textMuted }}
                        >
                          Attempt
                        </Text>
                        <Text
                          className="text-[12px] font-black"
                          style={{ color: colors.textPrimary }}
                        >
                          #{attemptNumber}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Heat Signs Badges */}
                {!isHealth && req.heatSigns && req.heatSigns.length > 0 ? (
                  <View className="mb-4">
                    <Text
                      className="text-[10px] font-bold uppercase mb-2"
                      style={{ color: colors.textMuted }}
                    >
                      Observed Heat Signs
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {req.heatSigns.map((signId: string) => {
                        const signMap: Record<string, string> = {
                          standing_heat: "Standing Heat 🐮",
                          attempt_mount: "Attempting to Mount",
                          restlessness: "Restlessness / Activity",
                          vocalization: "Vocalization (Bellowing)",
                          flehmen: "Flehmen Response",
                          grouping: "Friendly Grouping",
                          mucus_discharge: "Clear Mucus Discharge 💧",
                          swollen_vulva: "Swollen, Red Vulva",
                          muddy_flanks: "Muddy Flanks / Tailhead",
                          metestrus_bleeding: "Metestrus Bleeding 🩸",
                        };
                        const label = signMap[signId] || signId;
                        const isPrimary = signId === "standing_heat";
                        const isBleeding = signId === "metestrus_bleeding";

                        let badgeBg = isDark
                          ? "rgba(16, 185, 129, 0.15)"
                          : "#ECFDF5";
                        let badgeText = isDark ? "#34d399" : "#065F46";
                        let badgeBorder = isDark
                          ? "rgba(16, 185, 129, 0.2)"
                          : "#d1fae5";

                        if (isPrimary) {
                          badgeBg = isDark
                            ? "rgba(245, 158, 11, 0.15)"
                            : "#FEF3C7";
                          badgeText = isDark ? "#fbbf24" : "#92400E";
                          badgeBorder = isDark
                            ? "rgba(245, 158, 11, 0.2)"
                            : "#FEF3C7";
                        } else if (isBleeding) {
                          badgeBg = isDark
                            ? "rgba(239, 68, 68, 0.15)"
                            : "#FEF2F2";
                          badgeText = isDark ? "#f87171" : "#991B1B";
                          badgeBorder = isDark
                            ? "rgba(239, 68, 68, 0.2)"
                            : "#fecaca";
                        }

                        return (
                          <View
                            key={signId}
                            className="px-3 py-1.5 rounded-xl border"
                            style={{
                              backgroundColor: badgeBg,
                              borderColor: badgeBorder,
                            }}
                          >
                            <Text
                              className="text-[10px] font-black uppercase tracking-wider"
                              style={{ color: badgeText }}
                            >
                              {label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Scheduled Info if scheduledDate is set */}
                {scheduledVisit ? (
                  <View
                    className="flex-row items-center gap-2 mb-4 p-3 rounded-xl border"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(2, 132, 199, 0.1)"
                        : "#e0f2fe",
                      borderColor: isDark ? "transparent" : "#bae6fd",
                    }}
                  >
                    <Clock size={14} color={isDark ? "#38bdf8" : "#0284c7"} />
                    <Text
                      className="text-[12px] font-bold"
                      style={{ color: isDark ? "#7dd3fc" : "#0369a1" }}
                    >
                      Scheduled for {scheduledVisit}
                    </Text>
                  </View>
                ) : legacyPreferredDate ? (
                  <View
                    className="flex-row items-center gap-2 mb-4 p-3 rounded-xl border"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(245, 158, 11, 0.1)"
                        : "#FFFBEB",
                      borderColor: isDark ? "transparent" : "#FEF3C7",
                    }}
                  >
                    <Clock size={14} color={isDark ? "#fbbf24" : "#d97706"} />
                    <Text
                      className="text-[12px] font-bold"
                      style={{ color: isDark ? "#fde68a" : "#b45309" }}
                    >
                      Legacy preferred date: {legacyPreferredDate}
                    </Text>
                  </View>
                ) : null}

                {/* Technician Info */}
                {assignedTechnician ? (
                  <View className="flex-row items-center gap-2 mb-4">
                    <CheckCircle2 size={14} color={primaryColor} />
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.textSecondary }}
                    >
                      Assigned to: {assignedTechnician}
                    </Text>
                  </View>
                ) : null}

                {/* Pending Cancellation Badge */}
                {isPendingCancellation && (
                  <View
                    className="flex-row items-center gap-2 p-3 rounded-xl border mb-4"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(245, 158, 11, 0.1)"
                        : "#FFFBEB",
                      borderColor: isDark
                        ? "rgba(245, 158, 11, 0.3)"
                        : "#FEF3C7",
                    }}
                  >
                    <XCircle size={14} color={isDark ? "#fbbf24" : "#d97706"} />
                    <View className="flex-1">
                      <Text
                        className="text-[11px] font-black uppercase tracking-wider"
                        style={{ color: isDark ? "#fbbf24" : "#92400E" }}
                      >
                        Pending Cancellation
                      </Text>
                      {req.cancellationReason ? (
                        <Text
                          className="text-[10px] mt-0.5"
                          style={{ color: isDark ? "#fde68a" : "#b45309" }}
                        >
                          Reason: {req.cancellationReason}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View
                  className="flex-row gap-3 pt-2 border-t flex-wrap"
                  style={{ borderTopColor: colors.border }}
                >
                  {req.animalId?._id && (
                    <TouchableOpacity
                      onPress={() =>
                        router.push(
                          `/(farmer)/animal-details?id=${req.animalId?._id}`,
                        )
                      }
                      className="flex-row items-center gap-1"
                    >
                      <Text
                        className="text-[11px] font-black uppercase tracking-widest"
                        style={{ color: colors.textMuted }}
                      >
                        Animal Details
                      </Text>
                      <ChevronRight size={12} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}

                  {isHealth ? (
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: "/(farmer)/health-request-detail",
                          params: { id: req._id },
                        })
                      }
                      className="flex-row items-center gap-1 ml-3"
                    >
                      <Text
                        className="text-[11px] font-black uppercase tracking-widest"
                        style={{ color: primaryColor }}
                      >
                        {isResolvedHealth ? "View Response" : "View Request"}
                      </Text>
                      <ChevronRight size={12} color={primaryColor} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: "/(farmer)/ai-request-detail",
                          params: { id: req._id },
                        })
                      }
                      className="flex-row items-center gap-1 ml-3"
                    >
                      <Text
                        className="text-[11px] font-black uppercase tracking-widest"
                        style={{ color: primaryColor }}
                      >
                        View Request
                      </Text>
                      <ChevronRight size={12} color={primaryColor} />
                    </TouchableOpacity>
                  )}

                  <View className="flex-1" />

                  {canDelete && (
                    <TouchableOpacity
                      onPress={() =>
                        handleDelete(
                          req._id,
                          req.type,
                          req.animalId?.earTag ||
                            req.animalId?.animalId ||
                            "this animal",
                          canCancelDirectly || canRequestCancellation,
                          canRequestCancellation,
                        )
                      }
                      className="px-4 py-2 rounded-xl flex-row items-center gap-2"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#fef2f2",
                      }}
                    >
                      {canRequestCancellation ? (
                        <Ban size={14} color={colors.error} />
                      ) : (
                        <Trash2 size={14} color={colors.error} />
                      )}
                      <Text
                        className="text-[11px] font-black"
                        style={{ color: colors.error }}
                      >
                        {canRequestCancellation
                          ? "Request Cancellation"
                          : canCancelDirectly
                            ? "Cancel"
                            : "Remove"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View className="py-20 items-center">
            <AlertCircle size={48} color={colors.textMuted} />
            <Text
              className="mt-4 font-bold"
              style={{ color: colors.textPrimary }}
            >
              No Active Requests
            </Text>
            <Text
              className="mt-2 text-center text-sm"
              style={{ color: colors.textSecondary }}
            >
              Your service requests will appear here once you submit them.
            </Text>
          </View>
        )}

        {hasMore && (
          <TouchableOpacity
            onPress={loadMore}
            disabled={isRefetching}
            className="py-4 items-center rounded-[20px] border mt-2 mb-10"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {isRefetching ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Text
                className="text-[12px] font-black uppercase tracking-widest"
                style={{ color: primaryColor }}
              >
                Load Older Requests
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
      {deleteInfo && (
        <ConfirmationModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onConfirm={handleConfirmDelete}
          title={deleteInfo.isCancel ? "Cancel Request?" : "Remove Request?"}
          message={
            deleteInfo.isCancel
              ? `Are you sure you want to cancel this request for ${deleteInfo.animalTag}? This action cannot be undone.`
              : `Are you sure you want to remove this request from your history?`
          }
          confirmText={deleteInfo.isCancel ? "Yes, Cancel" : "Yes, Remove"}
          cancelText={deleteInfo.isCancel ? "No, Keep it" : "No, Keep it"}
          isDestructive={true}
        />
      )}

      {/* Scheduled Cancellation — Reason Modal */}
      <Modal
        visible={reasonModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReasonModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 24,
                paddingBottom: 40,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text
                  className="text-[16px] font-black"
                  style={{ color: colors.textPrimary }}
                >
                  Request Cancellation
                </Text>
                <TouchableOpacity onPress={() => setReasonModalVisible(false)}>
                  <XCircle size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View
                className="flex-row items-start gap-2 p-3 rounded-xl border mb-4"
                style={{
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.1)"
                    : "#FFFBEB",
                  borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#FEF3C7",
                }}
              >
                <AlertCircle
                  size={14}
                  color={isDark ? "#fbbf24" : "#d97706"}
                  style={{ marginTop: 2 }}
                />
                <Text
                  className="text-[11px] font-bold flex-1"
                  style={{ color: isDark ? "#fde68a" : "#92400E" }}
                >
                  This visit is already scheduled. Your request will be sent to
                  your assigned technician for review. Please contact your
                  assigned technician or the Municipal Agriculture Office if
                  urgent.
                </Text>
              </View>

              <Text
                className="text-[11px] font-black uppercase tracking-widest mb-2"
                style={{ color: colors.textMuted }}
              >
                Reason for Cancellation *
              </Text>
              <TextInput
                value={cancellationReason}
                onChangeText={setCancellationReason}
                placeholder="e.g. Animal is sick, I will be travelling..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: isDark ? colors.background : "#f8fafc",
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
              />

              <TouchableOpacity
                onPress={handleConfirmScheduledCancel}
                disabled={isSubmittingCancel || !cancellationReason.trim()}
                className="mt-4 py-4 rounded-2xl items-center"
                style={{
                  backgroundColor:
                    isSubmittingCancel || !cancellationReason.trim()
                      ? colors.border
                      : colors.error,
                }}
              >
                <Text className="text-[13px] font-black text-white">
                  {isSubmittingCancel
                    ? "Submitting..."
                    : "Submit Cancellation Request"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenLayout>
  );
}
