import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  Syringe,
  Info,
  XCircle,
  Ban,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { aiRequestKeys } from "@/lib/queryKeys";
import { Skeleton } from "@/components/ui/Skeleton";
import { ImageViewerModal, type ImageViewerItem } from "@/components/shared";
import {
  FarmerScreen,
  AsyncState,
  SectionHeader,
  StatusBadge,
  WorkflowProgress,
} from "@/features/farmer-ui/components";
import { FarmerRequestHeader } from "@/features/farmer-requests/components/FarmerRequestHeader";
import {
  RequestDetailCard,
  RequestDetailField,
  RequestDetailNotice,
  RequestDetailRow,
} from "@/features/farmer-requests/components/RequestDetailPrimitives";
import {
  formatRequestDateTime,
  formatVisitSchedule,
  getFarmerAINextStepMessage,
  getFarmerAIProgressIndex,
  getFarmerAIStatusLabel,
  getRequestList,
  getRequestText,
} from "@/features/farmer-requests/utils/requestDetailPresentation";
import {
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
  getFarmerBreedingObservationReadiness,
} from "@/features/breeding/utils/breedingObservationPresentation";
import type { AIRequest } from "@/types";

const stages = [
  { key: "pending", label: "Submitted" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in-progress", label: "In Progress" },
  { key: "done", label: "Completed" },
];

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

const heatSignMap: Record<string, string> = {
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

function AiRequestDetailSkeleton() {
  const { colors } = useTheme();

  return (
    <FarmerScreen scroll={false}>
      <FarmerRequestHeader title="AI Request Details" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Concern Card Skeleton */}
        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-2">
              <Skeleton width="70%" height={16} radius={4} />
              <Skeleton width="30%" height={12} radius={3} />
            </View>
            <Skeleton width={80} height={20} radius={10} />
          </View>

          {/* Breeding Details Skeleton */}
          <View className="pt-3 border-t border-slate-100 dark:border-slate-800/50">
            <View className="flex-row flex-wrap gap-6">
              <View className="gap-1.5">
                <Skeleton width={60} height={8} radius={2} />
                <Skeleton width={80} height={12} radius={3} />
              </View>
              <View className="gap-1.5">
                <Skeleton width={60} height={8} radius={2} />
                <Skeleton width={100} height={12} radius={3} />
              </View>
            </View>
          </View>

          {/* Observed Heat Signs Skeleton */}
          <View className="gap-2">
            <Skeleton
              width="40%"
              height={10}
              radius={2}
              style={{ marginBottom: 8 }}
            />
            <View className="flex-row flex-wrap gap-2">
              <Skeleton width={90} height={22} radius={11} />
              <Skeleton width={110} height={22} radius={11} />
              <Skeleton width={70} height={22} radius={11} />
            </View>
          </View>

          {/* Image Gallery Skeleton */}
          <View className="flex-row gap-2 mt-1">
            {[1, 2].map((item) => (
              <Skeleton key={item} width={64} height={64} radius={10} />
            ))}
          </View>
        </View>

        {/* Progress Card Skeleton */}
        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Skeleton width="50%" height={16} radius={4} />
          {/* Progress workflow stepper bar mock */}
          <View className="flex-row justify-between items-center py-4 px-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <View key={s} className="items-center gap-1.5">
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.border,
                  }}
                />
                <Skeleton width={45} height={8} radius={2} />
              </View>
            ))}
          </View>

          <View className="pt-3 border-t border-slate-100 dark:border-slate-800/50 flex-row items-start gap-2.5">
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.border,
                marginTop: 2,
              }}
            />
            <View className="flex-1 gap-2">
              <Skeleton width="90%" height={12} radius={3} />
              <Skeleton width="60%" height={12} radius={3} />
            </View>
          </View>
        </View>

        {/* Response Card Skeleton */}
        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Skeleton
            width="65%"
            height={16}
            radius={4}
            style={{ marginBottom: 4 }}
          />

          <View className="gap-4">
            <View className="flex-row items-center gap-2.5">
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.border,
                }}
              />
              <Skeleton width="50%" height={14} radius={3} />
            </View>
            <View className="flex-row items-center gap-2.5">
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.border,
                }}
              />
              <Skeleton width="70%" height={14} radius={3} />
            </View>
          </View>
        </View>
      </ScrollView>
    </FarmerScreen>
  );
}

