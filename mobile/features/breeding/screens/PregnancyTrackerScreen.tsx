import React, { useCallback, useState } from "react";
import {
  Image,
  Linking,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import {
  AlertTriangle,
  CalendarHeart,
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  MessageSquareText,
  Phone,
  Stethoscope,
} from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { AnimatedBottomSheet } from "@/components/shared/AnimatedBottomSheet";
import { differenceInCalendarDays, format } from "date-fns";
import { useTheme } from "@/lib/theme";
import {
  FarmerScreen,
  AsyncState,
  StatusBadge,
} from "@/features/farmer-ui/components";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";
import { calculateTargetCalvingDate, normalizeSpecies } from "@/lib/cattleCore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { breedingKeys } from "@/lib/queryKeys";
import {
  usePregnancyLossReportsQuery,
  usePregnancyTrackerQuery,
} from "../hooks/usePregnancyTracker";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppPageHeader } from "@/components/AppPageHeader";
import { Text } from "@/components/ui/Text";
import {
  getBreedingObservationLabel,
  hasBreedingObservation,
  isBreedingObservationAwaitingReview,
} from "../utils/breedingObservationPresentation";
import {
  getHistoricalInseminationPresentation,
  getPostpartumPresentation,
  getTimelineMilestoneVisualState,
  resolveCurrentPostpartumRecovery,
  getUnconfirmedReproductiveTimelinePresentation,
  splitReproductiveAttempts,
} from "../utils/reproductiveCyclePresentation";
import {
  differenceInManilaCalendarDays,
  getFarmerCalvingReadinessPresentation,
} from "../utils/calvingUiSemantics";
import {
  findActivePregnancyLossReport,
  findLatestReviewedPregnancyLossReport,
  formatPregnancyLossStatus,
  getFarmerPregnancyLossPresentation,
} from "../utils/pregnancyLossWorkflow";

interface PregnancyTrackerScreenProps {
  id: string;
  viewerRole?: "farmer" | "technician";
}

