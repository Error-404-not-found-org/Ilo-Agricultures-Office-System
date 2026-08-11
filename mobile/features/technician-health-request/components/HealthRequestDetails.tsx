import React, { useMemo, useState } from "react";
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
  HeartPulse,
  MapPin,
  Phone,
  Send,
  Stethoscope,
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
  cancelTechnicianHealthRequest,
  declineTechnicianRequest,
  updateRequestStatus,
} from "@/features/technician/services/technician.service";
import { claimTechnicianRequest } from "@/features/technician-requests/services/technicianRequests.service";
import type { VisitPeriod } from "@/features/technician-requests/types/technicianRequests.types";
import {
  HealthVisitScheduleModal,
  type HealthVisitSchedulePayload,
} from "./HealthVisitScheduleModal";

type ScheduleMode = "accept" | "schedule" | "reschedule";

interface HealthRequestDetailsProps {
  request: any;
  routeTaskId?: string;
  routeWorkflowId?: string;
  onRefresh: () => Promise<void>;
  onBack: () => void;
}

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

  const structured = [
    cleanText(address.houseNumber),
    cleanText(address.street),
    cleanText(address.subdivision),
    cleanText(address.barangay),
    cleanText(address.city || address.municipality),
    cleanText(address.province),
  ]
    .filter(Boolean)
    .join(", ");
  if (structured) return structured;

  return [
    cleanText(address.barangay),
    cleanText(address.city || address.municipality),
  ]
    .filter(Boolean)
    .join(", ");
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
  const [updating, setUpdating] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [reason, setReason] = useState("");

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
                  label: formatLabel(request?.status, "Health request"),
                  variant: "neutral",
                };

  const farmerName = cleanText(farmer?.name) || cleanText(request?.farmerName);
  const farmerAddress = Array.isArray(farmer?.address)
    ? farmer.address[0] || {}
    : farmer?.address || {};
  const barangay =
    cleanText(farmerAddress.barangay) || cleanText(request?.barangay);
  const municipality =
    cleanText(farmerAddress.city || farmerAddress.municipality) ||
    cleanText(request?.municipality);
  const candidateArea = [barangay, municipality]
    .filter(Boolean)
    .join(", ");
  const farmerPhone = cleanText(farmer?.phoneNumber || farmer?.phone);
  const farmerLocation = farmer ? getFarmerLocation(farmer) : "";
  const farmLocation = farmer?.farmLocation || {};
  const landmark = cleanText(farmLocation.landmark);
  const latitude = farmLocation.latitude ?? farmerAddress?.coordinates?.lat;
  const longitude = farmLocation.longitude ?? farmerAddress?.coordinates?.lng;
  const directionsNote = cleanText(
    farmLocation.directionsNote || farmerAddress?.directionsNote,
  );
  const photos = useMemo(() => getPhotoUrls(request), [request]);
  const symptoms = normalizeText(request?.symptoms);
  const farmerNotes = normalizeText(request?.farmerNotes, "\n\n");
  const submittedDate = formatDate(request?.createdAt);
  const submittedAt = formatDate(request?.createdAt, true);
  const scheduledDate = formatDate(request?.scheduledDate);
  const visitPeriod = cleanText(
    request?.visitPeriod,
  ).toLowerCase() as VisitPeriod;

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
    ]);
  };

  const requireOnline = async () => {
    const connectivity = await NetInfo.fetch();
    if (
      connectivity.isConnected === false ||
      connectivity.isInternetReachable === false
    ) {
      setActionNotice(
        "Accepting and scheduling Health visits requires an internet connection.",
      );
      return false;
    }
    return true;
  };

  const handleClaimConflict = async () => {
    const message =
      "This request was claimed by another technician. Refreshing your work list.";
    setActionNotice(message);
    toast.error(message);
    setScheduleVisible(false);
    await invalidateHealthWorkflow();
    await onRefresh();
  };

  const handleSchedule = async (payload: HealthVisitSchedulePayload) => {
    if (!(await requireOnline())) return;
    setUpdating(true);
    setActionNotice(null);
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
          setActionNotice(message);
          toast.error(message);
          setScheduleVisible(false);
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
      setActionNotice(
        getErrorMessage(error, "The Health visit could not be scheduled."),
      );
    } finally {
      setUpdating(false);
    }
  };

  const openSchedule = (mode: ScheduleMode) => {
    setScheduleMode(mode);
    setScheduleVisible(true);
    setActionNotice(null);
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
    if (isResolved) {
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
          : isResolved
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
                Health Assistance
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
            <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
              {formatLabel(request?.urgency, "Normal")}
            </Text>
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
                {cleanText(animal?.earTag || animal?.animalId) || "Not recorded"}
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
            Request Details
          </Text>
          <DetailRow
            label="Request type"
            value={formatLabel(request?.requestType, "Health assistance")}
          />
          <DetailRow
            label="Symptoms"
            value={symptoms || "No symptoms were described."}
          />
          {farmerNotes ? (
            <DetailRow label="Farmer notes" value={farmerNotes} />
          ) : null}

          {submittedAt ? (
            <View style={{ marginTop: 8 }}>
              <InfoLine icon={Send} text={`Submitted ${submittedAt}`} />
            </View>
          ) : null}

          <Text textRole="title" style={{ color: colors.textPrimary, marginTop: 24 }}>
            Attachments
          </Text>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 12 }}
            >
              {photos.map((uri, index) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  resizeMode="cover"
                  accessibilityLabel={`Health request photo ${index + 1}`}
                  style={{ width: 112, height: 88, borderRadius: 12 }}
                />
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
                <Text
                  textRole="bodyStrong"
                  style={{ color: colors.textSecondary }}
                >
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
        initialDate={
          scheduleMode === "reschedule" ? request?.scheduledDate : null
        }
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
