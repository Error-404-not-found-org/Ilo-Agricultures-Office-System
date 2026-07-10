import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Linking,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  User,
  MapPin,
  Activity,
  History,
  Info as InfoIcon,
  Calendar,
  Trash2,
  Syringe,
  Stethoscope,
  ClipboardList,
  Scale,
  Edit2,
  X,
  Phone,
  Mail,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import {
  SPECIES_PROFILES,
  normalizeSpecies,
  calculateTargetCalvingDate,
} from "@/lib/cattleCore";
import { differenceInCalendarDays } from "date-fns";
import { useTheme } from "@/lib/theme";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { SelectDropdown } from "@/components/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTechnicianAnimal } from "@/features/technician/hooks/useTechnicianAnimal";
import { TimelineList } from "@/features/farmer-ui/components";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";
import { useAnimalTimeline, useAnimalHealthHistory } from "@/features/animal-records/hooks/useAnimalTimeline";
import { AnimalProfileSkeleton } from "@/features/animals/components/skeletons/AnimalProfileSkeleton";
import { TimelineSkeleton } from "@/features/animals/components/skeletons/TimelineSkeleton";
import { MedicalHistorySkeleton } from "@/features/animals/components/skeletons/MedicalHistorySkeleton";

export default function AnimalDetails() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const [activeTab, setActiveTab] = useState<"Info" | "Timeline" | "Medical">("Info");
  const [timelineFilter, setTimelineFilter] = useState("All");
  const [medicalFilter, setMedicalFilter] = useState("All");

  const { animalDetailsQuery, animalMedicalQuery, deleteAnimalMutation } =
    useTechnicianAnimal(id as string);
  const animal = animalDetailsQuery.data;
  const medicalRecords = animalMedicalQuery.data || [];
  const loading = animalDetailsQuery.isLoading || animalMedicalQuery.isLoading;
  const deleting = deleteAnimalMutation.isPending;

  const {
    data: timelineData,
    isLoading: loadingTimeline,
    fetchNextPage: fetchNextTimelinePage,
    hasNextPage: hasNextTimelinePage,
    isFetchingNextPage: isFetchingNextTimelinePage,
  } = useAnimalTimeline({ animalId: id as string, type: timelineFilter });

  const {
    data: healthHistoryData,
    isLoading: loadingHealthHistory,
    fetchNextPage: fetchNextHealthPage,
    hasNextPage: hasNextHealthPage,
    isFetchingNextPage: isFetchingNextHealthPage,
  } = useAnimalHealthHistory({ animalId: id as string, type: medicalFilter });

  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);

  const displayRecord = selectedRecord ? {
    type: selectedRecord.type || (selectedRecord.recordKind === "health_request" ? (selectedRecord.requestType === "vaccination" ? "Vaccination" : selectedRecord.requestType === "deworming" ? "Deworming" : selectedRecord.requestType === "medicine" ? "Treatment" : "Check-up") : "Medical Record"),
    date: selectedRecord.recordDate || selectedRecord.date || selectedRecord.createdAt,
    diagnosis: selectedRecord.details?.diagnosis || selectedRecord.symptoms || selectedRecord.diagnosis || "",
    treatment: selectedRecord.details?.treatment || selectedRecord.treatment || "",
    medicineName: selectedRecord.details?.medicineName || selectedRecord.advice || "",
    dosage: selectedRecord.details?.dosage || "",
    weight: selectedRecord.details?.weight || selectedRecord.weight || "",
    note: selectedRecord.note || selectedRecord.technicianNote || selectedRecord.notes || selectedRecord.comment || "",
    recordedBy: selectedRecord.technicianId?.name || selectedRecord.handledBy?.name || "",
    withdrawalPeriodDays: selectedRecord.details?.withdrawalPeriodDays || selectedRecord.withdrawalPeriodDays,
    withdrawalEndDate: selectedRecord.details?.withdrawalEndDate || selectedRecord.withdrawalEndDate,
    followUpDate: selectedRecord.followUpDate || selectedRecord.followUpCheckupDate,
  } : null;

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (!loading && animal) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, animal]);

  useEffect(() => {
    if (animalDetailsQuery.error) {
      const error: any = animalDetailsQuery.error;
      console.error("Failed to fetch animal details", error);
      toast.error(
        error.response?.data?.message || "Could not load animal details.",
      );
    }
    if (animalMedicalQuery.error) {
      const error: any = animalMedicalQuery.error;
      console.error("Failed to fetch medical details", error);
      toast.error(
        error.response?.data?.message || "Could not load medical details.",
      );
    }
  }, [animalDetailsQuery.error, animalMedicalQuery.error]);

  const handleDelete = () => {
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteAnimalMutation.mutateAsync(id as string);
      toast.success("Animal deleted successfully");
      router.replace("/(technician)/technician.animals" as any);
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(error.response?.data?.message || "Failed to delete animal");
    }
  };

  if (loading && !animal) {
    return <AnimalProfileSkeleton />;
  }

  if (!animal) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-slate-950 px-8">
        <MaterialCommunityIcons
          name="cow-off"
          size={64}
          color={isDark ? "#4b5563" : "#CBD5E1"}
        />
        <Text
          style={{ fontFamily: "Outfit_700Bold" }}
          className="text-slate-500 dark:text-slate-400 text-lg mt-4"
        >
          Animal Not Found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 px-10 py-3.5 bg-[#00643B] dark:bg-emerald-600 rounded-full shadow-lg shadow-emerald-200 dark:shadow-none"
        >
          <Text style={{ fontFamily: "Outfit_700Bold" }} className="text-white">
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Extract proper formats
  const farmerName = animal.farmerId?.name || "Unassigned";
  const addr = animal.farmerId?.address;
  const farmerPhone =
    addr?.phoneNumber || animal.farmerId?.phone || "No phone attached";
  const farmerAddress = addr
    ? [addr.street, addr.barangay, addr.city, addr.province]
        .filter(Boolean)
        .join(", ")
    : "Location Unregistered";

  const primaryColor = isDark ? colors.primary : "#00643B";

  const handleCall = () => {
    if (farmerPhone && farmerPhone !== 'No phone attached') {
      Linking.openURL(`tel:${farmerPhone}`).catch(() => {
        toast.error("Could not initiate phone call.");
      });
    }
  };

  const handleMapRedirect = () => {
    if (farmerAddress && farmerAddress !== 'Location Unregistered') {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(farmerAddress)}`).catch(() => {
        toast.error("Could not open maps.");
      });
    }
  };

  // Compute dynamic age based on birthDate subtraction
  let ageDisplay = "Unknown";
  if (animal.birthDate) {
    const birth = new Date(animal.birthDate);
    const now = new Date();
    let diffMonths =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());
    if (diffMonths < 0) diffMonths = 0;

    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;

    if (years > 0 && months > 0)
      ageDisplay = `${years} Yr${years > 1 ? "s" : ""}, ${months} Mo${months > 1 ? "s" : ""}`;
    else if (years > 0) ageDisplay = `${years} Year${years > 1 ? "s" : ""}`;
    else if (months > 0) ageDisplay = `${months} Month${months > 1 ? "s" : ""}`;
    else ageDisplay = "Newborn";
  }

  const timelineEvents = timelineData?.events || [];
  const healthRecords = healthHistoryData?.records || [];

  // Check for active medicine withdrawal period
  const activeWithdrawalRecord = (medicalRecords || []).find((record: any) => {
    if (!record.details?.withdrawalEndDate) return false;
    const endDate = new Date(record.details.withdrawalEndDate);
    return endDate > new Date();
  });

  const activeCasesCount = medicalRecords.filter((r: any) => r.type === "Treatment" && (r.followUpDate ? new Date(r.followUpDate) > new Date() : (new Date().getTime() - new Date(r.date || r.createdAt).getTime()) < 14 * 24 * 60 * 60 * 1000)).length;
  const treatmentsCount = medicalRecords.filter((r: any) => r.type === "Treatment").length;
  const healthChecksCount = medicalRecords.filter((r: any) => r.type === "Check-up").length;
  const medicationsCount = medicalRecords.filter((r: any) => r.type === "Vaccination" || r.type === "Deworming" || r.details?.medicineName).length;

  const getNextAction = () => {
    // 1. Check for medical record follow-up checkup
    const sortedMedicals = [...(medicalRecords || [])]
      .filter((r: any) => r.followUpDate)
      .sort((a: any, b: any) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());

    const nextFollowUp = sortedMedicals.find((r: any) => new Date(r.followUpDate) >= new Date());
    const overdueFollowUp = sortedMedicals.find((r: any) => new Date(r.followUpDate) < new Date());
    const targetFollowUp = nextFollowUp || overdueFollowUp;

    if (targetFollowUp) {
      const followUpDate = new Date(targetFollowUp.followUpDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const compareDate = new Date(followUpDate);
      compareDate.setHours(0, 0, 0, 0);
      
      const diffDays = differenceInCalendarDays(compareDate, today);
      let relativeDateStr = "";
      if (diffDays === 0) relativeDateStr = "today";
      else if (diffDays === 1) relativeDateStr = "tomorrow";
      else if (diffDays === -1) relativeDateStr = "yesterday";
      else if (diffDays > 0) relativeDateStr = `in ${diffDays} days`;
      else relativeDateStr = `${Math.abs(diffDays)} days ago`;

      const formattedFollowUpDate = followUpDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      return {
        type: "follow-up",
        title: "Follow-up Checkup",
        detail: `${formattedFollowUpDate} > Follow-up ${targetFollowUp.type || "checkup"} (${relativeDateStr})`,
        badge: diffDays < 0 ? "Overdue" : "Scheduled",
        color: "#d97706",
        bg: isDark ? "rgba(217, 119, 6, 0.12)" : "#fef3c7",
        border: isDark ? "rgba(217, 119, 6, 0.25)" : "#fde68a",
        icon: "calendar-clock" as const,
      };
    }

    if (animal.gender !== "Female") return null;

    if (animal.reproductiveStatus === "Pregnant") {
      const latest = animal.inseminations?.[0];
      const aiDateValue =
        latest?.inseminationDate ||
        latest?.dateOfAI ||
        latest?.createdAt ||
        animal.lastInseminationDate;
      const aiDate = aiDateValue ? new Date(aiDateValue) : null;
      const dueDate = animal.expectedCalvingDate
        ? new Date(animal.expectedCalvingDate)
        : aiDate
          ? calculateTargetCalvingDate(aiDate, animal.species || "Cattle", undefined, animal.breed)
          : null;

      if (dueDate) {
        const daysRemaining = Math.max(0, differenceInCalendarDays(dueDate, new Date()));
        return {
          type: "pregnant",
          title: "Expected Calving",
          detail: `Expected delivery date: ${dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
          badge: `${daysRemaining} days left`,
          color: "#7e22ce",
          bg: isDark ? "rgba(147, 51, 234, 0.12)" : "#f5f3ff",
          border: isDark ? "rgba(147, 51, 234, 0.25)" : "#e9d5ff",
          icon: "baby-carriage" as const,
        };
      }
    }

    if (animal.reproductiveStatus?.toLowerCase() === "inseminated") {
      const lastInsem = animal.inseminations?.[0];
      const aiDate = lastInsem?.dateOfAI || lastInsem?.inseminationDate || lastInsem?.createdAt || animal.updatedAt;
      const startDate = new Date(aiDate);
      const today = new Date();
      const diffDays = Math.max(0, differenceInCalendarDays(today, startDate));
      const color = diffDays >= 60 ? "#ef4444" : (diffDays >= 18 && diffDays <= 24 ? "#f97316" : "#3b82f6");

      return {
        type: "inseminated",
        title: diffDays >= 60 ? "PD Diagnosis Due" : (diffDays >= 18 && diffDays <= 24 ? "Heat Watch Active" : "Insemination Monitoring"),
        detail: diffDays >= 60
          ? "It's been 60+ days post-AI. Perform a pregnancy diagnosis checkup."
          : (diffDays >= 18 && diffDays <= 24
            ? "Day 18-24 window. Observe closely for signs of heat/reheat."
            : `Day ${diffDays} post-AI. Maintain regular checks.`),
        badge: diffDays >= 60 ? "Overdue" : (diffDays >= 18 && diffDays <= 24 ? "Watch Window" : "Monitoring"),
        color,
        bg: diffDays >= 60 ? (isDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2") : (diffDays >= 18 && diffDays <= 24 ? (isDark ? "rgba(249, 115, 22, 0.12)" : "#fff7ed") : (isDark ? "rgba(59, 130, 246, 0.12)" : "#eff6ff")),
        border: diffDays >= 60 ? (isDark ? "rgba(239, 68, 68, 0.25)" : "#fecaca") : (diffDays >= 18 && diffDays <= 24 ? (isDark ? "rgba(249, 115, 22, 0.25)" : "#ffedd5") : (isDark ? "rgba(59, 130, 246, 0.25)" : "#bfdbfe")),
        icon: diffDays >= 60 ? ("alert-decagram" as const) : (diffDays >= 18 && diffDays <= 24 ? ("eye-outline" as const) : ("timer-sand" as const)),
      };
    }

    if (animal.reproductiveStatus === "In Heat") {
      return {
        type: "inheat",
        title: "Breeding Window Open",
        detail: "Animal is in heat. Ready for artificial insemination.",
        badge: "Action Needed",
        color: "#10b981",
        bg: isDark ? "rgba(16, 185, 129, 0.12)" : "#ecfdf5",
        border: isDark ? "rgba(16, 185, 129, 0.25)" : "#a7f3d0",
        icon: "fire" as const,
      };
    }

    return null;
  };

  const nextAction = getNextAction();

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent={true} />

      {/* Solid Header Bar */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          zIndex: 50,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          className="w-10 h-10 items-center justify-center rounded-full"
        >
          <ArrowLeft size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Outfit_800ExtraBold",
            color: colors.textPrimary,
            fontSize: 18,
          }}
        >
          Animal Details
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() =>
              router.push(`/(technician)/edit-animal?id=${animal._id}` as any)
            }
            activeOpacity={0.8}
            className="w-10 h-10 items-center justify-center rounded-full active:opacity-75"
          >
            <Edit2 size={18} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.8}
            className="w-10 h-10 items-center justify-center rounded-full"
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Trash2 size={20} color="#ef4444" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content Wrapper */}
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Animal Photo Card */}
          <View className="px-6 pt-4">
            <View
              style={{
                height: 220,
                width: "100%",
                borderRadius: 24,
                overflow: "hidden",
                position: "relative",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Image
                source={getAnimalImageSource(animal)}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.05)",
                }}
              />
              {/* Overlapping Tag Badge inside the photo card bottom left */}
              <View
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  backgroundColor: primaryColor,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 12,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_900Black",
                    color: "white",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Tag #{animal.earTag || animal.animalId || "N/A"}
                </Text>
              </View>
            </View>
          </View>

          {/* Profile Content Container */}
          <Animated.View
            className="px-6 pt-8"
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Name & Status Pill Row */}
            <View className="flex-row justify-between items-center mb-3">
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Outfit_900Black",
                  color: colors.textPrimary,
                  fontSize: 24,
                  flex: 1,
                  marginRight: 12,
                }}
              >
                {animal.name || animal.breed || "Animal"}
              </Text>

              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 14,
                  backgroundColor: animal.reproductiveStatus === "Pregnant"
                    ? (isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5")
                    : animal.reproductiveStatus === "Inseminated"
                      ? (isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff")
                      : animal.reproductiveStatus === "In Heat"
                        ? (isDark ? "rgba(249, 115, 22, 0.15)" : "#fff7ed")
                        : (isDark ? "rgba(148, 163, 184, 0.15)" : "#f1f5f9"),
                  borderWidth: 1,
                  borderColor: animal.reproductiveStatus === "Pregnant"
                    ? (isDark ? "rgba(16, 185, 129, 0.3)" : "#a7f3d0")
                    : animal.reproductiveStatus === "Inseminated"
                      ? (isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe")
                      : animal.reproductiveStatus === "In Heat"
                        ? (isDark ? "rgba(249, 115, 22, 0.3)" : "#fed7aa")
                        : colors.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color: animal.reproductiveStatus === "Pregnant"
                      ? "#10b981"
                      : animal.reproductiveStatus === "Inseminated"
                        ? "#3b82f6"
                        : animal.reproductiveStatus === "In Heat"
                          ? "#f97316"
                          : colors.textSecondary,
                    fontSize: 10,
                    textTransform: "uppercase",
                  }}
                >
                  {animal.reproductiveStatus || "Active"}
                </Text>
              </View>
            </View>

            {/* Info Chips Row */}
            <View className="flex-row flex-wrap gap-2 mb-5">
              <View
                className="flex-row items-center px-3 py-1.5 rounded-full border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 12, marginRight: 4 }}>🐾</Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {ageDisplay}
                </Text>
              </View>

              <View
                className="flex-row items-center px-3 py-1.5 rounded-full border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 12, marginRight: 4 }}>
                  {animal.gender === "Male" ? "♂" : "♀"}
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {animal.gender || "Female"}
                </Text>
              </View>

              <View
                className="flex-row items-center px-3 py-1.5 rounded-full border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 12, marginRight: 4 }}>📅</Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {animal.birthDate
                    ? new Date(animal.birthDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })
                    : "Unknown"}
                </Text>
              </View>
            </View>

            {/* 3-Column Info Grid without dividers */}
            <View
              className="flex-row justify-between p-4 rounded-2xl border mb-6"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View style={{ flex: 1, paddingLeft: 4 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    color: colors.textMuted,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Breed
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textPrimary,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  {animal.breed || "Unspecified"}
                </Text>
              </View>

              <View style={{ flex: 1.2, paddingHorizontal: 4 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    color: colors.textMuted,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Owner
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textPrimary,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  {farmerName}
                </Text>
              </View>

              <View style={{ flex: 1, paddingRight: 4 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    color: colors.textMuted,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Location
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textPrimary,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  {animal.farmerId?.address?.barangay || "Unregistered"}
                </Text>
              </View>
            </View>

            {/* Active Withdrawal Warning Card */}
            {activeWithdrawalRecord && (
              <View
                className="mb-6 p-4 rounded-3xl border flex-row gap-3 items-center"
                style={{
                  backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                  borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca",
                }}
              >
                <View className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 items-center justify-center">
                  <MaterialCommunityIcons
                    name="alert-decagram"
                    size={24}
                    color="#ef4444"
                  />
                </View>
                <View className="flex-1">
                  <Text
                    style={{ fontFamily: "Outfit_900Black", color: "#ef4444" }}
                    className="text-[12px] uppercase tracking-wider"
                  >
                    ⚠️ Active Withdrawal Warning
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      color: colors.textSecondary,
                    }}
                    className="text-[11px] leading-4 mt-0.5"
                  >
                    Meat and milk from this animal are unsafe for consumption or
                    sale until{" "}
                    <Text className="font-outfit-bold text-red-600 dark:text-red-400">
                      {new Date(
                        activeWithdrawalRecord.details.withdrawalEndDate,
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>{" "}
                    due to recent{" "}
                    <Text className="font-outfit-bold">
                      {activeWithdrawalRecord.details.medicineName || "medicine"}
                    </Text>{" "}
                    treatment.
                  </Text>
                </View>
              </View>
            )}

            {/* Next Action Alert Bar */}
            {nextAction && (
              <View
                className="flex-row items-center p-3.5 rounded-2xl border mb-6 gap-3 shadow-sm"
                style={{
                  backgroundColor: nextAction.bg,
                  borderColor: nextAction.border,
                  borderWidth: 1,
                }}
              >
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center border"
                  style={{
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.65)",
                    borderColor: nextAction.border,
                  }}
                >
                  <MaterialCommunityIcons name={nextAction.icon} size={18} color={nextAction.color} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5 flex-wrap">
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: nextAction.color,
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Next Action:
                    </Text>
                    {nextAction.badge && (
                      <View
                        className="px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "white",
                          borderColor: nextAction.border,
                          borderWidth: 1,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            color: nextAction.color,
                            fontSize: 7,
                            textTransform: "uppercase",
                          }}
                        >
                          {nextAction.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textPrimary,
                      fontSize: 12,
                      marginTop: 1,
                    }}
                  >
                    {nextAction.detail}
                  </Text>
                </View>
              </View>
            )}

            {/* Quick Actions Grid */}
            <View className="mb-6">
              <Text
                className="mb-3"
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 16,
                }}
              >
                Quick Actions
              </Text>
              {animal.gender === "Female" ? (
                <View className="flex-col gap-3">
                  <View className="flex-row gap-3">
                    <ActionCard
                      title="Record A.I."
                      subtitle="Artificial Insemination"
                      icon={<MaterialCommunityIcons name="needle" size={20} color={isDark ? "#34d399" : "#00643B"} />}
                      onPress={() => router.push({
                        pathname: "/(technician)/record-ai",
                        params: {
                          farmerId: animal.farmerId?._id || "",
                          farmerName: farmerName,
                          animalId: animal._id,
                          earTag: animal.earTag || "",
                          source: "animal-profile",
                        }
                      } as any)}
                      color={isDark ? "#34d399" : "#00643B"}
                      bg={isDark ? "rgba(16, 185, 129, 0.1)" : "#f0fdf4"}
                    />
                    <ActionCard
                      title="Pregnancy Check"
                      subtitle="Pregnancy Verification"
                      icon={<MaterialCommunityIcons name="calendar-check" size={20} color={isDark ? "#60a5fa" : "#1d4ed8"} />}
                      onPress={() => router.push({
                        pathname: "/(technician)/pregnancy-check",
                        params: {
                          farmerId: animal.farmerId?._id || "",
                          farmerName: farmerName,
                          animalId: animal._id,
                          earTag: animal.earTag || "",
                          source: "animal-profile",
                        }
                      } as any)}
                      color={isDark ? "#60a5fa" : "#1d4ed8"}
                      bg={isDark ? "rgba(59, 130, 246, 0.1)" : "#eff6ff"}
                    />
                  </View>
                  <View className="flex-row gap-3">
                    <ActionCard
                      title="Record Calving"
                      subtitle="Record Birth / Offspring"
                      icon={<MaterialCommunityIcons name="baby-carriage" size={20} color={isDark ? "#c084fc" : "#7c3aed"} />}
                      onPress={() => {
                        const latestInsem = (animal.inseminations || []).find((i: any) => i.pregnancy);
                        const pregnancyId = latestInsem?.pregnancy?._id;
                        if (!pregnancyId) {
                          toast.error("Could not locate active pregnancy record.");
                          return;
                        }
                        router.push({
                          pathname: "/(technician)/record-calf-drop",
                          params: {
                            motherId: animal._id,
                            pregnancyId: pregnancyId,
                            motherTag: animal.earTag || animal.animalId,
                            source: "animal-profile",
                          },
                        } as any);
                      }}
                      color={isDark ? "#c084fc" : "#7c3aed"}
                      bg={isDark ? "rgba(168, 85, 247, 0.1)" : "#faf5ff"}
                    />
                    <ActionCard
                      title="Health Assistance"
                      subtitle="Record Medical Check"
                      icon={<MaterialCommunityIcons name="stethoscope" size={20} color={isDark ? "#f87171" : "#b91c1c"} />}
                      onPress={() => router.push({
                        pathname: "/(technician)/health-log",
                        params: {
                          farmerId: animal.farmerId?._id || "",
                          farmerName: farmerName,
                          animalId: animal._id,
                          earTag: animal.earTag || "",
                          source: "animal-profile",
                        }
                      } as any)}
                      color={isDark ? "#f87171" : "#b91c1c"}
                      bg={isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2"}
                    />
                  </View>
                </View>
              ) : (
                <ActionCard
                  title="Record Health Assistance"
                  subtitle="Record Medical checkup, treatment, or vaccination"
                  icon={<MaterialCommunityIcons name="stethoscope" size={22} color={isDark ? "#f87171" : "#b91c1c"} />}
                  onPress={() => router.push({
                    pathname: "/(technician)/health-log",
                    params: {
                      farmerId: animal.farmerId?._id || "",
                      farmerName: farmerName,
                      animalId: animal._id,
                      earTag: animal.earTag || "",
                      source: "animal-profile",
                    }
                  } as any)}
                  color={isDark ? "#f87171" : "#b91c1c"}
                  bg={isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2"}
                />
              )}
            </View>

            {/* Health Summary Row */}
            <View className="mb-6">
              <Text
                className="mb-3"
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 16,
                }}
              >
                Health Summary
              </Text>
              <View className="flex-row gap-2.5">
                <View
                  className="flex-1 p-3 rounded-2xl border items-center justify-center"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textMuted,
                      fontSize: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    Active Cases
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 18,
                      marginTop: 3,
                    }}
                  >
                    {activeCasesCount}
                  </Text>
                </View>

                <View
                  className="flex-1 p-3 rounded-2xl border items-center justify-center"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textMuted,
                      fontSize: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    Treatments
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 18,
                      marginTop: 3,
                    }}
                  >
                    {treatmentsCount}
                  </Text>
                </View>

                <View
                  className="flex-1 p-3 rounded-2xl border items-center justify-center"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textMuted,
                      fontSize: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    Checks
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 18,
                      marginTop: 3,
                    }}
                  >
                    {healthChecksCount}
                  </Text>
                </View>

                <View
                  className="flex-1 p-3 rounded-2xl border items-center justify-center"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textMuted,
                      fontSize: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.2,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                  >
                    Meds
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 18,
                      marginTop: 3,
                    }}
                  >
                    {medicationsCount}
                  </Text>
                </View>
              </View>
            </View>

            {/* Customized Tabs */}
            <View className="flex-row mb-6 border-b" style={{ borderBottomColor: colors.border }}>
              <TouchableOpacity
                onPress={() => setActiveTab("Info")}
                className="flex-1 py-3.5 items-center flex-row justify-center gap-1.5"
                style={{
                  borderBottomWidth: 3,
                  borderBottomColor: activeTab === "Info" ? primaryColor : "transparent",
                }}
              >
                <InfoIcon
                  size={16}
                  color={activeTab === "Info" ? primaryColor : colors.textMuted}
                />
                <Text
                  style={{
                    fontFamily: activeTab === "Info" ? "Outfit_800ExtraBold" : "Outfit_600SemiBold",
                    color: activeTab === "Info" ? primaryColor : colors.textMuted,
                  }}
                  className="text-[13px]"
                >
                  Overview
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("Timeline")}
                className="flex-1 py-3.5 items-center flex-row justify-center gap-1.5"
                style={{
                  borderBottomWidth: 3,
                  borderBottomColor: activeTab === "Timeline" ? primaryColor : "transparent",
                }}
              >
                <History
                  size={16}
                  color={activeTab === "Timeline" ? primaryColor : colors.textMuted}
                />
                <Text
                  style={{
                    fontFamily: activeTab === "Timeline" ? "Outfit_800ExtraBold" : "Outfit_600SemiBold",
                    color: activeTab === "Timeline" ? primaryColor : colors.textMuted,
                  }}
                  className="text-[13px]"
                >
                  Timeline
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("Medical")}
                className="flex-1 py-3.5 items-center flex-row justify-center gap-1.5"
                style={{
                  borderBottomWidth: 3,
                  borderBottomColor: activeTab === "Medical" ? primaryColor : "transparent",
                }}
              >
                <ClipboardList
                  size={16}
                  color={activeTab === "Medical" ? primaryColor : colors.textMuted}
                />
                <Text
                  style={{
                    fontFamily: activeTab === "Medical" ? "Outfit_800ExtraBold" : "Outfit_600SemiBold",
                    color: activeTab === "Medical" ? primaryColor : colors.textMuted,
                  }}
                  className="text-[13px]"
                >
                  Medical
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {activeTab === "Info" ? (
            <View className="px-6 gap-y-6">
              {/* Biological Details Card */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0 : 0.03,
                  shadowRadius: 8,
                  elevation: 1,
                  borderRadius: 24,
                  padding: 20,
                }}
              >
                <View className="flex-row items-center mb-5 gap-2">
                  <Activity size={20} color={isDark ? "#34d399" : "#00643B"} />
                  <Text
                    style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}
                    className="text-lg"
                  >
                    Biological Details
                  </Text>
                </View>

                <View className="gap-y-4">
                  <InfoRow label="System ID" value={animal.animalId || "Missing"} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                  <InfoRow label="Gender" value={animal.gender || "Female"} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                  <InfoRow label="Current Age" value={ageDisplay} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                  <InfoRow label="Species" value={animal.species || "Missing"} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                  <InfoRow label="Breed Type" value={animal.breed || "Missing"} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                  <InfoRow label="Color / Markings" value={animal.color || "Unregistered"} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                  <InfoRow label="Brand Mark" value={animal.brand || "Unbranded"} textColor={colors.textPrimary} mutedColor={colors.textMuted} />
                </View>
              </View>

              {/* Family Lineage Card */}
              {(animal.motherId || (animal.offspring && animal.offspring.length > 0)) && (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0 : 0.03,
                    shadowRadius: 8,
                    elevation: 1,
                    borderRadius: 24,
                    padding: 20,
                  }}
                >
                  <View className="flex-row items-center mb-5 gap-2">
                    <MaterialCommunityIcons
                      name="family-tree"
                      size={20}
                      color={isDark ? "#34d399" : "#00643B"}
                    />
                    <Text
                      style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}
                      className="text-lg"
                    >
                      Family Lineage
                    </Text>
                  </View>

                  <View className="gap-y-4">
                    {animal.motherId && (
                      <View>
                        <Text
                          style={{ fontFamily: "Outfit_900Black", color: colors.textMuted }}
                          className="text-[9px] uppercase tracking-widest mb-2 ml-1"
                        >
                          Mother (Dam)
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname: "/(technician)/animal-details",
                              params: {
                                id: animal.motherId._id || animal.motherId,
                              },
                            } as any)
                          }
                          className="flex-row items-center justify-between p-3 rounded-2xl border"
                          style={{
                            backgroundColor: isDark ? colors.background : "#f8fafc",
                            borderColor: colors.border,
                          }}
                        >
                          <View className="flex-row items-center gap-3">
                            <View
                              className="w-10 h-10 rounded-xl items-center justify-center border"
                              style={{
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                                overflow: "hidden",
                              }}
                            >
                              {animal.motherId.imageUrl ? (
                                <Image
                                  source={{ uri: animal.motherId.imageUrl }}
                                  className="w-full h-full"
                                  resizeMode="cover"
                                />
                              ) : (
                                <MaterialCommunityIcons
                                  name="cow"
                                  size={20}
                                  color={isDark ? "#34d399" : "#00643B"}
                                />
                              )}
                            </View>
                            <View>
                              <Text
                                style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}
                                className="text-sm"
                              >
                                Tag #{animal.motherId.earTag || "Unknown"}
                              </Text>
                              <Text
                                style={{ fontFamily: "Outfit_500Medium", color: colors.textSecondary }}
                                className="text-[10px] uppercase mt-0.5"
                              >
                                {animal.motherId.breed} • {animal.motherId.species}
                              </Text>
                            </View>
                          </View>
                          <View className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <Text
                              style={{ fontFamily: "Outfit_900Black", color: "#10b981" }}
                              className="text-[8px] uppercase tracking-wider"
                            >
                              {animal.motherId.reproductiveStatus || "Normal"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}

                    {animal.offspring && animal.offspring.length > 0 && (
                      <View>
                        <Text
                          style={{ fontFamily: "Outfit_900Black", color: colors.textMuted }}
                          className="text-[9px] uppercase tracking-widest mb-2 ml-1"
                        >
                          Offspring ({animal.offspring.length})
                        </Text>
                        <View className="gap-y-2">
                          {animal.offspring.map((calf: any) => (
                            <TouchableOpacity
                              key={calf._id}
                              onPress={() =>
                                router.push({
                                  pathname: "/(technician)/animal-details",
                                  params: {
                                    id: calf._id,
                                  },
                                } as any)
                              }
                              className="flex-row items-center justify-between p-3 rounded-2xl border"
                              style={{
                                backgroundColor: isDark ? colors.background : "#f8fafc",
                                borderColor: colors.border,
                              }}
                            >
                              <View className="flex-row items-center gap-3">
                                <View
                                  className="w-10 h-10 rounded-xl items-center justify-center border"
                                  style={{
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                    overflow: "hidden",
                                  }}
                                >
                                  {calf.imageUrl ? (
                                    <Image
                                      source={{ uri: calf.imageUrl }}
                                      className="w-full h-full"
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <MaterialCommunityIcons
                                      name="cow"
                                      size={20}
                                      color={isDark ? "#34d399" : "#00643B"}
                                    />
                                  )}
                                </View>
                                <View>
                                  <Text
                                    style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}
                                    className="text-sm"
                                  >
                                    Tag #{calf.earTag || "Unknown"}
                                  </Text>
                                  <Text
                                    style={{ fontFamily: "Outfit_500Medium", color: colors.textSecondary }}
                                    className="text-[10px] uppercase mt-0.5"
                                  >
                                    {calf.breed} • {calf.species}
                                  </Text>
                                </View>
                              </View>
                              <View className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <Text
                                  style={{ fontFamily: "Outfit_900Black", color: "#10b981" }}
                                  className="text-[8px] uppercase tracking-wider"
                                >
                                  {calf.gender || "Female"}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Ownership details Card */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0 : 0.03,
                  shadowRadius: 8,
                  elevation: 1,
                  borderRadius: 24,
                  padding: 20,
                }}
              >
                <View className="flex-row items-center mb-5 gap-2">
                  <User size={20} color={isDark ? "#34d399" : "#00643B"} />
                  <Text
                    style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}
                    className="text-lg"
                  >
                    Ownership Details
                  </Text>
                </View>

                {/* Farmer Info Row */}
                <View className="flex-row items-center gap-4 mb-5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <View 
                    className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 rounded-full items-center justify-center border border-slate-200 dark:border-slate-800"
                    style={{ overflow: "hidden" }}
                  >
                    {animal.farmerId?.imageUrl ? (
                      <Image
                        source={{ uri: animal.farmerId.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={{ fontFamily: "Outfit_900Black", color: isDark ? "#34d399" : "#00643B" }}
                        className="text-lg"
                      >
                        {(animal.farmerId?.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}
                      className="text-base"
                    >
                      {farmerName}
                    </Text>
                    <View className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 self-start mt-1.5 border border-emerald-100 dark:border-emerald-900/30">
                      <Text
                        style={{ fontFamily: "Outfit_900Black", color: isDark ? "#34d399" : "#00643B" }}
                        className="text-[9px] uppercase tracking-widest"
                      >
                        Registered Owner
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Contact Shortcuts */}
                <View className="gap-y-4">
                  <TouchableOpacity onPress={handleCall} className="flex-row items-center justify-between py-1">
                    <View className="flex-row items-center gap-3">
                      <View style={{ backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#f0fdf4" }} className="w-10 h-10 rounded-full items-center justify-center">
                        <Phone size={18} color={isDark ? "#34d399" : "#00643B"} />
                      </View>
                      <View>
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: colors.textMuted }}>Phone Number</Text>
                        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 15, color: colors.textPrimary, marginTop: 1 }}>{farmerPhone}</Text>
                      </View>
                    </View>
                    {farmerPhone !== 'No phone attached' && (
                      <MaterialCommunityIcons name="phone-outgoing" size={18} color={isDark ? "#34d399" : "#00643B"} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleMapRedirect} className="flex-row items-center justify-between py-1">
                    <View className="flex-row items-center gap-3 flex-1 pr-4">
                      <View style={{ backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#f0fdf4" }} className="w-10 h-10 rounded-full items-center justify-center">
                        <MapPin size={18} color={isDark ? "#34d399" : "#00643B"} />
                      </View>
                      <View className="flex-1">
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: colors.textMuted }}>Location Address</Text>
                        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 14, color: colors.textPrimary, marginTop: 1 }} numberOfLines={2}>{farmerAddress}</Text>
                      </View>
                    </View>
                    {farmerAddress !== 'Location Unregistered' && (
                      <MaterialCommunityIcons name="map-marker-outline" size={18} color={isDark ? "#34d399" : "#00643B"} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : activeTab === "Timeline" ? (
            <View className="px-6">
              {loadingTimeline && timelineEvents.length === 0 ? (
                <TimelineSkeleton />
              ) : (
                <View className="mb-5">
                  <Text
                    className="mb-3"
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 17,
                    }}
                  >
                    Animal Timeline
                  </Text>
                  <TimelineList 
                    events={timelineEvents} 
                    filter={timelineFilter}
                    onFilterChange={(newF) => {
                      setTimelineFilter(newF);
                    }}
                  />
                  {timelineEvents.length === 0 ? (
                    <View className="rounded-[32px] p-8 items-center mt-4 border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                      <History size={32} color={colors.textMuted} />
                      <Text style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }} className="text-lg mt-2 mb-1">
                        No Timeline Events
                      </Text>
                      <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textSecondary }} className="text-center text-xs leading-5">
                        This animal does not have any timeline events matching the filter.
                      </Text>
                    </View>
                  ) : null}
                  {hasNextTimelinePage && timelineEvents.length > 0 && (
                    <TouchableOpacity
                      onPress={() => fetchNextTimelinePage()}
                      disabled={isFetchingNextTimelinePage}
                      className="py-3.5 px-4 rounded-2xl items-center justify-center border mt-4"
                      style={{ borderColor: colors.border, backgroundColor: colors.card }}
                    >
                      <Text style={{ fontFamily: "Outfit_700Bold", color: primaryColor }} className="text-xs">
                        {isFetchingNextTimelinePage ? "Loading more..." : "Load More Records"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View className="px-6">
              {/* Medical Filters selector */}
              <View className="mb-4 flex-row items-center justify-between gap-4">
                <Text
                  style={{ fontFamily: "Outfit_700Bold", color: colors.textSecondary }}
                  className="text-xs"
                >
                  Category Filter:
                </Text>
                <SelectDropdown
                  label="All Records"
                  options={[
                    { label: "All Records", value: "All" },
                    { label: "Treatments", value: "Treatment" },
                    { label: "Vaccinations", value: "Vaccination" },
                    { label: "Deworming", value: "Deworming" },
                    { label: "Check-ups", value: "Check-up" },
                    { label: "Weight Logs", value: "Weight" },
                  ]}
                  value={medicalFilter}
                  onChange={(val) => setMedicalFilter(val)}
                  flex={1}
                />
              </View>

              {loadingHealthHistory && healthRecords.length === 0 ? (
                <MedicalHistorySkeleton />
              ) : healthRecords.length > 0 ? (
                <View className="mt-2 text-primary">
                  {healthRecords.map((record: any, idx: number) => {
                    const isRequest = record.recordKind === "health_request";
                    const recType = isRequest 
                      ? (record.requestType === "vaccination" ? "Vaccination" : record.requestType === "deworming" ? "Deworming" : record.requestType === "medicine" ? "Treatment" : "Check-up")
                      : (record.type || "Medical Record");
                    const title = isRequest ? `Health Visit (${record.status || "Pending"})` : record.type;
                    const dateVal = record.recordDate || record.date || record.createdAt;
                    const medicineVal = record.details?.medicineName || record.advice || "";
                    const weightVal = record.details?.weight;
                    const noteVal = record.note || record.technicianNote || record.notes || "";
                    const recordedByVal = record.technicianId?.name || record.handledBy?.name || "";

                    return (
                      <TouchableOpacity
                        key={record._id || idx}
                        onPress={() => {
                          setSelectedRecord(record);
                          setRecordModalVisible(true);
                        }}
                        activeOpacity={0.7}
                        className="p-5 rounded-[24px] mb-4 flex-row border"
                        style={{
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          shadowColor: "#94a3b8",
                          shadowOpacity: isDark ? 0 : 0.05,
                          shadowRadius: 6,
                          elevation: isDark ? 0 : 2,
                        }}
                      >
                        <View
                          className="w-12 h-12 rounded-full items-center justify-center mr-4"
                          style={{
                            backgroundColor:
                              recType === "Vaccination"
                                ? isDark
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : "#ecfdf5"
                                : recType === "Weight Log" || recType === "Weight"
                                  ? isDark
                                    ? "rgba(99, 102, 241, 0.15)"
                                    : "#eef2ff"
                                  : recType === "Treatment"
                                    ? isDark
                                      ? "rgba(245, 158, 11, 0.15)"
                                      : "#fff7ed"
                                    : isDark
                                      ? "rgba(100, 116, 139, 0.15)"
                                      : "#f8fafc",
                          }}
                        >
                          {recType === "Vaccination" && (
                            <Syringe size={22} color="#10B981" />
                          )}
                          {recType === "Deworming" && (
                            <MaterialCommunityIcons
                              name="pill"
                              size={22}
                              color="#3B82F6"
                            />
                          )}
                          {recType === "Treatment" && (
                            <Stethoscope size={22} color="#F59E0B" />
                          )}
                          {(recType === "Weight Log" || recType === "Weight") && (
                            <Scale size={22} color="#6366F1" />
                          )}
                          {recType === "Check-up" && (
                            <ClipboardList size={22} color="#64748B" />
                          )}
                        </View>

                        <View className="flex-1">
                          <View className="flex-row justify-between items-start mb-1">
                            <Text
                              style={{
                                fontFamily: "Outfit_800ExtraBold",
                                color: colors.textPrimary,
                              }}
                              className="text-[16px]"
                            >
                              {title}
                            </Text>
                            <View
                              className="px-2.5 py-0.5 rounded-full"
                              style={{ backgroundColor: colors.border }}
                            >
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: colors.textSecondary,
                                }}
                                className="text-[9px] uppercase tracking-wider"
                              >
                                Medical
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center gap-1 mb-2">
                            <Calendar size={12} color={colors.textMuted} />
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textSecondary,
                              }}
                                className="text-xs"
                            >
                              {new Date(dateVal).toLocaleDateString()}
                            </Text>
                          </View>

                          {medicineVal ? (
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textSecondary,
                              }}
                              className="text-sm mt-1"
                            >
                              Medicine:{" "}
                              <Text
                                style={{
                                  fontFamily: "Outfit_800ExtraBold",
                                  color: colors.textPrimary,
                                }}
                              >
                                {medicineVal}
                              </Text>
                            </Text>
                          ) : null}

                          {weightVal ? (
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: isDark ? "#818cf8" : "#4f46e5",
                              }}
                              className="text-sm mt-1"
                            >
                              Weight:{" "}
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: colors.textPrimary,
                                }}
                              >
                                {weightVal} kg
                              </Text>
                            </Text>
                          ) : null}

                          {noteVal ? (
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textMuted,
                              }}
                              className="text-[12px] mt-1 italic leading-4"
                            >
                              &quot;{noteVal}&quot;
                            </Text>
                          ) : null}

                          {recordedByVal ? (
                            <Text
                              style={{
                                fontFamily: "Outfit_900Black",
                                color: colors.textMuted,
                              }}
                              className="text-[9px] mt-2 uppercase tracking-tight"
                            >
                              Recorded by {recordedByVal}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {hasNextHealthPage && (
                    <TouchableOpacity
                      onPress={() => fetchNextHealthPage()}
                      disabled={isFetchingNextHealthPage}
                      className="py-3.5 px-4 rounded-2xl items-center justify-center border mt-4"
                      style={{ borderColor: colors.border, backgroundColor: colors.card }}
                    >
                      <Text style={{ fontFamily: "Outfit_700Bold", color: primaryColor }} className="text-xs">
                        {isFetchingNextHealthPage ? "Loading more..." : "Load More Records"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View
                  className="rounded-[32px] p-8 items-center mt-4 border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    shadowColor: "#94a3b8",
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View
                    className="w-20 h-20 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: colors.background }}
                  >
                    <History size={32} color={colors.textMuted} />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textPrimary,
                    }}
                    className="text-lg mb-1"
                  >
                    No Medical Records
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      color: colors.textSecondary,
                    }}
                    className="text-center text-sm px-4 leading-5"
                  >
                    This animal does not have any recorded medical history matching the filter.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* --- MEDICAL RECORD DETAIL DIALOG --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={recordModalVisible}
        onRequestClose={() => setRecordModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setRecordModalVisible(false)}
          />
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-8 shadow-2xl">
            <View className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full align-self-center mb-5" />

            <View className="flex-row justify-between items-start mb-4 gap-4">
              <View className="flex-1 pr-3">
                <Text
                  style={{ fontFamily: "Outfit_900Black" }}
                  className="text-emerald-700 dark:text-emerald-400 text-[10px] uppercase tracking-widest mb-1.5"
                >
                  Record Details
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_900Black" }}
                  className="text-[22px] text-slate-800 dark:text-white leading-7"
                >
                  {selectedRecord?.type === "insemination"
                    ? `A.I. Insemination`
                    : selectedRecord?.type === "calving"
                      ? "Calving / Offspring"
                      : selectedRecord?.type || "Medical Record"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRecordModalVisible(false)}
                className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center flex-shrink-0"
              >
                <X size={18} color={isDark ? "white" : "black"} />
              </TouchableOpacity>
            </View>

            {/* Scrollable details container */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {selectedRecord && (
                <View className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 gap-y-4 mb-2">
                  {/* Photo attachment if present */}
                  {selectedRecord.imageUrl ? (
                    <View className="mb-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                      <Image
                        source={{ uri: selectedRecord.imageUrl }}
                        className="w-full h-48"
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}

                  {/* 1. Common Info: Date */}
                  <View className="flex-row justify-between items-start gap-4">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                    >
                      Activity Date
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_800ExtraBold" }}
                      className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                    >
                      {new Date(selectedRecord.recordDate).toLocaleDateString(
                        "en-US",
                        { month: "long", day: "numeric", year: "numeric" },
                      )}
                    </Text>
                  </View>
                  <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />

                  {/* 2. Type-Specific Attributes */}
                  {selectedRecord.type === "insemination" && (
                    <>
                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Attempt No.
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_900Black" }}
                          className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                        >
                          #{selectedRecord.attemptNumber || 1}
                        </Text>
                      </View>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Estrus Cycle Type
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_800ExtraBold" }}
                          className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.estrus ||
                            selectedRecord.estrusType ||
                            "Natural"}
                        </Text>
                      </View>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Sire Breed
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_800ExtraBold" }}
                          className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.sireBreed || "N/A"}
                        </Text>
                      </View>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Sire Code
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_900Black" }}
                          className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.sireCode || "N/A"}
                        </Text>
                      </View>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Current Status
                        </Text>
                        <View
                          className={`px-2.5 py-0.5 rounded-full ${
                            selectedRecord.status === "done"
                              ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-900/20"
                              : selectedRecord.status === "approved"
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/20"
                                : selectedRecord.status === "pending"
                                  ? "bg-amber-50 dark:bg-amber-905/30 border border-amber-100 dark:border-amber-900/20"
                                  : "bg-slate-100 dark:bg-slate-800"
                          }`}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_900Black" }}
                            className={`text-[10px] uppercase tracking-wider ${
                              selectedRecord.status === "done"
                                ? "text-blue-600 dark:text-blue-400"
                                : selectedRecord.status === "approved"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : selectedRecord.status === "pending"
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {selectedRecord.status || "Pending"}
                          </Text>
                        </View>
                      </View>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Pregnancy Status
                        </Text>
                        {(() => {
                          const outcomeText =
                            selectedRecord.pregnancyStatus ||
                            selectedRecord.outcome ||
                            selectedRecord.result ||
                            "Pending";
                          const isSuccess =
                            outcomeText === "Pregnant" ||
                            outcomeText === "Successful" ||
                            outcomeText === "Positive";
                          const isFailed =
                            outcomeText.startsWith("Failed") ||
                            outcomeText === "Negative" ||
                            outcomeText === "Empty";
                          return (
                            <View
                              className={`px-3 py-1 rounded-full ${
                                isSuccess
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900"
                                  : isFailed
                                    ? "bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900"
                                    : "bg-slate-100 dark:bg-slate-800"
                              }`}
                            >
                              <Text
                                style={{ fontFamily: "Outfit_900Black" }}
                                className={`text-[12px] ${
                                  isSuccess
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : isFailed
                                      ? "text-red-500"
                                      : "text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {outcomeText}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      {selectedRecord.dateOfPD && (
                        <>
                          <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                            >
                              Diagnosis Date
                            </Text>
                            <Text
                              style={{ fontFamily: "Outfit_800ExtraBold" }}
                              className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                            >
                              {new Date(
                                selectedRecord.dateOfPD,
                              ).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </Text>
                          </View>
                        </>
                      )}
                    </>
                  )}

                  {selectedRecord.type === "calving" && (
                    <>
                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Number of Calves
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_900Black" }}
                          className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.numberOfCalves ||
                            selectedRecord.calves?.length ||
                            1}
                        </Text>
                      </View>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Calving Ease
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_800ExtraBold" }}
                          className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.calvingEase || "Natural"}
                        </Text>
                      </View>

                      {selectedRecord.locationAddress ? (
                        <>
                          <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                            >
                              Calving Location
                            </Text>
                            <Text
                              style={{ fontFamily: "Outfit_600SemiBold" }}
                              className="text-slate-800 dark:text-white text-[13px] text-right max-w-[200px]"
                            >
                              {selectedRecord.locationAddress}
                            </Text>
                          </View>
                        </>
                      ) : null}

                      {/* Display offspring details array */}
                      {selectedRecord.calves &&
                      selectedRecord.calves.length > 0 ? (
                        <>
                          <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                          <Text
                            style={{ fontFamily: "Outfit_800ExtraBold" }}
                            className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider mt-1"
                          >
                            Offspring Born
                          </Text>
                          <View className="gap-y-2 mt-1">
                            {selectedRecord.calves.map(
                              (calf: any, cidx: number) => (
                                <View
                                  key={cidx}
                                  className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80"
                                >
                                  <View className="flex-row justify-between items-start gap-4">
                                    <View className="flex-row items-center gap-2">
                                      <MaterialCommunityIcons
                                        name="cow"
                                        size={16}
                                        color={
                                          calf.sex === "M"
                                            ? "#3B82F6"
                                            : "#F472B6"
                                        }
                                      />
                                      <Text
                                        style={{
                                          fontFamily: "Outfit_800ExtraBold",
                                        }}
                                        className="text-slate-800 dark:text-white text-[12px]"
                                      >
                                        Tag: {calf.earTag || `Calf ${cidx + 1}`}
                                      </Text>
                                    </View>
                                    <View className="flex-row gap-2.5 items-center">
                                      <View
                                        className={`px-2 py-0.5 rounded-full ${calf.sex === "M" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-pink-50 dark:bg-pink-950/40"}`}
                                      >
                                        <Text
                                          style={{
                                            fontFamily: "Outfit_900Black",
                                          }}
                                          className={`text-[9px] ${calf.sex === "M" ? "text-blue-600 dark:text-blue-400" : "text-pink-600 dark:text-pink-400"}`}
                                        >
                                          {calf.sex === "M"
                                            ? "Male ♂"
                                            : "Female ♀"}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                  {calf.imageUrl ? (
                                    <View className="mt-2.5 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800/80">
                                      <Image
                                        source={{ uri: calf.imageUrl }}
                                        className="w-full h-36"
                                        resizeMode="cover"
                                      />
                                    </View>
                                  ) : null}
                                </View>
                              ),
                            )}
                          </View>
                        </>
                      ) : selectedRecord.calfId || selectedRecord.calfSex ? (
                        <>
                          <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                            >
                              Calf Tag ID
                            </Text>
                            <Text
                              style={{ fontFamily: "Outfit_900Black" }}
                              className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                            >
                              {selectedRecord.calfId || "N/A"}
                            </Text>
                          </View>
                          <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{ fontFamily: "Outfit_500Medium" }}
                              className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                            >
                              Offspring Sex
                            </Text>
                            <Text
                              style={{ fontFamily: "Outfit_800ExtraBold" }}
                              className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                            >
                              {selectedRecord.calfSex === "M"
                                ? "Male ♂"
                                : selectedRecord.calfSex === "F"
                                  ? "Female ♀"
                                  : selectedRecord.calfSex || "N/A"}
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </>
                  )}

                  {displayRecord && selectedRecord.type !== "insemination" &&
                    selectedRecord.type !== "calving" && (
                      <>
                        <View className="flex-row justify-between items-start gap-4">
                          <Text
                            style={{ fontFamily: "Outfit_500Medium" }}
                            className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                          >
                            Check Category
                          </Text>
                          <Text
                            style={{ fontFamily: "Outfit_800ExtraBold" }}
                            className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                          >
                            {displayRecord.type}
                          </Text>
                        </View>

                        {displayRecord.diagnosis ? (
                          <>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                              >
                                Diagnosis
                              </Text>
                              <Text
                                style={{ fontFamily: "Outfit_800ExtraBold" }}
                                className="text-slate-850 dark:text-slate-200 text-[13px] text-right max-w-[200px]"
                              >
                                {displayRecord.diagnosis}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.treatment ? (
                          <>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                              >
                                Treatment Given
                              </Text>
                              <Text
                                style={{ fontFamily: "Outfit_800ExtraBold" }}
                                className="text-slate-855 dark:text-slate-200 text-[13px] text-right max-w-[200px]"
                              >
                                {displayRecord.treatment}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.medicineName ? (
                          <>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                              >
                                Medicine Administered
                              </Text>
                              <Text
                                style={{ fontFamily: "Outfit_800ExtraBold" }}
                                className="text-emerald-700 dark:text-emerald-400 text-[14px] text-right flex-1 leading-5"
                              >
                                {displayRecord.medicineName}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.dosage ? (
                          <>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                              >
                                Dosage / Route
                              </Text>
                              <Text
                                style={{ fontFamily: "Outfit_800ExtraBold" }}
                                className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                              >
                                {displayRecord.dosage}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.weight ? (
                          <>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                              >
                                Recorded Weight
                              </Text>
                              <Text
                                style={{ fontFamily: "Outfit_900Black" }}
                                className="text-indigo-600 dark:text-indigo-400 text-[14px] text-right flex-1 leading-5"
                              >
                                {displayRecord.weight} kg
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.followUpDate ? (
                          <>
                            <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{ fontFamily: "Outfit_500Medium" }}
                                className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                              >
                                Follow-Up Date
                              </Text>
                              <View className="bg-amber-50 dark:bg-amber-955/30 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-900/20">
                                <Text
                                  style={{ fontFamily: "Outfit_800ExtraBold" }}
                                  className="text-amber-700 dark:text-amber-400 text-[12px]"
                                >
                                  {new Date(displayRecord.followUpDate).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </Text>
                              </View>
                            </View>
                          </>
                        ) : null}
                      </>
                    )}

                  {/* Heat Signs List inside details modal */}
                  {selectedRecord.type === "insemination" &&
                  selectedRecord.heatSigns &&
                  selectedRecord.heatSigns.length > 0 ? (
                    <>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                      <View className="flex-col gap-1.5">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Observed Heat Signs
                        </Text>
                        <View className="flex-row flex-wrap gap-2 mt-1">
                          {selectedRecord.heatSigns.map((signId: string) => {
                            const signMap: Record<string, string> = {
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
                            const label = signMap[signId] || signId;
                            const isPrimary = signId === "standing_heat";
                            const isBleeding = signId === "metestrus_bleeding";

                            let badgeBg = isDark
                              ? "rgba(16, 185, 129, 0.15)"
                              : "#ECFDF5";
                            let badgeText = isDark ? "#34d399" : "#065F46";
                            let badgeBorder = isDark
                              ? "rgba(16, 185, 129, 0.2)"
                              : "#d1fae5";

                            if (isPrimary) {
                              badgeBg = isDark
                                ? "rgba(245, 158, 11, 0.15)"
                                : "#FEF3C7";
                              badgeText = isDark ? "#fbbf24" : "#92400E";
                              badgeBorder = isDark
                                ? "rgba(245, 158, 11, 0.2)"
                                : "#FEF3C7";
                            } else if (isBleeding) {
                              badgeBg = isDark
                                ? "rgba(239, 68, 68, 0.15)"
                                : "#FEF2F2";
                              badgeText = isDark ? "#f87171" : "#991B1B";
                              badgeBorder = isDark
                                ? "rgba(239, 68, 68, 0.2)"
                                : "#fecaca";
                            }

                            return (
                              <View
                                key={signId}
                                className="px-3 py-1.5 rounded-xl border"
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
                    </>
                  ) : null}

                  {/* 3. Common Info: Notes / Remarks */}
                  {displayRecord && displayRecord.note ? (
                    <>
                      <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                      <View className="flex-col gap-1">
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                        >
                          Notes & Remarks
                        </Text>
                        <Text
                          style={{ fontFamily: "Outfit_500Medium" }}
                          className="text-slate-700 dark:text-slate-300 text-[13px] italic leading-5 mt-1"
                        >
                          &quot;{displayRecord.note}&quot;
                        </Text>
                      </View>
                    </>
                  ) : null}

                  {/* 4. Common Info: Recorded By */}
                  <View className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                  <View className="flex-row justify-between items-start gap-4">
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-slate-400 dark:text-slate-500 text-[12px] uppercase tracking-wider"
                    >
                      Logged By
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_800ExtraBold" }}
                      className="text-slate-800 dark:text-white text-[14px] text-right flex-1 leading-5"
                    >
                      {displayRecord?.recordedBy || "Agriculture Office Technician"}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setRecordModalVisible(false)}
              style={{ backgroundColor: colors.primary }}
              className="w-full py-4 rounded-2xl items-center justify-center active:opacity-75 shadow-md mt-2"
            >
              <Text
                style={{ fontFamily: "Outfit_800ExtraBold" }}
                className="text-white text-base"
              >
                Close Details
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Animal?"
        message={`Are you sure you want to permanently delete ${animal?.animalId || "this animal"} and all its history? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="No, Keep it"
        isDestructive={true}
      />
    </View>
  );
}

// --- HELPER COMPONENTS ---
const InfoRow = ({
  label,
  value,
  textColor = "#1e293b",
  mutedColor = "#94a3b8",
}: {
  label: string;
  value: string;
  textColor?: string;
  mutedColor?: string;
}) => (
  <View className="flex-row justify-between items-center py-1">
    <Text
      style={{ fontFamily: "Outfit_500Medium", color: mutedColor }}
      className="text-[13px]"
    >
      {label}
    </Text>
    <Text
      style={{ fontFamily: "Outfit_800ExtraBold", color: textColor }}
      className="text-[15px]"
    >
      {value}
    </Text>
  </View>
);

const Divider = () => (
  <View className="h-[1px] w-full bg-slate-50 dark:bg-slate-900/50" />
);

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  color: string;
  bg: string;
}

const ActionCard = ({ title, subtitle, icon, onPress, color, bg }: ActionCardProps) => {
  const { isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.02,
        shadowRadius: 4,
        elevation: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Outfit_800ExtraBold",
            color: color,
            fontSize: 13,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: "Outfit_500Medium",
            color: isDark ? "#94a3b8" : "#64748b",
            fontSize: 9,
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
