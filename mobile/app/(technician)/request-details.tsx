import React, { useState, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Linking,
  Modal,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { AppPageHeader } from "@/components/AppPageHeader";
import { StatusBadge } from "@/components/shared";
import { getTechnicianRequestStatusPresentation } from "@/features/technician-requests/utils/requestPresentation";
import { useTheme } from "@/lib/theme";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  FileText,
  Syringe,
  Activity,
  HeartPulse,
  Check,
  X,
  AlertCircle,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { BreedSelectorModal } from "@/features/technician-dashboard/components/BreedSelectorModal";
import { ReproductionNextActionCard } from "@/components/ReproductionNextActionCard";
import {
  getTechnicianAnimalHistory,
  getTechnicianRequestDetail,
  respondToCancellationRequest,
  updateRequestStatus,
} from "@/features/technician/services/technician.service";
import { getEarlyStartMinutes } from "@/features/technician-requests/utils/serviceTiming";
import {
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
  isBreedingObservationAwaitingReview,
} from "@/features/breeding/utils/breedingObservationPresentation";
import { formatLocalCalendarDate } from "@/features/technician-requests/utils/aiWorkflow";
import type { VisitPeriod } from "@/features/technician-requests/types/technicianRequests.types";

function SkeletonBlock({
  width = "100%",
  height,
  borderRadius = 10,
  color,
  style,
}: {
  width?: any;
  height: number;
  borderRadius?: number;
  color: string;
  style?: any;
}) {
  return (
    <View
      style={[{ width, height, borderRadius, backgroundColor: color }, style]}
    />
  );
}

function RequestDetailsSkeleton({
  colors,
  isDark,
  onBack,
}: {
  colors: any;
  isDark: boolean;
  onBack: () => void;
}) {
  const skeletonColor = isDark ? "#1f2937" : "#e8edf3";
  const cardStyle = {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title="Request details" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 40,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={cardStyle}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <SkeletonBlock
              width={48}
              height={48}
              borderRadius={15}
              color={skeletonColor}
            />
            <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
              <SkeletonBlock width="62%" height={17} color={skeletonColor} />
              <SkeletonBlock width="42%" height={12} color={skeletonColor} />
            </View>
            <SkeletonBlock
              width={70}
              height={26}
              borderRadius={13}
              color={skeletonColor}
            />
          </View>
          <View style={{ marginTop: 18, gap: 12 }}>
            {["92%", "78%", "86%"].map((width, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <SkeletonBlock width={82} height={12} color={skeletonColor} />
                <SkeletonBlock
                  width={width}
                  height={12}
                  color={skeletonColor}
                  style={{ maxWidth: 150 }}
                />
              </View>
            ))}
          </View>
        </View>

        {[1, 2, 3].map((item) => (
          <View key={item} style={cardStyle}>
            <SkeletonBlock width="38%" height={16} color={skeletonColor} />
            <View style={{ flexDirection: "row", marginTop: 16 }}>
              <SkeletonBlock
                width={64}
                height={64}
                borderRadius={16}
                color={skeletonColor}
              />
              <View style={{ flex: 1, marginLeft: 12, gap: 9 }}>
                <SkeletonBlock width="72%" height={14} color={skeletonColor} />
                <SkeletonBlock width="88%" height={12} color={skeletonColor} />
                <SkeletonBlock width="55%" height={12} color={skeletonColor} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function RequestDetailsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { id, type, taskId, workflowId } = useLocalSearchParams();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Action input states
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateChoice, setDateChoice] = useState<"today" | "tomorrow" | "custom">("today");
  const [visitPeriod, setVisitPeriod] = useState<VisitPeriod | null>(null);
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Cancellation review states
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [cancelResponding, setCancelResponding] = useState(false);
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const queryClient = useQueryClient();

  const fetchRequestDetails = async (showFullSkeleton = false) => {
    try {
      if (showFullSkeleton) setLoading(true);
      setTimelineLoading(true);
      const isHealth = type === "health";
      const requestData = await getTechnicianRequestDetail(
        api,
        isHealth ? "health" : "ai",
        String(id),
      );
      setRequest(requestData);

      // Prepopulate scheduling or details
      if (requestData.scheduledDate) {
        setScheduledDate(new Date(requestData.scheduledDate));
      }

      if (requestData.visitPeriod) {
        setVisitPeriod(requestData.visitPeriod as VisitPeriod);
      }

      if (requestData.animalId?._id) {
        const historyTimeline = await getTechnicianAnimalHistory(
          api,
          requestData.animalId._id,
        );
        setTimeline(historyTimeline);
      }
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        toast.error("This request is no longer available or assigned to another technician.");
        void queryClient.invalidateQueries();
        router.back();
        return;
      }
      toast.error(err.message || "Failed to fetch request details");
    } finally {
      setLoading(false);
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (id && type) {
      fetchRequestDetails(true);
    }
    // Route identifiers intentionally own the initial details fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type]);

  const handleUpdateStatus = async (nextStatus: string, payload: any) => {
    try {
      const connectivity = await NetInfo.fetch();
      if (!connectivity.isConnected || !connectivity.isInternetReachable) {
        setActionNotice(
          nextStatus === "scheduled"
            ? "Scheduling requires an internet connection."
            : "Updating request status requires an internet connection."
        );
        return false;
      }
      setUpdating(true);
      setActionNotice(null);
      const result = await updateRequestStatus(
        api,
        type === "health" ? "health" : "ai",
        String(id),
        {
          status: nextStatus,
          ...payload,
        },
      );
      if (result?.request) {
        setRequest(result.request);
      }
      toast.success("Status updated successfully");
      void fetchRequestDetails();
      return true;
    } catch (err: any) {
      if (err.response?.status === 409) {
        setActionNotice("This request was claimed by another technician. Refreshing your work list.");
        void queryClient.invalidateQueries();
        setTimeout(() => router.back(), 2000);
        return false;
      }
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to update request status";
      setActionNotice(message);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAge = (birthDate: string) => {
    if (!birthDate) return "N/A";
    const birth = new Date(birthDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - birth.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} days`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} months`;
    const diffYears = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    return remainingMonths > 0
      ? `${diffYears}y ${remainingMonths}m`
      : `${diffYears} years`;
  };

  const getAdditionalNotesOnly = (fullComment: string) => {
    if (!fullComment) return "";
    const parts = fullComment.split("Additional Notes:\n");
    if (parts.length > 1) return parts[1].trim();
    if (fullComment.includes("Observed Heat Signs:\n")) return "";
    return fullComment;
  };

  const isTerminal = [
    "done",
    "resolved",
    "completed",
    "rejected",
    "cancelled",
    "declined",
  ].includes(request?.status?.toLowerCase());

  const isAI =
    type === "ai" || request?.serviceType === "ai" || request?.type === "ai" || request?.sireBreed !== undefined;

  const isReadyToday = (() => {
    if (!request) return false;
    const status = request.status?.toLowerCase();
    if (status !== "scheduled" && status !== "approved") return false;
    if (!request.scheduledDate) return false;

    const offset = 8 * 60 * 60 * 1000;
    const nowLocal = new Date(Date.now() + offset);
    const dateLocal = new Date(
      new Date(request.scheduledDate).getTime() + offset,
    );

    return (
      nowLocal.getUTCFullYear() === dateLocal.getUTCFullYear() &&
      nowLocal.getUTCMonth() === dateLocal.getUTCMonth() &&
      nowLocal.getUTCDate() === dateLocal.getUTCDate()
    );
  })();

  const handleAction = async () => {
    if (!request) return;
    setActionNotice(null);
    const status = request.status?.toLowerCase();

    if (isAI) {
      const destination = ["scheduled", "in-progress", "in_progress"].includes(
        status,
      )
        ? "/(technician)/(tabs)/technician.requests?section=myWork"
        : "/(technician)/(tabs)/technician.requests";
      toast.error(
        ["scheduled", "in-progress", "in_progress"].includes(status)
          ? "Open My Work to use the current AI action."
          : "Open Requests to use Claim & Set Visit.",
      );
      router.replace(destination as any);
      return;
    }

    if (status === "pending") {
      // Assign to Me
      await handleUpdateStatus("approved", {
        technicianNote: "Assigned to technician.",
      });
    } else if (
      status === "approved" ||
      status === "assigned" ||
      status === "triaged"
    ) {
      if (!visitPeriod) {
        toast.error("Please select Morning or Afternoon for the visit.");
        return;
      }
      // Schedule Visit
      await handleUpdateStatus("scheduled", {
        scheduledDate: formatLocalCalendarDate(scheduledDate),
        visitPeriod,
        technicianNote: "Scheduled visit.",
      });
    } else if (status === "scheduled" || status === "in-progress" || status === "in_progress") {
      // Navigate to the dedicated canonical form
      if (isAI) {
        router.push({
          pathname: "/(technician)/record-ai",
          params: {
            mode: "request-linked",
            requestId: request._id,
            ...(request.workflowId || workflowId ? { workflowId: request.workflowId || workflowId } : {}),
            ...(request.taskId || taskId ? { taskId: request.taskId?._id || request.taskId || taskId } : {}),
            farmerId: request.farmerId?._id || request.farmerId,
            farmerName: request.farmerId?.name || undefined,
            animalId: request.animalId?._id || request.animalId,
            animalName: request.animalId?.name || undefined,
            earTag: request.animalId?.earTag || undefined,
            scheduleDate: request.scheduledDate || undefined,
          },
        });
      } else {
        router.push({
          pathname: "/(technician)/health-log",
          params: {
            source: "task",
            requestId: request._id,
            healthRequestId: request._id,
            ...(request.workflowId || workflowId ? { workflowId: request.workflowId || workflowId } : {}),
            ...(request.taskId || taskId ? { taskId: request.taskId?._id || request.taskId || taskId } : {}),
            farmerId: request.farmerId?._id || request.farmerId,
            animalId: request.animalId?._id || request.animalId,
            scheduleDate: request.scheduledDate || undefined,
            visitPeriod: request.visitPeriod || undefined,
          },
        });
      }
    }
  };

  const handleRespondCancellation = async (
    approved: boolean,
    customReason?: string,
  ) => {
    try {
      setCancelResponding(true);
      const payload = {
        approved,
        reason:
          customReason ||
          note ||
          (approved ? "Approved by technician." : "Declined by technician."),
      };

      await respondToCancellationRequest(
        api,
        type === "health" ? "health" : "ai",
        String(id),
        payload,
      );
      toast.success(
        approved ? "Cancellation approved" : "Cancellation request rejected",
      );
      setNote("");
      setRescheduleMode(false);
      fetchRequestDetails();
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error("This request was claimed by another technician. Refreshing your work list.");
        void queryClient.invalidateQueries();
        router.back();
        return;
      }
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to respond to cancellation request",
      );
    } finally {
      setCancelResponding(false);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!visitPeriod) {
      toast.error("Please select Morning or Afternoon for the rescheduled visit.");
      return;
    }
    try {
      const connectivity = await NetInfo.fetch();
      if (!connectivity.isConnected || !connectivity.isInternetReachable) {
        toast.error("Scheduling requires an internet connection.");
        return;
      }
      setCancelResponding(true);
      // Step 1: Reject the cancellation request with a reschedule note
      await respondToCancellationRequest(
        api,
        type === "health" ? "health" : "ai",
        String(id),
        {
          approved: false,
          reason: "Rescheduled by technician",
        },
      );

      // Step 2: Set status back to scheduled with new date
      await updateRequestStatus(
        api,
        type === "health" ? "health" : "ai",
        String(id),
        {
          status: "scheduled",
          scheduledDate: formatLocalCalendarDate(scheduledDate),
          visitPeriod,
          technicianNote: note || "Rescheduled by technician.",
        },
      );

      toast.success("Request rescheduled successfully");
      setRescheduleMode(false);
      setNote("");
      fetchRequestDetails();
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error("This request was claimed by another technician. Refreshing your work list.");
        void queryClient.invalidateQueries();
        router.back();
        return;
      }
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to reschedule request",
      );
    } finally {
      setCancelResponding(false);
    }
  };

  const handleTechnicianDecline = async () => {
    if (!declineReason.trim()) {
      toast.error("Please provide a reason for declining this request.");
      return;
    }

    try {
      setUpdating(true);
      const endpoint =
        type === "health"
          ? `/health-request/${id}/cancel`
          : `/ai-request/${id}/cancel`;
      await api.patch(endpoint, { reason: declineReason.trim() });
      toast.success("Request declined and farmer notified");
      setDeclineReason("");
      setDeclineModalVisible(false);
      router.back();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to decline request",
      );
    } finally {
      setUpdating(false);
    }
  };

  const getTimelineIcon = (iconType: string) => {
    switch (iconType) {
      case "Syringe":
        return <Syringe size={16} color={colors.primary} />;
      case "HeartPulse":
        return <HeartPulse size={16} color="#ec4899" />;
      case "CheckCircle2":
        return (
          <MaterialCommunityIcons
            name="check-circle"
            size={18}
            color="#10b981"
          />
        );
      case "FileText":
        return <FileText size={16} color={colors.textMuted} />;
      default:
        return <Activity size={16} color={colors.textSecondary} />;
    }
  };

  if (loading) {
    return (
      <RequestDetailsSkeleton
        colors={colors}
        isDark={isDark}
        onBack={() => router.back()}
      />
    );
  }

  if (!request) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text
          style={{ color: colors.error, textAlign: "center", marginBottom: 16 }}
          variant="bold"
          size={16}
        >
          Request Details not found.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#fff" }} variant="bold">
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const animal = request.animalId;
  const farmer = request.farmerId;
  const technician = request.approvedBy || request.handledBy;
  const formatServiceType = (value?: string) => {
    if (!value) return isAI ? "Artificial Insemination" : "Health Assistance";
    return value
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };
  const serviceTypeLabel = formatServiceType(
    request.serviceType || request.requestType,
  );
  const normalizedStatus = request.status?.toLowerCase() || "";
  const statusPresentation = getTechnicianRequestStatusPresentation(request);
  const primaryActionLabel = normalizedStatus === "pending"
    ? "Claim request"
    : ["approved", "assigned", "triaged"].includes(normalizedStatus)
      ? "Schedule visit"
      : ["scheduled", "in-progress", "in_progress"].includes(normalizedStatus)
        ? isAI ? "Record AI Service" : "Record Health Assistance"
        : isAI ? "Complete AI service" : "Resolve health request";
  const nextActionDescription = normalizedStatus === "pending"
    ? "Claim this request to unlock the farmer's full contact and farm directions."
    : ["approved", "assigned", "triaged"].includes(normalizedStatus)
      ? "Confirm a visit date and time before notifying the farmer."
      : ["scheduled", "in-progress", "in_progress"].includes(normalizedStatus)
        ? "Navigate to the dedicated canonical form to record this service."
        : "Record the work completed so it becomes part of the animal's history.";
  const sectionCardStyle = {
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <AppPageHeader title="Request details" />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 60,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Request Summary Section */}
        <View style={sectionCardStyle}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                backgroundColor: isAI
                  ? isDark
                    ? "rgba(16,185,129,0.12)"
                    : "#ecfdf5"
                  : isDark
                    ? "rgba(245,158,11,0.12)"
                    : "#fffbeb",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isAI ? (
                <Syringe size={22} color={colors.primary} />
              ) : (
                <HeartPulse size={22} color={isDark ? "#fbbf24" : "#d97706"} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
              <Text
                style={{
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 18,
                  color: colors.textPrimary,
                }}
              >
                {serviceTypeLabel}
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  color: colors.textMuted,
                  marginTop: 2,
                }}
              >
                Submitted {formatDate(request.createdAt)}
              </Text>
            </View>
            <StatusBadge
              label={
                statusPresentation?.label || formatServiceType(request.status)
              }
              variant={statusPresentation?.variant || request.status}
              domain="request"
              compact
            />
          </View>

          <View
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "#f8fafc",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.06)" : "#eef2f7",
              padding: 14,
              gap: 11,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <Text style={{ color: colors.textMuted }} variant="medium">
                Priority
              </Text>
              <Text
                style={{
                  color:
                    request.urgency === "urgent"
                      ? colors.error
                      : colors.textPrimary,
                }}
                variant="bold"
              >
                {formatServiceType(
                  request.urgency || request.priority || "Normal",
                )}
              </Text>
            </View>
            {!isAI && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <Text style={{ color: colors.textMuted }} variant="medium">
                  Service Type
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.textPrimary,
                    flex: 1,
                    textAlign: "right",
                  }}
                  variant="bold"
                >
                  {serviceTypeLabel}
                </Text>
              </View>
            )}
            {!isAI && request.preferredDate && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <Text style={{ color: colors.textMuted }} variant="medium">
                  Preferred Date (Legacy)
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.textPrimary,
                    flex: 1,
                    textAlign: "right",
                  }}
                  variant="bold"
                >
                  {formatDate(request.preferredDate)}
                </Text>
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <Text style={{ color: colors.textMuted }} variant="medium">
                Scheduled Date
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.textPrimary,
                  flex: 1,
                  textAlign: "right",
                }}
                variant="bold"
              >
                {request.scheduledDate
                  ? new Date(request.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + (request.visitPeriod ? ` · ${String(request.visitPeriod).replace(/^./, (c: string) => c.toUpperCase())}` : "")
                  : "Not Scheduled Yet"}
              </Text>
            </View>
            {technician && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <Text style={{ color: colors.textMuted }} variant="medium">
                  Assigned Tech
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    color: colors.textPrimary,
                    flex: 1,
                    textAlign: "right",
                  }}
                  variant="bold"
                >
                  {technician.name}
                </Text>
              </View>
            )}
            {isReadyToday && (
              <View
                style={{
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.2)"
                    : "#d1fae5",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(16, 185, 129, 0.4)" : "#a7f3d0",
                  alignSelf: "flex-start",
                  marginTop: 4,
                }}
              >
                <Text
                  variant="black"
                  size={10}
                  style={{ color: isDark ? "#34d399" : "#065f46" }}
                >
                  READY TODAY
                </Text>
              </View>
            )}
          </View>
        </View>

        {isAI && request.nextAction ? (
          <ReproductionNextActionCard
            action={request.nextAction}
            title="Required Reproductive Action"
          />
        ) : null}

        {isAI && request.farmerOutcomeReport ? (
          <View style={sectionCardStyle}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "rgba(16,185,129,0.14)" : "#ECFDF5",
                }}
              >
                <Activity size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 16,
                  }}
                >
                  Farmer observation
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                    marginTop: 4,
                  }}
                >
                  {getBreedingObservationLabel(request.farmerOutcomeReport)}
                </Text>
                {request.farmerOutcomeReportedAt ? (
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    Reported {formatDate(request.farmerOutcomeReportedAt)}
                  </Text>
                ) : null}
              </View>
              {isBreedingObservationAwaitingReview(
                request.verificationStatus || request.outcomeVerificationStatus,
              ) ? (
                <StatusBadge label="Needs review" variant="warning" compact />
              ) : null}
            </View>

            {request.farmerObservationSigns?.length ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                {request.farmerObservationSigns.map((sign: string) => (
                  <View
                    key={sign}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 11,
                      }}
                    >
                      {getBreedingObservationSignLabel(sign)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {request.farmerObservationNotes ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                  lineHeight: 19,
                  marginTop: 12,
                }}
              >
                {request.farmerObservationNotes}
              </Text>
            ) : null}

            {request.evidencePhotos?.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingTop: 12 }}
              >
                {request.evidencePhotos.map((photo: string, index: number) => (
                  <Image
                    key={`${photo}-${index}`}
                    source={{ uri: photo }}
                    style={{ width: 72, height: 72, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : null}

            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "#FFFBEB",
              }}
            >
              <Text
                style={{
                  color: isDark ? "#FCD34D" : "#92400E",
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                This is a farmer observation, not an official pregnancy
                diagnosis. Review it before changing the reproductive outcome.
              </Text>
            </View>

            {request.verificationTaskId ? (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(technician)/task-details",
                    params: {
                      id:
                        request.verificationTaskId?._id ||
                        request.verificationTaskId,
                    },
                  } as never)
                }
                style={{
                  marginTop: 14,
                  minHeight: 44,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primary,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                  }}
                >
                  Open pregnancy check
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Animal Information Section */}
        <View style={sectionCardStyle}>
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 14,
            }}
          >
            Animal Profile
          </Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {animal?.imageUrl ? (
              <Image
                source={{ uri: animal.imageUrl }}
                style={{ width: 80, height: 80, borderRadius: 16 }}
              />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons
                  name="cow"
                  size={40}
                  color={colors.textMuted}
                />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 16,
                  color: colors.textPrimary,
                }}
              >
                Ear Tag: #{animal?.earTag || "N/A"}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Breed: {animal?.breed || "N/A"}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Species/Sex: {animal?.species || "Cattle"} •{" "}
                {animal?.gender || "Female"}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Age: {getAge(animal?.birthDate)}
              </Text>
              <Text style={{ color: colors.textSecondary }} variant="medium">
                Reproductive Status:{" "}
                <Text style={{ color: colors.primary }} variant="bold">
                  {animal?.reproductiveStatus || "N/A"}
                </Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Farmer Information Section */}
        <View style={sectionCardStyle}>
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 14,
            }}
          >
            Farmer Information
          </Text>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            {farmer?.imageUrl ? (
              <Image
                source={{ uri: farmer.imageUrl }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <User size={24} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 15,
                  color: colors.textPrimary,
                }}
              >
                {farmer?.name || "N/A"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <Phone size={12} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {(isAI ? request.approvedBy : request.handledBy)
                    ? farmer?.phoneNumber || "N/A"
                    : "Claim request to view contact"}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <MapPin size={12} color={colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {(isAI ? request.approvedBy : request.handledBy)
                    ? `${farmer?.address?.houseNumber || ""} ${farmer?.address?.street || ""} ${farmer?.address?.barangay || ""}, ${farmer?.address?.city || farmer?.address?.municipality || "Iloilo"}`.trim() ||
                      "N/A"
                    : `${farmer?.address?.barangay || "N/A"}, ${farmer?.address?.city || farmer?.address?.municipality || "Iloilo"}`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Farm Location & Directions Section */}
        {(isAI ? request.approvedBy : request.handledBy) ? (
          <View style={sectionCardStyle}>
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 10,
              }}
            >
              Farm Location & Directions
            </Text>
            <View style={{ gap: 8 }}>
              <Text
                style={{ color: colors.textSecondary, fontSize: 13 }}
                variant="medium"
              >
                Landmark:{" "}
                {farmer?.farmLocation?.landmark ||
                  farmer?.address?.landmark ||
                  "None listed"}
              </Text>
              <Text
                style={{ color: colors.textSecondary, fontSize: 13 }}
                variant="medium"
              >
                Directions Note:{" "}
                {farmer?.farmLocation?.directionsNote || "None listed"}
              </Text>
              {farmer?.farmLocation?.latitude &&
              farmer?.farmLocation?.longitude ? (
                <TouchableOpacity
                  onPress={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${farmer.farmLocation.latitude},${farmer.farmLocation.longitude}&travelmode=driving`;
                    Linking.openURL(url).catch((err) =>
                      console.error("Maps error", err),
                    );
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: colors.primary,
                    padding: 12,
                    borderRadius: 12,
                    justifyContent: "center",
                    marginTop: 8,
                  }}
                >
                  <MapPin size={16} color="#fff" />
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: "#fff",
                      fontSize: 14,
                    }}
                  >
                    Get directions to farm
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  Exact farm location is not set.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={sectionCardStyle}>
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 10,
              }}
            >
              Farm Location
            </Text>
            <Text
              style={{ color: colors.textMuted, fontSize: 13 }}
              variant="medium"
            >
              Detailed landmark, directions, and exact GPS navigation are
              locked. Claim this request to view them.
            </Text>
          </View>
        )}

        {/* Request Information Section */}
        <View style={sectionCardStyle}>
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 10,
            }}
          >
            Request Details
          </Text>
          {isAI ? (
            <View style={{ gap: 8 }}>
              <View
                style={{
                  backgroundColor: colors.card,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                  variant="extrabold"
                >
                  Observed Heat Signs
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    marginTop: 4,
                    fontSize: 14,
                  }}
                  variant="bold"
                >
                  {request.heatSigns?.join(", ") ||
                    request.raw?.heatSigns?.join(", ") ||
                    "No specific heat signs listed"}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.card,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                  variant="extrabold"
                >
                  Farmer Comments
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    marginTop: 4,
                    fontSize: 14,
                  }}
                  variant="medium"
                >
                  {getAdditionalNotesOnly(
                    request.technicianNote || request.comments,
                  ) || "No additional comments"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View
                style={{
                  backgroundColor: colors.card,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                  variant="extrabold"
                >
                  Symptoms Reported
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    marginTop: 4,
                    fontSize: 14,
                  }}
                  variant="bold"
                >
                  {request.symptoms || "No specific symptoms described"}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.card,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                  variant="extrabold"
                >
                  Farmer Notes
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    marginTop: 4,
                    fontSize: 14,
                  }}
                  variant="medium"
                >
                  {getAdditionalNotesOnly(
                    request.technicianNote || request.comments,
                  ) || "No additional notes"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action / Input Section */}
        {!isTerminal && (!isAI || request.cancellationStatus === "requested") && (
          <View style={sectionCardStyle}>
            {request.cancellationStatus === "requested" ? (
              // Cancellation Requested Review Panel
              <View style={{ gap: 14 }}>
                <View
                  style={{
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.08)"
                      : "#FEF2F2",
                    borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2",
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.error,
                      fontSize: 15,
                      marginBottom: 4,
                    }}
                  >
                    Farmer Requested Cancellation
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                    variant="medium"
                  >
                    The farmer has requested to cancel this scheduled visit.
                  </Text>
                  {request.cancellationReason ? (
                    <View
                      style={{
                        marginTop: 10,
                        backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "#fff",
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: 10,
                          fontFamily: "Outfit_700Bold",
                          textTransform: "uppercase",
                        }}
                      >
                        Reason Provided
                      </Text>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 13,
                          marginTop: 2,
                          fontStyle: "italic",
                        }}
                        variant="medium"
                      >
                        &quot;{request.cancellationReason}&quot;
                      </Text>
                    </View>
                  ) : null}
                </View>

                {!rescheduleMode ? (
                  <View style={{ gap: 10 }}>
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 10,
                        marginBottom: 2,
                      }}
                    >
                      CANCELLATION RESPONSE
                    </Text>

                    <TextInput
                      placeholder="Add response note (optional for approval, required for rejection)..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={2}
                      style={{
                        backgroundColor: colors.border,
                        padding: 12,
                        borderRadius: 12,
                        color: colors.textPrimary,
                        fontFamily: "Outfit_600SemiBold",
                        height: 60,
                        textAlignVertical: "top",
                      }}
                      value={note}
                      onChangeText={setNote}
                    />

                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 4 }}
                    >
                      <TouchableOpacity
                        onPress={() => handleRespondCancellation(true)}
                        disabled={cancelResponding}
                        style={{
                          flex: 1,
                          backgroundColor: "#ef4444",
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        {cancelResponding ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Check size={16} color="#fff" />
                            <Text
                              style={{ color: "#fff", fontSize: 13 }}
                              variant="bold"
                            >
                              Approve Cancel
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          if (!note.trim()) {
                            toast.error(
                              "Please add a note to reject the cancellation request.",
                            );
                            return;
                          }
                          handleRespondCancellation(false);
                        }}
                        disabled={cancelResponding}
                        style={{
                          flex: 1,
                          backgroundColor: colors.border,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        {cancelResponding ? (
                          <ActivityIndicator
                            color={colors.textPrimary}
                            size="small"
                          />
                        ) : (
                          <>
                            <X size={16} color={colors.textPrimary} />
                            <Text
                              style={{
                                color: colors.textPrimary,
                                fontSize: 13,
                              }}
                              variant="bold"
                            >
                              Reject Cancel
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={() => setRescheduleMode(true)}
                      style={{
                        backgroundColor: colors.primary,
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        marginTop: 4,
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <Calendar size={16} color="#fff" />
                      <Text
                        style={{ color: "#fff", fontSize: 13 }}
                        variant="bold"
                      >
                        Reschedule Visit
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Reschedule mode within cancellation review
                  <View style={{ gap: 12 }}>
                    <Text style={{ color: colors.textPrimary, marginBottom: 4 }} variant="bold">
                      Visit date
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(["today", "tomorrow", "custom"] as const).map((choice) => (
                        <TouchableOpacity
                          key={choice}
                          onPress={() => {
                            if (choice === "custom") {
                              setDateChoice("custom");
                              setShowDatePicker(true);
                            } else {
                              setDateChoice(choice);
                              const d = new Date();
                              d.setHours(0,0,0,0);
                              if (choice === "tomorrow") d.setDate(d.getDate() + 1);
                              setScheduledDate(d);
                            }
                          }}
                          style={{
                            flex: 1,
                            minHeight: 44,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: dateChoice === choice ? colors.primary : colors.border,
                            backgroundColor: dateChoice === choice ? (isDark ? "rgba(16,185,129,0.15)" : colors.tint) : colors.card,
                          }}
                        >
                          <Text style={{ color: dateChoice === choice ? colors.primary : colors.textSecondary, fontSize: 12 }} variant="bold">
                            {choice === "today" ? "Today" : choice === "tomorrow" ? "Tomorrow" : "Custom"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Calendar size={17} color={colors.primary} />
                      <Text style={{ color: colors.textPrimary }} variant="bold">
                        {scheduledDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>

                    <Text style={{ color: colors.textPrimary, marginBottom: 4 }} variant="bold">
                      Visit period
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {(["morning", "afternoon"] as const).map((period) => (
                        <TouchableOpacity
                          key={period}
                          onPress={() => setVisitPeriod(period)}
                          style={{
                            flex: 1,
                            minHeight: 48,
                            borderRadius: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 7,
                            borderWidth: 1,
                            borderColor: visitPeriod === period ? colors.primary : colors.border,
                            backgroundColor: visitPeriod === period ? (isDark ? "rgba(16,185,129,0.15)" : colors.tint) : colors.card,
                          }}
                        >
                          <Clock size={16} color={colors.primary} />
                          <Text style={{ color: colors.textPrimary, textTransform: "capitalize" }} variant="bold">
                            {period}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 10,
                        marginTop: 4,
                      }}
                    >
                      RESCHEDULE NOTES
                    </Text>
                    <TextInput
                      placeholder="Add rescheduling reason or instructions for farmer..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={2}
                      style={{
                        backgroundColor: colors.border,
                        padding: 12,
                        borderRadius: 12,
                        color: colors.textPrimary,
                        fontFamily: "Outfit_600SemiBold",
                        height: 60,
                        textAlignVertical: "top",
                      }}
                      value={note}
                      onChangeText={setNote}
                    />

                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 4 }}
                    >
                      <TouchableOpacity
                        onPress={handleRescheduleConfirm}
                        disabled={cancelResponding}
                        style={{
                          flex: 1,
                          backgroundColor: colors.primary,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {cancelResponding ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text
                            style={{ color: "#fff", fontSize: 13 }}
                            variant="bold"
                          >
                            Confirm Reschedule
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setRescheduleMode(false)}
                        style={{
                          flex: 1,
                          backgroundColor: colors.border,
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{ color: colors.textPrimary, fontSize: 13 }}
                          variant="bold"
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              // Normal action execution section
              <>
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 16,
                      color: colors.textPrimary,
                    }}
                  >
                    Next action
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      fontSize: 13,
                      lineHeight: 18,
                      color: colors.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    {nextActionDescription}
                  </Text>
                </View>

                {/* Inline scheduling date/time picker */}
                {!isAI && (request.status?.toLowerCase() === "approved" ||
                  request.status?.toLowerCase() === "assigned" ||
                  request.status?.toLowerCase() === "triaged") && (
                  <View style={{ gap: 10, marginBottom: 16 }}>
                    <Text style={{ color: colors.textPrimary, marginBottom: 4 }} variant="bold">
                      Visit date
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(["today", "tomorrow", "custom"] as const).map((choice) => (
                        <TouchableOpacity
                          key={choice}
                          onPress={() => {
                            if (choice === "custom") {
                              setDateChoice("custom");
                              setShowDatePicker(true);
                            } else {
                              setDateChoice(choice);
                              const d = new Date();
                              d.setHours(0,0,0,0);
                              if (choice === "tomorrow") d.setDate(d.getDate() + 1);
                              setScheduledDate(d);
                            }
                          }}
                          style={{
                            flex: 1,
                            minHeight: 44,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: dateChoice === choice ? colors.primary : colors.border,
                            backgroundColor: dateChoice === choice ? (isDark ? "rgba(16,185,129,0.15)" : colors.tint) : colors.card,
                          }}
                        >
                          <Text style={{ color: dateChoice === choice ? colors.primary : colors.textSecondary, fontSize: 12 }} variant="bold">
                            {choice === "today" ? "Today" : choice === "tomorrow" ? "Tomorrow" : "Custom"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Calendar size={17} color={colors.primary} />
                      <Text style={{ color: colors.textPrimary }} variant="bold">
                        {scheduledDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>

                    <Text style={{ color: colors.textPrimary, marginBottom: 4 }} variant="bold">
                      Visit period
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {(["morning", "afternoon"] as const).map((period) => (
                        <TouchableOpacity
                          key={period}
                          onPress={() => setVisitPeriod(period)}
                          style={{
                            flex: 1,
                            minHeight: 48,
                            borderRadius: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 7,
                            borderWidth: 1,
                            borderColor: visitPeriod === period ? colors.primary : colors.border,
                            backgroundColor: visitPeriod === period ? (isDark ? "rgba(16,185,129,0.15)" : colors.tint) : colors.card,
                          }}
                        >
                          <Clock size={16} color={colors.primary} />
                          <Text style={{ color: colors.textPrimary, textTransform: "capitalize" }} variant="bold">
                            {period}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}



                {actionNotice && (
                  <View
                    accessibilityRole="alert"
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 12,
                      marginBottom: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(248,113,113,0.4)" : "#fecaca",
                      backgroundColor: isDark
                        ? "rgba(239,68,68,0.12)"
                        : "#fef2f2",
                    }}
                  >
                    <AlertCircle
                      size={19}
                      color={isDark ? "#f87171" : "#dc2626"}
                      style={{ marginTop: 1 }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: isDark ? "#fca5a5" : "#b91c1c",
                        fontSize: 13,
                        lineHeight: 19,
                      }}
                      variant="semibold"
                    >
                      {actionNotice}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleAction}
                  disabled={updating}
                  accessibilityRole="button"
                  accessibilityLabel={primaryActionLabel}
                  style={{
                    backgroundColor: colors.primary,
                    minHeight: 50,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: updating ? 0.65 : 1,
                  }}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{ color: "#fff", fontSize: 16 }}
                      variant="extrabold"
                    >
                      {primaryActionLabel}
                    </Text>
                  )}
                </TouchableOpacity>

                {["approved", "assigned", "triaged", "scheduled"].includes(
                  request.status?.toLowerCase(),
                ) && (
                  <TouchableOpacity
                    onPress={() => setDeclineModalVisible(true)}
                    disabled={updating}
                    style={{
                      marginTop: 10,
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.12)"
                        : "#fef2f2",
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(248, 113, 113, 0.25)"
                        : "#fecaca",
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: isDark ? "#f87171" : "#dc2626",
                        fontSize: 14,
                      }}
                      variant="extrabold"
                    >
                      Decline / Cancel With Reason
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* View Record (If completed/resolved) */}
        {isTerminal && (
          <View style={sectionCardStyle}>
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                fontSize: 16,
                color: colors.textPrimary,
                marginBottom: 12,
              }}
            >
              Service Record (Completed)
            </Text>
            <View
              style={{
                backgroundColor: colors.primary + "15",
                padding: 16,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: colors.primary, fontFamily: "Outfit_500Medium", fontSize: 14, textAlign: "center" }}>
                This request has been completed.
              </Text>
            </View>
          </View>
        )}

        {/* Animal History Section */}
        <View style={sectionCardStyle}>
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 16,
              color: colors.textPrimary,
              marginBottom: 14,
            }}
          >
            Animal History Timeline
          </Text>

          {timelineLoading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((item) => (
                <View
                  key={item}
                  style={{ flexDirection: "row", alignItems: "flex-start" }}
                >
                  <SkeletonBlock
                    width={28}
                    height={28}
                    borderRadius={14}
                    color={isDark ? "#1f2937" : "#e8edf3"}
                  />
                  <View style={{ flex: 1, marginLeft: 12, gap: 7 }}>
                    <SkeletonBlock
                      width="58%"
                      height={13}
                      color={isDark ? "#1f2937" : "#e8edf3"}
                    />
                    <SkeletonBlock
                      width="86%"
                      height={11}
                      color={isDark ? "#1f2937" : "#e8edf3"}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : timeline.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }} variant="bold">
                No past medical or AI history found.
              </Text>
            </View>
          ) : (
            <View
              style={{
                paddingLeft: 10,
                borderLeftWidth: 1.5,
                borderLeftColor: colors.border,
                marginLeft: 6,
              }}
            >
              {timeline.map((event, index) => (
                <View
                  key={event._id || index}
                  style={{ marginBottom: 20, position: "relative" }}
                >
                  {/* Timeline dot */}
                  <View
                    style={{
                      position: "absolute",
                      left: -20,
                      top: 2,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.card,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {getTimelineIcon(event.iconType)}
                  </View>

                  <View style={{ marginLeft: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          fontSize: 14,
                          color: colors.textPrimary,
                        }}
                      >
                        {event.title}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                        {new Date(event.date).toLocaleDateString()}
                      </Text>
                    </View>

                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        marginTop: 2,
                      }}
                      variant="medium"
                    >
                      {event.description}
                    </Text>

                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                      variant="medium"
                    >
                      Actor: {event.technicianName}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date & Time Picker Dialogs */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="date"
          display="default"
          minimumDate={new Date(new Date().setHours(0,0,0,0))}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (date) {
              const newDate = new Date(date);
              newDate.setHours(0,0,0,0);
              setScheduledDate(newDate);
            }
          }}
        />
      )}



      <ConfirmationModal
        visible={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        confirmText={confirmAction?.confirmText || "Confirm"}
        cancelText={confirmAction?.cancelText || "Review"}
        isDestructive={confirmAction?.isDestructive ?? false}
      />

      <Modal
        visible={declineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeclineModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              variant="extrabold"
              size={18}
              style={{ color: colors.textPrimary, marginBottom: 6 }}
            >
              Decline Request?
            </Text>
            <Text
              variant="medium"
              size={13}
              style={{
                color: colors.textSecondary,
                lineHeight: 18,
                marginBottom: 14,
              }}
            >
              This will cancel the claimed service and notify the farmer. Add a
              clear reason so the farmer knows what happened.
            </Text>
            <TextInput
              placeholder="Reason, e.g. schedule conflict or duplicate request..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={declineReason}
              onChangeText={setDeclineReason}
              style={{
                minHeight: 96,
                borderRadius: 14,
                padding: 12,
                backgroundColor: colors.border,
                color: colors.textPrimary,
                fontFamily: "Outfit_600SemiBold",
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setDeclineModalVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text
                  variant="bold"
                  size={13}
                  style={{ color: colors.textPrimary }}
                >
                  Keep Request
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTechnicianDecline}
                disabled={updating || !declineReason.trim()}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: !declineReason.trim()
                    ? colors.textMuted
                    : "#dc2626",
                  alignItems: "center",
                  opacity: updating ? 0.7 : 1,
                }}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text variant="bold" size={13} style={{ color: "#fff" }}>
                    Decline
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
