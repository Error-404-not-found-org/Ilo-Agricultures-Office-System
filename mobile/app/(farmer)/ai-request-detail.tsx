import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
  Alert,
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
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { recordAiOutcome } from "@/features/farmer-dashboard/services/farmerDashboard.service";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  FarmerScreen,
  AsyncState,
  SectionHeader,
  StatusBadge,
  WorkflowProgress,
} from "@/features/farmer-ui/components";
import { FarmerRequestHeader } from "@/features/farmer-requests/components/FarmerRequestHeader";
import { ReproductionNextActionCard } from "@/components/ReproductionNextActionCard";
import type { AIRequest } from "@/types";

const stages = [
  { key: "pending", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "in-progress", label: "In Progress" },
  { key: "done", label: "Completed" },
];

const stageIndex = (status?: string) =>
  ({
    pending: 0,
    approved: 1,
    assigned: 1,
    triaged: 1,
    scheduled: 2,
    "in-progress": 3,
    in_progress: 3,
    done: 4,
    resolved: 4,
  })[status || "pending"] ?? 0;

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
  const api = useApi();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const query = useQuery({
    queryKey: ["ai-request", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/ai-request/${id}`);
      return res.data.data;
    },
  });

  const outcomeMutation = useMutation({
    mutationFn: async ({ isSuccess }: { isSuccess: boolean }) => {
      if (!id) throw new Error("Missing request ID");
      return await recordAiOutcome(api, id, isSuccess);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ai-request", id] });
      queryClient.invalidateQueries({ queryKey: ["farmer", "ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
      Alert.alert(
        "Observation saved",
        variables.isSuccess
          ? "Possible pregnancy signs were recorded. A technician pregnancy check is still required for confirmation."
          : "Return to heat was recorded. You can now request re-insemination.",
      );
    },
    onError: (err: any) => {
      Alert.alert(
        "Error",
        err.response?.data?.message || "Failed to record outcome.",
      );
    },
  });

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

  const notes = getAdditionalNotesOnly(request.comment || "");

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
              {animal.earTag || animal.animalId || "No animal tag"}
              {` | Attempt ${request.attemptNumber || 1}`}
            </Text>
          </View>

          <StatusBadge label={request.status} />
        </View>

        {/* Breeding Details */}
        {(request.sireBreed || request.sireCode || request.estrus) && (
          <View className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
            <View className="flex-row flex-wrap gap-4">
              {request.estrus ? (
                <View>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 9,
                    }}
                  >
                    ESTRUS TYPE
                  </Text>
                  <Text
                    className="mt-0.5"
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                    }}
                  >
                    {request.estrus}
                  </Text>
                </View>
              ) : null}
              {request.sireBreed ? (
                <View>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 9,
                    }}
                  >
                    SIRE BREED
                  </Text>
                  <Text
                    className="mt-0.5"
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                    }}
                  >
                    {request.sireBreed}
                  </Text>
                </View>
              ) : null}
              {request.sireCode ? (
                <View>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 9,
                    }}
                  >
                    SIRE CODE
                  </Text>
                  <Text
                    className="mt-0.5"
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                    }}
                  >
                    {request.sireCode}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Observed Heat Signs Badges */}
        {request.heatSigns && request.heatSigns.length > 0 ? (
          <View className="mt-4">
            <Text
              className="text-[10px] font-bold uppercase mb-2"
              style={{ color: colors.textMuted }}
            >
              Observed Heat Signs
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {request.heatSigns.map((signId: string) => {
                const label = heatSignMap[signId] || signId;
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
                  badgeBorder = isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7";
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

        {request.imageUrl ? (
          <View className="mt-3">
            <Image
              source={{ uri: request.imageUrl }}
              className="w-20 h-20"
              style={{ borderRadius: 10 }}
            />
          </View>
        ) : null}
      </View>

      {request.nextAction ? (
        <View className="mx-5 mt-5">
          <ReproductionNextActionCard
            action={request.nextAction}
            title="What Happens Next"
          />
        </View>
      ) : null}

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
        <View className="mt-2">
          <WorkflowProgress
            steps={stages}
            currentIndex={stageIndex(request.status)}
          />
        </View>
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
              const s = request.status?.toLowerCase() || "pending";
              if (s === "pending")
                return "Your request has been submitted. A technician will review and assign your request shortly.";
              if (s === "approved" || s === "assigned" || s === "triaged")
                return "Your request has been approved. A technician will schedule your insemination visit soon.";
              if (s === "scheduled") {
                const dateStr = request.scheduledDate
                  ? format(
                      new Date(request.scheduledDate),
                      "MMM d, yyyy 'at' h:mm a",
                    )
                  : "a rescheduled date";
                return `Your insemination visit has been scheduled for ${dateStr}. Please ensure the animal is secured.`;
              }
              if (s === "in-progress" || s === "in_progress")
                return "The technician is currently on-site or performing the insemination service.";
              if (s === "done" || s === "resolved" || s === "completed")
                return "The insemination procedure has been completed. Continue monitoring the animal and follow the next reproductive action.";
              if (s === "rejected")
                return "This request was rejected. Please review notes or submit a new request.";
              if (s === "cancelled") return "This request has been cancelled.";
              return "";
            })()}
          </Text>
        </View>
      </View>

      {/* Response Card */}
      <View
        className="mx-5 mt-5 p-4 border"
        style={{
          borderRadius: 16,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <SectionHeader title="Response & Insemination details" />

        <View className="mt-3">
          {handler ? (
            <View className="flex-row items-center mb-3">
              <Syringe size={18} color={colors.primary} />
              <Text
                className="ml-2 flex-1"
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                }}
              >
                {handler.name} ({handler.role || "technician"})
              </Text>
            </View>
          ) : (
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
              }}
            >
              Waiting for assignment.
            </Text>
          )}

          {request.scheduledDate ? (
            <View className="flex-row items-center mb-3">
              <CalendarClock size={18} color={colors.primary} />
              <Text
                className="ml-2 flex-1"
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                }}
              >
                Scheduled:{" "}
                {format(
                  new Date(request.scheduledDate),
                  "MMM d, yyyy - h:mm a",
                )}
              </Text>
            </View>
          ) : request.preferredDate ? (
            <View className="flex-row items-center mb-3">
              <CalendarClock size={18} color={colors.textMuted} />
              <Text
                className="ml-2 flex-1"
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                }}
              >
                Preferred:{" "}
                {format(
                  new Date(request.preferredDate),
                  "MMM d, yyyy - h:mm a",
                )}
              </Text>
            </View>
          ) : null}

          {request.inseminationDate ? (
            <View className="flex-row items-center mb-3">
              <CheckCircle2 size={18} color={colors.primary} />
              <Text
                className="ml-2 flex-1"
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                }}
              >
                Inseminated on:{" "}
                {format(
                  new Date(request.inseminationDate),
                  "MMM d, yyyy - h:mm a",
                )}
              </Text>
            </View>
          ) : null}

          {request.technicianNote ? (
            <View className="mt-3">
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 10,
                }}
              >
                TECHNICIAN NOTE
              </Text>
              <Text
                className="mt-1"
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                {request.technicianNote}
              </Text>
            </View>
          ) : null}

          {request.outcome && request.outcome !== "Pending" ? (
            <View className="mt-3">
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 10,
                }}
              >
                PREGNANCY OUTCOME
              </Text>
              <Text
                className="mt-1 font-bold text-sm"
                style={{
                  color: request.isSuccess ? "#10b981" : "#ef4444",
                }}
              >
                {request.outcome}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Outcome Confirmation Box for Farmer */}
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
                Breeding observation needed
              </Text>
              <Text
                className="text-[11px] mt-0.5"
                style={{ color: isDark ? "#6ee7b7" : "#166534" }}
              >
                Report what you have observed. Pregnancy is only confirmed
                after a technician pregnancy check.
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity
              disabled={outcomeMutation.isPending}
              onPress={() => outcomeMutation.mutate({ isSuccess: true })}
              className="flex-1 py-2.5 rounded-xl items-center justify-center bg-emerald-600 active:bg-emerald-700"
            >
              {outcomeMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-xs font-bold">Possible pregnancy</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={outcomeMutation.isPending}
              onPress={() => outcomeMutation.mutate({ isSuccess: false })}
              className="flex-1 py-2.5 rounded-xl items-center justify-center border border-red-200 bg-red-50 dark:bg-red-950/20 active:bg-red-100 dark:active:bg-red-950/40"
            >
              {outcomeMutation.isPending ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text className="text-red-600 text-xs font-bold">
                  Returned to heat
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
                This visit remains scheduled. You may submit another request if
                the situation changes.
              </Text>
              {request.cancellationResponseReason ? (
                <Text
                  className="text-[11px] mt-2 italic font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  Reason: {request.cancellationResponseReason}
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
                You requested to cancel this scheduled visit. This is currently
                pending technician review.
              </Text>
              {request.cancellationReason ? (
                <Text
                  className="text-[11px] mt-2 italic font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  &quot;{request.cancellationReason}&quot;
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
                <TouchableOpacity onPress={() => setReasonModalVisible(false)}>
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
                      err.response?.data?.message || "Failed to cancel request",
                    );
                  } finally {
                    setIsSubmittingCancel(false);
                  }
                }}
                disabled={
                  isSubmittingCancel ||
                  (request.status === "scheduled" && !cancellationReason.trim())
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
