import React, { useState } from "react";
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
  FileText,
  Stethoscope,
  Info,
  AlertCircle,
  XCircle,
  Ban,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Skeleton } from "@/components/ui/Skeleton";
import { getHealthRequestDetail } from "@/features/health-requests/services/healthRequests.service";
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
  getRequestList,
  getRequestText,
} from "@/features/farmer-requests/utils/requestDetailPresentation";

const stages = [
  { key: "pending", label: "Submitted" },
  { key: "triaged", label: "Reviewed" },
  { key: "scheduled", label: "Visit scheduled" },
  { key: "in_progress", label: "Assistance in progress" },
  { key: "resolved", label: "Resolved" },
];

const stageIndex = (status?: string) =>
  ({
    pending: 0,
    triaged: 1,
    assigned: 1,
    approved: 1,
    scheduled: 2,
    "in-progress": 3,
    in_progress: 3,
    resolved: 4,
    done: 4,
  })[status || "pending"] ?? 0;

function HealthRequestDetailSkeleton() {
  const { colors } = useTheme();

  return (
    <FarmerScreen scroll={false}>
      <FarmerRequestHeader title="Health Request Details" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
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
              <Skeleton width="72%" height={16} radius={4} />
              <Skeleton width="38%" height={12} radius={3} />
            </View>
            <Skeleton width={78} height={20} radius={10} />
          </View>

          <View className="gap-2">
            <Skeleton width="96%" height={12} radius={3} />
            <Skeleton width="88%" height={12} radius={3} />
            <Skeleton width="54%" height={12} radius={3} />
          </View>

          <View className="flex-row gap-2 mt-1">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} width={64} height={64} radius={10} />
            ))}
          </View>
        </View>

        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Skeleton width="44%" height={16} radius={4} />
          <View className="flex-row justify-between items-center py-4 px-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <View key={step} className="items-center gap-1.5">
                <Skeleton shape="circle" height={18} />
                <Skeleton width={42} height={8} radius={2} />
              </View>
            ))}
          </View>
          <View className="pt-3 border-t border-slate-100 dark:border-slate-800/50 flex-row items-start gap-2.5">
            <Skeleton shape="circle" height={16} style={{ marginTop: 2 }} />
            <View className="flex-1 gap-2">
              <Skeleton width="92%" height={12} radius={3} />
              <Skeleton width="68%" height={12} radius={3} />
            </View>
          </View>
        </View>

        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <Skeleton width="36%" height={16} radius={4} />
          {[1, 2].map((row) => (
            <View key={row} className="flex-row items-center gap-2.5">
              <Skeleton shape="circle" height={18} />
              <Skeleton
                width={row === 1 ? "58%" : "74%"}
                height={14}
                radius={3}
              />
            </View>
          ))}
          <View className="gap-2 mt-1">
            <Skeleton width="28%" height={10} radius={2} />
            <Skeleton width="96%" height={12} radius={3} />
            <Skeleton width="72%" height={12} radius={3} />
          </View>
        </View>

        <Skeleton
          width="90%"
          height={46}
          radius={12}
          style={{ alignSelf: "center", marginTop: 20 }}
        />
      </ScrollView>
    </FarmerScreen>
  );
}

