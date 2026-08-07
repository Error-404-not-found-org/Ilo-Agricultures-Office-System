import React, { useEffect, useMemo, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  Clock3,
  MapPin,
  Phone,
  Send,
  Syringe,
  UserRound,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

import { AppPageHeader } from "@/components/AppPageHeader";
import { StatusBadge } from "@/components/shared";
import { Text } from "@/components/ui/Text";
import { useApi } from "@/lib/api";
import { technicianKeys } from "@/lib/queryKeys";
import { useTheme } from "@/lib/theme";
import {
  declineTechnicianRequest,
  updateRequestStatus,
} from "@/features/technician/services/technician.service";
import { claimAndScheduleAIRequest } from "../services/technicianRequests.service";
import type { VisitPeriod } from "../types/technicianRequests.types";
import {
  formatLocalCalendarDate,
  getClaimScheduleErrorMessage,
  isCanonicalWorkflowId,
} from "../utils/aiWorkflow";

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
        request?.evidencePhotos,
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
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("accept");
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [reason, setReason] = useState("");
  const submittingRef = useRef(false);

  const requestId = getEntityId(request?._id || request?.id);
  const workflowId =
    [getEntityId(request?.workflowId), cleanText(routeWorkflowId), requestId].find(
      isCanonicalWorkflowId,
    ) || "";
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
  const farmLocation = farmer?.farmLocation || {};
  const landmark = cleanText(farmLocation.landmark);
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
  const candidateArea = [barangay, municipality]
    .filter(Boolean)
    .join(", ");
  const heatSigns = normalizeText(request?.heatSigns);
  const farmerNotes = normalizeText(
    request?.farmerNotes || request?.comment || request?.note,
    "\n\n",
  );
  const attachments = useMemo(() => getAttachmentUrls(request), [request]);
  const submittedAt = formatDate(request?.createdAt, true);
  const scheduledDate = formatDate(request?.scheduledDate);
  const visitPeriod = cleanText(request?.visitPeriod).toLowerCase() as VisitPeriod;

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

  const requireOnline = async () => {
    const connectivity = await NetInfo.fetch();
    if (
      connectivity.isConnected === false ||
      connectivity.isInternetReachable === false
    ) {
      setActionNotice(
        "Accepting and scheduling AI visits requires an internet connection.",
      );
      return false;
    }
    return true;
  };

  const handleSchedule = async (payload: AISchedulePayload) => {
    if (submittingRef.current || !(await requireOnline())) return;
    if (!workflowId) {
      setActionNotice("This AI request is missing its workflow identifier.");
      return;
    }

    submittingRef.current = true;
    setUpdating(true);
    setActionNotice(null);
    try {
      if (scheduleMode === "accept") {
        await claimAndScheduleAIRequest(api, workflowId, payload);
      } else {
        await updateRequestStatus(api, "ai", requestId, {
          status: "scheduled",
          scheduledDate: payload.scheduledDate,
          visitPeriod: payload.visitPeriod,
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
        setActionNotice(message);
        toast.error(message);
        setScheduleVisible(false);
        await invalidateWorkflow();
        router.replace({
          pathname: "/(technician)/(tabs)/technician.requests",
          params: { section: "openRequests" },
        });
        return;
      }
      setActionNotice(
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

  const primaryLabel = isAvailable
    ? "Accept & Set Visit"
    : isClaimedUnscheduled
      ? "Set Visit"
      : isScheduled
        ? "Record AI Service"
        : isInProgress
          ? "Continue AI Service"
          : isResolved
            ? "View AI Record"
            : "";

  const handlePrimaryAction = () => {
    if (isAvailable) openSchedule("accept");
    else if (isClaimedUnscheduled) openSchedule("schedule");
    else if (isScheduled || isInProgress) openAIRecord();
    else if (isResolved) {
      router.push("/(technician)/(tabs)/technician.records" as never);
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
      setActionNotice(getErrorMessage(error, "The request could not be declined."));
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
      setActionNotice(getErrorMessage(error, "The request could not be cancelled."));
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
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
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
              <Text textRole="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
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
            <Text textRole="body" style={{ color: colors.textSecondary, marginTop: 12 }}>
              Visit not scheduled
            </Text>
          ) : isClaimedUnscheduled ? (
            <Text textRole="bodyStrong" style={{ color: colors.warningForeground, marginTop: 12 }}>
              Needs scheduling
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
          {farmerLocation || candidateArea ? (
            <InfoLine icon={MapPin} text={farmerLocation || candidateArea} />
          ) : null}
          {barangay ? <DetailRow label="Barangay" value={barangay} /> : null}
          {municipality ? (
            <DetailRow label="Municipality" value={municipality} />
          ) : null}
          {landmark ? <DetailRow label="Landmark" value={landmark} /> : null}
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
              <MapPin size={17} color={colors.primary} />
              <Text textRole="bodyStrong" style={{ color: colors.primary }}>
                Get Directions
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
                Ear tag: {cleanText(animal?.earTag || animal?.animalId) || "Not recorded"}
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
                  Reproductive status: {formatLabel(animal.reproductiveStatus, "")}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={cardStyle}>
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            Request Details
          </Text>
          <DetailRow
            label="Heat signs"
            value={heatSigns ? formatLabel(heatSigns, "") : "No heat signs were submitted."}
          />
          {farmerNotes ? <DetailRow label="Farmer notes" value={farmerNotes} /> : null}
        </View>

        <View style={cardStyle}>
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            Attachments
          </Text>
          {attachments.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 12 }}
            >
              {attachments.map((uri, index) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  resizeMode="cover"
                  accessibilityLabel={`AI request attachment ${index + 1}`}
                  style={{ width: 112, height: 88, borderRadius: 12 }}
                />
              ))}
            </ScrollView>
          ) : (
            <Text textRole="body" style={{ color: colors.textSecondary, marginTop: 8 }}>
              No attachments submitted.
            </Text>
          )}
        </View>

        {submittedAt ? (
          <View style={cardStyle}>
            <InfoLine icon={Send} text={`Submitted ${submittedAt}`} />
          </View>
        ) : null}

        {isClaimedUnscheduled || isScheduled || isInProgress ? (
          <View style={cardStyle}>
            <Text textRole="title" style={{ color: colors.textPrimary }}>
              {isClaimedUnscheduled ? "Visit" : "Scheduled Visit"}
            </Text>
            {scheduledDate ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
                <CalendarDays size={18} color={colors.primary} />
                <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                  {scheduledDate}
                  {visitPeriod ? ` · ${formatLabel(visitPeriod, "")}` : ""}
                </Text>
              </View>
            ) : (
              <Text textRole="bodyStrong" style={{ color: colors.warningForeground, marginTop: 8 }}>
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
            <Text textRole="body" style={{ flex: 1, color: colors.errorForeground }}>
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
                style={{ minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 }}
              >
                <Text textRole="bodyStrong" style={{ color: colors.textSecondary }}>
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
                style={{ minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 }}
              >
                <Text textRole="bodyStrong" style={{ color: colors.errorForeground }}>
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
        initialDate={scheduleMode === "reschedule" ? request?.scheduledDate : null}
        initialVisitPeriod={scheduleMode === "reschedule" ? visitPeriod : null}
        onClose={() => {
          if (!updating) setScheduleVisible(false);
        }}
        onConfirm={handleSchedule}
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
            style={{ width: "100%", maxWidth: 420, padding: 20, borderRadius: 16, backgroundColor: colors.card }}
          >
            <Text textRole="title" style={{ color: colors.textPrimary }}>
              Cancel AI Request
            </Text>
            <Text textRole="body" style={{ color: colors.textSecondary, marginTop: 6 }}>
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
                style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
              >
                <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                  Keep Request
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={updating || !reason.trim()}
                onPress={handleCancel}
                style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.errorForeground, opacity: updating || !reason.trim() ? 0.55 : 1 }}
              >
                {updating ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
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

function AIScheduleModal({
  visible,
  mode,
  isSubmitting,
  initialDate,
  initialVisitPeriod,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  mode: ScheduleMode;
  isSubmitting: boolean;
  initialDate?: string | null;
  initialVisitPeriod?: VisitPeriod | null;
  onClose: () => void;
  onConfirm: (payload: AISchedulePayload) => Promise<void>;
}) {
  const { colors, isDark } = useTheme();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const initial = initialDate ? new Date(initialDate) : today;
  if (Number.isNaN(initial.getTime())) initial.setTime(today.getTime());
  initial.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState(initial);
  const [dateChoice, setDateChoice] = useState<"today" | "tomorrow" | "custom">("today");
  const [visitPeriod, setVisitPeriod] = useState<VisitPeriod | null>(initialVisitPeriod || null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const nextDate = initialDate ? new Date(initialDate) : new Date();
    if (Number.isNaN(nextDate.getTime())) nextDate.setTime(Date.now());
    nextDate.setHours(0, 0, 0, 0);
    setSelectedDate(nextDate);
    setDateChoice(initialDate ? "custom" : "today");
    setVisitPeriod(initialVisitPeriod || null);
    setShowDatePicker(false);
  }, [initialDate, initialVisitPeriod, visible]);

  const selectRelativeDate = (choice: "today" | "tomorrow") => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    if (choice === "tomorrow") value.setDate(value.getDate() + 1);
    setDateChoice(choice);
    setSelectedDate(value);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: colors.modalBackdrop }}>
        <Pressable accessible={false} disabled={isSubmitting} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 420, alignSelf: "center", padding: 20, borderRadius: 16, backgroundColor: colors.card }}>
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            {mode === "reschedule" ? "Reschedule AI Visit" : "Set AI Visit"}
          </Text>

          <Text textRole="label" style={{ color: colors.textMuted, marginTop: 18, marginBottom: 8 }}>
            Visit Date
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["today", "tomorrow", "custom"] as const).map((choice) => (
              <TouchableOpacity
                key={choice}
                accessibilityRole="button"
                onPress={() => {
                  if (choice === "custom") {
                    setDateChoice("custom");
                    setShowDatePicker(true);
                  } else selectRelativeDate(choice);
                }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: dateChoice === choice ? colors.primary : colors.border,
                  backgroundColor: dateChoice === choice ? (isDark ? colors.successContainer : colors.tint) : colors.card,
                }}
              >
                <Text textRole="label" style={{ color: dateChoice === choice ? colors.primary : colors.textSecondary }}>
                  {choice === "today" ? "Today" : choice === "tomorrow" ? "Tomorrow" : "Choose date"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
            <CalendarDays size={17} color={colors.primary} />
            <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
              {selectedDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
            </Text>
          </View>

          <Text textRole="label" style={{ color: colors.textMuted, marginTop: 18, marginBottom: 8 }}>
            Visit Period
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["morning", "afternoon"] as const).map((period) => (
              <TouchableOpacity
                key={period}
                accessibilityRole="button"
                onPress={() => setVisitPeriod(period)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: visitPeriod === period ? colors.primary : colors.border,
                  backgroundColor: visitPeriod === period ? (isDark ? colors.successContainer : colors.tint) : colors.card,
                }}
              >
                <Clock3 size={16} color={colors.primary} />
                <Text textRole="bodyStrong" style={{ color: colors.textPrimary, textTransform: "capitalize" }}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={onClose}
              style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
            >
              <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={isSubmitting || !visitPeriod}
              onPress={() =>
                onConfirm({
                  scheduledDate: formatLocalCalendarDate(selectedDate),
                  visitPeriod: visitPeriod as VisitPeriod,
                })
              }
              style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primary, opacity: isSubmitting || !visitPeriod ? 0.55 : 1 }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
                  {mode === "accept" ? "Accept & Schedule" : "Save Visit"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showDatePicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          minimumDate={today}
          onChange={(_, value) => {
            setShowDatePicker(false);
            if (value) {
              value.setHours(0, 0, 0, 0);
              setSelectedDate(value);
              setDateChoice("custom");
            }
          }}
        />
      ) : null}
    </Modal>
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
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 12 }}>
      <Icon size={17} color={colors.textMuted} style={{ marginTop: 1 }} />
      <Text textRole="body" style={{ flex: 1, color: colors.textPrimary }}>
        {text}
      </Text>
    </View>
  );
}
