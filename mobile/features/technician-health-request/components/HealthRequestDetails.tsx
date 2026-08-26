import React, { useMemo, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  MapPin,
  MessageSquare,
  Navigation,
  PackageCheck,
  Phone,
  Pill,
  Send,
  Stethoscope,
  TriangleAlert,
  UserRound,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { AppPageHeader } from "@/components/AppPageHeader";
import {
  ImageViewerModal,
  StatusBadge,
  type ImageViewerItem,
} from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useApi } from "@/lib/api";
import { healthRequestKeys, technicianKeys } from "@/lib/queryKeys";
import { useTheme } from "@/lib/theme";
import type { HealthHandlingMethod } from "@/types";
import { getStructuredHealthRequestPresentation } from "@/features/farmer-requests/utils/healthRequestInput";
import { getHealthUrgencyPresentation } from "@/features/farmer-requests/utils/healthRequestState";
import {
  cancelTechnicianHealthRequest,
  declineTechnicianRequest,
  sendTechnicianHealthAdvice,
  sendTechnicianHealthOfficePickup,
  updateRequestStatus,
} from "@/features/technician/services/technician.service";
import { claimTechnicianRequest } from "@/features/technician-requests/services/technicianRequests.service";
import type { VisitPeriod } from "@/features/technician-requests/types/technicianRequests.types";
import {
  HealthVisitScheduleModal,
  type HealthVisitSchedulePayload,
} from "./HealthVisitScheduleModal";
import {
  AdviceResponseForm,
  HealthHandlingMethodSelector,
  OfficePickupResponseForm,
  type AdviceResponseValues,
  type OfficePickupResponseValues,
} from "./HealthHandlingMethodFoundation";
import {
  buildHealthAdvicePayload,
  isHealthAdviceEligible,
  validateHealthAdviceDraft,
} from "../utils/healthAdviceWorkflow";
import {
  buildHealthOfficePickupPayload,
  isHealthOfficePickupEligible,
  validateHealthOfficePickupDraft,
} from "../utils/healthOfficePickupWorkflow";
import {
  getTechnicianHealthLocationPresentation,
  shouldShowTechnicianHealthMapAction,
} from "../utils/healthRequestLocation";
import {
  TECHNICIAN_MY_WORK_COMPLETED_TARGET,
  runConfirmedHealthResponseSubmission,
} from "../utils/healthResponseSubmission";

type ScheduleMode = "accept" | "schedule" | "reschedule";

interface HealthRequestDetailsProps {
  request: any;
  routeTaskId?: string;
  routeWorkflowId?: string;
  onRefresh: () => Promise<void>;
  onBack: () => void;
}

const EMPTY_ADVICE_DRAFT: AdviceResponseValues = {
  adviceForFarmer: "",
  followUpDate: "",
  internalNote: "",
};

const EMPTY_OFFICE_PICKUP_DRAFT: OfficePickupResponseValues = {
  item: "",
  availabilityConfirmed: false,
  pickupInstructions: "",
  farmerMessage: "",
  dosageInstructions: "",
  withdrawalGuidance: "",
  followUpDate: "",
  internalNote: "",
};

const cleanText = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text &&
    !["n/a", "na", "null", "undefined"].includes(text.toLowerCase())
    ? text
    : "";
};

const normalizeText = (value: unknown, separator = ", ") =>
  Array.isArray(value)
    ? value.map(cleanText).filter(Boolean).join(separator)
    : cleanText(value);

const getEntityId = (value: any) =>
  cleanText(value?._id) || cleanText(value?.id) || cleanText(value);