function PregnancyTrackerSkeleton({ backFallback }: { backFallback: string }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader
        title="Animal Reproductive Status"
        onBack={() => safeBack(backFallback)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Animal Details Card Skeleton */}
        <View
          style={{
            marginHorizontal: 24,
            marginTop: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 24,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Skeleton shape="rect" height={64} width={64} radius={16} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Skeleton width="45%" height={20} radius={6} />
              <Skeleton width={80} height={24} radius={12} />
            </View>
            <Skeleton
              width="60%"
              height={14}
              radius={4}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>

        {/* Timeline Component Skeleton */}
        <View style={{ marginHorizontal: 24, marginTop: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Skeleton width="50%" height={20} radius={6} />
          </View>
          <View style={{ marginTop: 16 }}>
            {[1, 2, 3].map((idx) => (
              <View key={idx} style={{ flexDirection: "row", minHeight: 80 }}>
                <View style={{ width: 32, alignItems: "center" }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  />
                  {idx < 3 ? (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        backgroundColor: colors.border,
                      }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, marginLeft: 12, paddingBottom: 20 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Skeleton width="45%" height={16} radius={4} />
                    <Skeleton width="25%" height={14} radius={4} />
                  </View>
                  <Skeleton
                    width="65%"
                    height={14}
                    radius={4}
                    style={{ marginTop: 8 }}
                  />
                  {idx === 2 ? (
                    <View
                      style={{
                        backgroundColor: isDark
                          ? "rgba(0,100,59,0.15)"
                          : "#ecfdf5",
                        alignSelf: "flex-start",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        marginTop: 6,
                      }}
                    >
                      <Skeleton width={80} height={12} radius={3} />
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </FarmerScreen>
  );
}

export function PregnancyTrackerScreen({
  id,
  viewerRole = "farmer",
}: PregnancyTrackerScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isTechnician = viewerRole === "technician";
  const backFallback = isTechnician
    ? "/(technician)/(tabs)/technician.animals"
    : "/(farmer)/(tabs)/farmer.records";

  const query = usePregnancyTrackerQuery(id);
  const lossReportsQuery = usePregnancyLossReportsQuery(id, !isTechnician);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      query.refetch();
      if (!isTechnician) {
        lossReportsQuery.refetch();
      }
    }, [query, lossReportsQuery, isTechnician]),
  );

  if (query.isLoading) {
    return <PregnancyTrackerSkeleton backFallback={backFallback} />;
  }

  if (query.isError || !query.data) {
    return (
      <FarmerScreen scroll={false}>
        <AppPageHeader
          title="Animal Reproductive Status"
          onBack={() => safeBack(backFallback)}
        />
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <AsyncState
            state="error"
            message="Pregnancy information could not be loaded."
            onAction={() => query.refetch()}
          />
        </View>
      </FarmerScreen>
    );
  }

  const animal = query.data;
  const { current: latest, history: historicalAttempts } =
    splitReproductiveAttempts(
      animal.inseminations || [],
      animal.reproductiveStatus,
    );
  const activePregnancy = animal.inseminations
    ?.map((item: any) => item.pregnancy)
    .find(
      (item: any) =>
        item?.pregnancyDiagnosis?.result === "Pregnant" &&
        !["completed", "lost"].includes(item?.cycleStatus),
    );
  const latestPregnancy = latest?.pregnancy;
  const isPostpartum = animal.reproductiveStatus === "Post-partum";

  const currentRecoveryEvent = resolveCurrentPostpartumRecovery(animal);
  const pregnancyLinkedCalving = (animal.calvings || []).find((calving: any) => {
    if (!latestPregnancy?._id) return false;
    const pregnancyId =
      typeof calving.pregnancyId === "object"
        ? calving.pregnancyId?._id
        : calving.pregnancyId;
    return pregnancyId && String(pregnancyId) === String(latestPregnancy._id);
  });
  const associatedCalving = isPostpartum
    ? currentRecoveryEvent.calving
    : pregnancyLinkedCalving || null;

  const associatedCalvingPregnancyId =
    typeof associatedCalving?.pregnancyId === "object"
      ? associatedCalving?.pregnancyId?._id
      : associatedCalving?.pregnancyId;

  const targetPregnancyId =
    activePregnancy?._id ||
    latestPregnancy?._id ||
    associatedCalvingPregnancyId ||
    null;

  const lossReports = lossReportsQuery.data || [];
  const activeLossReport = findActivePregnancyLossReport(
    lossReports,
    targetPregnancyId,
  );
  const latestReviewedLossReport = findLatestReviewedPregnancyLossReport(
    lossReports,
    {
      pregnancyId: targetPregnancyId,
      calving: associatedCalving,
    },
  );
  const displayLossReport = activeLossReport || latestReviewedLossReport;
  const lossReportPresentation = displayLossReport
    ? getFarmerPregnancyLossPresentation(displayLossReport)
    : null;

  const isLossRecovery = currentRecoveryEvent.isLossRecovery;

  const isCompletedCycle =
    isPostpartum ||
    latestPregnancy?.cycleStatus === "completed" ||
    latestPregnancy?.cycleStatus === "lost";

  const lossDate = isLossRecovery ? currentRecoveryEvent.recoveryStartDate : null;

  const postpartumPresentation = getPostpartumPresentation({
    isCompletedCycle,
    nextAction: animal.nextAction,
    nextActionAt: animal.nextActionAt,
    effectiveReproductiveStatus: animal.effectiveReproductiveStatus,
    calvingDate: currentRecoveryEvent.recoveryStartDate,
    isLossRecovery,
    lossDate,
  });

  // Canonical resolution of historical insemination without guessing from array index
  const closedCycleInsemination = isCompletedCycle
    ? (animal.inseminations || []).find((i: any) => {
        const iId = String(i._id || i.id || "");
        const calvInsemId = String(
          (typeof associatedCalving?.inseminationId === "object"
            ? associatedCalving?.inseminationId?._id
            : associatedCalving?.inseminationId) || "",
        );
        if (calvInsemId && iId === calvInsemId) return true;

        const calvPregId = String(associatedCalvingPregnancyId || "");
        const iPregId = String(
          (typeof i.pregnancy === "object"
            ? i.pregnancy?._id
            : i.pregnancy) || "",
        );
        if (calvPregId && iPregId === calvPregId) return true;

        const repInsemId = String(
          latestReviewedLossReport?.inseminationId || "",
        );
        if (repInsemId && iId === repInsemId) return true;

        const repPregId = String(
          (typeof latestReviewedLossReport?.pregnancyId === "object"
            ? latestReviewedLossReport?.pregnancyId?._id
            : latestReviewedLossReport?.pregnancyId) || "",
        );
        if (repPregId && iPregId === repPregId) return true;

        return false;
      })
    : null;

  const displayedPregnancy =
    latestPregnancy || closedCycleInsemination?.pregnancy || null;

  const aiDateValue =
    latest?.inseminationDate ||
    latest?.dateOfAI ||
    latest?.createdAt ||
    closedCycleInsemination?.inseminationDate ||
    closedCycleInsemination?.dateOfAI ||
    closedCycleInsemination?.createdAt ||
    animal.lastInseminationDate;
  const aiDate = aiDateValue ? new Date(aiDateValue) : null;
  const expected = animal.expectedCalvingDate
    ? new Date(animal.expectedCalvingDate)
    : aiDate
      ? calculateTargetCalvingDate(
          aiDate,
          animal.species || "Cattle",
          undefined,
          animal.breed,
        )
      : null;
  const readiness = activePregnancy?.calvingReadiness;
  const canonicalGestationDays =
    typeof readiness?.gestationDays === "number"
      ? readiness.gestationDays
      : aiDate
        ? Math.max(0, differenceInManilaCalendarDays(new Date(), aiDate) ?? 0)
        : 0;
  const elapsedDays = canonicalGestationDays;

  const diffDays =
    typeof readiness?.expectedCalvingDaysRemaining === "number"
      ? readiness.expectedCalvingDaysRemaining
      : expected
        ? differenceInManilaCalendarDays(expected, new Date())
        : null;
  const remainingDisplay =
    diffDays !== null
      ? diffDays === 0
        ? "Expected today"
        : diffDays < 0
          ? `${Math.abs(diffDays)} days overdue`
          : `${diffDays} estimated days remaining`
      : null;
  const remaining = diffDays;
  const totalDays =
    typeof readiness?.averageGestationDays === "number"
      ? readiness.averageGestationDays
      : aiDate && expected
        ? Math.max(1, differenceInManilaCalendarDays(expected, aiDate) ?? 1)
        : 0;
  const progress = totalDays
    ? Math.min(100, Math.round((elapsedDays / totalDays) * 100))
    : 0;
  const normSpecies = normalizeSpecies(animal.species);
  const isCattle =
    normSpecies === "Cattle" ||
    normSpecies === "Beef Cattle" ||
    normSpecies === "Dairy Cattle";
  const isEligibleForPregnancyReport = isCattle && elapsedDays >= 35;
  const isConfirmedPregnant =
    activePregnancy?.pregnancyDiagnosis?.result === "Pregnant";

  const isTerminallyFailed = latest?.isSuccess === false;
  const isReturnToHeat =
    isTerminallyFailed && latest?.outcome === "Failed (Re-heat)";
  const isNegativePD =
    isTerminallyFailed && latest?.outcome === "Failed (Negative PD)";

  const isRecheck =
    latest?.pregnancyFollowUpTask?.metadata?.workflowStage ===
    "diagnostic_follow_up";
  const hasRecordedHeatObservation = hasBreedingObservation(latest);
  const isFarmerHeatReportPendingReview =
    latest?.farmerOutcomeReport === "return_to_heat" &&
    !isReturnToHeat &&
    latest?.verificationStatus !== "verified";

  const unconfirmedTimeline = getUnconfirmedReproductiveTimelinePresentation({
    aiDate,
    nextAction: animal.nextAction,
    pregnancyReadiness: latest?.pregnancyReadiness,
    pregnancyFollowUpTask: latest?.pregnancyFollowUpTask,
    hasRecordedHeatObservation,
    recordedHeatObservationLabel: hasRecordedHeatObservation
      ? getBreedingObservationLabel(latest?.farmerOutcomeReport)
      : null,
  });

  const currentIndex = isConfirmedPregnant
    ? 3
    : isTerminallyFailed
      ? isNegativePD
        ? 3
        : 2
      : unconfirmedTimeline.currentIndex;

  type Milestone = {
    label: string;
    date: Date | null;
    detail: string;
    isFailed?: boolean;
    isSkipped?: boolean;
    isPendingEvidence?: boolean;
    isElapsedWithoutObservation?: boolean;
    stageLabel?: string;
  };

  const milestones: Milestone[] = [
    {
      label: "AI completed",
      date: aiDate,
      detail:
        latest?.technician?.name ||
        latest?.technicianName ||
        "Insemination recorded",
    },
    {
      label: "Heat return monitoring",
      date: unconfirmedTimeline.heatReturnDate,
      detail: isReturnToHeat
        ? "Return to heat confirmed"
        : isFarmerHeatReportPendingReview
          ? "Heat signs reported\nAwaiting technician verification"
          : isConfirmedPregnant && !hasRecordedHeatObservation
            ? "Monitoring window passed\nNo observation recorded"
            : unconfirmedTimeline.heatReturnDetail,
      isFailed: isReturnToHeat,
      isElapsedWithoutObservation: isConfirmedPregnant
        ? !hasRecordedHeatObservation && !isReturnToHeat
        : unconfirmedTimeline.heatReturnState ===
          "elapsed_without_observation",
    },
  ];

  if (!isConfirmedPregnant) {
    milestones.push({
      label: isRecheck ? "Pregnancy recheck" : "Pregnancy check",
      date:
        isRecheck && latest?.pregnancyFollowUpTask?.dueDate
          ? new Date(latest.pregnancyFollowUpTask.dueDate)
          : unconfirmedTimeline.pregnancyCheckDate,
      detail: isReturnToHeat
        ? "No longer required"
        : isNegativePD
          ? "Negative diagnosis confirmed"
          : isRecheck
            ? "Pregnancy was not confirmed at the previous check."
            : "Professional diagnosis window",
      isSkipped: isReturnToHeat,
      isFailed: isNegativePD,
      stageLabel: unconfirmedTimeline.currentStageLabel,
    });
  }

  if (isConfirmedPregnant) {
    const confirmationDate = activePregnancy?.pregnancyDiagnosis?.date
      ? new Date(activePregnancy.pregnancyDiagnosis.date)
      : activePregnancy?.confirmation?.confirmedAt
        ? new Date(activePregnancy.confirmation.confirmedAt)
        : null;

    milestones.push(
      {
        label: "Pregnancy confirmed",
        date: confirmationDate,
        detail: "Confirmed in the animal record",
        isPendingEvidence: !confirmationDate,
      },
      {
        label: "Expected calving",
        date: expected,
        detail: remainingDisplay || "Awaiting breeding information",
      },
    );
  }

  const warningSigns = [
    { label: "Difficulty standing", icon: "↕" },
    { label: "Bleeding", icon: "!" },
    { label: "Loss of appetite", icon: "−" },
    { label: "Abnormal discharge", icon: "◇" },
  ];

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader
        title="Animal Reproductive Status"
        onBack={() => safeBack(backFallback)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Animal Details Card */}
        <View
          style={{
            marginHorizontal: 24,
            marginTop: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 24,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Image
            source={getAnimalImageSource(animal)}
            style={{ width: 64, height: 64, borderRadius: 16 }}
            resizeMode="cover"
          />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 17,
                }}
              >
                {animal.name || animal.earTag || animal.animalId}
              </Text>
              <StatusBadge
                label={
                  postpartumPresentation?.statusLabel ||
                  animal.reproductiveStatus ||
                  "Monitoring"
                }
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {[animal.animalId, animal.breed, animal.gender]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>

        {/* Gestation Progress Card */}
        {isCompletedCycle && postpartumPresentation ? (
          <View
            style={{
              marginHorizontal: 24,
              marginTop: 16,
              padding: 20,
              borderRadius: 24,
              backgroundColor: isDark ? colors.card : "#ecfdf5",
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 16,
              }}
            >
              {postpartumPresentation.title}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
                lineHeight: 19,
                marginTop: 4,
              }}
            >
              {postpartumPresentation.message}
            </Text>
            {postpartumPresentation.calvingDate ? (
              <View style={{ marginTop: 16 }}>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {postpartumPresentation.isLossRecovery
                    ? "Recovery started"
                    : "Last calving date"}
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 14,
                    marginTop: 3,
                  }}
                >
                  {format(
                    new Date(postpartumPresentation.calvingDate),
                    "MMM d, yyyy",
                  )}
                </Text>
              </View>
            ) : null}
            {postpartumPresentation.nextEligibleDate ? (
              <View style={{ marginTop: 14 }}>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {postpartumPresentation.isLossRecovery
                    ? "Eligible for AI after"
                    : "Next eligible date"}
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 14,
                    marginTop: 3,
                  }}
                >
                  {format(
                    new Date(postpartumPresentation.nextEligibleDate),
                    "MMM d, yyyy",
                  )}
                </Text>
              </View>
            ) : null}
            {postpartumPresentation.availability ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                  marginTop: 16,
                }}
              >
                {postpartumPresentation.availability}
              </Text>
            ) : null}
          </View>
        ) : animal.reproductiveStatus === "Pregnant" || activePregnancy ? (
          <View
            style={{
              marginHorizontal: 24,
              marginTop: 16,
              padding: 20,
              borderRadius: 24,
              backgroundColor: isDark ? colors.card : "#ecfdf5",
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 16,
                  }}
                >
                  Gestation Progress
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {elapsedDays} days since recorded AI
                </Text>
              </View>
              <Text
                style={{
                  color: isDark ? colors.primary : "#00643B",
                  fontFamily: "Outfit_900Black",
                  fontSize: 24,
                }}
              >
                {progress}%
              </Text>
            </View>

            {/* Progress Bar */}
            <View
              style={{
                height: 8,
                marginTop: 16,
                overflow: "hidden",
                borderRadius: 4,
                backgroundColor: colors.border,
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: isDark ? colors.primary : "#00643B",
                }}
              />
            </View>

            {/* Expected / Days Remaining Grid */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <View
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 16,
                  borderColor: colors.border,
                  borderWidth: 1,
                  backgroundColor: colors.card,
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 9,
                    letterSpacing: 0.5,
                  }}
                >
                  EXPECTED CALVING
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                    marginTop: 4,
                  }}
                >
                  {expected
                    ? format(expected, "MMM d, yyyy")
                    : "Not calculated"}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 16,
                  borderColor: colors.border,
                  borderWidth: 1,
                  backgroundColor: colors.card,
                }}
              >
                <Text
                  style={{
                    color:
                      diffDays !== null && diffDays < 0
                        ? colors.error
                        : colors.textMuted,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 9,
                    letterSpacing: 0.5,
                  }}
                >
                  {diffDays !== null && diffDays < 0
                    ? "OVERDUE"
                    : "DAYS REMAINING"}
                </Text>
                <Text
                  style={{
                    color:
                      diffDays !== null && diffDays < 0
                        ? colors.error
                        : colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                    marginTop: 4,
                  }}
                >
                  {diffDays !== null ? Math.abs(diffDays) : "N/A"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {isCompletedCycle ? (
          <View style={{ marginHorizontal: 24, marginTop: 24 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 16,
                }}
              >
                Previous reproductive cycle
              </Text>
            </View>
            <View style={{ marginTop: 16 }}>
              <View
                style={{ flexDirection: "row", marginBottom: 16, opacity: 0.7 }}
              >
                <View style={{ width: 24, alignItems: "center" }}>
                  <CheckCircle size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 15,
                    }}
                  >
                    AI completed
                  </Text>
                  {aiDate && (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: "Outfit_400Regular",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {format(aiDate, "MMM d, yyyy")}
                    </Text>
                  )}
                </View>
              </View>
              {(displayedPregnancy?.pregnancyDiagnosis?.date ||
                displayedPregnancy?.confirmation?.confirmedAt) && (
                <View
                  style={{
                    flexDirection: "row",
                    marginBottom: 16,
                    opacity: 0.7,
                  }}
                >
                  <View style={{ width: 24, alignItems: "center" }}>
                    <CheckCircle size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 15,
                      }}
                    >
                      Pregnancy confirmed
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: "Outfit_400Regular",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {format(
                        new Date(
                          displayedPregnancy.pregnancyDiagnosis?.date ||
                            displayedPregnancy.confirmation?.confirmedAt,
                        ),
                        "MMM d, yyyy",
                      )}
                    </Text>
                  </View>
                </View>
              )}
              {currentRecoveryEvent.recoveryStartDate && (
                <View
                  style={{
                    flexDirection: "row",
                    marginBottom: 16,
                    opacity: 0.7,
                  }}
                >
                  <View style={{ width: 24, alignItems: "center" }}>
                    <CheckCircle size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 15,
                      }}
                    >
                      {isLossRecovery
                        ? "Pregnancy loss confirmed"
                        : "Calving recorded"}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: "Outfit_400Regular",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {format(
                        new Date(
                          currentRecoveryEvent.recoveryStartDate,
                        ),
                        "MMM d, yyyy",
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : latest ? (
          <View style={{ marginHorizontal: 24, marginTop: 24 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 16,
                }}
              >
                {animal.reproductiveStatus === "Pregnant" || activePregnancy
                  ? "Pregnancy Timeline"
                  : "Reproductive Timeline"}
              </Text>
              {latest?.attemptNumber ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 13,
                  }}
                >
                  Current Cycle · Attempt #{latest.attemptNumber}
                </Text>
              ) : null}
            </View>
            <View style={{ marginTop: 16 }}>
              {milestones.map((milestone, index) => {
                const isFailed = milestone.isFailed;
                const isSkipped = milestone.isSkipped;
                const isElapsedWithoutObservation =
                  milestone.isElapsedWithoutObservation;
                const { complete, active } =
                  getTimelineMilestoneVisualState({
                    index,
                    currentIndex,
                    isTerminallyFailed,
                    isSkipped,
                    isFailed,
                    isPendingEvidence: milestone.isPendingEvidence,
                    isElapsedWithoutObservation,
                  });
                return (
                  <View
                    key={milestone.label}
                    style={{
                      flexDirection: "row",
                      minHeight: 80,
                      opacity: isSkipped ? 0.5 : 1,
                    }}
                  >
                    <View style={{ width: 32, alignItems: "center" }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 2,
                          borderColor:
                            complete || active || isFailed
                              ? isFailed
                                ? colors.error
                                : isDark
                                  ? colors.primary
                                  : "#00643B"
                              : colors.border,
                          backgroundColor:
                            complete || isFailed
                              ? isFailed
                                ? colors.error
                                : isDark
                                  ? colors.primary
                                  : "#00643B"
                              : colors.card,
                        }}
                      >
                        {complete && !isFailed ? (
                          <Check size={12} color="white" />
                        ) : isFailed ? (
                          <Text
                            style={{
                              color: "white",
                              fontSize: 10,
                              fontFamily: "Outfit_700Bold",
                            }}
                          >
                            X
                          </Text>
                        ) : isSkipped || isElapsedWithoutObservation ? (
                          <Circle
                            size={8}
                            color={colors.textMuted}
                            fill="transparent"
                          />
                        ) : (
                          <Circle
                            size={8}
                            color={
                              active
                                ? isDark
                                  ? colors.primary
                                  : "#00643B"
                                : colors.textMuted
                            }
                            fill={
                              active
                                ? isDark
                                  ? colors.primary
                                  : "#00643B"
                                : "transparent"
                            }
                          />
                        )}
                      </View>
                      {index < milestones.length - 1 ? (
                        <View
                          style={{
                            width: 2,
                            flex: 1,
                            backgroundColor: complete
                              ? isDark
                                ? colors.primary
                                : "#00643B"
                              : colors.border,
                          }}
                        />
                      ) : null}
                    </View>
                    <View
                      style={{ flex: 1, marginLeft: 12, paddingBottom: 20 }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <Text
                          style={{
                            color: active
                              ? isDark
                                ? colors.primary
                                : "#00643B"
                              : isFailed
                                ? colors.error
                                : colors.textPrimary,
                            fontFamily: "Outfit_600SemiBold",
                            fontSize: 14,
                          }}
                        >
                          {milestone.label}
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontFamily: "Outfit_500Medium",
                            fontSize: 12,
                          }}
                        >
                          {milestone.date
                            ? format(milestone.date, "MMM d, yyyy")
                            : "Pending"}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: "Outfit_500Medium",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        {milestone.detail}
                      </Text>
                      {active ? (
                        <View
                          style={{
                            backgroundColor: isDark
                              ? "rgba(0,100,59,0.15)"
                              : "#ecfdf5",
                            alignSelf: "flex-start",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                            marginTop: 6,
                          }}
                        >
                          <Text
                            style={{
                              color: isDark ? colors.primary : "#00643B",
                              fontFamily: "Outfit_800ExtraBold",
                              fontSize: 8,
                              textTransform: "uppercase",
                            }}
                          >
                            {milestone.stageLabel || "Current Stage"}
                          </Text>
                        </View>
                      ) : isTerminallyFailed && isFailed ? (
                        <View
                          style={{
                            backgroundColor: isDark
                              ? "rgba(220,38,38,0.15)"
                              : "#FEE2E2",
                            alignSelf: "flex-start",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                            marginTop: 6,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.error,
                              fontFamily: "Outfit_800ExtraBold",
                              fontSize: 8,
                              textTransform: "uppercase",
                            }}
                          >
                            Attempt Failed
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {historicalAttempts && historicalAttempts.length > 0 && (
          <View style={{ marginHorizontal: 24, marginTop: 32 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 16,
                marginBottom: 16,
              }}
            >
              Past Reproductive History
            </Text>
            {historicalAttempts.map((attempt: any) => {
              const presentation =
                getHistoricalInseminationPresentation(attempt);
              const histDateValue =
                attempt?.inseminationDate ||
                attempt?.dateOfAI ||
                attempt?.createdAt;
              const histDate = histDateValue ? new Date(histDateValue) : null;

              const isHistFailed = attempt.isSuccess === false;

              const routeDef = {
                pathname: isTechnician
                  ? "/(technician)/record-details"
                  : "/(farmer)/animal-record-detail",
                params: {
                  animalId: animal._id,
                  sourceId: attempt._id,
                  sourceKind: "insemination",
                  recordId: attempt._id,
                  recordType: "insemination",
                },
              };

              return (
                <TouchableOpacity
                  key={attempt._id}
                  activeOpacity={0.7}
                  onPress={() => router.push(routeDef as any)}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    marginBottom: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 14,
                      }}
                    >
                      {presentation.title}
                    </Text>
                    {histDate ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: "Outfit_400Regular",
                          fontSize: 13,
                        }}
                      >
                        {format(histDate, "MMM d, yyyy")}
                      </Text>
                    ) : null}
                    {presentation.context ? (
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontFamily: "Outfit_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        {presentation.context}
                      </Text>
                    ) : null}
                    <Text
                      style={{
                        color: isHistFailed ? colors.error : colors.textMuted,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {presentation.outcome}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isDark
                        ? colors.surfaceSubtle
                        : "#F3F4F6",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Pregnancy Loss Report Card (Active or Reviewed) */}
        {!isTechnician && displayLossReport && lossReportPresentation ? (
          <View style={{ marginHorizontal: 24, marginTop: 24 }}>
            {(() => {
              const isConfirmed = displayLossReport.status === "confirmed";
              const isNeedsVisit = displayLossReport.status === "needs_visit";

              const borderColor = isConfirmed
                ? isDark
                  ? "rgba(239, 68, 68, 0.4)"
                  : "#fecaca"
                : isNeedsVisit
                  ? isDark
                    ? "rgba(245, 158, 11, 0.4)"
                    : "#fde68a"
                  : isDark
                    ? "rgba(59, 130, 246, 0.4)"
                    : "#bfdbfe";

              const backgroundColor = isConfirmed
                ? isDark
                  ? "rgba(239, 68, 68, 0.1)"
                  : "#fef2f2"
                : isNeedsVisit
                  ? isDark
                    ? "rgba(245, 158, 11, 0.12)"
                    : "#fffbeb"
                  : isDark
                    ? "rgba(59, 130, 246, 0.08)"
                    : "#eff6ff";

              const accentColor = isConfirmed
                ? isDark
                  ? "#f87171"
                  : "#dc2626"
                : isNeedsVisit
                  ? isDark
                    ? "#fbbf24"
                    : "#d97706"
                  : isDark
                    ? "#60a5fa"
                    : "#2563eb";

              const titleColor = isConfirmed
                ? isDark
                  ? "#f87171"
                  : "#dc2626"
                : isNeedsVisit
                  ? isDark
                    ? "#fbbf24"
                    : "#b45309"
                  : isDark
                    ? "#93c5fd"
                    : "#1d4ed8";

              const badgeBg = isConfirmed
                ? isDark
                  ? "rgba(239, 68, 68, 0.25)"
                  : "#fee2e2"
                : isNeedsVisit
                  ? isDark
                    ? "rgba(245, 158, 11, 0.25)"
                    : "#fef3c7"
                  : isDark
                    ? "rgba(59, 130, 246, 0.25)"
                    : "#dbeafe";

              const badgeTextColor = isConfirmed
                ? isDark
                  ? "#f87171"
                  : "#b91c1c"
                : isNeedsVisit
                  ? isDark
                    ? "#fbbf24"
                    : "#92400e"
                  : isDark
                    ? "#60a5fa"
                    : "#1e40af";

              return (
                <View
                  style={{
                    padding: 16,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor,
                    backgroundColor,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={16} color={accentColor} />
                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          color: titleColor,
                        }}
                      >
                        Pregnancy Loss Report
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 8,
                        backgroundColor: badgeBg,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          fontSize: 10,
                          color: badgeTextColor,
                        }}
                      >
                        {lossReportPresentation.badgeLabel}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      lineHeight: 18,
                      color: colors.textPrimary,
                    }}
                  >
                    {lossReportPresentation.explanation}
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setExpandedReportId((prev) =>
                        prev === displayLossReport._id ? null : displayLossReport._id,
                      )
                    }
                    activeOpacity={0.7}
                    style={{
                      alignSelf: "flex-start",
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      marginTop: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        fontSize: 11,
                        color: colors.primary,
                      }}
                    >
                      {expandedReportId === displayLossReport._id
                        ? "Hide details"
                        : "View details"}
                    </Text>
                  </TouchableOpacity>

                  {expandedReportId === displayLossReport._id ? (
                    <View
                      style={{
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: isDark ? colors.background : "white",
                        gap: 8,
                      }}
                    >
                      {lossReportPresentation.noticedDate ? (
                        <View style={{ gap: 2 }}>
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              fontSize: 11,
                              color: colors.textMuted,
                            }}
                          >
                            {lossReportPresentation.noticedDateLabel}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Outfit_600SemiBold",
                              fontSize: 12,
                              color: colors.textPrimary,
                            }}
                          >
                            {lossReportPresentation.noticedDate}
                          </Text>
                        </View>
                      ) : null}

                      {lossReportPresentation.reportSentDate ? (
                        <View style={{ gap: 2 }}>
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              fontSize: 11,
                              color: colors.textMuted,
                            }}
                          >
                            {lossReportPresentation.reportSentLabel}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Outfit_600SemiBold",
                              fontSize: 12,
                              color: colors.textPrimary,
                            }}
                          >
                            {lossReportPresentation.reportSentDate}
                          </Text>
                        </View>
                      ) : null}

                      {lossReportPresentation.technicianNote ? (
                        <View style={{ gap: 2 }}>
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              fontSize: 11,
                              color: colors.textMuted,
                            }}
                          >
                            {lossReportPresentation.technicianNoteLabel}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Outfit_600SemiBold",
                              fontSize: 12,
                              color: colors.textSecondary,
                            }}
                          >
                            {lossReportPresentation.technicianNote}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })()}
          </View>
        ) : null}

        {/* Action Buttons */}
        {activePregnancy && animal.reproductiveStatus === "Pregnant" && (
          <View style={{ marginHorizontal: 24, marginTop: 24, gap: 12 }}>

            {(() => {
              const farmerReadiness = getFarmerCalvingReadinessPresentation(
                activePregnancy?.calvingReadiness,
                expected,
              );

              return (
                <>
                  {isTechnician && !activePregnancy.calvingReadiness?.isEligible ? (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.warningBorder,
                        backgroundColor: colors.warningContainer,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.warningForeground,
                          fontFamily: "Outfit_600SemiBold",
                          fontSize: 12,
                          lineHeight: 18,
                        }}
                      >
                        {activePregnancy.calvingReadiness?.reason ||
                          "Delivery recording readiness is unavailable. Review the timing before recording an outcome."}
                      </Text>
                    </View>
                  ) : null}

                  {!isTechnician && farmerReadiness.isReadinessUnavailable ? (
                    <View
                      style={{
                        padding: 16,
                        borderRadius: 20,
                        backgroundColor: isDark
                          ? "rgba(30, 41, 59, 0.7)"
                          : "#f8fafc",
                        borderWidth: 1,
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color: colors.textSecondary,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          Calving
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                            backgroundColor: isDark
                              ? "rgba(148, 163, 184, 0.15)"
                              : "#f1f5f9",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Outfit_700Bold",
                              fontSize: 10,
                              color: isDark ? "#94a3b8" : "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            Readiness unavailable
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          fontSize: 13,
                          color: colors.textPrimary,
                          marginBottom: 4,
                        }}
                      >
                        Calving readiness unavailable
                      </Text>

                      <Text
                        style={{
                          fontFamily: "Outfit_400Regular",
                          fontSize: 12,
                          color: colors.textSecondary,
                          lineHeight: 18,
                          marginBottom: 12,
                        }}
                      >
                        We couldn't verify whether delivery recording is available right now.
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          query.refetch();
                          queryClient.invalidateQueries({ queryKey: breedingKeys.tracker(id) });
                        }}
                        activeOpacity={0.8}
                        style={{
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 12,
                            color: colors.textPrimary,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Try Again
                        </Text>
                      </TouchableOpacity>

                      <View
                        style={{
                          height: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 16,
                          backgroundColor: isDark
                            ? "rgba(100, 116, 139, 0.2)"
                            : "#e2e8f0",
                          opacity: 0.6,
                        }}
                      >
                        <CalendarHeart
                          size={18}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />
                        <Text
                          style={{
                            color: isDark ? "#94a3b8" : "#64748b",
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            marginLeft: 8,
                          }}
                        >
                          Record Calving
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {!isTechnician && !farmerReadiness.isReadinessUnavailable && !farmerReadiness.canRecordCalving ? (
                    <View
                      style={{
                        padding: 16,
                        borderRadius: 20,
                        backgroundColor: isDark
                          ? "rgba(30, 41, 59, 0.7)"
                          : "#f8fafc",
                        borderWidth: 1,
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color: colors.textSecondary,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          Calving
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                            backgroundColor: isDark
                              ? "rgba(245, 158, 11, 0.15)"
                              : "#fef3c7",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Outfit_700Bold",
                              fontSize: 10,
                              color: isDark ? "#fbbf24" : "#d97706",
                              textTransform: "uppercase",
                            }}
                          >
                            {farmerReadiness.badgeLabel}
                          </Text>
                        </View>
                      </View>

                      {farmerReadiness.expectedCalvingDateFormatted ? (
                        <View style={{ marginBottom: 10 }}>
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              fontSize: 11,
                              color: colors.textMuted,
                            }}
                          >
                            Expected calving
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Outfit_700Bold",
                              fontSize: 13,
                              color: colors.textPrimary,
                              marginTop: 1,
                            }}
                          >
                            {farmerReadiness.expectedCalvingDateFormatted}
                          </Text>
                        </View>
                      ) : null}

                      <View style={{ marginBottom: 10 }}>
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            fontSize: 11,
                            color: colors.textMuted,
                          }}
                        >
                          Current gestation
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            color: colors.textPrimary,
                            marginTop: 1,
                          }}
                        >
                          {farmerReadiness.gestationProgressLabel || `Day ${elapsedDays}`}
                        </Text>
                      </View>

                      {farmerReadiness.minimumThresholdLabel ? (
                        <View style={{ marginBottom: 10 }}>
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              fontSize: 11,
                              color: colors.textMuted,
                            }}
                          >
                            Delivery recording available from
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Outfit_700Bold",
                              fontSize: 13,
                              color: colors.textPrimary,
                              marginTop: 1,
                            }}
                          >
                            {farmerReadiness.minimumThresholdLabel}
                          </Text>
                        </View>
                      ) : null}

                      {farmerReadiness.countdownLabel ? (
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            backgroundColor: isDark
                              ? "rgba(245, 158, 11, 0.1)"
                              : "#fffbeb",
                            marginBottom: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Outfit_600SemiBold",
                              fontSize: 12,
                              color: isDark ? "#fbbf24" : "#b45309",
                            }}
                          >
                            {farmerReadiness.countdownLabel}
                          </Text>
                        </View>
                      ) : null}

                      <Text
                        style={{
                          fontFamily: "Outfit_400Regular",
                          fontSize: 11,
                          color: colors.textSecondary,
                          lineHeight: 16,
                          marginBottom: 12,
                        }}
                      >
                        {farmerReadiness.supportingCopy}
                      </Text>

                      <View
                        style={{
                          height: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 16,
                          backgroundColor: isDark
                            ? "rgba(100, 116, 139, 0.2)"
                            : "#e2e8f0",
                          opacity: 0.6,
                        }}
                      >
                        <CalendarHeart
                          size={18}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />
                        <Text
                          style={{
                            color: isDark ? "#94a3b8" : "#64748b",
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            marginLeft: 8,
                          }}
                        >
                          Record Calving
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {!isTechnician && !farmerReadiness.isReadinessUnavailable && farmerReadiness.canRecordCalving ? (
                    <View
                      style={{
                        padding: 16,
                        borderRadius: 20,
                        backgroundColor: isDark
                          ? "rgba(30, 41, 59, 0.7)"
                          : "#f8fafc",
                        borderWidth: 1,
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color: colors.textSecondary,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          Calving
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                            backgroundColor: isDark
                              ? "rgba(16, 185, 129, 0.15)"
                              : "#dcfce7",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Outfit_700Bold",
                              fontSize: 10,
                              color: isDark ? "#34d399" : "#15803d",
                              textTransform: "uppercase",
                            }}
                          >
                            {farmerReadiness.badgeLabel}
                          </Text>
                        </View>
                      </View>

                      {farmerReadiness.expectedCalvingDateFormatted ? (
                        <View style={{ marginBottom: 10 }}>
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              fontSize: 11,
                              color: colors.textMuted,
                            }}
                          >
                            Expected calving
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Outfit_700Bold",
                              fontSize: 13,
                              color: colors.textPrimary,
                              marginTop: 1,
                            }}
                          >
                            {farmerReadiness.expectedCalvingDateFormatted}
                          </Text>
                        </View>
                      ) : null}

                      <View style={{ marginBottom: 10 }}>
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            fontSize: 11,
                            color: colors.textMuted,
                          }}
                        >
                          Current gestation
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            color: colors.textPrimary,
                            marginTop: 1,
                          }}
                        >
                          {farmerReadiness.gestationProgressLabel || `Day ${elapsedDays}`}
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontFamily: "Outfit_600SemiBold",
                          fontSize: 12,
                          color: isDark ? "#34d399" : "#15803d",
                          marginBottom: 12,
                        }}
                      >
                        Delivery recording is available
                      </Text>

                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/(farmer)/record-calving" as never,
                            params: {
                              animalId: id,
                              pregnancyId: activePregnancy._id,
                            },
                          })
                        }
                        activeOpacity={0.8}
                        style={{
                          height: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 16,
                          backgroundColor: isDark ? colors.primary : "#00643B",
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isDark ? 0 : 0.05,
                          shadowRadius: 6,
                          elevation: 2,
                        }}
                      >
                        <CalendarHeart size={18} color="white" />
                        <Text
                          style={{
                            color: "white",
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            marginLeft: 8,
                          }}
                        >
                          Record Calving
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {isTechnician ? (
                    <TouchableOpacity
                      onPress={() =>
                        router.push(
                          {
                            pathname: "/(technician)/record-calf-drop",
                            params: {
                              motherId: id,
                              motherTag:
                                animal.earTag || animal.animalId || "",
                              pregnancyId: activePregnancy._id,
                            },
                          } as never,
                        )
                      }
                      activeOpacity={0.8}
                      style={{
                        height: 48,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 16,
                        backgroundColor: isDark ? colors.primary : "#00643B",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isDark ? 0 : 0.05,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      <CalendarHeart size={18} color="white" />
                      <Text
                        style={{
                          color: "white",
                          fontFamily: "Outfit_700Bold",
                          fontSize: 13,
                          marginLeft: 8,
                        }}
                      >
                        Record Calving / Loss
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Report Pregnancy Loss button (Farmer only, when an active confirmed pregnancy exists and no active report is pending) */}
                  {!isTechnician && !activeLossReport && isConfirmedPregnant ? (
                    <View style={{ marginTop: 16 }}>
                      <View style={{ marginBottom: 8 }}>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color: colors.textSecondary,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 2,
                          }}
                        >
                          Pregnancy Concern
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            color: colors.textPrimary,
                            marginBottom: 2,
                          }}
                        >
                          Notice something unusual?
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_400Regular",
                            fontSize: 12,
                            color: colors.textMuted,
                          }}
                        >
                          Report signs or observations that may indicate pregnancy loss.
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/(farmer)/report-pregnancy-loss" as any,
                            params: {
                              animalId: id,
                              pregnancyId: activePregnancy._id,
                              earTag:
                                animal.earTag ||
                                animal.animalId ||
                                animal.name ||
                                "",
                            },
                          })
                        }
                        activeOpacity={0.8}
                        style={{
                          height: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 16,
                          borderWidth: 1.5,
                          borderColor: isDark
                            ? "rgba(245, 158, 11, 0.4)"
                            : "#fcd34d",
                          backgroundColor: isDark
                            ? "rgba(245, 158, 11, 0.08)"
                            : "#fffbeb",
                        }}
                      >
                        <AlertTriangle
                          size={18}
                          color={isDark ? "#fbbf24" : "#d97706"}
                        />
                        <Text
                          style={{
                            color: isDark ? "#fbbf24" : "#b45309",
                            fontFamily: "Outfit_700Bold",
                            fontSize: 13,
                            marginLeft: 8,
                          }}
                        >
                          Report Pregnancy Loss
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              );
            })()}

            {!isTechnician ? (
              <>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/(farmer)/report-sickness",
                      params: { animalId: id, type: "pregnancy_complication" },
                    })
                  }
                  activeOpacity={0.8}
                  style={{
                    height: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.error,
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.1)"
                      : "#fef2f2",
                  }}
                >
                  <Stethoscope size={18} color={colors.error} />
                  <Text
                    style={{
                      color: colors.error,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 13,
                      marginLeft: 8,
                    }}
                  >
                    Report Health Concern
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    latest?.technician?.phoneNumber
                      ? Linking.openURL(`tel:${latest.technician.phoneNumber}`)
                      : router.push("/(farmer)/(tabs)/service-requests")
                  }
                  activeOpacity={0.8}
                  style={{
                    height: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <Phone size={18} color={colors.textSecondary} />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 13,
                      marginLeft: 8,
                    }}
                  >
                    Contact Technician
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </FarmerScreen>
  );
}