export default function AiRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  const query = useQuery({
    queryKey: aiRequestKeys.detail(id || ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/ai-request/${id}`);
      return res.data.data;
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void queryClient.invalidateQueries({
        queryKey: aiRequestKeys.detail(id),
        exact: true,
        refetchType: "active",
      });
    }, [id, queryClient]),
  );

  const galleryImages = useMemo<ImageViewerItem[]>(() => {
    const request = query.data;
    if (!request) return [];

    const photoUris = getRequestList(
      request.photos?.length ? request.photos : [request.imageUrl],
    ).slice(0, 5);

    return photoUris.map((uri, index) => ({
      uri,
      fileName: `ai-request-photo-${index + 1}`,
      accessibilityLabel: `AI request photo ${index + 1} of ${photoUris.length}`,
    }));
  }, [query.data]);

  if (query.isLoading) {
    return <AiRequestDetailSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <FarmerScreen>
        <FarmerRequestHeader title="AI Request Details" />
        <View className="flex-1 items-center justify-center px-6">
          <AsyncState
            state="error"
            message="This AI insemination request could not be loaded."
            onAction={() => query.refetch()}
          />
        </View>
      </FarmerScreen>
    );
  }

  const request = query.data as AIRequest;
  const animal: any = request.animalId || {};
  const handler: any = request.technicianId || request.approvedBy;

  const status = getRequestText(request.status)?.toLowerCase() || "unknown";
  const statusLabel = getFarmerAIStatusLabel(status);
  const animalLabel =
    getRequestText(animal.earTag) ||
    getRequestText(animal.animalId) ||
    (typeof request.animalId === "string"
      ? getRequestText(request.animalId)
      : null) ||
    "Animal identifier not provided";
  const attemptNumber = getRequestText(request.attemptNumber);
  const estrus = getRequestText(request.estrus);
  const sireBreed = getRequestText(request.sireBreed);
  const sireCode = getRequestText(request.sireCode);
  const notes = getRequestText(
    getAdditionalNotesOnly(getRequestText(request.comment) || ""),
  );
  const cancellationReasonDisplay = getRequestText(request.cancellationReason);
  const cancellationResponseReason = getRequestText(
    request.cancellationResponseReason,
  );
  const heatSigns = getRequestList(request.heatSigns).filter(
    (sign) => heatSignMap[sign],
  );
  const handlerName = getRequestText(handler?.name);
  const hasHandlerReference = Boolean(
    handlerName ||
    (typeof handler === "string" ? getRequestText(handler) : handler?._id),
  );
  const handlerRole = getRequestText(handler?.role) || "technician";
  const visitSchedule = formatVisitSchedule(
    request.scheduledDate,
    request.visitPeriod,
  );
  const preferredDate = formatVisitSchedule(request.preferredDate, null);
  const inseminationDate = formatRequestDateTime(
    request.inseminationDate,
    (date) => format(date, "MMM d, yyyy 'at' h:mm a"),
  );
  const technicianNote = getRequestText(request.technicianNote);
  const hasRecordedObservation = Boolean(request.farmerOutcomeReport);
  const observationReadiness = getFarmerBreedingObservationReadiness(request);
  const observationLabel = getBreedingObservationLabel(
    request.farmerOutcomeReport,
  );
  const observationSigns = (request.farmerObservationSigns || []).map(
    getBreedingObservationSignLabel,
  );
  const hasBreedingDetails = Boolean(estrus || sireBreed || sireCode);
  const showProgress =
    status !== "unknown" && status !== "cancelled" && status !== "rejected";
  const nextStepMessage = getFarmerAINextStepMessage(status, visitSchedule);

  return (
    <FarmerScreen scroll={false}>
      <FarmerRequestHeader title="AI Request Details" />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Concern Card */}
        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 16,
                  lineHeight: 21,
                }}
              >
                Artificial Insemination
              </Text>

              <Text
                className="mt-1"
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
                }}
              >
                {animalLabel}
                {attemptNumber ? ` · Attempt ${attemptNumber}` : ""}
              </Text>
            </View>

            {statusLabel ? <StatusBadge label={statusLabel} /> : null}
          </View>

          {/* Breeding Details */}
          {hasBreedingDetails ? (
            <View className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <View className="flex-row flex-wrap gap-4">
                {estrus ? (
                  <RequestDetailField label="Estrus type" value={estrus} />
                ) : null}
                {sireBreed ? (
                  <RequestDetailField label="Sire breed" value={sireBreed} />
                ) : null}
                {sireCode ? (
                  <RequestDetailField label="Sire code" value={sireCode} />
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Observed Heat Signs Badges */}
          {heatSigns.length > 0 ? (
            <View className="mt-4">
              <Text
                className="text-[10px] font-bold uppercase mb-2"
                style={{ color: colors.textMuted }}
              >
                Observed Heat Signs
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {heatSigns.map((signId: string) => {
                  const label = heatSignMap[signId];
                  const isPrimary = signId === "standing_heat";
                  const isBleeding = signId === "metestrus_bleeding";

                  let badgeBg = isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5";
                  let badgeText = isDark ? "#34d399" : "#065F46";
                  let badgeBorder = isDark
                    ? "rgba(16, 185, 129, 0.2)"
                    : "#d1fae5";

                  if (isPrimary) {
                    badgeBg = isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7";
                    badgeText = isDark ? "#fbbf24" : "#92400E";
                    badgeBorder = isDark
                      ? "rgba(245, 158, 11, 0.2)"
                      : "#FEF3C7";
                  } else if (isBleeding) {
                    badgeBg = isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2";
                    badgeText = isDark ? "#f87171" : "#991B1B";
                    badgeBorder = isDark ? "rgba(239, 68, 68, 0.2)" : "#fecaca";
                  }

                  return (
                    <View
                      key={signId}
                      className="px-2.5 py-1 rounded-xl border"
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

          {notes ? (
            <Text
              className="mt-3"
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              Your note: {notes}
            </Text>
          ) : null}

          {galleryImages.length ? (
            <View className="flex-row flex-wrap gap-2 mt-3">
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
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: colors.border,
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
            </View>
          ) : null}
        </View>

        <RequestDetailCard title="What Happens Next">
          <RequestDetailNotice message={nextStepMessage} />
        </RequestDetailCard>

        {/* Progress Card */}
        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <SectionHeader title="Insemination progress" />
          {showProgress ? (
            <View className="mt-2">
              <WorkflowProgress
                steps={stages}
                currentIndex={getFarmerAIProgressIndex(status)}
              />
            </View>
          ) : null}
          <View className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex-row items-start gap-2.5">
            <Info
              size={16}
              color={colors.textSecondary}
              style={{ marginTop: 2 }}
            />
            <Text
              className="flex-1 leading-5 text-[12px]"
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
              }}
            >
              {nextStepMessage}
            </Text>
          </View>
        </View>

        <RequestDetailCard
          title="Visit and service details"
          description="Assignment, appointment, and technician-provided insemination information."
        >
          <RequestDetailRow
            icon={<Syringe size={17} color={colors.primary} />}
            label="Assigned technician"
            value={
              handlerName
                ? `${handlerName} (${handlerRole})`
                : hasHandlerReference
                  ? "Assigned technician details are not yet available"
                  : "Not assigned yet"
            }
          />
          <RequestDetailRow
            icon={<CalendarClock size={17} color={colors.primary} />}
            label={
              visitSchedule
                ? "Confirmed visit"
                : preferredDate
                  ? "Legacy preferred date"
                  : "Visit schedule"
            }
            value={visitSchedule || preferredDate || "Not scheduled yet"}
            isLast={!inseminationDate}
          />
          {inseminationDate ? (
            <RequestDetailRow
              icon={<CheckCircle2 size={17} color={colors.primary} />}
              label="Insemination performed"
              value={inseminationDate}
              isLast
            />
          ) : null}

          {technicianNote || hasRecordedObservation ? (
            <View className="pt-4 gap-4">
              {technicianNote ? (
                <RequestDetailField
                  label="Technician note"
                  value={technicianNote}
                />
              ) : null}
              {hasRecordedObservation ? (
                <RequestDetailField
                  label="Farmer observation"
                  value={[
                    observationLabel,
                    observationSigns.length
                      ? observationSigns.join(", ")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : null}
              {hasRecordedObservation ? (
                <RequestDetailNotice message="This is a farmer observation, not an official pregnancy diagnosis. A technician pregnancy check is still required." />
              ) : null}
            </View>
          ) : (
            <View className="mt-3">
              <RequestDetailNotice message="Technician service notes are not yet available." />
            </View>
          )}
        </RequestDetailCard>

        {/* Canonical farmer-observation entry point */}
        {request.status === "done" && request.isSuccess === null && (
          <View
            className="mx-5 mt-5 p-4 border"
            style={{
              borderRadius: 16,
              backgroundColor: isDark ? "rgba(16, 185, 129, 0.05)" : "#F0FDF4",
              borderColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#DCFCE7",
            }}
          >
            <View className="flex-row gap-2 items-start mb-2">
              <Info size={16} color="#059669" className="mt-0.5" />
              <View className="flex-1">
                <Text
                  className="text-[13px] font-bold text-slate-800 dark:text-slate-100"
                  style={{ color: isDark ? "#a7f3d0" : "#14532d" }}
                >
                  {hasRecordedObservation
                    ? "Farmer observation submitted"
                    : "Breeding follow-up"}
                </Text>
                <Text
                  className="text-[11px] mt-0.5"
                  style={{ color: isDark ? "#6ee7b7" : "#166534" }}
                >
                  {hasRecordedObservation
                    ? "Your report is visible to the technician. It does not confirm pregnancy until an official pregnancy check is completed."
                    : observationReadiness.message}
                </Text>
              </View>
            </View>

            {(hasRecordedObservation || observationReadiness.isAvailable) ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(farmer)/report-breeding-observation",
                  params: {
                    animalId:
                      typeof request.animalId === "object"
                        ? request.animalId?._id
                        : request.animalId,
                    requestId: id,
                    defaultReport: request.farmerOutcomeReport || "unsure",
                  },
                } as never)
              }
              className="mt-3 py-3 rounded-xl items-center justify-center bg-emerald-700 active:bg-emerald-800"
            >
              <Text className="text-white text-xs font-bold">
                {hasRecordedObservation
                  ? observationReadiness.isAvailable
                    ? "Update observation"
                    : "View observation"
                  : "Report an observation"}
              </Text>
            </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Cancellation Banner/Request block */}
        {request.cancellationStatus === "rejected" ? (
          <View
            className="mx-5 mt-5 p-4 border"
            style={{
              borderRadius: 16,
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.08)" : "#FEF2F2",
              borderColor: isDark ? "rgba(239, 68, 68, 0.25)" : "#FECACA",
            }}
          >
            <View className="flex-row gap-2 items-start">
              <AlertCircle size={18} color={colors.error} />
              <View className="flex-1">
                <Text
                  className="text-[13px] font-black uppercase tracking-wider"
                  style={{ color: colors.error }}
                >
                  Cancellation Not Approved
                </Text>
                <Text
                  className="text-[11px] mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  This visit remains scheduled. You may submit another request
                  if the situation changes.
                </Text>
                {cancellationResponseReason ? (
                  <Text
                    className="text-[11px] mt-2 italic font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    Reason: {cancellationResponseReason}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {request.cancellationStatus === "requested" ? (
          <View
            className="mx-5 mt-5 p-4 border"
            style={{
              borderRadius: 16,
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.05)" : "#FFFBEB",
              borderColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7",
            }}
          >
            <View className="flex-row gap-2 items-start">
              <XCircle size={18} color={isDark ? "#fbbf24" : "#d97706"} />
              <View className="flex-1">
                <Text
                  className="text-[13px] font-black uppercase tracking-wider"
                  style={{ color: isDark ? "#fbbf24" : "#92400E" }}
                >
                  Pending Cancellation
                </Text>
                <Text
                  className="text-[11px] mt-1"
                  style={{ color: isDark ? "#fde68a" : "#b45309" }}
                >
                  You requested to cancel this scheduled visit. This is
                  currently pending technician review.
                </Text>
                {cancellationReasonDisplay ? (
                  <Text
                    className="text-[11px] mt-2 italic font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    &quot;{cancellationReasonDisplay}&quot;
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : ["pending", "approved", "scheduled"].includes(request.status) ? (
          <View className="mx-5 mt-6 mb-8">
            <TouchableOpacity
              onPress={() => {
                setCancellationReason("");
                setReasonModalVisible(true);
              }}
              className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2"
              style={{
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                borderWidth: 1,
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FEE2E2",
              }}
            >
              {request.status === "scheduled" ? (
                <Ban size={18} color={colors.error} />
              ) : (
                <XCircle size={18} color={colors.error} />
              )}
              <Text
                className="text-[13px] font-black uppercase tracking-widest"
                style={{ color: colors.error }}
              >
                {request.status === "scheduled"
                  ? "Request Cancellation"
                  : "Cancel Request"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ImageViewerModal
          visible={galleryVisible}
          images={galleryImages}
          initialIndex={galleryInitialIndex}
          title="AI request photos"
          onClose={() => setGalleryVisible(false)}
        />

        {/* Cancellation Reason Modal */}
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
                    {request.status === "scheduled"
                      ? "Request Cancellation"
                      : "Cancel Request"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setReasonModalVisible(false)}
                  >
                    <XCircle size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {request.status === "scheduled"
                  ? (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const scheduledDay = request.scheduledDate
                        ? new Date(request.scheduledDate)
                        : null;
                      if (scheduledDay) scheduledDay.setHours(0, 0, 0, 0);
                      const isReadyToday =
                        scheduledDay &&
                        scheduledDay.getTime() === today.getTime();

                      return (
                        <View
                          className="flex-row items-start gap-2 p-3 rounded-xl border mb-4"
                          style={{
                            backgroundColor: isDark
                              ? "rgba(245, 158, 11, 0.1)"
                              : "#FFFBEB",
                            borderColor: isDark
                              ? "rgba(245, 158, 11, 0.3)"
                              : "#FEF3C7",
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
                            {isReadyToday
                              ? "This visit is scheduled for today. Please contact your assigned technician or the Municipal Agriculture Office."
                              : "This visit is already scheduled. Your request will be sent to your assigned technician for review."}
                          </Text>
                        </View>
                      );
                    })()
                  : null}

                <Text
                  className="text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ color: colors.textMuted }}
                >
                  Reason for Cancellation{" "}
                  {request.status === "scheduled" ? "*" : "(Optional)"}
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
                  onPress={async () => {
                    if (
                      request.status === "scheduled" &&
                      !cancellationReason.trim()
                    ) {
                      toast.error("Please provide a reason for cancellation.");
                      return;
                    }
                    setIsSubmittingCancel(true);
                    try {
                      await api.patch(`/ai-request/${id}/cancel`, {
                        reason: cancellationReason.trim(),
                      });
                      toast.success(
                        request.status === "scheduled"
                          ? "Cancellation request submitted"
                          : "Request cancelled successfully",
                      );
                      setReasonModalVisible(false);
                      queryClient.invalidateQueries({
                        queryKey: ["ai-request", id],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ["farmer", "ai-requests"],
                      });
                    } catch (err: any) {
                      toast.error(
                        err.response?.data?.message ||
                          "Failed to cancel request",
                      );
                    } finally {
                      setIsSubmittingCancel(false);
                    }
                  }}
                  disabled={
                    isSubmittingCancel ||
                    (request.status === "scheduled" &&
                      !cancellationReason.trim())
                  }
                  className="mt-4 py-4 rounded-2xl items-center"
                  style={{
                    backgroundColor:
                      isSubmittingCancel ||
                      (request.status === "scheduled" &&
                        !cancellationReason.trim())
                        ? colors.border
                        : colors.error,
                  }}
                >
                  <Text className="text-[13px] font-black text-white">
                    {isSubmittingCancel
                      ? "Processing..."
                      : request.status === "scheduled"
                        ? "Submit Cancellation Request"
                        : "Cancel Request"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </FarmerScreen>
  );
}
