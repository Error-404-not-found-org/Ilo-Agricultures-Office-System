import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  Phone,
  User,
  Info,
  Navigation,
  Lock,
  FileText,
  MessageSquareText,
  CalendarClock,
  HeartPulse,
  Baby,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import {
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
} from "@/features/breeding/utils/breedingObservationPresentation";

const formatDisplayDate = (value: unknown, includeWeekday = false) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    ...(includeWeekday ? { weekday: "long" as const } : {}),
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const humanize = (value: unknown) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getPregnancyTaskLabel = (stage: string) => {
  if (stage === "continuation_recheck") return "Pregnancy continuation recheck";
  if (stage === "diagnostic_follow_up") return "Pregnancy diagnostic follow-up";
  return "Pregnancy check";
};

function DetailRow({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value: string;
  colors: any;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        !last && { borderBottomColor: colors.border, borderBottomWidth: 1 },
      ]}
    >
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

export default function TaskDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const { taskDetailsQuery, claimTaskMutation, completeTaskMutation } = useTechnicianTasks(String(id));
  const { data: task, isLoading, refetch } = taskDetailsQuery;
  const pregnancyWorkflowStage =
    task?.metadata?.workflowStage || task?.workflowStage || "initial_confirmation";
  const isReturnToHeatReview =
    task?.insemination?.farmerOutcomeReport === "return_to_heat";
  const initialPregnancyCheckLocked = Boolean(
    task?.taskType === "PD" &&
      pregnancyWorkflowStage === "initial_confirmation" &&
      task?.pregnancyReadiness &&
      !task.pregnancyReadiness.isEligible &&
      !isReturnToHeatReview,
  );

  const [completing, setCompleting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      await claimTaskMutation.mutateAsync(String(id));
      toast.success("Task claimed successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to claim task");
    } finally {
      setClaiming(false);
    }
  };

  const handleComplete = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await completeTaskMutation.mutateAsync(String(id));
      toast.success("Visit marked as completed!");
      router.back();
    } catch {
      toast.error("Update failed");
    } finally {
      setCompleting(false);
    }
  };

  const getPrimaryAction = () => {
    const taskType = task?.taskType;
    if (taskType === "AI") {
      return { label: "Record AI Service", pathname: "/(technician)/record-ai" };
    }
    if (["Health", "Treatment", "Vaccination", "Deworming"].includes(taskType)) {
      return { label: "Record Health Assistance", pathname: "/(technician)/health-log" };
    }
    if (taskType === "PD") {
      if (pregnancyWorkflowStage === "continuation_recheck") {
        return { label: "Record Continuation Recheck", pathname: "/(technician)/pregnancy-verification" };
      }
      if (pregnancyWorkflowStage === "diagnostic_follow_up") {
        return { label: "Record Diagnostic Follow-up", pathname: "/(technician)/pregnancy-verification" };
      }
      return { label: "Record Pregnancy Check", pathname: "/(technician)/pregnancy-verification" };
    }
    if (taskType === "CD" || taskType === "Calving") {
      return { label: "Record Calving", pathname: "/(technician)/record-calf-drop" };
    }
    return { label: "Complete General Visit", pathname: null };
  };

  const handlePrimaryAction = () => {
    if (initialPregnancyCheckLocked) {
      toast.error(task?.pregnancyReadiness?.reason || "Pregnancy check is not yet available.");
      return;
    }
    const action = getPrimaryAction();
    if (!action.pathname) {
      handleComplete();
      return;
    }

    const animal = task.animalIds?.[0];
    const params: Record<string, string> = {
      taskId: String(task._id),
      farmerId: String(task.farmerId?._id || ""),
      farmerName: String(task.farmerId?.name || ""),
      source: "task",
    };

    if (animal?._id) {
      if (task.taskType === "CD" || task.taskType === "Calving") {
        params.motherId = String(animal._id);
      } else {
        params.animalId = String(animal._id);
      }
    }

    if (task.taskType === "CD" || task.taskType === "Calving") {
      const pregnancyId =
        task.pregnancy?._id ||
        task.metadata?.pregnancyId ||
        (task.relatedRecordType === "pregnancy" ? task.relatedRecordId : null);
      if (pregnancyId) params.pregnancyId = String(pregnancyId);
    }

    if (task.taskType === "PD") {
      router.push(`/(technician)/pregnancy-verification?id=${task._id}` as any);
      return;
    }

    router.push({ pathname: action.pathname as any, params } as any);
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator
          size="large"
          color={isDark ? "#10b981" : "#00643B"}
        />
      </View>
    );
  }

  if (!task) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.textPrimary }}>Visit or task not found</Text>
      </View>
    );
  }

  const isClaimed = !!task.technicianId;
  const isFieldWorkTask = [
    "GeneralVisit",
    "FarmInspection",
    "Registration",
    "Other",
  ].includes(task.taskType);
  const pregnancyReadiness =
    task.taskType === "PD" ? task.pregnancyReadiness : null;

  const isPregnancyTask = task.taskType === "PD";
  const isCalvingTask = task.taskType === "CD" || task.taskType === "Calving";
  const animal = task.animalIds?.[0];
  const pregnancy = task.pregnancy;
  const insemination = task.insemination || pregnancy?.inseminationId;
  const visitPeriod = String(
    task.visitPeriod || task.metadata?.visitPeriod || "",
  ).toLowerCase();
  const serviceTitle = isPregnancyTask
    ? getPregnancyTaskLabel(pregnancyWorkflowStage)
    : isCalvingTask
      ? "Calving assistance"
      : humanize(task.taskType || "Farm visit");
  const visitDate = formatDisplayDate(task.dueDate, true);
  const pregnancyDetails = isPregnancyTask
    ? [
        ["Check type", getPregnancyTaskLabel(pregnancyWorkflowStage)],
        [
          "AI service date",
          formatDisplayDate(
            insemination?.inseminationDate || insemination?.scheduledDate,
          ),
        ],
        [
          "AI attempt",
          insemination?.attemptNumber
            ? `Attempt ${insemination.attemptNumber}`
            : null,
        ],
        ["Sire breed", insemination?.sireBreed],
        ["Sire code", insemination?.sireCode],
        ["Estrus type", insemination?.estrus],
        [
          "Pregnancy result",
          pregnancy?.pregnancyDiagnosis?.result
            ? humanize(pregnancy.pregnancyDiagnosis.result)
            : null,
        ],
        [
          "Diagnosis date",
          formatDisplayDate(pregnancy?.pregnancyDiagnosis?.date),
        ],
        ["Expected calving", formatDisplayDate(pregnancy?.targetCalvingDate)],
        [
          "Check readiness",
          pregnancyReadiness?.isEligible ? "Ready to record" : null,
        ],
      ]
    : isCalvingTask
      ? [
          [
            "Pregnancy status",
            pregnancy?.pregnancyDiagnosis?.result
              ? humanize(pregnancy.pregnancyDiagnosis.result)
              : null,
          ],
          [
            "Pregnancy confirmed",
            formatDisplayDate(pregnancy?.pregnancyDiagnosis?.date),
          ],
          [
            "Expected calving",
            formatDisplayDate(
              pregnancy?.targetCalvingDate || animal?.expectedCalvingDate,
            ),
          ],
          [
            "Confirmation method",
            pregnancy?.confirmation?.methodCode
              ? humanize(pregnancy.confirmation.methodCode)
              : null,
          ],
          [
            "AI service date",
            formatDisplayDate(
              insemination?.inseminationDate || insemination?.scheduledDate,
            ),
          ],
          [
            "AI attempt",
            insemination?.attemptNumber
              ? `Attempt ${insemination.attemptNumber}`
              : null,
          ],
          ["Sire breed", insemination?.sireBreed],
          ["Sire code", insemination?.sireCode],
        ]
      : [];
  const availablePregnancyDetails = pregnancyDetails.filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  const farmLocation = task.farmerId?.farmLocation;
  const farmerAddress = task.farmerId?.address || {};
  const farmerArea = [
    farmerAddress.barangay,
    farmerAddress.municipality || farmerAddress.city,
  ]
    .filter(Boolean)
    .join(", ");
  const structuredAddress = [
    farmerAddress.houseNumber,
    farmerAddress.street,
    farmerAddress.barangay,
    farmerAddress.municipality || farmerAddress.city,
  ]
    .filter(Boolean)
    .join(", ");
  const displayAddress =
    farmLocation?.detectedAddress || structuredAddress || farmerArea;
  const destinationQuery =
    typeof farmLocation?.latitude === "number" &&
    typeof farmLocation?.longitude === "number"
      ? `${farmLocation.latitude},${farmLocation.longitude}`
      : typeof farmerAddress.coordinates?.lat === "number" &&
          typeof farmerAddress.coordinates?.lng === "number"
        ? `${farmerAddress.coordinates.lat},${farmerAddress.coordinates.lng}`
        : displayAddress;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? colors.card : "#f8fafc" },
          ]}
        >
          <ArrowLeft size={24} color={isDark ? "white" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {task?.taskType === "PD"
            ? "Pregnancy Check Details"
            : task?.taskType === "Calving"
              ? "Calving Monitoring"
              : "Task Details"}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Task Info Content */}
        <View style={styles.content}>
          <View
            style={[
              styles.section,
              styles.cardContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.summaryHeading}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.summaryEyebrow, { color: colors.primary }]}
                >
                  {isCalvingTask
                    ? "CALVING VISIT"
                    : isPregnancyTask
                      ? "PREGNANCY VISIT"
                      : "FIELD VISIT"}
                </Text>
                <Text
                  style={[styles.summaryTitle, { color: colors.textPrimary }]}
                >
                  {serviceTitle}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isDark
                      ? "rgba(16,185,129,0.14)"
                      : "#ECFDF5",
                  },
                ]}
              >
                <Text
                  style={[styles.statusPillText, { color: colors.primary }]}
                >
                  {humanize(task.status || "Pending")}
                </Text>
              </View>
            </View>

            {visitDate ? (
              <View style={styles.scheduleLine}>
                <CalendarClock size={19} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.scheduleLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Scheduled visit
                  </Text>
                  <Text
                    style={[
                      styles.scheduleValue,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {visitDate}
                    {visitPeriod === "morning"
                      ? " · Morning"
                      : visitPeriod === "afternoon"
                        ? " · Afternoon"
                        : ""}
                  </Text>
                </View>
              </View>
            ) : (
              <Text
                style={[
                  styles.unscheduledText,
                  { color: colors.textSecondary },
                ]}
              >
                Visit date not scheduled
              </Text>
            )}

            <View style={styles.summaryMetaRow}>
              <Text
                style={[styles.summaryMeta, { color: colors.textSecondary }]}
              >
                {task.category || "Routine"}
              </Text>
              {task.priority ? (
                <Text
                  style={[styles.summaryMeta, { color: colors.textSecondary }]}
                >
                  Priority {task.priority}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Farmer Info section */}
          <View
            style={[
              styles.section,
              styles.cardContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <User size={18} color={isDark ? "#34d399" : "#00643B"} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#34d399" : "#00643B" },
                ]}
              >
                Farmer Info
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                marginTop: 8,
              }}
            >
              {/* Farmer Profile Pic */}
              {task.farmerId?.imageUrl ? (
                <Image
                  source={{ uri: task.farmerId.imageUrl }}
                  style={styles.profileAvatar}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.profileAvatar,
                    { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
                  ]}
                >
                  <User size={24} color={colors.textSecondary} />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.farmerName, { color: colors.textPrimary }]}
                >
                  {task.farmerId?.name}
                </Text>

                {isClaimed ? (
                  <>
                    <View style={styles.row}>
                      <Phone size={14} color={colors.textSecondary} />
                      <Text
                        style={[
                          styles.farmerSub,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {task.farmerId?.phoneNumber || "Phone not provided"}
                      </Text>
                    </View>
                    {displayAddress ? (
                      <View style={styles.row}>
                        <MapPin size={14} color={colors.textSecondary} />
                        <Text
                          style={[
                            styles.farmerSub,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {displayAddress}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.locationNote,
                          { color: colors.textMuted },
                        ]}
                      >
                        Farm location not provided
                      </Text>
                    )}
                    {farmLocation?.landmark || farmerAddress.landmark ? (
                      <Text
                        style={[
                          styles.locationNote,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Landmark:{" "}
                        {farmLocation?.landmark || farmerAddress.landmark}
                      </Text>
                    ) : null}
                    {farmLocation?.directionsNote ? (
                      <Text
                        style={[
                          styles.locationNote,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Directions: {farmLocation.directionsNote}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.row}>
                    <Lock size={14} color={colors.textMuted} />
                    <Text
                      style={[
                        styles.farmerSub,
                        { color: colors.textMuted, fontStyle: "italic" },
                      ]}
                    >
                      Claim task to view contact details
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Navigate Button */}
            {isClaimed && destinationQuery ? (
              <TouchableOpacity
                style={[
                  styles.navigateBtn,
                  {
                    backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
                    borderColor: isDark ? "#065f46" : "#bbf7d0",
                  },
                ]}
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`;
                  Linking.openURL(url).catch((err) =>
                    console.error("Failed to open maps", err),
                  );
                }}
              >
                <Navigation size={14} color={isDark ? "#34d399" : "#00643B"} />
                <Text
                  style={[
                    styles.navigateBtnText,
                    { color: isDark ? "#34d399" : "#00643B" },
                  ]}
                >
                  {typeof farmLocation?.latitude === "number"
                    ? "Get directions to farm"
                    : task.farmerId?.address?.coordinates?.lat
                      ? "Navigate to Address Coordinates"
                      : "Navigate to Barangay Area"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Task Description section */}
          <View
            style={[
              styles.section,
              styles.cardContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Info size={18} color={isDark ? "#34d399" : "#00643B"} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#34d399" : "#00643B" },
                ]}
              >
                Visit / Task Description
              </Text>
            </View>
            <View
              className={`inline-block self-start px-2 py-1 rounded-lg mb-3 ${
                task.category === "Urgent"
                  ? isDark
                    ? "bg-red-950/40"
                    : "bg-red-50"
                  : isDark
                    ? "bg-blue-950/40"
                    : "bg-blue-50"
              }`}
            >
              <Text
                className={`text-[10px] font-black uppercase ${
                  task.category === "Urgent" ? "text-red-500" : "text-blue-500"
                }`}
              >
                {task.category}
              </Text>
            </View>
            <Text style={[styles.notesText, { color: colors.textPrimary }]}>
              {task.notes}
            </Text>
          </View>

          {availablePregnancyDetails.length > 0 ? (
            <View
              style={[
                styles.section,
                styles.cardContainer,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                {isCalvingTask ? (
                  <Baby size={18} color={isDark ? "#22D3EE" : "#0891B2"} />
                ) : (
                  <HeartPulse
                    size={18}
                    color={isDark ? "#F472B6" : "#DB2777"}
                  />
                )}
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDark ? "#34d399" : "#00643B" },
                  ]}
                >
                  {isCalvingTask
                    ? "Calving & Pregnancy Details"
                    : "Pregnancy Check Details"}
                </Text>
              </View>
              <View style={[styles.detailList, { borderColor: colors.border }]}>
                {availablePregnancyDetails.map(([label, value], index) => (
                  <DetailRow
                    key={label}
                    label={label}
                    value={value}
                    colors={colors}
                    last={index === availablePregnancyDetails.length - 1}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {task.taskType === "PD" && task.insemination?.farmerOutcomeReport ? (
            <View
              style={[
                styles.section,
                styles.cardContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <MessageSquareText
                  size={18}
                  color={isDark ? "#34d399" : "#00643B"}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDark ? "#34d399" : "#00643B" },
                  ]}
                >
                  Farmer Observation
                </Text>
              </View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 15,
                  marginTop: 8,
                }}
              >
                {getBreedingObservationLabel(
                  task.insemination.farmerOutcomeReport,
                )}
              </Text>
              {task.insemination.farmerOutcomeReportedAt ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  Reported{" "}
                  {new Date(
                    task.insemination.farmerOutcomeReportedAt,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              ) : null}
              {task.insemination.farmerObservationSigns?.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {task.insemination.farmerObservationSigns.map(
                    (sign: string) => (
                      <View
                        key={sign}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontFamily: "Outfit_600SemiBold",
                            fontSize: 11,
                          }}
                        >
                          {getBreedingObservationSignLabel(sign)}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              ) : null}
              {task.insemination.farmerObservationNotes ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 13,
                    lineHeight: 19,
                    marginTop: 12,
                  }}
                >
                  {task.insemination.farmerObservationNotes}
                </Text>
              ) : null}
              {task.insemination.evidencePhotos?.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingTop: 12 }}
                >
                  {task.insemination.evidencePhotos.map(
                    (photo: string, index: number) => (
                      <Image
                        key={`${photo}-${index}`}
                        source={{ uri: photo }}
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: 12,
                        }}
                      />
                    ),
                  )}
                </ScrollView>
              ) : null}
              <View
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "#FFFBEB",
                }}
              >
                <Text
                  style={{
                    color: isDark ? "#FCD34D" : "#92400E",
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  Review only. An official pregnancy diagnosis must be recorded
                  through the pregnancy-check action below.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Associated Animals section */}
          {task.animalIds && task.animalIds.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: isDark ? "#34d399" : "#00643B",
                    marginBottom: 12,
                    marginLeft: 4,
                  },
                ]}
              >
                {isCalvingTask ? "Mother Animal" : "Associated Animals"}
              </Text>
              {task.animalIds.map((anim: any) => (
                <TouchableOpacity
                  key={anim._id}
                  style={[
                    styles.animalCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    router.push(
                      `/(technician)/animal-details?id=${anim._id}` as any,
                    )
                  }
                >
                  {/* Animal Profile Pic */}
                  {anim.imageUrl ? (
                    <Image
                      source={{ uri: anim.imageUrl }}
                      style={styles.animalAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.animalAvatar,
                        { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
                      ]}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          color: colors.textSecondary,
                          fontSize: 16,
                        }}
                      >
                        {(anim.species || "A").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.animalInfo}>
                    <Text
                      style={[styles.animalTag, { color: colors.textPrimary }]}
                    >
                      Tag: {anim.earTag || anim.animalId}
                    </Text>
                    <Text
                      style={[
                        styles.animalBreed,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {[anim.breed, anim.species].filter(Boolean).join(" · ")}
                    </Text>
                    {[anim.gender, anim.color, anim.reproductiveStatus].filter(
                      Boolean,
                    ).length ? (
                      <Text
                        style={[
                          styles.animalFacts,
                          { color: colors.textMuted },
                        ]}
                        numberOfLines={2}
                      >
                        {[anim.gender, anim.color, anim.reproductiveStatus]
                          .filter(Boolean)
                          .map(humanize)
                          .join(" · ")}
                      </Text>
                    ) : null}
                    {anim.birthDate || typeof anim.parity === "number" ? (
                      <Text
                        style={[
                          styles.animalFacts,
                          { color: colors.textMuted },
                        ]}
                        numberOfLines={2}
                      >
                        {[
                          anim.birthDate
                            ? `Born ${formatDisplayDate(anim.birthDate)}`
                            : null,
                          typeof anim.parity === "number"
                            ? `Parity ${anim.parity}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  <CheckCircle size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {pregnancyReadiness && !pregnancyReadiness.isEligible && (
            <View
              style={[
                styles.section,
                styles.cardContainer,
                {
                  backgroundColor: isDark ? "rgba(245,158,11,0.10)" : "#fffbeb",
                  borderColor: isDark ? "rgba(245,158,11,0.30)" : "#fde68a",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Info size={18} color={isDark ? "#fbbf24" : "#92400e"} />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: isDark ? "#fbbf24" : "#92400e" },
                  ]}
                >
                  Pregnancy check not yet available
                </Text>
              </View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  lineHeight: 20,
                }}
              >
                {pregnancyReadiness.reason}
              </Text>
            </View>
          )}

          {isClaimed && isFieldWorkTask && task.status !== "Completed" ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Add an optional field note"
              onPress={() => {
                const animal = task.animalIds?.[0];
                router.push({
                  pathname: "/(technician)/photo-notes",
                  params: {
                    taskId: String(task._id),
                    taskType: String(task.taskType),
                    farmerId: String(task.farmerId?._id || ""),
                    farmerName: String(task.farmerId?.name || ""),
                    animalId: animal?._id ? String(animal._id) : "",
                    openEditor: "true",
                  },
                } as any);
              }}
              style={[
                styles.fieldNoteBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <FileText size={18} color={isDark ? "#34d399" : "#00643B"} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.fieldNoteBtnTitle,
                    { color: colors.textPrimary },
                  ]}
                >
                  Add Field Note
                </Text>
                <Text
                  style={[
                    styles.fieldNoteBtnDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Optional observation, photo, or GPS context
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Save/Action Button */}
          {!isClaimed ? (
            <TouchableOpacity
              disabled={claiming}
              style={[
                styles.completeBtn,
                {
                  backgroundColor: claiming
                    ? "#34d399"
                    : isDark
                      ? "#10b981"
                      : "#00643B",
                  shadowColor: isDark ? "transparent" : "#00643B",
                  opacity: claiming ? 0.7 : 1,
                },
              ]}
              onPress={handleClaim}
            >
              {claiming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CheckCircle size={20} color="#fff" />
                  <Text style={styles.completeBtnText}>Claim Task</Text>
                </>
              )}
            </TouchableOpacity>
          ) : task.status === "Completed" ? (
            <View
              style={[
                styles.completeBtn,
                {
                  backgroundColor: colors.border,
                  shadowColor: "transparent",
                  opacity: 0.8,
                },
              ]}
            >
              <CheckCircle size={20} color={colors.textMuted} />
              <Text
                style={[styles.completeBtnText, { color: colors.textMuted }]}
              >
                Completed
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              disabled={completing || initialPregnancyCheckLocked}
              accessibilityRole="button"
              accessibilityState={{
                disabled: completing || initialPregnancyCheckLocked,
              }}
              accessibilityLabel={
                initialPregnancyCheckLocked
                  ? `Pregnancy check unavailable. ${pregnancyReadiness?.reason || "Not yet available."}`
                  : getPrimaryAction().label
              }
              style={[
                styles.completeBtn,
                {
                  backgroundColor: completing
                    ? "#34d399"
                    : isDark
                      ? "#10b981"
                      : "#00643B",
                  shadowColor: isDark ? "transparent" : "#00643B",
                  opacity: completing || initialPregnancyCheckLocked ? 0.55 : 1,
                },
              ]}
              onPress={handlePrimaryAction}
            >
              {completing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CheckCircle size={20} color="#fff" />
                  <Text style={styles.completeBtnText}>
                    {initialPregnancyCheckLocked
                      ? "Pregnancy Check Unavailable"
                      : getPrimaryAction().label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    marginRight: 16,
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 12,
  },
  headerTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
    color: "#1e293b",
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  summaryHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryEyebrow: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 11,
    letterSpacing: 1.1,
  },
  summaryTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    lineHeight: 28,
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
  },
  scheduleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  scheduleLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  scheduleValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    marginTop: 2,
  },
  unscheduledText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    marginTop: 16,
  },
  summaryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  summaryMeta: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  cardContainer: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 13,
    color: "#00643B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerName: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
    color: "#1e293b",
  },
  farmerSub: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    color: "#64748b",
    marginLeft: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  navigateBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  notesText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
  },
  detailList: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailLabel: {
    flex: 1,
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
  },
  detailValue: {
    flex: 1.35,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
  },
  locationNote: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  animalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
  },
  animalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  animalInfo: {
    flex: 1,
  },
  animalTag: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    color: "#1e293b",
  },
  animalBreed: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    color: "#64748b",
  },
  animalFacts: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  fieldNoteBtn: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 4,
  },
  fieldNoteBtnTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
  fieldNoteBtnDescription: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
  completeBtn: {
    backgroundColor: "#00643B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 24,
    gap: 12,
    marginTop: 10,
    shadowColor: "#00643B",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  completeBtnText: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
});