export default function HealthRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const query = useQuery({
    queryKey: ["health-request", id],
    enabled: Boolean(id),
    queryFn: () => getHealthRequestDetail(api, id),
  });

  if (query.isLoading) {
    return <HealthRequestDetailSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <FarmerScreen>
        <FarmerRequestHeader title="Health Request Details" />
        <View className="flex-1 items-center justify-center px-6">
          <AsyncState
            state="error"
            message="This health request could not be loaded."
            onAction={() => query.refetch()}
          />
        </View>
      </FarmerScreen>
    );
  }

  const request: any = query.data;
  const animal: any = request.animalId || {};
  const handler: any =
    request.assignedVeterinarianId ||
    request.assignedTechnicianId ||
    request.handledBy;

  const statusLabel = getRequestText(request.status);
  const status = statusLabel?.toLowerCase() || "unknown";
  const requestType =
    getRequestText(request.requestType)?.replaceAll("_", " ") ||
    "Health concern";
  const animalLabel =
    getRequestText(animal.earTag) ||
    getRequestText(animal.animalId) ||
    (typeof request.animalId === "string"
      ? getRequestText(request.animalId)
      : null) ||
    "Animal identifier not provided";
  const urgency = getRequestText(request.urgency);
  const symptoms = getRequestText(request.symptoms);
  const farmerNotes = getRequestText(request.farmerNotes);
  const cancellationReasonDisplay = getRequestText(request.cancellationReason);
  const cancellationResponseReason = getRequestText(
    request.cancellationResponseReason,
  );
  const handlerName = getRequestText(handler?.name);
  const hasHandlerReference = Boolean(
    handlerName ||
      (typeof handler === "string" ? getRequestText(handler) : handler?._id),
  );
  const handlerRole = getRequestText(handler?.role) || "technician";
  const scheduledDate = formatRequestDateTime(request.scheduledDate, (date) =>
    format(date, "MMM d, yyyy 'at' h:mm a"),
  );
  const preferredDate = formatRequestDateTime(request.preferredDate, (date) =>
    format(date, "MMM d, yyyy 'at' h:mm a"),
  );
  const responseFields = [
    ["Findings", getRequestText(request.findings)],
    ["Diagnosis", getRequestText(request.diagnosis)],
    ["Treatment", getRequestText(request.treatment)],
    ["Medicine", getRequestText(request.medicineGiven)],
    ["Dosage", getRequestText(request.dosage)],
    ["Resolution", getRequestText(request.resolutionNotes)],
  ].filter((entry): entry is [string, string] => entry[1] !== null);
  const photos = getRequestList(
    request.photos?.length ? request.photos : [request.imageUrl],
  );
  const showProgress =
    status !== "unknown" && status !== "cancelled" && status !== "rejected";

  return (
    <FarmerScreen scroll={false}>
      <FarmerRequestHeader title="Health Request Details" />

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
                {requestType}
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
              </Text>
            </View>

            <View className="items-end gap-2">
              {statusLabel ? <StatusBadge label={statusLabel} /> : null}
              {urgency ? <StatusBadge label={`${urgency} urgency`} /> : null}
            </View>
          </View>

          {symptoms ? (
            <Text
              className="mt-3"
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {symptoms}
            </Text>
          ) : (
            <View className="mt-3">
              <RequestDetailNotice message="Symptoms were not provided with this request." />
            </View>
          )}

          {farmerNotes ? (
            <Text
              className="mt-2"
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                lineHeight: 16,
              }}
            >
              Your note: {farmerNotes}
            </Text>
          ) : null}

          {photos.length ? (
            <View className="flex-row flex-wrap gap-2 mt-3">
              {photos.slice(0, 4).map((uri: string) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  className="w-16 h-16"
                  style={{ borderRadius: 10 }}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Progress Card */}
        <View
          className="mx-5 mt-5 p-4 border"
          style={{
            borderRadius: 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <SectionHeader title="Case progress" />
          {showProgress ? (
            <View className="mt-2">
              <WorkflowProgress
                steps={stages}
                currentIndex={stageIndex(status)}
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
              {(() => {
                const s = status;
                if (s === "pending")
                  return "Your health report has been submitted. A technician will review and assign your case shortly.";
                if (s === "approved" || s === "assigned" || s === "triaged")
                  return "Your case has been approved. A technician will contact you to schedule a visit shortly.";
                if (s === "scheduled") {
                  return scheduledDate
                    ? `A visit has been scheduled for ${scheduledDate}. Please make sure someone is available to assist.`
                    : "The visit is marked as scheduled, but the appointment time is not yet available. Please wait for the technician's confirmation.";
                }
                if (s === "in-progress" || s === "in_progress")
                  return "A technician is currently attending to the animal's medical assistance.";
                if (s === "resolved" || s === "done")
                  return "This medical request has been resolved. Check diagnosis and advice details below.";
                if (s === "cancelled")
                  return "This request has been cancelled.";
                return "Current service progress is not yet available.";
              })()}
            </Text>
          </View>
        </View>

        <RequestDetailCard
          title="Visit and care details"
          description="Assignment, appointment, and technician-provided care information."
        >
          <RequestDetailRow
            icon={<Stethoscope size={17} color={colors.primary} />}
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
            label={scheduledDate ? "Confirmed visit" : "Visit schedule"}
            value={
              scheduledDate ||
              (preferredDate
                ? `Preferred: ${preferredDate}`
                : "Not scheduled yet")
            }
            isLast={responseFields.length === 0}
          />

          {responseFields.length > 0 ? (
            <View className="pt-4 gap-4">
              {responseFields.map(([label, value]) => (
                <RequestDetailField key={label} label={label} value={value} />
              ))}
            </View>
          ) : (
            <View className="mt-3">
              <RequestDetailNotice message="Technician findings and care details are not yet available." />
            </View>
          )}
        </RequestDetailCard>

        {request.status === "resolved" ? (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(farmer)/health-report-preview",
                params: { id },
              })
            }
            className="mx-5 mt-5 py-3 flex-row items-center justify-center border"
            style={{
              borderRadius: 12,
              borderColor: colors.primary,
            }}
          >
            <FileText size={17} color={colors.primary} />
            <Text
              className="ml-2"
              style={{
                color: colors.primary,
                fontFamily: "Outfit_700Bold",
                fontSize: 12,
              }}
            >
              Preview health report
            </Text>
          </TouchableOpacity>
        ) : null}

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
                      await api.patch(`/health-request/${id}/cancel`, {
                        reason: cancellationReason.trim(),
                      });
                      toast.success(
                        request.status === "scheduled"
                          ? "Cancellation request submitted"
                          : "Request cancelled successfully",
                      );
                      setReasonModalVisible(false);
                      queryClient.invalidateQueries({
                        queryKey: ["health-request", id],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ["farmer", "health-requests"],
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
