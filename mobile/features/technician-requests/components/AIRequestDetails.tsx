import React, { useMemo, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
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
  House,
  MapPinHouse,
  Phone,
  Send,
  Syringe,
  UserRound,
  X,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { AppPageHeader } from "@/components/AppPageHeader";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { StatusBadge } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useApi } from "@/lib/api";
import { aiRequestKeys, technicianKeys } from "@/lib/queryKeys";
import { useTheme } from "@/lib/theme";
import {
  declineTechnicianRequest,
  updateRequestStatus,
} from "@/features/technician/services/technician.service";
import { claimAndScheduleAIRequest } from "../services/technicianRequests.service";
import { VisitScheduleSheet } from "./VisitScheduleSheet";
import type { VisitPeriod } from "../types/technicianRequests.types";
import {
  getAIStartErrorMessage,
  getClaimScheduleErrorMessage,
  isCanonicalWorkflowId,
} from "../utils/aiWorkflow";
import {
  getAISchedulePeriodAvailability,
  getAIScheduleTiming,
  getRelativeAIScheduleDayLabel,
} from "../utils/aiScheduleAvailability";

type ScheduleMode = "accept" | "schedule" | "reschedule";

interface AIRequestDetailsProps {
  request: any;
  routeTaskId?: string;
  routeWorkflowId?: string;
  onRefresh: () => Promise<void>;
  onBack: () => void;
}

interface AISchedulePayload {
  scheduledDate: string;
  visitPeriod: VisitPeriod;
  samePeriodConfirmed?: boolean;
}

const cleanText = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text &&
    !["n/a", "na", "none", "null", "undefined"].includes(text.toLowerCase())
    ? text
    : "";
};

const getEntityId = (value: any) =>
  cleanText(value?._id) || cleanText(value?.id) || cleanText(value);

const normalizeText = (value: unknown, separator = ", ") =>
  Array.isArray(value)
    ? value.map(cleanText).filter(Boolean).join(separator)
    : cleanText(value);

