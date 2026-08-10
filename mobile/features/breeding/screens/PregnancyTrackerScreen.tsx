import React from "react";
import {
  Image,
  Linking,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import {
  AlertTriangle,
  CalendarHeart,
  Check,
  ChevronRight,
  Circle,
  MessageSquareText,
  Phone,
  Stethoscope,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useTheme } from "@/lib/theme";
import {
  FarmerScreen,
  AsyncState,
  StatusBadge,
} from "@/features/farmer-ui/components";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";
import { calculateTargetCalvingDate } from "@/lib/cattleCore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePregnancyTrackerQuery } from "../hooks/usePregnancyTracker";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppPageHeader } from "@/components/AppPageHeader";
import {
  getBreedingObservationLabel,
  isBreedingObservationAwaitingReview,
} from "../utils/breedingObservationPresentation";

interface PregnancyTrackerScreenProps {
  id: string;
  viewerRole?: "farmer" | "technician";
}

function PregnancyTrackerSkeleton({
  backFallback,
}: {
  backFallback: string;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader
        title="Pregnancy Tracker"
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
          }}
        >
          <Skeleton
            shape="rect"
            height={64}
            width={64}
            radius={16}
            style={{ marginRight: 16 }}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Skeleton width="50%" height={18} radius={6} />
              <Skeleton width={80} height={20} radius={12} />
            </View>
            <Skeleton width="70%" height={12} radius={4} />
          </View>
        </View>

        {/* Gestation Progress Card Skeleton */}
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
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="60%" height={16} radius={4} />
              <Skeleton width="40%" height={12} radius={4} />
            </View>
            <Skeleton width={50} height={28} radius={6} />
          </View>

          {/* Progress Bar Skeleton */}
          <View
            style={{
              height: 8,
              marginTop: 16,
              borderRadius: 4,
              backgroundColor: colors.border,
            }}
          />

          {/* Expected / Days Remaining Grid Skeletons */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
            <View
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 16,
                borderColor: colors.border,
                borderWidth: 1,
                backgroundColor: colors.card,
                gap: 6,
              }}
            >
              <Skeleton width="70%" height={10} radius={2} />
              <Skeleton width="80%" height={16} radius={4} />
            </View>

            <View
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 16,
                borderColor: colors.border,
                borderWidth: 1,
                backgroundColor: colors.card,
                gap: 6,
              }}
            >
              <Skeleton width="60%" height={10} radius={2} />
              <Skeleton width="40%" height={16} radius={4} />
            </View>
          </View>
        </View>

        {/* Timeline Component Skeleton */}
        <View style={{ marginHorizontal: 24, marginTop: 24 }}>
          <Skeleton
            width="60%"
            height={20}
            radius={6}
            style={{ marginBottom: 16 }}
          />
          <View style={{ marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((idx) => (
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
                  {idx < 5 ? (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        backgroundColor: colors.border,
                      }}
                    />
                  ) : null}
                </View>
                <View
                  style={{ flex: 1, marginLeft: 12, paddingBottom: 20, gap: 8 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Skeleton width="45%" height={14} radius={4} />
                    <Skeleton width="25%" height={12} radius={4} />
                  </View>
                  <Skeleton width="75%" height={12} radius={4} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Warning Signs Component Skeleton */}
        <View
          style={{
            marginHorizontal: 24,
            marginTop: 8,
            padding: 20,
            borderRadius: 24,
            backgroundColor: isDark ? colors.card : "#fff8e7",
            borderColor: isDark ? colors.border : "#f2d48a",
            borderWidth: 1,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.border,
              }}
            />
            <Skeleton width="60%" height={16} radius={4} />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            {[1, 2, 3, 4].map((idx) => (
              <View
                key={idx}
                style={{
                  width: "48%",
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderColor: colors.border,
                  borderWidth: 1,
                  backgroundColor: colors.card,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: colors.border,
                  }}
                />
                <Skeleton width="60%" height={12} radius={3} />
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
          title="Pregnancy Tracker"
          onBack={() => safeBack(backFallback)}
        />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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
  const latest = animal.inseminations?.[0];
  const canReportObservation =
    !isTechnician &&
    Boolean(latest?._id) &&
    ["done", "completed", "resolved"].includes(
      String(latest?.status || "").toLowerCase(),
    ) &&
    ["Inseminated", "Likely Pregnant", "In Heat"].includes(
      animal.reproductiveStatus || "",
    );
  const activePregnancy = animal.inseminations
    ?.map((item: any) => item.pregnancy)
    .find((item: any) =>
      item?.pregnancyDiagnosis?.result === "Pregnant" &&
      !["completed", "lost"].includes(item?.cycleStatus),
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
  const remaining = expected
    ? Math.max(0, differenceInCalendarDays(expected, new Date()))
    : null;
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
  const currentIndex =
    animal.reproductiveStatus === "Pregnant"
      ? remaining !== null && remaining <= 30
        ? 4
        : 3
      : animal.reproductiveStatus === "Inseminated"
        ? 1
        : 2;

  const milestones = [
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
      detail: "Observe for returning heat signs",
    },
    {
      label: "Pregnancy check",
      date: aiDate ? addDays(aiDate, 60) : null,
      detail: "Professional diagnosis window",
    },
    {
      label: "Pregnancy confirmed",
      date: animal.pregnancyConfirmedAt
        ? new Date(animal.pregnancyConfirmedAt)
        : null,
      detail:
        animal.reproductiveStatus === "Pregnant"
          ? "Confirmed in the animal record"
          : "Awaiting confirmation",
    },
    {
      label: "Expected calving",
      date: expected,
      detail:
        remaining === null
          ? "Awaiting breeding information"
          : `${remaining} estimated days remaining`,
    },
  ];

  const warningSigns = [
    { label: "Difficulty standing", icon: "↕" },
    { label: "Bleeding", icon: "!" },
    { label: "Loss of appetite", icon: "−" },
    { label: "Abnormal discharge", icon: "◇" },
  ];

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader
        title="Pregnancy Tracker"
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

        {canReportObservation || latest?.farmerOutcomeReport ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/(farmer)/report-breeding-observation",
                params: {
                  animalId: animal._id,
                  requestId: latest?._id,
                  defaultReport: latest?.farmerOutcomeReport || "unsure",
                },
              } as never)
            }
            style={{
              marginHorizontal: 24,
              marginTop: 16,
              padding: 16,
              minHeight: 76,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark
                  ? "rgba(16,185,129,0.14)"
                  : "#ECFDF5",
              }}
            >
              <MessageSquareText size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 15,
                }}
              >
                {latest?.farmerOutcomeReport
                  ? getBreedingObservationLabel(latest.farmerOutcomeReport)
                  : "Report a breeding observation"}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  lineHeight: 16,
                  marginTop: 3,
                }}
              >
                {latest?.farmerOutcomeReport
                  ? isBreedingObservationAwaitingReview(
                      latest.verificationStatus ||
                        latest.outcomeVerificationStatus,
                    )
                    ? "Farmer observation · Awaiting technician review"
                    : "Farmer observation submitted"
                  : "Share signs or a return to heat with the technician."}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {/* Gestation Progress Card */}
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
                {expected ? format(expected, "MMM d, yyyy") : "Not calculated"}
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
                  color: colors.textMuted,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 9,
                  letterSpacing: 0.5,
                }}
              >
                DAYS REMAINING
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 14,
                  marginTop: 4,
                }}
              >
                {remaining ?? "N/A"}
              </Text>
            </View>
          </View>
        </View>

        {/* Timeline Component */}
        <View style={{ marginHorizontal: 24, marginTop: 24 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 18,
            }}
          >
            Pregnancy Timeline
          </Text>
          <View style={{ marginTop: 16 }}>
            {milestones.map((milestone, index) => {
              const complete = index < currentIndex;
              const active = index === currentIndex;
              return (
                <View
                  key={milestone.label}
                  style={{ flexDirection: "row", minHeight: 80 }}
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
                          complete || active
                            ? isDark
                              ? colors.primary
                              : "#00643B"
                            : colors.border,
                        backgroundColor: complete
                          ? isDark
                            ? colors.primary
                            : "#00643B"
                          : colors.card,
                      }}
                    >
                      {complete ? (
                        <Check size={12} color="white" />
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
                            : colors.textPrimary,
                          fontFamily: "Outfit_700Bold",
                          fontSize: 14,
                        }}
                      >
                        {milestone.label}
                      </Text>
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontFamily: "Outfit_500Medium",
                          fontSize: 11,
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
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Warning Signs Component */}
        <View
          style={{
            marginHorizontal: 24,
            marginTop: 8,
            padding: 20,
            borderRadius: 24,
            backgroundColor: isDark ? colors.card : "#fff8e7",
            borderColor: isDark ? colors.border : "#f2d48a",
            borderWidth: 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AlertTriangle size={18} color={colors.warning || "#d97706"} />
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
                marginLeft: 8,
              }}
            >
              Monitor for warning signs
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 16,
            }}
          >
            {warningSigns.map((sign) => (
              <View
                key={sign.label}
                style={{
                  width: "48%",
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderColor: colors.border,
                  borderWidth: 1,
                  backgroundColor: colors.card,
                }}
              >
                <Text
                  style={{
                    color: colors.warning || "#d97706",
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 14,
                  }}
                >
                  {sign.icon}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 11,
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  {sign.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

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
                      params: { animalId: id, pregnancyId: activePregnancy._id },
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

          {!isTechnician ? <>
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
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
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
          </> : null}
        </View>
        )}

        <Text
          style={{
            marginHorizontal: 24,
            marginTop: 24,
            color: colors.textMuted,
            fontFamily: "Outfit_500Medium",
            fontSize: 11,
            lineHeight: 16,
          }}
        >
          Dates are estimates based on recorded breeding information and do not
          replace a professional examination.
        </Text>
      </ScrollView>
    </FarmerScreen>
  );
}
