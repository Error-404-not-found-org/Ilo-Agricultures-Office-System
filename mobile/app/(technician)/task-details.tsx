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
  CalendarClock,
  Baby,
  House,
  MapPinHouse,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import {
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
} from "@/features/breeding/utils/breedingObservationPresentation";
import { FarmerBreedingObservationCard } from "@/features/breeding/components/FarmerBreedingObservationCard";
import { PregnancyConfirmationWindow } from "@/features/breeding/components/PregnancyConfirmationWindow";
import BreedingFollowUpTaskView from "@/features/breeding/components/BreedingFollowUpTaskView";

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

function PregnancyConfirmationTaskView({
  task,
  colors,
  isClaimed,
  destinationQuery,
  handleClaim,
  handlePrimaryAction,
  claiming,
  completing,
  initialPregnancyCheckLocked,
}: any) {
  const animal = task.animalIds?.[0];
  const insemination = task.insemination || task.pregnancy?.inseminationId;
  const pregnancyReadiness = task.pregnancyReadiness;
  const { isDark } = useTheme();

  const farmLocation = task.farmerId?.farmLocation;
  const farmerAddress = Array.isArray(task.farmerId?.address)
    ? task.farmerId.address[0] || {}
    : task.farmerId?.address || {};

  const structuredHomeAddress = [
    farmerAddress.houseNumber,
    farmerAddress.street,
    farmerAddress.barangay,
    farmerAddress.municipality || farmerAddress.city,
    farmerAddress.province,
  ]
    .filter(Boolean)
    .join(", ");

  const structuredFarmAddress =
    farmLocation?.detectedAddress ||
    [
      farmLocation?.barangay,
      farmLocation?.city || farmLocation?.municipality,
      farmLocation?.province,
    ]
      .filter(Boolean)
      .join(", ");

  const aiDate = insemination?.inseminationDate || insemination?.scheduledDate;
  const animalTag = animal?.earTag || animal?.animalId || "Animal";
  const animalDescription = [animal?.species, animal?.breed]
    .filter(Boolean)
    .map(humanize)
    .join(" · ");
  const sire = [insemination?.sireBreed, insemination?.sireCode]
    .filter(Boolean)
    .map((value, index) => (index === 0 ? humanize(value) : String(value)))
    .join(" · ");
  const technicianName =
    typeof insemination?.technicianId === "object"
      ? insemination.technicianId?.name
      : typeof insemination?.approvedBy === "object"
        ? insemination.approvedBy?.name
        : null;
  const breedingReference = [
    ["AI Date", formatDisplayDate(aiDate)],
    [
      "AI Attempt",
      insemination?.attemptNumber ? `#${insemination.attemptNumber}` : null,
    ],
    ["Sire", sire || null],
    ["AI Technician", technicianName],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  const hasFarmerObservation = Boolean(
    insemination?.farmerOutcomeReport ||
    insemination?.farmerObservationSigns?.length ||
    insemination?.farmerObservationNotes ||
    insemination?.evidencePhotos?.length,
  );

  return (
    <View>
      {/* 1. Animal and Farmer */}
      <View
        style={[
          styles.pdCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.pdSectionTitle,
            { color: colors.primary, marginBottom: 12 },
          ]}
        >
          Animal & Farmer
        </Text>

        {animal ? (
          <View>
            <Text style={[styles.pdAnimalTag, { color: colors.textPrimary }]}>
              {animalTag}
            </Text>
            {animalDescription ? (
              <Text
                style={[styles.pdAnimalMeta, { color: colors.textSecondary }]}
              >
                {animalDescription}
              </Text>
            ) : null}
            {animal.reproductiveStatus ? (
              <Text
                style={[styles.pdAnimalStatus, { color: colors.textMuted }]}
              >
                Reproductive status: {humanize(animal.reproductiveStatus)}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            No animal linked.
          </Text>
        )}

        <View style={[styles.pdDivider, { backgroundColor: colors.border }]} />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: isClaimed ? 14 : 0,
          }}
        >
          {task.farmerId?.imageUrl ? (
            <Image
              source={{ uri: task.farmerId.imageUrl }}
              style={{ width: 48, height: 48, borderRadius: 24 }}
            />
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={20} color={colors.textSecondary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.pdFarmerName, { color: colors.textPrimary }]}>
              {task.farmerId?.name || "Farmer"}
            </Text>
            <Text
              style={[styles.pdContextLabel, { color: colors.textSecondary }]}
            >
              Farmer Owner
            </Text>
          </View>
          {isClaimed && task.farmerId?.phoneNumber ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Call farmer"
              onPress={() =>
                Linking.openURL(`tel:${task.farmerId.phoneNumber}`)
              }
              style={[styles.pdCallButton, { backgroundColor: colors.tint }]}
            >
              <Phone size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {isClaimed ? (
          <View style={{ gap: 14 }}>
            {task.farmerId?.phoneNumber ? (
              <PDContactRow
                icon={Phone}
                label="Phone"
                value={task.farmerId.phoneNumber}
                colors={colors}
              />
            ) : null}
            {structuredHomeAddress ? (
              <PDContactRow
                icon={House}
                label="Home Address"
                value={structuredHomeAddress}
                colors={colors}
              />
            ) : null}
            {structuredFarmAddress ? (
              <View style={styles.pdContactRow}>
                <MapPinHouse
                  size={17}
                  color={colors.textSecondary}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.pdContextLabel, { color: colors.textMuted }]}
                  >
                    Farm Location
                  </Text>
                  <Text
                    style={[
                      styles.pdContactValue,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {structuredFarmAddress}
                  </Text>
                  {destinationQuery ? (
                    <TouchableOpacity
                      accessibilityRole="link"
                      accessibilityLabel="Get directions to farm"
                      style={{ marginTop: 7, alignSelf: "flex-start" }}
                      onPress={() => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`;
                        Linking.openURL(url).catch((error) =>
                          console.error("Failed to open maps", error),
                        );
                      }}
                    >
                      <Text
                        style={[styles.pdDirections, { color: colors.primary }]}
                      >
                        Get directions
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View
            style={[styles.pdLockedRow, { backgroundColor: colors.background }]}
          >
            <Lock size={16} color={colors.textMuted} />
            <Text style={[styles.pdLockedText, { color: colors.textMuted }]}>
              Claim task to view full contact and location details
            </Text>
          </View>
        )}
      </View>

      {/* 2. Breeding Reference */}
      <View
        style={[
          styles.pdCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.pdSectionTitle,
            { color: colors.primary, marginBottom: 4 },
          ]}
        >
          Breeding Reference
        </Text>
        <View>
          {breedingReference.map(([label, value], index) => (
            <DetailRow
              key={label}
              label={label}
              value={value}
              colors={colors}
              last={index === breedingReference.length - 1}
            />
          ))}
        </View>
      </View>

      {/* 3. Farmer Update */}
      {hasFarmerObservation ? (
        <View style={{ marginBottom: 20 }}>
          <FarmerBreedingObservationCard observation={insemination} />
        </View>
      ) : (
        <View
          style={[
            styles.pdCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.pdSectionTitle,
              { color: colors.primary, marginBottom: 8 },
            ]}
          >
            Farmer Follow-up
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_400Regular",
            }}
          >
            No update has been received from the farmer.
          </Text>
        </View>
      )}

      {/* 4. Pregnancy Confirmation Window */}
      <PregnancyConfirmationWindow
        pregnancyReadiness={pregnancyReadiness}
        aiDate={aiDate}
      />

      {/* 5. Primary Action */}
      {!isClaimed ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Claim task"
          disabled={claiming}
          style={[
            styles.pdBtn,
            { backgroundColor: colors.primary, opacity: claiming ? 0.7 : 1 },
          ]}
          onPress={handleClaim}
        >
          {claiming ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <CheckCircle size={20} color="#fff" />
              <Text style={styles.pdBtnText}>Claim Task</Text>
            </>
          )}
        </TouchableOpacity>
      ) : task.status === "Completed" ? (
        <View style={[styles.pdBtn, { backgroundColor: colors.border }]}>
          <CheckCircle size={20} color={colors.textMuted} />
          <Text style={[styles.pdBtnText, { color: colors.textMuted }]}>
            Completed
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{
            disabled: completing || initialPregnancyCheckLocked,
          }}
          accessibilityLabel={
            initialPregnancyCheckLocked
              ? "Confirmation not yet available"
              : "Record pregnancy confirmation"
          }
          disabled={completing || initialPregnancyCheckLocked}
          style={[
            styles.pdBtn,
            {
              backgroundColor: colors.primary,
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
              <Text style={styles.pdBtnText}>
                {initialPregnancyCheckLocked
                  ? "Confirmation Not Yet Available"
                  : "Record Pregnancy Confirmation"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function PDContactRow({
  icon: Icon,
  label,
  value,
  colors,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.pdContactRow}>
      <Icon size={17} color={colors.textSecondary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.pdContextLabel, { color: colors.textMuted }]}>
          {label}
        </Text>
        <Text style={[styles.pdContactValue, { color: colors.textPrimary }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function TaskDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const { taskDetailsQuery, claimTaskMutation, completeTaskMutation } =
    useTechnicianTasks(String(id));
  const { data: task, isLoading, refetch } = taskDetailsQuery;
  const pregnancyWorkflowStage =
    task?.metadata?.workflowStage ||
    task?.workflowStage ||
    "initial_confirmation";
  const initialPregnancyCheckLocked = Boolean(
    task?.taskType === "PD" &&
    pregnancyWorkflowStage === "initial_confirmation" &&
    task?.pregnancyReadiness &&
    !task.pregnancyReadiness.isEligible
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
      return {
        label: "Record AI Service",
        pathname: "/(technician)/record-ai",
      };
    }
    if (
      ["Health", "Treatment", "Vaccination", "Deworming"].includes(taskType)
    ) {
      return {
        label: "Record Health Assistance",
        pathname: "/(technician)/health-log",
      };
    }
    if (taskType === "PD") {
      if (pregnancyWorkflowStage === "continuation_recheck") {
        return {
          label: "Record Continuation Recheck",
          pathname: "/(technician)/pregnancy-verification",
        };
      }
      if (pregnancyWorkflowStage === "diagnostic_follow_up") {
        return {
          label: "Record Diagnostic Follow-up",
          pathname: "/(technician)/pregnancy-verification",
        };
      }
      return {
        label: "Record Pregnancy Check",
        pathname: "/(technician)/pregnancy-verification",
      };
    }
    if (taskType === "CD" || taskType === "Calving") {
      return {
        label: "Record Calving",
        pathname: "/(technician)/record-calf-drop",
      };
    }
    if (taskType === "BreedingFollowUp") {
      return {
        label: "Record Follow-up",
        pathname: "/(technician)/record-breeding-observation",
      };
    }
    return { label: "Complete General Visit", pathname: null };
  };

  const handlePrimaryAction = () => {
    if (initialPregnancyCheckLocked) {
      toast.error(
        task?.pregnancyReadiness?.reason ||
          "Pregnancy check is not yet available.",
      );
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
        <Text style={{ color: colors.textPrimary }}>
          Visit or task not found
        </Text>
      </View>
    );
  }

  if (task.taskType === "BreedingFollowUp") {
    const hasFarmerUpdate = Boolean(
      task.insemination?.observationSource === "farmer" &&
      (task.insemination?.farmerOutcomeReport ||
      task.insemination?.farmerObservationSigns?.length ||
      task.insemination?.farmerObservationNotes ||
      task.insemination?.evidencePhotos?.length)
    );
    const ctaText = hasFarmerUpdate ? "Review & Record Follow-up" : "Record Follow-up";

    return (
      <View style={{ flex: 1 }}>
        <BreedingFollowUpTaskView task={task} />
        {!["completed", "cancelled", "resolved", "rejected"].includes(String(task.status || "").toLowerCase()) &&
         (!task.dueDate || new Date(task.dueDate).getTime() <= Date.now() || task.status === "In Progress") && (
          <View style={{ padding: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 8,
                alignItems: "center",
              }}
              activeOpacity={0.7}
              onPress={() => router.push(`/(technician)/record-breeding-observation?taskId=${task._id}&inseminationId=${task.metadata?.inseminationId || task.inseminationId || task.insemination?._id}` as any)}
            >
              <Text style={{ color: "white", fontSize: 16, fontFamily: "Outfit_600SemiBold" }}>
                {ctaText}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  const isPregnancyTask = task.taskType === "PD";
  const isCalvingTask = task.taskType === "CD" || task.taskType === "Calving";
  const animal = task.animalIds?.[0];
  const pregnancy = task.pregnancy;
  const insemination = task.insemination || pregnancy?.inseminationId;
  const visitPeriod = String(
    task.visitPeriod || task.metadata?.visitPeriod || "",
  ).toLowerCase();
  const serviceTitle = isCalvingTask
    ? "Calving assistance"
    : humanize(task.taskType || "Farm visit");
  const visitDate = formatDisplayDate(task.dueDate, true);
  const pregnancyDetails = isCalvingTask
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
            ? "Pregnancy Confirmation"
            : task?.taskType === "Calving"
              ? "Calving Monitoring"
              : "Task Details"}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Task Info Content */}
        <View style={styles.content}>
          {isPregnancyTask ? (
            <PregnancyConfirmationTaskView
              task={task}
              colors={colors}
              isClaimed={isClaimed}
              destinationQuery={destinationQuery}
              handleClaim={handleClaim}
              handlePrimaryAction={handlePrimaryAction}
              claiming={claiming}
              completing={completing}
              initialPregnancyCheckLocked={initialPregnancyCheckLocked}
            />
          ) : (
            <>
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
                      {isCalvingTask ? "CALVING VISIT" : "FIELD VISIT"}
                    </Text>
                    <Text
                      style={[
                        styles.summaryTitle,
                        { color: colors.textPrimary },
                      ]}
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
                    style={[
                      styles.summaryMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {task.category || "Routine"}
                  </Text>
                  {task.priority ? (
                    <Text
                      style={[
                        styles.summaryMeta,
                        { color: colors.textSecondary },
                      ]}
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
                    <Navigation
                      size={14}
                      color={isDark ? "#34d399" : "#00643B"}
                    />
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
                      task.category === "Urgent"
                        ? "text-red-500"
                        : "text-blue-500"
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
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.sectionHeader}>
                    <Baby size={18} color={isDark ? "#22D3EE" : "#0891B2"} />
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: isDark ? "#34d399" : "#00643B" },
                      ]}
                    >
                      Calving &amp; Pregnancy Details
                    </Text>
                  </View>
                  <View
                    style={[styles.detailList, { borderColor: colors.border }]}
                  >
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
                          style={[
                            styles.animalTag,
                            { color: colors.textPrimary },
                          ]}
                        >
                          Tag: {anim.earTag || anim.animalId}
                        </Text>
                        <Text
                          style={[
                            styles.animalBreed,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {[anim.breed, anim.species]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                        {[
                          anim.gender,
                          anim.color,
                          anim.reproductiveStatus,
                        ].filter(Boolean).length ? (
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
                    style={[
                      styles.completeBtnText,
                      { color: colors.textMuted },
                    ]}
                  >
                    Completed
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  disabled={completing}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: completing,
                  }}
                  accessibilityLabel={getPrimaryAction().label}
                  style={[
                    styles.completeBtn,
                    {
                      backgroundColor: completing
                        ? "#34d399"
                        : isDark
                          ? "#10b981"
                          : "#00643B",
                      shadowColor: isDark ? "transparent" : "#00643B",
                      opacity: completing ? 0.55 : 1,
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
                        {getPrimaryAction().label}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pdCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  pdReadinessStatus: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 7,
  },
  pdTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
    lineHeight: 26,
  },
  pdMilestoneDay: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    marginTop: 5,
  },
  pdProgressLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
  },
  pdContextLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  pdAvailabilityDate: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    lineHeight: 20,
  },
  pdDaysRemaining: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    marginTop: 3,
  },
  pdSectionTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
  pdAnimalTag: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
    lineHeight: 21,
  },
  pdAnimalMeta: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    marginTop: 2,
  },
  pdAnimalStatus: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    marginTop: 4,
  },
  pdDivider: {
    height: 1,
    marginVertical: 14,
  },
  pdFarmerName: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    lineHeight: 20,
  },
  pdCallButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pdContactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  pdContactValue: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
  pdDirections: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
  pdLockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  pdLockedText: {
    flex: 1,
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  pdObservation: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
  },
  pdObservationPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pdObservationPillText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
  },
  pdObservationNote: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  pdBtn: {
    backgroundColor: "#00643B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  pdBtnText: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
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
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  navigateBtnText: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold",
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
    alignItems: "center",
    justifyContent: "center",
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