const formatLabel = (value: unknown, fallback: string) => {
  const text = cleanText(value) || fallback;
  return text
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

const getFarmerLocation = (farmer: any) => {
  const farmLocation = farmer?.farmLocation || {};
  const address = Array.isArray(farmer?.address)
    ? farmer.address[0] || {}
    : farmer?.address || {};
  const detectedAddress = cleanText(farmLocation.detectedAddress);
  if (detectedAddress) return detectedAddress;

  return [
    cleanText(address.houseNumber),
    cleanText(address.street),
    cleanText(address.subdivision),
    cleanText(address.barangay),
    cleanText(address.city || address.municipality),
    cleanText(address.province),
  ]
    .filter(Boolean)
    .join(", ");
};

const getAttachmentUrls = (request: any) =>
  Array.from(
    new Set(
      [
        request?.imageUrl,
        request?.photos,
        request?.attachments?.urls,
        request?.attachments,
      ]
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map(cleanText)
        .filter(Boolean),
    ),
  );

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export function AIRequestDetails({
  request,
  routeTaskId,
  routeWorkflowId,
  onRefresh,
  onBack,
}: AIRequestDetailsProps) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(
    null,
  );
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("accept");
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [earlyStartVisible, setEarlyStartVisible] = useState(false);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [reason, setReason] = useState("");
  const submittingRef = useRef(false);

  const requestId = getEntityId(request?._id || request?.id);
  const workflowId =
    [
      getEntityId(request?.workflowId),
      cleanText(routeWorkflowId),
      requestId,
    ].find(isCanonicalWorkflowId) || "";
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
  const isOwned = Boolean(request?.approvedBy || request?.technicianId);
  const isAvailable = normalizedStatus === "pending" && !isOwned;
  const isResolved = ["resolved", "done", "completed"].includes(
    normalizedStatus,
  );
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
            ? { label: "Resolved", variant: "resolved" }
            : isCancelled
              ? { label: "Cancelled", variant: "cancelled" }
              : {
                  label: formatLabel(request?.status, "AI request"),
                  variant: "neutral",
                };

  const farmerName = cleanText(farmer?.name) || cleanText(request?.farmerName);
  const farmerPhone = cleanText(farmer?.phoneNumber || farmer?.phone);
  const farmerAddress = Array.isArray(farmer?.address)
    ? farmer.address[0] || {}
    : farmer?.address || {};
  const farmerLocation = getFarmerLocation(farmer);
  const homeAddressString = [
    cleanText(farmerAddress.houseNumber),
    cleanText(farmerAddress.street),
    cleanText(farmerAddress.subdivision),
    cleanText(farmerAddress.barangay),
    cleanText(farmerAddress.city || farmerAddress.municipality),
    cleanText(farmerAddress.province),
  ]
    .filter(Boolean)
    .join(", ");
  const farmLocation = farmer?.farmLocation || {};
  const directionsNote = cleanText(
    farmLocation.directionsNote || farmerAddress?.directionsNote,
  );
  const latitude = farmLocation.latitude ?? farmerAddress?.coordinates?.lat;
  const longitude = farmLocation.longitude ?? farmerAddress?.coordinates?.lng;
  const barangay =
    cleanText(farmerAddress.barangay) || cleanText(request?.barangay);
  const municipality =
    cleanText(farmerAddress.city || farmerAddress.municipality) ||
    cleanText(request?.municipality);
  const candidateArea = [barangay, municipality].filter(Boolean).join(", ");
  const farmerNotes = normalizeText(
    request?.farmerNotes || request?.comment || request?.note,
    "\n\n",
  );
  const attachments = useMemo(() => getAttachmentUrls(request), [request]);
  const submittedAt = formatDate(request?.createdAt, true);
  const scheduledDate = formatDate(request?.scheduledDate);
  const visitPeriod = cleanText(
    request?.visitPeriod,
  ).toLowerCase() as VisitPeriod;
  const scheduleTiming = isScheduled
    ? getAIScheduleTiming(request?.scheduledDate, visitPeriod)
    : "unknown";
  const isPastSchedule = scheduleTiming === "past";
  const relativeScheduleDay = getRelativeAIScheduleDayLabel(
    request?.scheduledDate,
  );

  const rawAttemptNumber = Number(
    request?.attemptNumber ?? request?.raw?.attemptNumber,
  );
  const attemptNumber =
    Number.isInteger(rawAttemptNumber) && rawAttemptNumber > 0
      ? rawAttemptNumber
      : 1;

  const cardStyle = {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  } as const;

  const invalidateWorkflow = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: technicianKeys.requests() }),
      queryClient.invalidateQueries({ queryKey: technicianKeys.workQueue() }),
      queryClient.invalidateQueries({ queryKey: technicianKeys.dashboard() }),
      queryClient.invalidateQueries({ queryKey: technicianKeys.tasks() }),
    ]);
  };

  const requireOnline = async (
    message = "Accepting and scheduling AI visits requires an internet connection.",
    onUnavailable = setActionNotice,
  ) => {
    const connectivity = await NetInfo.fetch();
    if (
      connectivity.isConnected === false ||
      connectivity.isInternetReachable === false
    ) {
      onUnavailable(message);
      return false;
    }
    return true;
  };

  const handleSchedule = async (payload: AISchedulePayload) => {
    if (
      submittingRef.current ||
      !(await requireOnline(undefined, setScheduleError))
    )
      return;
    if (!workflowId) {
      setScheduleError("This AI request is missing its workflow identifier.");
      return;
    }

    submittingRef.current = true;
    setUpdating(true);
    setScheduleError(null);
    try {
      if (scheduleMode === "accept") {
        await claimAndScheduleAIRequest(api, workflowId, payload);
      } else {
        await updateRequestStatus(api, "ai", requestId, {
          status: "scheduled",
          scheduledDate: payload.scheduledDate,
          visitPeriod: payload.visitPeriod,
          samePeriodConfirmed: payload.samePeriodConfirmed,
          technicianNote:
            scheduleMode === "reschedule"
              ? "AI visit rescheduled."
              : "AI visit scheduled.",
        });
      }

      await invalidateWorkflow();
      setScheduleVisible(false);
      toast.success(
        scheduleMode === "reschedule"
          ? "AI visit rescheduled."
          : "AI request accepted and scheduled.",
      );

      if (scheduleMode === "accept") {
        router.replace({
          pathname: "/(technician)/(tabs)/technician.requests",
          params: { section: "myWork" },
        });
      } else {
        await onRefresh();
      }
    } catch (error: any) {
      if (error?.response?.status === 409) {
        const message = getClaimScheduleErrorMessage(error);
        setScheduleError(message);
        await invalidateWorkflow();
        await onRefresh();
        return;
      }
      setScheduleError(
        scheduleMode === "accept"
          ? getClaimScheduleErrorMessage(error)
          : getErrorMessage(error, "The AI visit could not be scheduled."),
      );
    } finally {
      setUpdating(false);
      submittingRef.current = false;
    }
  };

  const openSchedule = (mode: ScheduleMode) => {
    setScheduleMode(mode);
    setActionNotice(null);
    setScheduleError(null);
    setScheduleVisible(true);
  };

  const openAIRecord = () => {
    const taskId = getEntityId(request?.taskId) || cleanText(routeTaskId);
    const farmerId = getEntityId(request?.farmerId);
    const animalId = getEntityId(request?.animalId);

    router.push({
      pathname: "/(technician)/record-ai",
      params: {
        mode: "request-linked",
        requestId,
        ...(workflowId ? { workflowId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(farmerId ? { farmerId } : {}),
        ...(animalId ? { animalId } : {}),
        ...(request?.scheduledDate
          ? { scheduleDate: request.scheduledDate }
          : {}),
        ...(visitPeriod ? { visitPeriod } : {}),
      },
    });
  };

  const handleStartAIRecord = async (earlyStartConfirmed = false) => {
    if (
      submittingRef.current ||
      !(await requireOnline(
        "Starting an AI service requires an internet connection.",
      ))
    ) {
      return;
    }
    if (!workflowId) {
      setActionNotice("This AI request is missing its workflow identifier.");
      return;
    }

    submittingRef.current = true;
    setUpdating(true);
    setActionNotice(null);
    try {
      const result = await updateRequestStatus(api, "ai", workflowId, {
        status: "in-progress",
        ...(earlyStartConfirmed ? { earlyStartConfirmed: true } : {}),
      });
      const authoritativeRequest = result?.request;
      if (authoritativeRequest?.status !== "in-progress") {
        throw new Error("The AI request did not enter the in-progress state.");
      }

      await invalidateWorkflow();
      await onRefresh().catch(() => undefined);
      setEarlyStartVisible(false);
      openAIRecord();
    } catch (error: any) {
      const code = String(error?.response?.data?.code || "");
      if (code === "EARLY_START_CONFIRMATION_REQUIRED") {
        setEarlyStartVisible(true);
        return;
      }

      const message = getAIStartErrorMessage(error);
      setActionNotice(message);
      toast.error(message);
      await invalidateWorkflow();
      await onRefresh().catch(() => undefined);
    } finally {
      setUpdating(false);
      submittingRef.current = false;
    }
  };

  const primaryLabel = isAvailable
    ? "Accept & Set Visit"
    : isClaimedUnscheduled
      ? "Set Visit"
      : isScheduled
        ? isPastSchedule
          ? "Record Completed Service"
          : "Record AI Service"
        : isInProgress
          ? "Continue AI Service"
          : isResolved
            ? "View Full Insemination Record"
            : "";

  const handlePrimaryAction = () => {
    if (isAvailable) openSchedule("accept");
    else if (isClaimedUnscheduled) openSchedule("schedule");
    else if (isScheduled) void handleStartAIRecord();
    else if (isInProgress) openAIRecord();
    else if (isResolved) {
      if (!workflowId) {
        toast.error(
          "This completed AI request does not include a record identifier. Open Technician Records to locate the legacy record.",
        );
        router.push("/(technician)/(tabs)/technician.records" as never);
        return;
      }

      router.push({
        pathname: "/(technician)/record-details",
        params: {
          animalId: getEntityId(request?.animalId),
          sourceId: workflowId,
          sourceKind: "insemination",
          recordId: workflowId,
          recordType: "insemination",
        },
      });
    }
  };

  const handleDecline = async () => {
    if (updating) return;
    setUpdating(true);
    setActionNotice(null);
    try {
      await declineTechnicianRequest(
        api,
        "ai",
        requestId,
        "Declined by technician.",
      );
      await invalidateWorkflow();
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
      await api.patch(`/ai-request/${requestId}/cancel`, {
        reason: trimmedReason,
      });
      await invalidateWorkflow();
      toast.success("AI request cancelled.");
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title="Request Details" onBack={onBack} />
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
        <View style={cardStyle}>
          <View
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
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
              <Syringe size={23} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text textRole="title" style={{ color: colors.textPrimary }}>
                Artificial Insemination
              </Text>
              <Text
                textRole="caption"
                style={{ color: colors.textMuted, marginTop: 2 }}
              >
                Farmer request
              </Text>
            </View>
            <StatusBadge
              label={status.label}
              variant={status.variant}
              domain="reproduction"
              compact
            />
          </View>
          {isAvailable ? (
            attemptNumber > 1 ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.warningContainer,
                }}
              >
                <Text
                  textRole="bodyStrong"
                  style={{ color: colors.warningForeground }}
                >
                  Re-insemination (Attempt {attemptNumber})
                </Text>
                <Text
                  textRole="body"
                  style={{ color: colors.warningForeground, marginTop: 4 }}
                >
                  Please review the attached heat evidence before accepting this
                  request.
                </Text>
              </View>
            ) : (
              <Text
                textRole="body"
                style={{ color: colors.textSecondary, marginTop: 12 }}
              >
                Request is available to accept and schedule a visit
              </Text>
            )
          ) : isClaimedUnscheduled ? (
            <Text
              textRole="bodyStrong"
              style={{ color: colors.warningForeground, marginTop: 12 }}
            >
              Request is awaiting scheduling. Tap “Set Visit” to schedule a
              visit.
            </Text>
          ) : null}
        </View>

        <View style={cardStyle}>
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            Farmer & Location
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

          {homeAddressString ? (
            <InfoLine icon={House} text={homeAddressString} />
          ) : null}

          {farmerLocation || candidateArea ? (
            <InfoLine
              icon={MapPinHouse}
              text={farmerLocation || candidateArea}
            />
          ) : null}

          {directionsNote ? (
            <DetailRow label="Directions" value={directionsNote} />
          ) : null}
          {latitude != null && longitude != null ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Get directions"
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`,
                )
              }
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
              <MapPinHouse size={17} color={colors.primary} />
              <Text textRole="bodyStrong" style={{ color: colors.primary }}>
                View Farm Location
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
                accessibilityLabel={`Animal ${cleanText(animal?.earTag) || "for this AI request"}`}
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
                <Syringe size={28} color={colors.textMuted} />
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
                  Reproductive status:{" "}
                  {formatLabel(animal.reproductiveStatus, "")}
                </Text>
              ) : null}
            </View>
          </View>

          <Text
            textRole="title"
            style={{ color: colors.textPrimary, marginTop: 24 }}
          >
            Request Details
          </Text>

          {farmerNotes ? (
            <DetailRow label="Farmer notes" value={farmerNotes} />
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
            AI Request Attachments
          </Text>
          {attachments.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 12 }}
            >
              {attachments.map((uri, index) => (
                <TouchableOpacity
                  key={uri}
                  onPress={() => setSelectedAttachment(uri)}
                >
                  <Image
                    source={{ uri }}
                    resizeMode="cover"
                    accessibilityLabel={`AI request attachment ${index + 1}`}
                    style={{ width: 112, height: 88, borderRadius: 12 }}
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
                  {visitPeriod ? ` · ${formatLabel(visitPeriod, "")}` : ""}
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
            {isPastSchedule ? (
              <View
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.warningContainer,
                }}
              >
                <Text
                  textRole="bodyStrong"
                  style={{ color: colors.warningForeground }}
                >
                  Scheduled visit has passed
                </Text>
                <Text
                  textRole="body"
                  style={{ color: colors.textSecondary, marginTop: 3 }}
                >
                  This service was scheduled for{" "}
                  {relativeScheduleDay || "an earlier date"}
                  {visitPeriod ? ` ${visitPeriod}` : ""}.
                </Text>
              </View>
            ) : null}
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

        {primaryLabel ? (
          <View style={cardStyle}>
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
                <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
                  {primaryLabel}
                </Text>
              )}
            </TouchableOpacity>

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
                  marginTop: 8,
                }}
              >
                <Text textRole="bodyStrong" style={{ color: colors.error }}>
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
      <AIScheduleModal
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
          }
        }}
        onErrorClear={() => setScheduleError(null)}
        onConfirm={handleSchedule}
      />

      <ConfirmationModal
        visible={earlyStartVisible}
        title="Start service early?"
        message={`This AI service is scheduled for ${relativeScheduleDay || "the planned visit"}${visitPeriod ? ` ${visitPeriod}` : ""}. Are you sure you want to start it now?`}
        confirmText="Start Early"
        cancelText="Go Back"
        isDestructive={false}
        onClose={() => setEarlyStartVisible(false)}
        onCancel={() => setEarlyStartVisible(false)}
        onConfirm={() => handleStartAIRecord(true)}
      />
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
              Cancel AI Request
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
      <Modal
        visible={!!selectedAttachment}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAttachment(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 16,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <View>
                <Text
                  style={{
                    color: "#111827",
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 17,
                  }}
                >
                  Attachment
                </Text>

                <Text
                  style={{
                    color: "#6B7280",
                    fontFamily: "Outfit_400Regular",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  Farmer submitted photo
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedAttachment(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={19} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Image */}
            {selectedAttachment ? (
              <View
                style={{
                  width: "100%",
                  height: 300,
                  backgroundColor: "#F3F4F6",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: selectedAttachment }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            {/* Close */}
            <TouchableOpacity
              onPress={() => setSelectedAttachment(null)}
              style={{
                marginTop: 16,
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#374151",
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 14,
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AIScheduleModal({
  visible,
  mode,
  isSubmitting,
  errorMessage,
  initialDate,
  initialVisitPeriod,
  onClose,
  onErrorClear,
  onConfirm,
}: {
  visible: boolean;
  mode: ScheduleMode;
  isSubmitting: boolean;
  errorMessage?: string | null;
  initialDate?: string | null;
  initialVisitPeriod?: VisitPeriod | null;
  onClose: () => void;
  onErrorClear?: () => void;
  onConfirm: (payload: AISchedulePayload) => Promise<void>;
}) {
  return (
    <VisitScheduleSheet
      visible={visible}
      title={mode === "reschedule" ? "Reschedule AI Visit" : "Set AI Visit"}
      description="Choose a visit day and service period. The farmer will see the confirmed window, not an exact appointment time."
      confirmLabel={
        mode === "accept"
          ? "Accept & Schedule"
          : mode === "reschedule"
            ? "Save New Visit"
            : "Schedule Visit"
      }
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      initialDate={initialDate}
      initialVisitPeriod={initialVisitPeriod}
      getPeriodAvailability={(date, period, now) =>
        getAISchedulePeriodAvailability(date, period, now)
      }
      onClose={onClose}
      onErrorClear={onErrorClear}
      onConfirm={onConfirm}
    />
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
