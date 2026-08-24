import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { AnimatedBottomSheet } from "@/components/shared/AnimatedBottomSheet";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useTheme } from "@/lib/theme";
import {
  FarmerScreen,
  AsyncState,
  StatusBadge,
} from "@/features/farmer-ui/components";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";
import { calculateTargetCalvingDate, normalizeSpecies } from "@/lib/cattleCore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePregnancyTrackerQuery } from "../hooks/usePregnancyTracker";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppPageHeader } from "@/components/AppPageHeader";
import { Text } from "@/components/ui/Text";
import {
  getBreedingObservationLabel,
  isBreedingObservationAwaitingReview,
} from "../utils/breedingObservationPresentation";

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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isTechnician = viewerRole === "technician";
  const backFallback = isTechnician
    ? "/(technician)/(tabs)/technician.animals"
    : "/(farmer)/(tabs)/farmer.records";

  const query = usePregnancyTrackerQuery(id);

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
  const [latest, ...historicalAttempts] = animal.inseminations || [];
  const canReportObservation =
    !isTechnician &&
    Boolean(latest?._id) &&
    ["done", "completed", "resolved"].includes(
      String(latest?.status || "").toLowerCase(),
    ) &&
    ["Inseminated", "In Heat"].includes(animal.reproductiveStatus || "");
  const activePregnancy = animal.inseminations
    ?.map((item: any) => item.pregnancy)
    .find(
      (item: any) =>
        item?.pregnancyDiagnosis?.result === "Pregnant" &&
        !["completed", "lost"].includes(item?.cycleStatus),
    );
  const latestPregnancy = latest?.pregnancy;
  const isCompletedCycle = latestPregnancy?.cycleStatus === "completed";
  const associatedCalving = animal.calvings?.find(
    (c: any) =>
      c.pregnancyId === latestPregnancy?._id ||
      c.pregnancyId?._id === latestPregnancy?._id
  );

  const aiDateValue =
    latest?.inseminationDate ||
    latest?.dateOfAI ||
    latest?.createdAt ||
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
  const diffDays = expected
    ? differenceInCalendarDays(expected, new Date())
    : null;
  const remainingDisplay = diffDays !== null
    ? diffDays === 0
      ? "Expected today"
      : diffDays < 0
        ? `${Math.abs(diffDays)} days overdue`
        : `${diffDays} estimated days remaining`
    : null;
  const remaining = diffDays;
  const totalDays =
    aiDate && expected
      ? Math.max(1, differenceInCalendarDays(expected, aiDate))
      : 0;
  const elapsedDays = aiDate
    ? Math.max(0, differenceInCalendarDays(new Date(), aiDate))
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
  const isConfirmedPregnant = activePregnancy?.pregnancyDiagnosis?.result === "Pregnant";

  const isTerminallyFailed = latest?.isSuccess === false;
  const isReturnToHeat =
    isTerminallyFailed && latest?.outcome === "Failed (Re-heat)";
  const isNegativePD =
    isTerminallyFailed && latest?.outcome === "Failed (Negative PD)";

  const isRecheck =
    latest?.pregnancyFollowUpTask?.metadata?.workflowStage ===
    "diagnostic_follow_up";

  const currentIndex = isConfirmedPregnant
    ? diffDays !== null && diffDays <= 30
      ? 3
      : 2
    : isTerminallyFailed
      ? isNegativePD
        ? 3
        : 2
      : animal.reproductiveStatus === "Inseminated" && !isRecheck
        ? 1
        : 2;

  type Milestone = {
    label: string;
    date: Date | null;
    detail: string;
    isFailed?: boolean;
    isSkipped?: boolean;
    isPendingEvidence?: boolean;
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
      date: aiDate ? addDays(aiDate, 21) : null,
      detail: isReturnToHeat
        ? "Return to heat confirmed"
        : currentIndex > 1
          ? "Initial observation period passed"
          : "Observe for returning heat signs",
      isFailed: isReturnToHeat,
    },
  ];

  if (!isConfirmedPregnant) {
    milestones.push({
      label: isRecheck ? "Pregnancy recheck" : "Pregnancy check",
      date:
        isRecheck && latest?.pregnancyFollowUpTask?.dueDate
          ? new Date(latest.pregnancyFollowUpTask.dueDate)
          : aiDate
            ? addDays(aiDate, 60)
            : null,
      detail: isReturnToHeat
        ? "No longer required"
        : isNegativePD
          ? "Negative diagnosis confirmed"
          : isRecheck
            ? "Pregnancy was not confirmed at the previous check."
            : "Professional diagnosis window",
      isSkipped: isReturnToHeat,
      isFailed: isNegativePD,
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
              <StatusBadge label={animal.reproductiveStatus || "Monitoring"} />
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
        {isCompletedCycle ? (
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
            <View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 16,
                }}
              >
                Post-partum
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                Calving recorded · {associatedCalving?.date ? format(new Date(associatedCalving.date), "MMM d, yyyy") : "N/A"}
              </Text>
            </View>
            <View style={{ marginTop: 16 }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Current status
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 15,
                  marginTop: 4,
                }}
              >
                Post-partum recovery
              </Text>
            </View>
          </View>
        ) : (animal.reproductiveStatus === "Pregnant" || activePregnancy) ? (
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
                    color: diffDays !== null && diffDays < 0 ? colors.error : colors.textMuted,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 9,
                    letterSpacing: 0.5,
                  }}
                >
                  {diffDays !== null && diffDays < 0 ? "OVERDUE" : "DAYS REMAINING"}
                </Text>
                <Text
                  style={{
                    color: diffDays !== null && diffDays < 0 ? colors.error : colors.textPrimary,
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
              <View style={{ flexDirection: "row", marginBottom: 16, opacity: 0.7 }}>
                <View style={{ width: 24, alignItems: "center" }}>
                  <CheckCircle size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold", fontSize: 15 }}>AI completed</Text>
                  {aiDate && <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_400Regular", fontSize: 13, marginTop: 2 }}>{format(aiDate, "MMM d, yyyy")}</Text>}
                </View>
              </View>
              {latestPregnancy?.pregnancyDiagnosis?.date && (
                <View style={{ flexDirection: "row", marginBottom: 16, opacity: 0.7 }}>
                  <View style={{ width: 24, alignItems: "center" }}>
                    <CheckCircle size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold", fontSize: 15 }}>Pregnancy confirmed</Text>
                    <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_400Regular", fontSize: 13, marginTop: 2 }}>{format(new Date(latestPregnancy.pregnancyDiagnosis.date), "MMM d, yyyy")}</Text>
                  </View>
                </View>
              )}
              {associatedCalving?.date && (
                <View style={{ flexDirection: "row", marginBottom: 16, opacity: 0.7 }}>
                  <View style={{ width: 24, alignItems: "center" }}>
                    <CheckCircle size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold", fontSize: 15 }}>Calving recorded</Text>
                    <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_400Regular", fontSize: 13, marginTop: 2 }}>{format(new Date(associatedCalving.date), "MMM d, yyyy")}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
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
              const complete =
                index < currentIndex &&
                !milestone.isSkipped &&
                !milestone.isFailed &&
                !milestone.isPendingEvidence;
              const active =
                index === currentIndex &&
                !isTerminallyFailed &&
                !milestone.isSkipped;
              const isFailed = milestone.isFailed;
              const isSkipped = milestone.isSkipped;
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
                      ) : isSkipped ? (
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
                  <View style={{ flex: 1, marginLeft: 12, paddingBottom: 20 }}>
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
                          Current Stage
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
        )}

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
              Previous Attempts
            </Text>
            {historicalAttempts.map((attempt: any) => {
              const histDateValue =
                attempt?.inseminationDate ||
                attempt?.dateOfAI ||
                attempt?.createdAt;
              const histDate = histDateValue ? new Date(histDateValue) : null;

              const isHistFailed = attempt.isSuccess === false;
              let outcomeText = attempt.outcome || "Pending";
              if (isHistFailed && outcomeText.includes("Failed")) {
                const reason = outcomeText
                  .replace("Failed", "")
                  .replace(/[()]/g, "")
                  .trim();
                outcomeText = `Failed · ${reason || "Unsuccessful"}`;
              } else if (attempt.isSuccess === true) {
                outcomeText = "Successful";
              }

              const routeDef = {
                pathname: isTechnician
                  ? "/(technician)/record-details"
                  : "/(farmer)/record-details",
                params: {
                  animalId: animal._id,
                  sourceId: attempt._id,
                  sourceKind: "insemination",
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
                      Attempt #{attempt.attemptNumber || "?"}
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
                    <Text
                      style={{
                        color: isHistFailed ? colors.error : colors.textMuted,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      {outcomeText}
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

        {/* Action Buttons */}
        {activePregnancy && animal.reproductiveStatus === "Pregnant" && (
          <View style={{ marginHorizontal: 24, marginTop: 24, gap: 12 }}>
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
                    "Live-birth readiness is unavailable. Review the timing before recording an outcome."}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() =>
                router.push(
                  isTechnician
                    ? ({
                        pathname: "/(technician)/record-calf-drop",
                        params: {
                          motherId: id,
                          motherTag: animal.earTag || animal.animalId || "",
                          pregnancyId: activePregnancy._id,
                        },
                      } as never)
                    : ({
                        pathname: "/(farmer)/record-calving",
                        params: {
                          animalId: id,
                          pregnancyId: activePregnancy._id,
                        },
                      } as never),
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
                {isTechnician ? "Record Calving / Loss" : "Record Calving"}
              </Text>
            </TouchableOpacity>

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