const formatLabel = (value: unknown, fallback: string) => {
  const text = cleanText(value) || fallback;
  return text
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatHealthCategory = (value: unknown) => {
  const normalized = cleanText(value).toLowerCase();
  if (
    [
      "disease",
      "injury",
      "wound",
      "health_concern",
      "pregnancy_complication",
    ].includes(normalized)
  ) {
    return normalized === "pregnancy_complication"
      ? "Pregnancy-related health concern"
      : "Sick or Injured Animal";
  }
  if (["medicine", "deworming", "medicine_request"].includes(normalized)) {
    return "Medicine or Dewormer";
  }
  if (["checkup", "vaccination", "preventive_care"].includes(normalized)) {
    return "Checkup or Vaccination";
  }
  if (normalized === "other") return "Other Health Assistance";
  return formatLabel(value, "Health assistance");
};

const formatDate = (value: unknown, includeTime = false) => {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
};

const getPhotoUrls = (request: any) =>
  Array.from(
    new Set(
      [request?.photos, request?.imageUrl]
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map(cleanText)
        .filter(Boolean),
    ),
  );

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export function HealthRequestDetails({
  request,
  routeTaskId,
  routeWorkflowId,
  onRefresh,
  onBack,
}: HealthRequestDetailsProps) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("accept");
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState<
    "advice" | "office_pickup" | null
  >(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedHandlingMethod, setSelectedHandlingMethod] =
    useState<HealthHandlingMethod | null>(null);
  const [adviceVisible, setAdviceVisible] = useState(false);
  const [adviceDraft, setAdviceDraft] =
    useState<AdviceResponseValues>(EMPTY_ADVICE_DRAFT);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [officePickupVisible, setOfficePickupVisible] = useState(false);
  const [officePickupDraft, setOfficePickupDraft] =
    useState<OfficePickupResponseValues>(EMPTY_OFFICE_PICKUP_DRAFT);
  const [officePickupError, setOfficePickupError] = useState<string | null>(
    null,
  );
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  const requestId = getEntityId(request?._id || request?.id);
  const farmer =
    request?.farmerId && typeof request.farmerId === "object"
      ? request.farmerId
      : null;
  const animal =
    request?.animalId && typeof request.animalId === "object"
      ? request.animalId
      : null;
  const normalizedStatus = cleanText(request?.status)
    .toLowerCase()
    .replace(/_/g, "-");
  const isOwned = Boolean(request?.handledBy || request?.assignedTechnicianId);
  const isAvailable = normalizedStatus === "pending" && !isOwned;
  const isResolved = ["resolved", "done", "completed"].includes(
    normalizedStatus,
  );
  const resolvedHandlingMethod = cleanText(
    request?.handlingMethod,
  ).toLowerCase();
  const isAdviceResolved = isResolved && resolvedHandlingMethod === "advice";
  const isOfficePickupResolved =
    isResolved && resolvedHandlingMethod === "office_pickup";
  const isCancelled = ["cancelled", "rejected", "declined"].includes(
    normalizedStatus,
  );
  const isInProgress = normalizedStatus === "in-progress";
  const isScheduled =
    normalizedStatus === "scheduled" && Boolean(request?.scheduledDate);
  const isClaimedUnscheduled =
    isOwned &&
    !request?.scheduledDate &&
    ["pending", "approved", "assigned", "triaged"].includes(normalizedStatus);

  const status = isAvailable
    ? { label: "Available", variant: "available" }
    : isClaimedUnscheduled
      ? { label: "Claimed", variant: "assigned" }
      : isScheduled
        ? { label: "Scheduled", variant: "scheduled" }
        : isInProgress
          ? { label: "In progress", variant: "info" }
          : isResolved
            ? {
                label: isAdviceResolved
                  ? "Advice provided"
                  : isOfficePickupResolved
                    ? "Pickup information sent"
                    : "Resolved",
                variant: "resolved",
              }
            : isCancelled
              ? { label: "Cancelled", variant: "cancelled" }
              : {
                  label: formatLabel(request?.status, "Health request"),
                  variant: "neutral",
                };

  const farmerName = cleanText(farmer?.name) || cleanText(request?.farmerName);
  const farmerPhone = cleanText(farmer?.phoneNumber || farmer?.phone);
  const locationPresentation = getTechnicianHealthLocationPresentation(request);
  const showMapAction = shouldShowTechnicianHealthMapAction(
    request,
    locationPresentation.mapUrl,
  );
  const urgencyPresentation = getHealthUrgencyPresentation(request?.urgency);
  const photos = useMemo(() => getPhotoUrls(request), [request]);
  const galleryImages = useMemo<ImageViewerItem[]>(
    () =>
      photos.map((uri, index) => ({
        uri,
        fileName: `health-request-photo-${index + 1}`,
        accessibilityLabel: `Farmer attachment ${index + 1} of ${photos.length}`,
      })),
    [photos],
  );
  const structuredInput = getStructuredHealthRequestPresentation(request || {});
  const requestCategoryLabel =
    structuredInput?.assistanceLabel ||
    formatHealthCategory(request?.requestType);
  const symptoms = structuredInput
    ? structuredInput.observedSigns.join("\n")
    : normalizeText(request?.symptoms);
  const farmerNotes = structuredInput
    ? structuredInput.farmerDescription
    : normalizeText(request?.farmerNotes, "\n\n");
  const showSeparateFarmerNote = Boolean(
    farmerNotes && !symptoms.toLowerCase().includes(farmerNotes.toLowerCase()),
  );
  const submittedDate = formatDate(request?.createdAt);
  const submittedAt = formatDate(request?.createdAt, true);
  const scheduledDate = formatDate(request?.scheduledDate);
  const visitPeriod = cleanText(
    request?.visitPeriod,
  ).toLowerCase() as VisitPeriod;
  const adviceEligible = isHealthAdviceEligible(request);
  const officePickupEligible = isHealthOfficePickupEligible(request);
  const canChooseHandlingMethod = adviceEligible || officePickupEligible;
  const pickupResponse = request?.technicianResponse?.pickup || {};
  const pickupInstructions = cleanText(pickupResponse.instructions);
  const pickupFarmerMessage = cleanText(request?.advice);
  const showPickupFarmerMessage = Boolean(
    pickupFarmerMessage && pickupFarmerMessage !== pickupInstructions,
  );

  const cardStyle = {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  } as const;

  const invalidateHealthWorkflow = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: technicianKeys.requests() }),
      queryClient.invalidateQueries({ queryKey: technicianKeys.workQueue() }),
      queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: technicianKeys.tasks() }),
      queryClient.invalidateQueries({
        queryKey: healthRequestKeys.detail(requestId),
      }),
    ]);
  };

  const requireOnline = async () => {
    const connectivity = await NetInfo.fetch();
    if (
      connectivity.isConnected === false ||
      connectivity.isInternetReachable === false
    ) {
      setScheduleError(
        "Accepting and scheduling Health visits requires an internet connection.",
      );
      return false;
    }
    return true;
  };

  const handleClaimConflict = async () => {
    const message =
      "This request was claimed by another technician. Refreshing your work list.";
    setScheduleError(message);
    await invalidateHealthWorkflow();
    await onRefresh();
  };

  const handleSchedule = async (payload: HealthVisitSchedulePayload) => {
    if (!(await requireOnline())) return;
    setUpdating(true);
    setScheduleError(null);
    let claimSucceeded = false;

    try {
      if (scheduleMode === "accept") {
        try {
          await claimTechnicianRequest(api, "health", requestId);
          claimSucceeded = true;
        } catch (error: any) {
          if (error?.response?.status === 409) {
            await handleClaimConflict();
            return;
          }
          throw error;
        }
      }

      try {
        await updateRequestStatus(api, "health", requestId, {
          status: "scheduled",
          scheduledDate: payload.scheduledDate,
          visitPeriod: payload.visitPeriod,
          samePeriodConfirmed: payload.samePeriodConfirmed,
          technicianNote:
            scheduleMode === "reschedule"
              ? "Health visit rescheduled."
              : "Health visit scheduled.",
        });
      } catch (error: any) {
        if (claimSucceeded) {
          const message =
            "Request accepted, but the visit could not be scheduled. Set the visit to continue.";
          setScheduleError(message);
          setScheduleMode("schedule");
          await invalidateHealthWorkflow();
          await onRefresh();
          return;
        }
        throw error;
      }

      toast.success(
        scheduleMode === "reschedule"
          ? "Health visit rescheduled."
          : "Health request accepted and scheduled.",
      );
      setScheduleVisible(false);
      await invalidateHealthWorkflow();
      await onRefresh();
    } catch (error: any) {
      setScheduleError(
        getErrorMessage(error, "The Health visit could not be scheduled."),
      );
      if (error?.response?.status === 409) {
        await invalidateHealthWorkflow();
        await onRefresh();
      }
    } finally {
      setUpdating(false);
    }
  };

  const openSchedule = (mode: ScheduleMode) => {
    setScheduleMode(mode);
    setScheduleVisible(true);
    setActionNotice(null);
    setScheduleError(null);
  };

  const closeAdviceEditor = () => {
    if (updating) return;
    setAdviceVisible(false);
    setAdviceError(null);
    setSelectedHandlingMethod(null);
  };

  const closeOfficePickupEditor = () => {
    if (updating) return;
    setOfficePickupVisible(false);
    setOfficePickupError(null);
    setSelectedHandlingMethod(null);
  };

  const handleHandlingMethodChange = (method: HealthHandlingMethod) => {
    setSelectedHandlingMethod(method);
    setActionNotice(null);

    if (method === "advice") {
      setAdviceDraft(EMPTY_ADVICE_DRAFT);
      setAdviceError(null);
      setAdviceVisible(true);
      return;
    }

    if (method === "office_pickup") {
      setOfficePickupDraft(EMPTY_OFFICE_PICKUP_DRAFT);
      setOfficePickupError(null);
      setOfficePickupVisible(true);
      return;
    }

    openSchedule(isAvailable ? "accept" : "schedule");
  };

  const handleAdviceSubmit = async () => {
    if (updating) return;
    const validationMessage = validateHealthAdviceDraft(adviceDraft);
    if (validationMessage) {
      setAdviceError(validationMessage);
      return;
    }

    setUpdating(true);
    setSubmittingResponse("advice");
    setAdviceError(null);
    setActionNotice(null);
    try {
      await runConfirmedHealthResponseSubmission({
        submit: () =>
          sendTechnicianHealthAdvice(
            api,
            requestId,
            buildHealthAdvicePayload(adviceDraft),
          ),
        refresh: async () => {
          await invalidateHealthWorkflow();
          await onRefresh();
        },
        acknowledge: () => {
          setAdviceVisible(false);
          setSelectedHandlingMethod(null);
          setAdviceDraft(EMPTY_ADVICE_DRAFT);
          toast.success("Advice sent to farmer");
        },
        navigate: () =>
          router.replace(TECHNICIAN_MY_WORK_COMPLETED_TARGET as never),
      });
    } catch (error: any) {
      const statusCode = error?.response?.status;
      const message =
        error?.response?.data?.message ||
        (statusCode === 403
          ? "This request is assigned to another technician."
          : statusCode === 409
            ? "This request changed and can no longer receive Advice. Refresh and try again."
            : error?.response
              ? "Advice could not be sent. Review the form and try again."
              : "Advice could not be sent. Check your connection and try again.");
      setAdviceError(message);
      setActionNotice(message);
      toast.error(message);
    } finally {
      setUpdating(false);
      setSubmittingResponse(null);
    }
  };

  const handleOfficePickupSubmit = async () => {
    if (updating) return;
    const validationMessage =
      validateHealthOfficePickupDraft(officePickupDraft);
    if (validationMessage) {
      setOfficePickupError(validationMessage);
      return;
    }

    setUpdating(true);
    setSubmittingResponse("office_pickup");
    setOfficePickupError(null);
    setActionNotice(null);
    try {
      await runConfirmedHealthResponseSubmission({
        submit: () =>
          sendTechnicianHealthOfficePickup(
            api,
            requestId,
            buildHealthOfficePickupPayload(officePickupDraft),
          ),
        refresh: async () => {
          await invalidateHealthWorkflow();
          await onRefresh();
        },
        acknowledge: () => {
          setOfficePickupVisible(false);
          setSelectedHandlingMethod(null);
          setOfficePickupDraft(EMPTY_OFFICE_PICKUP_DRAFT);
          toast.success("Pickup information sent to farmer");
        },
        navigate: () =>
          router.replace(TECHNICIAN_MY_WORK_COMPLETED_TARGET as never),
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        (error?.response
          ? "Pickup instructions could not be sent. Review the form and try again."
          : "Pickup instructions could not be sent. Check your connection and try again.");
      setOfficePickupError(message);
      setActionNotice(message);
      toast.error(message);
    } finally {
      setUpdating(false);
      setSubmittingResponse(null);
    }
  };

  const openHealthLog = () => {
    const canonicalWorkflowId =
      getEntityId(request?.workflowId) || cleanText(routeWorkflowId);
    const canonicalTaskId =
      getEntityId(request?.taskId) || cleanText(routeTaskId);
    const farmerId = getEntityId(request?.farmerId);
    const animalId = getEntityId(request?.animalId);

    router.push({
      pathname: "/(technician)/health-log",
      params: {
        source: "task",
        requestId,
        healthRequestId: requestId,
        ...(canonicalWorkflowId ? { workflowId: canonicalWorkflowId } : {}),
        ...(canonicalTaskId ? { taskId: canonicalTaskId } : {}),
        ...(farmerId ? { farmerId } : {}),
        ...(animalId ? { animalId } : {}),
        ...(request?.scheduledDate
          ? { scheduleDate: request.scheduledDate }
          : {}),
        ...(visitPeriod ? { visitPeriod } : {}),
      },
    });
  };

  const handlePrimaryAction = () => {
    if (isAvailable) {
      openSchedule("accept");
      return;
    }
    if (isClaimedUnscheduled) {
      openSchedule("schedule");
      return;
    }
    if (isScheduled || isInProgress) {
      openHealthLog();
      return;
    }
    if (isResolved && request?.medicalRecordId) {
      router.push("/(technician)/(tabs)/technician.records" as never);
    }
  };

  const primaryLabel = isAvailable
    ? "Accept & Set Visit"
    : isClaimedUnscheduled
      ? "Set Visit"
      : isScheduled
        ? "Record Health Assistance"
        : isInProgress
          ? "Continue Health Assistance"
          : isResolved && request?.medicalRecordId
            ? "View Health Record"
            : "";

  const handleDecline = async () => {
    if (updating) return;
    setUpdating(true);
    setActionNotice(null);
    try {
      await declineTechnicianRequest(
        api,
        "health",
        requestId,
        "Declined by technician.",
      );
      await invalidateHealthWorkflow();
      toast.success("Request removed from your available requests.");
      onBack();
    } catch (error: any) {
      setActionNotice(
        getErrorMessage(error, "The request could not be declined."),
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason || updating) return;
    setUpdating(true);
    setActionNotice(null);
    try {
      await cancelTechnicianHealthRequest(api, requestId, trimmedReason);
      await invalidateHealthWorkflow();
      toast.success("Health request cancelled.");
      setReasonVisible(false);
      setReason("");
      await onRefresh();
    } catch (error: any) {
      setActionNotice(
        getErrorMessage(error, "The request could not be cancelled."),
      );
    } finally {
      setUpdating(false);
    }
  };

  const internalTechnicianNote = cleanText(request?.technicianNote);
  const resolvedResponseCards =
    isAdviceResolved || isOfficePickupResolved ? (
      <>
        <View style={cardStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {isAdviceResolved ? (
              <MessageSquare size={20} color={colors.primary} />
            ) : (
              <PackageCheck size={20} color={colors.primary} />
            )}
            <Text textRole="title" style={{ color: colors.textPrimary }}>
              {isAdviceResolved ? "Advice provided" : "Office pickup"}
            </Text>
          </View>
          <Text
            textRole="body"
            style={{ color: colors.textSecondary, marginTop: 6 }}
          >
            {isAdviceResolved
              ? "Farmer-visible guidance sent for this request. No farm visit or medical treatment was recorded."
              : "Farmer-visible pickup information. Availability is confirmed; treatment and collection are not recorded."}
          </Text>

          {isAdviceResolved ? (
            <>
              {cleanText(request?.advice) ? (
                <DetailRow label="Advice for farmer" value={request.advice} />
              ) : null}
              {request?.followUpDate ? (
                <DetailRow
                  label="Follow-up date"
                  value={formatDate(request.followUpDate)}
                />
              ) : null}
            </>
          ) : (
            <>
              {cleanText(pickupResponse.item) ? (
                <DetailRow label="Item" value={pickupResponse.item} />
              ) : null}
              {pickupResponse.availabilityConfirmed === true ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <CheckCircle2 size={17} color={colors.success} />
                  <Text textRole="bodyStrong" style={{ color: colors.success }}>
                    Available for pickup
                  </Text>
                </View>
              ) : null}
              {pickupInstructions ? (
                <DetailRow
                  label="Pickup instructions"
                  value={pickupInstructions}
                />
              ) : null}
              {showPickupFarmerMessage ? (
                <DetailRow
                  label="Message for farmer"
                  value={pickupFarmerMessage}
                />
              ) : null}
              {cleanText(pickupResponse.dosageOrUseInstructions) ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <Pill size={17} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <DetailRow
                      label="Dosage / Use instructions"
                      value={pickupResponse.dosageOrUseInstructions}
                    />
                  </View>
                </View>
              ) : null}
              {cleanText(pickupResponse.withdrawalGuidance) ? (
                <DetailRow
                  label="Withdrawal guidance"
                  value={pickupResponse.withdrawalGuidance}
                />
              ) : null}
              {request?.followUpDate ? (
                <DetailRow
                  label="Follow-up date"
                  value={formatDate(request.followUpDate)}
                />
              ) : null}
            </>
          )}
        </View>

        {internalTechnicianNote ? (
          <View style={cardStyle}>
            <Text textRole="title" style={{ color: colors.textPrimary }}>
              Internal note
            </Text>
            <Text
              textRole="caption"
              style={{ color: colors.textSecondary, marginTop: 3 }}
            >
              Visible only to technicians and administrators.
            </Text>
            <DetailRow label="Technician note" value={internalTechnicianNote} />
          </View>
        ) : null}
      </>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title="Health Request" onBack={onBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 56,
          gap: 12,
        }}
      >
        {resolvedResponseCards}

        <View style={cardStyle}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                backgroundColor: colors.successContainer,
              }}
            >
              <HeartPulse size={23} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text textRole="title" style={{ color: colors.textPrimary }}>
                {requestCategoryLabel}
              </Text>
              {submittedDate ? (
                <Text
                  textRole="caption"
                  style={{ color: colors.textMuted, marginTop: 2 }}
                >
                  Submitted {submittedDate}
                </Text>
              ) : null}
            </View>
            <StatusBadge
              label={status.label}
              variant={status.variant}
              domain="health"
              compact
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 16,
            }}
          >
            <Text textRole="label" style={{ color: colors.textMuted }}>
              Urgency
            </Text>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {urgencyPresentation.priority === "urgent" ? (
                  <TriangleAlert size={17} color={colors.errorForeground} />
                ) : null}
                <Text
                  textRole="bodyStrong"
                  style={{
                    color:
                      urgencyPresentation.priority === "urgent"
                        ? colors.errorForeground
                        : colors.textPrimary,
                  }}
                >
                  {urgencyPresentation.label}
                </Text>
              </View>
              {urgencyPresentation.technicianContext ? (
                <Text
                  textRole="caption"
                  style={{ color: colors.textMuted, marginTop: 2 }}
                >
                  {urgencyPresentation.technicianContext}
                </Text>
              ) : null}
            </View>
          </View>
          {isAvailable ? (
            <Text
              textRole="body"
              style={{ color: colors.textSecondary, marginTop: 8 }}
            >
              Visit not scheduled
            </Text>
          ) : isClaimedUnscheduled ? (
            <Text
              textRole="bodyStrong"
              style={{ color: colors.warningForeground, marginTop: 8 }}
            >
              Needs scheduling
            </Text>
          ) : null}
        </View>

        <View style={cardStyle}>
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            Farmer and location
          </Text>
          {farmerName ? <InfoLine icon={UserRound} text={farmerName} /> : null}
          {farmerPhone ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Call ${farmerName || "farmer"}`}
              onPress={() => Linking.openURL(`tel:${farmerPhone}`)}
            >
              <InfoLine icon={Phone} text={farmerPhone} />
            </TouchableOpacity>
          ) : null}
          <InfoLine
            icon={MapPin}
            text={locationPresentation.humanReadableLocation}
          />
          {locationPresentation.landmark ? (
            <DetailRow label="Landmark" value={locationPresentation.landmark} />
          ) : null}
          {locationPresentation.directionsNote ? (
            <DetailRow
              label="Directions"
              value={locationPresentation.directionsNote}
            />
          ) : null}
          {showMapAction ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open farm location in maps"
              onPress={async () => {
                try {
                  await Linking.openURL(locationPresentation.mapUrl!);
                } catch {
                  toast.error("Unable to open the saved farm location.");
                }
              }}
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Navigation size={17} color={colors.primary} />
              <Text textRole="bodyStrong" style={{ color: colors.primary }}>
                Open location
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={cardStyle}>
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            Animal
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            {cleanText(animal?.imageUrl) ? (
              <Image
                source={{ uri: animal.imageUrl }}
                resizeMode="cover"
                accessibilityLabel={`Animal ${cleanText(animal?.earTag) || "for this Health request"}`}
                style={{ width: 72, height: 72, borderRadius: 14 }}
              />
            ) : (
              <View
                style={{
                  width: 72,
                  height: 72,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  backgroundColor: colors.surfaceSubtle,
                }}
              >
                <Stethoscope size={28} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                Ear tag:{" "}
                {cleanText(animal?.earTag || animal?.animalId) ||
                  "Not recorded"}
              </Text>
              {cleanText(animal?.breed) ? (
                <Text textRole="body" style={{ color: colors.textSecondary }}>
                  Breed: {animal.breed}
                </Text>
              ) : null}
              {cleanText(animal?.species) ? (
                <Text textRole="body" style={{ color: colors.textSecondary }}>
                  Species: {animal.species}
                </Text>
              ) : null}
              {cleanText(animal?.reproductiveStatus) ? (
                <Text textRole="body" style={{ color: colors.textSecondary }}>
                  Reproductive status: {animal.reproductiveStatus}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={cardStyle}>
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            Farmer request
          </Text>
          <DetailRow label="Request type" value={requestCategoryLabel} />
          <DetailRow
            label="Farmer observations and description"
            value={symptoms || "No observations or description were provided."}
          />
          {showSeparateFarmerNote ? (
            <DetailRow label="Additional farmer note" value={farmerNotes} />
          ) : null}

          {submittedAt ? (
            <View style={{ marginTop: 8 }}>
              <InfoLine icon={Send} text={`Submitted ${submittedAt}`} />
            </View>
          ) : null}

          <Text
            textRole="title"
            style={{ color: colors.textPrimary, marginTop: 24 }}
          >
            Attachments
          </Text>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 12 }}
            >
              {galleryImages.map((photo, index) => (
                <TouchableOpacity
                  key={`${photo.fileName}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${photo.accessibilityLabel}`}
                  onPress={() => {
                    setGalleryInitialIndex(index);
                    setGalleryVisible(true);
                  }}
                  activeOpacity={0.8}
                  style={{
                    width: 112,
                    height: 88,
                    overflow: "hidden",
                    borderRadius: 12,
                    backgroundColor: colors.surfaceSubtle,
                  }}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    resizeMode="cover"
                    accessibilityLabel={photo.accessibilityLabel}
                    style={{ width: "100%", height: "100%" }}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text
              textRole="body"
              style={{ color: colors.textSecondary, marginTop: 8 }}
            >
              No attachments submitted.
            </Text>
          )}
        </View>

        {isClaimedUnscheduled || isScheduled || isInProgress ? (
          <View style={cardStyle}>
            <Text textRole="title" style={{ color: colors.textPrimary }}>
              {isClaimedUnscheduled ? "Visit" : "Scheduled Visit"}
            </Text>
            {scheduledDate ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <CalendarDays size={18} color={colors.primary} />
                <Text
                  textRole="bodyStrong"
                  style={{ color: colors.textPrimary }}
                >
                  {scheduledDate}
                  {visitPeriod
                    ? ` · ${formatLabel(visitPeriod, "")}`
                    : " · Period not recorded"}
                </Text>
              </View>
            ) : (
              <Text
                textRole="bodyStrong"
                style={{ color: colors.warningForeground, marginTop: 8 }}
              >
                Needs scheduling
              </Text>
            )}
          </View>
        ) : null}

        {actionNotice ? (
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.errorBorder,
              backgroundColor: colors.errorContainer,
            }}
          >
            <AlertCircle size={19} color={colors.errorForeground} />
            <Text
              textRole="body"
              style={{ flex: 1, color: colors.errorForeground }}
            >
              {actionNotice}
            </Text>
          </View>
        ) : null}

        {canChooseHandlingMethod || primaryLabel ? (
          <View style={cardStyle}>
            {canChooseHandlingMethod ? (
              <HealthHandlingMethodSelector
                value={selectedHandlingMethod}
                disabled={updating}
                disabledMethods={{
                  advice: !adviceEligible,
                  office_pickup: !officePickupEligible,
                }}
                onChange={handleHandlingMethodChange}
              />
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                disabled={updating}
                onPress={handlePrimaryAction}
                style={{
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  opacity: updating ? 0.6 : 1,
                }}
              >
                {updating ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text
                    textRole="bodyStrong"
                    style={{ color: colors.onPrimary }}
                  >
                    {primaryLabel}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {isAvailable ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Decline"
                disabled={updating}
                onPress={handleDecline}
                style={{
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 32,
                  borderWidth: 1,
                  borderColor: colors.error,
                  borderRadius: 12,
                  backgroundColor: colors.error,
                }}
              >
                <Text textRole="bodyStrong" style={{ color: "#ffffff" }}>
                  Decline
                </Text>
              </TouchableOpacity>
            ) : null}

            {isScheduled ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Reschedule"
                disabled={updating}
                onPress={() => openSchedule("reschedule")}
                style={{
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text textRole="bodyStrong" style={{ color: colors.primary }}>
                  Reschedule
                </Text>
              </TouchableOpacity>
            ) : null}

            {isClaimedUnscheduled || isScheduled ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cancel With Reason"
                disabled={updating}
                onPress={() => setReasonVisible(true)}
                style={{
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 8,
                }}
              >
                <Text
                  textRole="bodyStrong"
                  style={{ color: colors.errorForeground }}
                >
                  Cancel With Reason
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <HealthVisitScheduleModal
        visible={scheduleVisible}
        mode={scheduleMode}
        isSubmitting={updating}
        errorMessage={scheduleError}
        initialDate={
          scheduleMode === "reschedule" ? request?.scheduledDate : null
        }
        initialVisitPeriod={scheduleMode === "reschedule" ? visitPeriod : null}
        onClose={() => {
          if (!updating) {
            setScheduleVisible(false);
            setScheduleError(null);
            setSelectedHandlingMethod(null);
          }
        }}
        onErrorClear={() => setScheduleError(null)}
        onConfirm={handleSchedule}
      />

      <ImageViewerModal
        visible={galleryVisible}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        title="Farmer attachments"
        onClose={() => setGalleryVisible(false)}
      />

      <Modal
        visible={officePickupVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeOfficePickupEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              backgroundColor: colors.modalBackdrop,
            }}
          >
            <Pressable
              accessible={false}
              disabled={updating}
              onPress={closeOfficePickupEditor}
              style={StyleSheet.absoluteFill}
            />
            <View
              accessibilityViewIsModal
              style={{
                width: "100%",
                maxWidth: 520,
                maxHeight: "92%",
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.card,
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20 }}
              >
                <Text textRole="title" style={{ color: colors.textPrimary }}>
                  Office Pickup
                </Text>
                <Text
                  textRole="body"
                  style={{ color: colors.textSecondary, marginTop: 4 }}
                >
                  Confirm what the farmer can collect and share clear pickup
                  instructions. This does not record treatment or a completed
                  pickup.
                </Text>

                <View style={{ marginTop: 20 }}>
                  <OfficePickupResponseForm
                    values={officePickupDraft}
                    error={officePickupError}
                    disabled={submittingResponse === "office_pickup"}
                    onChange={(values) => {
                      setOfficePickupDraft(values);
                      if (officePickupError) setOfficePickupError(null);
                    }}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Cancel Office Pickup"
                    disabled={updating}
                    onPress={closeOfficePickupEditor}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      textRole="bodyStrong"
                      style={{ color: colors.textPrimary }}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Send Office Pickup instructions"
                    accessibilityState={{
                      disabled: updating,
                      busy: submittingResponse === "office_pickup",
                    }}
                    disabled={updating}
                    onPress={handleOfficePickupSubmit}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      opacity: updating ? 0.6 : 1,
                    }}
                  >
                    {submittingResponse === "office_pickup" ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color={colors.onPrimary}
                        />
                        <Text
                          textRole="bodyStrong"
                          style={{
                            color: colors.onPrimary,
                            textAlign: "center",
                          }}
                        >
                          Sending pickup information...
                        </Text>
                      </View>
                    ) : (
                      <Text
                        textRole="bodyStrong"
                        style={{ color: colors.onPrimary, textAlign: "center" }}
                      >
                        Send Pickup Information
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={adviceVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeAdviceEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              backgroundColor: colors.modalBackdrop,
            }}
          >
            <Pressable
              accessible={false}
              disabled={updating}
              onPress={closeAdviceEditor}
              style={StyleSheet.absoluteFill}
            />
            <View
              accessibilityViewIsModal
              style={{
                width: "100%",
                maxWidth: 520,
                maxHeight: "92%",
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.card,
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20 }}
              >
                <Text textRole="title" style={{ color: colors.textPrimary }}>
                  Give Advice
                </Text>
                <Text
                  textRole="body"
                  style={{ color: colors.textSecondary, marginTop: 4 }}
                >
                  Review the response before sending. This resolves the request
                  with Advice and does not schedule a farm visit.
                </Text>

                <View style={{ marginTop: 20 }}>
                  <AdviceResponseForm
                    values={adviceDraft}
                    error={adviceError}
                    disabled={submittingResponse === "advice"}
                    onChange={(values) => {
                      setAdviceDraft(values);
                      if (adviceError) setAdviceError(null);
                    }}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Cancel Advice"
                    disabled={updating}
                    onPress={closeAdviceEditor}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      textRole="bodyStrong"
                      style={{ color: colors.textPrimary }}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Send Advice to Farmer"
                    accessibilityState={{
                      disabled: updating,
                      busy: submittingResponse === "advice",
                    }}
                    disabled={updating}
                    onPress={handleAdviceSubmit}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      opacity: updating ? 0.6 : 1,
                    }}
                  >
                    {submittingResponse === "advice" ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color={colors.onPrimary}
                        />
                        <Text
                          textRole="bodyStrong"
                          style={{ color: colors.onPrimary }}
                        >
                          Sending advice...
                        </Text>
                      </View>
                    ) : (
                      <Text
                        textRole="bodyStrong"
                        style={{ color: colors.onPrimary }}
                      >
                        Send Advice
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={reasonVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          if (!updating) setReasonVisible(false);
        }}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: colors.modalBackdrop,
          }}
        >
          <Pressable
            accessible={false}
            disabled={updating}
            onPress={() => setReasonVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={{
              width: "100%",
              maxWidth: 420,
              padding: 20,
              borderRadius: 16,
              backgroundColor: colors.card,
            }}
          >
            <Text textRole="title" style={{ color: colors.textPrimary }}>
              Cancel Health Request
            </Text>
            <Text
              textRole="body"
              style={{ color: colors.textSecondary, marginTop: 6 }}
            >
              Give the farmer a clear reason for cancelling this visit.
            </Text>
            <TextInput
              accessibilityLabel="Cancellation reason"
              placeholder="Reason for cancellation"
              placeholderTextColor={colors.textMuted}
              multiline
              value={reason}
              onChangeText={setReason}
              style={{
                minHeight: 96,
                marginTop: 16,
                padding: 12,
                textAlignVertical: "top",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                color: colors.textPrimary,
                fontFamily: "Outfit_400Regular",
                fontSize: 14,
                lineHeight: 20,
              }}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Keep Request"
                disabled={updating}
                onPress={() => setReasonVisible(false)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  textRole="bodyStrong"
                  style={{ color: colors.textPrimary }}
                >
                  Keep Request
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Confirm Cancellation"
                disabled={updating || !reason.trim()}
                onPress={handleCancel}
                style={{
                  flex: 1,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: colors.errorForeground,
                  opacity: updating || !reason.trim() ? 0.55 : 1,
                }}
              >
                {updating ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text
                    textRole="bodyStrong"
                    style={{ color: colors.onPrimary }}
                  >
                    Cancel Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 14 }}>
      <Text textRole="label" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <Text textRole="body" style={{ color: colors.textPrimary, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}

function InfoLine({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<any>;
  text: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        marginTop: 12,
      }}
    >
      <Icon size={17} color={colors.textMuted} style={{ marginTop: 1 }} />
      <Text textRole="body" style={{ flex: 1, color: colors.textPrimary }}>
        {text}
      </Text>
    </View>
  );
}
