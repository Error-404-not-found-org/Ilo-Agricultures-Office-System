import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { safeBack } from "@/utils/navigation";
import {
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
  X,
  Sparkles,
  Pencil,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner-native";
import {
  SPECIES_PROFILES,
  normalizeSpecies,
  verifyPostpartumWindow,
  calculateTargetCalvingDate,
} from "@/lib/cattleCore";
import { differenceInCalendarDays } from "date-fns";
import { useTheme } from "@/lib/theme";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { TimelineList } from "@/features/farmer-ui/components";
import { getAnimalImageSource } from "@/features/farmer-ui/utils/animalImage";
import { AsyncState, SelectDropdown } from "@/components/shared";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ReproductionNextActionCard } from "@/components/ReproductionNextActionCard";
import {
  useAnimalDetailsQuery,
  useAnimalMedicalRecordsQuery,
  useUpdateAnimalBasicInfoMutation,
  useUpdateReproductiveStatusMutation,
  useRecordAiOutcomeForAnimalMutation,
  useDeleteAnimalMutation,
} from "../hooks/useAnimalDetails";
import {
  useAnimalTimeline,
  useAnimalRecords,
} from "@/features/animal-records/hooks/useAnimalTimeline";
import { AnimalProfileSkeleton } from "../components/skeletons/AnimalProfileSkeleton";
import { TimelineSkeleton } from "../components/skeletons/TimelineSkeleton";
import { MedicalHistorySkeleton } from "../components/skeletons/MedicalHistorySkeleton";
import { getReInseminationAvailability } from "@/lib/reproductionEligibility";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  ANIMAL_RECORD_CATEGORY_OPTIONS,
  formatAnimalRecord,
} from "@/features/animal-records/utils/recordPresentation";

interface AnimalDetailsScreenProps {
  id: string;
}

export function AnimalDetailsScreen({ id }: AnimalDetailsScreenProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const primaryColor = isDark ? colors.primary : "#00643B";

  const [activeTab, setActiveTab] = useState<"Info" | "Timeline" | "Medical">(
    "Info",
  );
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [validationTitle, setValidationTitle] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  const [timelineFilter, setTimelineFilter] = useState("All");
  const [medicalFilter, setMedicalFilter] = useState("All");
  const [congratsModalVisible, setCongratsModalVisible] = useState(false);
  const [reheatModalVisible, setReheatModalVisible] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [basicInfoForm, setBasicInfoForm] = useState({
    animalId: "",
    earTag: "",
    breed: "",
    color: "",
    gender: "",
  });

  // Queries
  const {
    data: animal,
    isLoading: loadingAnimal,
    isError: isErrorAnimal,
    error: animalError,
    refetch: refetchAnimal,
  } = useAnimalDetailsQuery(id);
  const { data: medicalRecords = [], isLoading: loadingMedical } =
    useAnimalMedicalRecordsQuery(id);
  const updateBasicInfoMutation = useUpdateAnimalBasicInfoMutation();

  const {
    data: timelineData,
    isLoading: loadingTimeline,
    fetchNextPage: fetchNextTimelinePage,
    hasNextPage: hasNextTimelinePage,
    isFetchingNextPage: isFetchingNextTimelinePage,
  } = useAnimalTimeline({
    animalId: activeTab === "Timeline" ? id : undefined,
    type: timelineFilter,
  });

  const {
    data: animalRecordsData,
    isLoading: loadingAnimalRecords,
    fetchNextPage: fetchNextRecordsPage,
    hasNextPage: hasNextRecordsPage,
    isFetchingNextPage: isFetchingNextRecordsPage
  } = useAnimalRecords({
    animalId: activeTab === "Medical" ? id : undefined,
    type: medicalFilter,
  });
  const displayRecord = selectedRecord
    ? {
        type:
          selectedRecord.type ||
          (selectedRecord.recordKind === "health_request"
            ? selectedRecord.requestType === "vaccination"
              ? "Vaccination"
              : selectedRecord.requestType === "deworming"
                ? "Deworming"
                : selectedRecord.requestType === "medicine"
                  ? "Treatment"
                  : "Check-up"
            : "Medical Record"),
        date:
          selectedRecord.recordDate ||
          selectedRecord.date ||
          selectedRecord.createdAt,
        diagnosis:
          selectedRecord.details?.diagnosis ||
          selectedRecord.symptoms ||
          selectedRecord.diagnosis ||
          "",
        treatment:
          selectedRecord.details?.treatment || selectedRecord.treatment || "",
        medicineName:
          selectedRecord.details?.medicineName || selectedRecord.advice || "",
        dosage: selectedRecord.details?.dosage || "",
        weight: selectedRecord.details?.weight || selectedRecord.weight || "",
        note:
          selectedRecord.note ||
          selectedRecord.technicianNote ||
          selectedRecord.notes ||
          selectedRecord.comment ||
          "",
        recordedBy:
          selectedRecord.technicianId?.name ||
          selectedRecord.handledBy?.name ||
          "",
        withdrawalPeriodDays:
          selectedRecord.details?.withdrawalPeriodDays ||
          selectedRecord.withdrawalPeriodDays,
        withdrawalEndDate:
          selectedRecord.details?.withdrawalEndDate ||
          selectedRecord.withdrawalEndDate,
        followUpDate:
          selectedRecord.followUpDate || selectedRecord.followUpCheckupDate,
      }
    : null;

  useEffect(() => {
    if (!animal || !isEditingBasicInfo) return;
    setBasicInfoForm({
      animalId: animal.animalId || "",
      earTag: animal.earTag || "",
      breed: animal.breed || "",
      color: animal.color || "",
      gender: animal.gender || animal.sex || "",
    });
  }, [animal, isEditingBasicInfo]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (!loadingAnimal && animal) {
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
  }, [loadingAnimal, animal]);

  // Mutations
  const deleteAnimalMutation = useDeleteAnimalMutation();

  const deleting = deleteAnimalMutation.isPending;

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

  const getInseminationBadge = (record: any) => {
    if (!record)
      return {
        text: "Pending",
        bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
        color: isDark ? "#fbbf24" : "#d97706",
      };
    const status = record.status?.toLowerCase() || "pending";
    if (status !== "done") {
      switch (status) {
        case "rejected":
          return {
            text: "Rejected",
            bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
            color: isDark ? "#f87171" : "#b91c1c",
          };
        case "declined":
          return {
            text: "Declined",
            bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
            color: isDark ? "#f87171" : "#b91c1c",
          };
        case "approved":
          return {
            text: "Approved",
            bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
            color: isDark ? "#34d399" : "#047857",
          };
        case "in-progress":
          return {
            text: "In progress",
            bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
            color: isDark ? "#60a5fa" : "#1d4ed8",
          };
        case "cancelled":
        case "canceled":
          return {
            text: "Cancelled",
            bg: isDark ? "rgba(100, 116, 139, 0.15)" : "#f1f5f9",
            color: isDark ? "#94a3b8" : "#475569",
          };
        case "pending":
        default:
          return {
            text: "Pending",
            bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
            color: isDark ? "#fbbf24" : "#d97706",
          };
      }
    }

    const outcomeText =
      record.pregnancyStatus || record.outcome || record.result || "Pending";
    const isSuccess =
      outcomeText === "Pregnant" ||
      outcomeText === "Successful" ||
      outcomeText === "Positive";
    const isFailed =
      outcomeText.startsWith("Failed") ||
      outcomeText === "Negative" ||
      outcomeText === "Empty";

    if (isSuccess) {
      return {
        text: "Pregnant",
        bg: isDark ? "rgba(52, 211, 153, 0.15)" : "#ecfdf5",
        color: isDark ? "#34d399" : "#047857",
      };
    } else if (isFailed) {
      return {
        text: "Not pregnant",
        bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
        color: colors.error,
      };
    } else {
      return {
        text: "Inseminated",
        bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
        color: isDark ? "#60a5fa" : "#1d4ed8",
      };
    }
  };

  const handleConfirmPregnancy = async () => {
    const lastInsem = animal?.inseminations?.[0];
    setCongratsModalVisible(false);
    router.push({
      pathname: "/(farmer)/report-breeding-observation",
      params: {
        animalId: id,
        requestId: lastInsem?._id,
        defaultReport: "possible_pregnancy",
      },
    } as any);
  };

  const handleConfirmReheat = async () => {
    const lastInsem = animal?.inseminations?.[0];
    setReheatModalVisible(false);
    router.push({
      pathname: "/(farmer)/report-breeding-observation",
      params: {
        animalId: id,
        requestId: lastInsem?._id,
        defaultReport: "return_to_heat",
      },
    } as any);
  };

  const handleDelete = () => {
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteAnimalMutation.mutateAsync(id);
      toast.success("Animal profile deleted.");
      router.replace("/(farmer)/(tabs)/farmer.records");
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(
        error.response?.data?.message ||
          "We couldn't delete this animal profile. Please try again.",
      );
    }
  };

  if (loadingAnimal && !animal) {
    return (
      <AnimalProfileSkeleton
        onBack={() => safeBack("/(farmer)/(tabs)/farmer.records")}
      />
    );
  }

  if (isErrorAnimal || !animal) {
    const is404 = (animalError as any)?.response?.status === 404;
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.background }}
      >
        <AppPageHeader
          title="Animal details"
          onBack={() => safeBack("/(farmer)/(tabs)/farmer.records")}
        />
        <View className="flex-1 items-center justify-center">
          <AsyncState
            state="error"
            title={is404 ? "Animal profile removed" : "Animal profile unavailable"}
            message={
              is404
                ? "This animal is no longer available in your active records."
                : "We couldn't load this animal profile. Check your connection and try again."
            }
            actionLabel={is404 ? "Back to my animals" : "Try again"}
            onAction={
              is404
                ? () => safeBack("/(farmer)/(tabs)/farmer.records")
                : () => {
                    void refetchAnimal();
                  }
            }
            icon={
              <MaterialCommunityIcons
                name="cow-off"
                size={24}
                color={colors.primary}
              />
            }
          />
        </View>
      </View>
    );
  }

  // Extract proper formats
  const farmerName = animal.farmerId?.name || "No farmer assigned";
  const addr = animal.farmerId?.address;
  const farmerPhone =
    animal.farmerId?.phoneNumber ||
    animal.farmerId?.contact ||
    animal.farmerId?.phone ||
    addr?.phoneNumber ||
    "Phone not provided";
  const farmerAddress = addr
    ? [addr.street, addr.barangay, addr.city, addr.province]
        .filter(Boolean)
        .join(", ")
    : "Location not provided";
  const animalSex = String(animal.sex || animal.gender || "").toLowerCase();
  const isMaleAnimal = ["male", "bull", "m"].includes(animalSex);
  const isFemaleAnimal = ["female", "cow", "heifer", "f"].includes(animalSex);
  const handleSaveBasicInfo = async () => {
    if (!animal?._id || updateBasicInfoMutation.isPending) return;

    const payload = {
      animalId: basicInfoForm.animalId.trim(),
      earTag: basicInfoForm.earTag.trim(),
      breed: basicInfoForm.breed.trim(),
      color: basicInfoForm.color.trim(),
      gender: basicInfoForm.gender,
      sex: basicInfoForm.gender,
    };

    if (!payload.animalId) {
      toast.error("Animal ID is required.");
      return;
    }

    try {
      await updateBasicInfoMutation.mutateAsync({ id: animal._id, payload });
      toast.success("Basic information updated.");
      setIsEditingBasicInfo(false);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to update animal information.",
      );
    }
  };

  // Compute dynamic age based on birthDate subtraction
  let ageDisplay = "Not recorded";
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

  // Compute Breeding Statistics
  const completedInseminations = (animal.inseminations || []).filter(
    (ins: any) => ins.status === "done",
  );
  const totalAttempts = completedInseminations.length;
  const successfulAttempts = completedInseminations.filter(
    (ins: any) =>
      ins.outcome === "Pregnant" ||
      ins.isSuccess === true ||
      ins.pregnancyStatus === "Pregnant",
  ).length;
  const successRate =
    totalAttempts > 0
      ? Math.round((successfulAttempts / totalAttempts) * 100)
      : 0;
  const latestObservation = (animal.inseminations || []).find(
    (item: any) => item?.farmerOutcomeReport,
  );
  const showObservationSummary = Boolean(
    latestObservation &&
      (["Inseminated", "Likely Pregnant"].includes(
        animal.reproductiveStatus || "",
      ) ||
        latestObservation.verificationStatus === "pending" ||
        latestObservation.outcomeVerificationStatus === "reported"),
  );
  const reInsemination = getReInseminationAvailability(animal);

  const timelineEvents = timelineData?.events || [];
  const healthRecords = animalRecordsData?.records || [];

  // Check for active medicine withdrawal period
  const activeWithdrawalRecord = (medicalRecords || []).find((record: any) => {
    if (!record.details?.withdrawalEndDate) return false;
    const endDate = new Date(record.details.withdrawalEndDate);
    return endDate > new Date();
  });

  const nextAction = isFemaleAnimal ? (animal.nextAction ?? null) : null;
  const aiUnavailableReason = isMaleAnimal
    ? "Artificial insemination is available only for female animals."
    : animal.reproductiveStatus === "Pregnant"
      ? "This animal already has an active pregnancy."
      : ["Inseminated", "Likely Pregnant"].includes(
            animal.reproductiveStatus || "",
          )
        ? "This animal is currently under reproductive monitoring."
        : "";

  return (
    <View
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <AppPageHeader
        title="Animal details"
        onBack={() => safeBack("/(farmer)/(tabs)/farmer.records")}
        rightAction={
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete animal"
            activeOpacity={0.8}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.errorContainer,
            }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.errorForeground} />
            ) : (
              <Trash2 size={18} color={colors.errorForeground} />
            )}
          </TouchableOpacity>
        }
      />

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
                height: 192,
                width: "100%",
                borderRadius: 16,
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
                  {animal.earTag || animal.animalId
                    ? `Tag ${animal.earTag || animal.animalId}`
                    : "Tag not assigned"}
                </Text>
              </View>
            </View>
          </View>

          {/* Profile Content Container */}
          <Animated.View
            className="px-6 pt-6"
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
                  backgroundColor:
                    animal.reproductiveStatus === "Pregnant"
                      ? isDark
                        ? "rgba(16, 185, 129, 0.15)"
                        : "#ecfdf5"
                      : animal.reproductiveStatus === "Inseminated"
                        ? isDark
                          ? "rgba(59, 130, 246, 0.15)"
                          : "#eff6ff"
                        : animal.reproductiveStatus === "In Heat"
                          ? isDark
                            ? "rgba(249, 115, 22, 0.15)"
                            : "#fff7ed"
                          : isDark
                            ? "rgba(148, 163, 184, 0.15)"
                            : "#f1f5f9",
                  borderWidth: 1,
                  borderColor:
                    animal.reproductiveStatus === "Pregnant"
                      ? isDark
                        ? "rgba(16, 185, 129, 0.3)"
                        : "#a7f3d0"
                      : animal.reproductiveStatus === "Inseminated"
                        ? isDark
                          ? "rgba(59, 130, 246, 0.3)"
                          : "#bfdbfe"
                        : animal.reproductiveStatus === "In Heat"
                          ? isDark
                            ? "rgba(249, 115, 22, 0.3)"
                            : "#fed7aa"
                          : colors.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color:
                      animal.reproductiveStatus === "Pregnant"
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

            {/* Basic Info Grid */}
            <View className="mb-6">
              <View className="mb-3 flex-row items-center justify-between">
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 16,
                  }}
                >
                  Animal information
                </Text>
                {!isEditingBasicInfo && (
                  <TouchableOpacity
                    onPress={() => setIsEditingBasicInfo(true)}
                    className="flex-row items-center px-3 py-2 rounded-full border"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.12)"
                        : "#f0fdf4",
                      borderColor: isDark
                        ? "rgba(16, 185, 129, 0.25)"
                        : "#bbf7d0",
                    }}
                  >
                    <Pencil size={13} color={primaryColor} />
                    <Text
                      className="ml-1.5"
                      style={{
                        color: primaryColor,
                        fontFamily: "Outfit_800ExtraBold",
                        fontSize: 11,
                      }}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View
                className="p-4 rounded-2xl border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                {isEditingBasicInfo ? (
                  <View className="gap-3">
                    <View className="flex-row">
                      <BasicInfoInput
                        label="Animal ID"
                        value={basicInfoForm.animalId}
                        onChangeText={(value) =>
                          setBasicInfoForm({
                            ...basicInfoForm,
                            animalId: value,
                          })
                        }
                        placeholder="Animal ID"
                      />
                    </View>
                    <View className="flex-row">
                      <BasicInfoInput
                        label="Ear Tag"
                        value={basicInfoForm.earTag}
                        onChangeText={(value) =>
                          setBasicInfoForm({ ...basicInfoForm, earTag: value })
                        }
                        placeholder="Ear tag"
                      />
                    </View>
                    <View className="flex-row gap-3">
                      <BasicInfoInput
                        label="Breed"
                        value={basicInfoForm.breed}
                        onChangeText={(value) =>
                          setBasicInfoForm({ ...basicInfoForm, breed: value })
                        }
                        placeholder="Breed"
                      />
                      <BasicInfoInput
                        label="Color"
                        value={basicInfoForm.color}
                        onChangeText={(value) =>
                          setBasicInfoForm({ ...basicInfoForm, color: value })
                        }
                        placeholder="Color"
                      />
                    </View>
                    <View>
                      <Text
                        className="mb-1.5 ml-1"
                        style={{
                          color: colors.textMuted,
                          fontFamily: "Outfit_800ExtraBold",
                          fontSize: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        Sex
                      </Text>
                      <SelectDropdown
                        label="Sex"
                        value={basicInfoForm.gender || "Female"}
                        onChange={(value) =>
                          setBasicInfoForm({ ...basicInfoForm, gender: value })
                        }
                        options={[
                          { label: "Female", value: "Female" },
                          { label: "Male", value: "Male" },
                        ]}
                      />
                    </View>
                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        onPress={() => setIsEditingBasicInfo(false)}
                        disabled={updateBasicInfoMutation.isPending}
                        className="flex-1 py-3 rounded-2xl border items-center"
                        style={{
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontFamily: "Outfit_800ExtraBold",
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveBasicInfo}
                        disabled={updateBasicInfoMutation.isPending}
                        className="flex-1 py-3 rounded-2xl items-center justify-center"
                        style={{
                          backgroundColor: updateBasicInfoMutation.isPending
                            ? colors.border
                            : primaryColor,
                        }}
                      >
                        {updateBasicInfoMutation.isPending ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text
                            style={{
                              color: "#fff",
                              fontFamily: "Outfit_800ExtraBold",
                              fontSize: 12,
                            }}
                          >
                            Save
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap">
                    <BasicInfoCell label="Age" value={ageDisplay} />
                    <BasicInfoCell
                      label="Sex"
                      value={animal.gender || animal.sex || "Unspecified"}
                    />
                    <BasicInfoCell
                      label="Birth Date"
                      value={
                        animal.birthDate
                          ? new Date(animal.birthDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "Not recorded"
                      }
                    />
                    <BasicInfoCell
                      label="Breed"
                      value={animal.breed || "Unspecified"}
                    />
                    <BasicInfoCell label="Owner" value={farmerName} />
                    <BasicInfoCell
                      label="Color"
                      value={animal.color || "Unspecified"}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Active Withdrawal Warning Card */}
            {activeWithdrawalRecord && (
              <View
                className="mb-6 p-4 rounded-3xl border flex-row gap-3 items-center"
                style={{
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.15)"
                    : "#fef2f2",
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
                      {activeWithdrawalRecord.details.medicineName ||
                        "medicine"}
                    </Text>{" "}
                    treatment.
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
                Quick actions
              </Text>
              <View className="flex-col gap-3">
                <View className="flex-row gap-3">
                  <ActionCard
                    title="Report health concern"
                    subtitle="Request help for illness or injury"
                    icon={<Stethoscope size={20} color={colors.error} />}
                    onPress={() =>
                      router.push({
                        pathname: "/(farmer)/report-sickness",
                        params: { animalId: animal._id },
                      })
                    }
                    color={colors.error}
                    bg={isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2"}
                  />
                  <ActionCard
                    title="Track pregnancy"
                    subtitle="View pregnancy progress"
                    disabled={animal.reproductiveStatus !== "Pregnant"}
                    icon={<Calendar size={20} color={primaryColor} />}
                    onPress={() =>
                      router.push({
                        pathname: "/(farmer)/pregnancy-tracker",
                        params: { id: animal._id },
                      })
                    }
                    color={primaryColor}
                    bg={isDark ? "rgba(16, 185, 129, 0.1)" : "#f0fdf4"}
                  />
                </View>
                <View className="flex-row gap-3">
                  <ActionCard
                    title="Request AI service"
                    subtitle={
                      aiUnavailableReason || "Request insemination service"
                    }
                    disabled={Boolean(aiUnavailableReason)}
                    disabledReason={aiUnavailableReason}
                    icon={<Syringe size={20} color={primaryColor} />}
                    onPress={() => {
                      if (isMaleAnimal) {
                        setValidationTitle("Request Blocked");
                        setValidationMessage(
                          "Artificial insemination requests are only available for female cattle.",
                        );
                        setValidationModalVisible(true);
                        return;
                      }
                      if (animal.reproductiveStatus === "Pregnant") {
                        setValidationTitle("Request Blocked");
                        setValidationMessage(
                          "There is already an active pregnancy registered for this animal.",
                        );
                        setValidationModalVisible(true);
                        return;
                      }
                      if (animal.lastCalvingDate) {
                        const recovery = verifyPostpartumWindow(
                          animal.lastCalvingDate,
                          new Date(),
                          animal.species || "Cattle",
                          animal.breed,
                        );
                        if (!recovery.isSafe) {
                          setValidationTitle("Request Blocked");
                          setValidationMessage(
                            "The animal is in the postpartum recovery lockout window (45 days post-calving).",
                          );
                          setValidationModalVisible(true);
                          return;
                        }
                      }
                      if (
                        ["Inseminated", "Likely Pregnant"].includes(
                          animal.reproductiveStatus || "",
                        )
                      ) {
                        setValidationTitle("Request Blocked");
                        setValidationMessage(
                          "This animal is currently under reproductive monitoring.",
                        );
                        setValidationModalVisible(true);
                        return;
                      }
                      router.push({
                        pathname: "/(farmer)/request-ai",
                        params: { animalId: animal._id },
                      });
                    }}
                    color={primaryColor}
                    bg={isDark ? "rgba(16, 185, 129, 0.1)" : "#f0fdf4"}
                  />
                  <ActionCard
                    title="View activity timeline"
                    subtitle="Review the complete history"
                    icon={<History size={20} color={colors.textSecondary} />}
                    onPress={() => setActiveTab("Timeline")}
                    color={colors.textSecondary}
                    bg={isDark ? "rgba(148, 163, 184, 0.1)" : "#f8fafc"}
                  />
                </View>
              </View>
            </View>

            {/* Animal Summary Row */}
            <View className="mb-6">
              <Text
                className="mb-3"
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 16,
                }}
              >
                At a glance
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <View
                  className="min-h-20 rounded-2xl border p-3 items-center justify-center"
                  style={{
                    width: "48%",
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textSecondary,
                      fontSize: 11,
                    }}
                    numberOfLines={1}
                  >
                    AI attempts
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 20,
                      marginTop: 4,
                    }}
                  >
                    {totalAttempts}
                  </Text>
                </View>

                <View
                  className="min-h-20 rounded-2xl border p-3 items-center justify-center"
                  style={{
                    width: "48%",
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textSecondary,
                      fontSize: 11,
                    }}
                    numberOfLines={1}
                  >
                    Pregnancies
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 20,
                      marginTop: 4,
                    }}
                  >
                    {successfulAttempts}
                  </Text>
                </View>

                <View
                  className="min-h-20 rounded-2xl border p-3 items-center justify-center"
                  style={{
                    width: "48%",
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textSecondary,
                      fontSize: 11,
                    }}
                    numberOfLines={1}
                  >
                    Calving records
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 20,
                      marginTop: 4,
                    }}
                  >
                    {animal.parity || animal.calvings?.length || 0}
                  </Text>
                </View>

                <View
                  className="min-h-20 rounded-2xl border p-3 items-center justify-center"
                  style={{
                    width: "48%",
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textSecondary,
                      fontSize: 11,
                    }}
                    numberOfLines={1}
                  >
                    Health records
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_900Black",
                      color: colors.textPrimary,
                      fontSize: 20,
                      marginTop: 4,
                    }}
                  >
                    {medicalRecords.length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Customized Tabs */}
            <View
              className="flex-row mb-6 border-b"
              style={{ borderBottomColor: colors.border }}
            >
              <TouchableOpacity
                onPress={() => setActiveTab("Info")}
                className="min-h-11 flex-1 py-3 items-center flex-row justify-center gap-2"
                style={{
                  borderBottomWidth: 3,
                  borderBottomColor:
                    activeTab === "Info" ? primaryColor : "transparent",
                }}
              >
                <InfoIcon
                  size={16}
                  color={activeTab === "Info" ? primaryColor : colors.textMuted}
                />
                <Text
                  style={{
                    fontFamily:
                      activeTab === "Info"
                        ? "Outfit_800ExtraBold"
                        : "Outfit_600SemiBold",
                    color:
                      activeTab === "Info" ? primaryColor : colors.textMuted,
                  }}
                  className="text-[13px]"
                >
                  Overview
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("Timeline")}
                className="min-h-11 flex-1 py-3 items-center flex-row justify-center gap-2"
                style={{
                  borderBottomWidth: 3,
                  borderBottomColor:
                    activeTab === "Timeline" ? primaryColor : "transparent",
                }}
              >
                <History
                  size={16}
                  color={
                    activeTab === "Timeline" ? primaryColor : colors.textMuted
                  }
                />
                <Text
                  style={{
                    fontFamily:
                      activeTab === "Timeline"
                        ? "Outfit_800ExtraBold"
                        : "Outfit_600SemiBold",
                    color:
                      activeTab === "Timeline"
                        ? primaryColor
                        : colors.textMuted,
                  }}
                  className="text-[13px]"
                >
                  Timeline
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab("Medical")}
                className="min-h-11 flex-1 py-3 items-center flex-row justify-center gap-2"
                style={{
                  borderBottomWidth: 3,
                  borderBottomColor:
                    activeTab === "Medical" ? primaryColor : "transparent",
                }}
              >
                <ClipboardList
                  size={16}
                  color={
                    activeTab === "Medical" ? primaryColor : colors.textMuted
                  }
                />
                <Text
                  style={{
                    fontFamily:
                      activeTab === "Medical"
                        ? "Outfit_800ExtraBold"
                        : "Outfit_600SemiBold",
                    color:
                      activeTab === "Medical" ? primaryColor : colors.textMuted,
                  }}
                  className="text-[13px]"
                >
                  Records
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {activeTab === "Info" ? (
            <View className="px-6 gap-y-6">
              {nextAction ? (
                <ReproductionNextActionCard
                  action={nextAction}
                  title="Next Reproductive Action"
                />
              ) : null}
              {/* Reproductive Status Section */}
              {animal.gender === "Female" && (
                <View
                  className="p-5 rounded-2xl border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center mb-5 gap-2">
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={20}
                      color={primaryColor}
                    />
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: colors.textPrimary,
                      }}
                      className="text-lg"
                    >
                      Breeding and pregnancy
                    </Text>
                  </View>

                  <View
                    className="p-4 rounded-2xl mb-4 border"
                    style={{
                      backgroundColor: isDark ? colors.background : "#f8fafc",
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_900Black",
                        color: colors.textMuted,
                      }}
                      className="text-[10px] uppercase tracking-widest mb-1.5"
                    >
                      Reproductive status
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View
                        className={`w-3 h-3 rounded-full ${
                          animal.reproductiveStatus === "Pregnant"
                            ? "bg-emerald-500"
                            : animal.reproductiveStatus === "Inseminated"
                              ? "bg-blue-500"
                              : animal.reproductiveStatus === "In Heat"
                                ? "bg-orange-500"
                                : "bg-slate-300"
                        }`}
                      />
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textPrimary,
                        }}
                        className="text-xl"
                      >
                        {animal.reproductiveStatus || "Normal"}
                      </Text>
                    </View>
                  </View>

                  {showObservationSummary && (
                    <View
                      className="p-4 rounded-2xl border mb-4"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(139,92,246,0.08)"
                          : "#f5f3ff",
                        borderColor: isDark
                          ? "rgba(167,139,250,0.25)"
                          : "#ddd6fe",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: isDark ? "#c4b5fd" : "#6d28d9",
                          fontSize: 14,
                        }}
                      >
                        Farmer report submitted
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_600SemiBold",
                          color: colors.textSecondary,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        Awaiting technician verification
                      </Text>
                      <View className="mt-4 gap-2">
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontFamily: "Outfit_600SemiBold",
                            fontSize: 12,
                          }}
                        >
                          Reported outcome:{" "}
                          {String(
                            latestObservation.farmerOutcomeReport,
                          ).replaceAll("_", " ")}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          Selected signs:{" "}
                          {(
                            latestObservation.farmerObservationSigns || []
                          ).join(", ") || "None selected"}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          Farmer notes:{" "}
                          {latestObservation.farmerObservationNotes ||
                            "No notes provided"}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          Reported:{" "}
                          {latestObservation.farmerOutcomeReportedAt
                            ? new Date(
                                latestObservation.farmerOutcomeReportedAt,
                              ).toLocaleString("en-US")
                            : "Date unavailable"}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          Submitted by: {animal.farmerId?.name || "Farmer"}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          Verification status:{" "}
                          {latestObservation.verificationStatus === "pending" ||
                          latestObservation.outcomeVerificationStatus ===
                            "reported"
                            ? "Awaiting technician verification"
                            : String(
                                latestObservation.verificationStatus ||
                                  latestObservation.outcomeVerificationStatus ||
                                  "Not requested",
                              ).replaceAll("_", " ")}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          Technician next action: Review this observation and
                          perform pregnancy verification when eligible.
                        </Text>
                      </View>
                    </View>
                  )}

                  {reInsemination.isAvailable &&
                    reInsemination.latestAttempt && (
                      <View
                        className="p-4 rounded-2xl border mb-4"
                        style={{
                          backgroundColor: isDark
                            ? "rgba(16,185,129,0.08)"
                            : "#ecfdf5",
                          borderColor: isDark
                            ? "rgba(52,211,153,0.25)"
                            : "#a7f3d0",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            color: primaryColor,
                            fontSize: 15,
                          }}
                        >
                          Re-insemination available
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            lineHeight: 18,
                            marginTop: 6,
                          }}
                        >
                          The previous attempt on{" "}
                          {new Date(
                            reInsemination.latestAttempt.inseminationDate,
                          ).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          was marked unsuccessful because{" "}
                          {String(
                            reInsemination.latestAttempt.failureReason,
                          ).replaceAll("_", " ")}
                          .
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            lineHeight: 18,
                            marginTop: 4,
                          }}
                        >
                          This request creates Attempt #
                          {(reInsemination.latestAttempt.attemptNumber || 1) +
                            1}{" "}
                          and keeps it linked to the previous breeding series.
                        </Text>
                        <TouchableOpacity
                          className="rounded-xl py-3 items-center mt-4"
                          style={{ backgroundColor: primaryColor }}
                          onPress={() =>
                            router.push({
                              pathname: "/(farmer)/request-ai",
                              params: {
                                requestId: reInsemination.latestAttempt._id,
                                mode: "re-inseminate",
                                animalId: animal._id,
                                earTag: animal.earTag || animal.animalId,
                              },
                            } as any)
                          }
                        >
                          <Text
                            style={{
                              color: "white",
                              fontFamily: "Outfit_700Bold",
                            }}
                          >
                            Request Re-insemination
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                  {/* Breeding outcome reporting */}
                  {animal.reproductiveStatus?.toLowerCase() === "inseminated" &&
                    !animal.inseminations?.[0]?.farmerOutcomeReport &&
                    (() => {
                      const latestInsemination = animal.inseminations?.[0];

                      return (
                        <View
                          className="p-4 rounded-2xl border mb-4"
                          style={{
                            backgroundColor: isDark
                              ? "rgba(59, 130, 246, 0.08)"
                              : "#f8fafc",
                            borderColor: colors.border,
                          }}
                        >
                          <View className="flex-row items-start gap-3">
                            <View
                              className="w-10 h-10 rounded-xl items-center justify-center"
                              style={{
                                backgroundColor: isDark
                                  ? "rgba(59, 130, 246, 0.15)"
                                  : "#eff6ff",
                              }}
                            >
                              <MaterialCommunityIcons
                                name="clipboard-text-outline"
                                size={20}
                                color={isDark ? "#60a5fa" : "#2563eb"}
                              />
                            </View>

                            <View className="flex-1">
                              <Text
                                style={{
                                  fontFamily: "Outfit_800ExtraBold",
                                  color: colors.textPrimary,
                                }}
                                className="text-[15px]"
                              >
                                Report Observation
                              </Text>

                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textSecondary,
                                }}
                                className="text-[12px] leading-4 mt-1"
                              >
                                Record return-to-heat or possible pregnancy
                                observations. Pregnancy still requires
                                technician confirmation.
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row gap-3 mt-4">
                            <TouchableOpacity
                              onPress={() => setReheatModalVisible(true)}
                              className="flex-1 py-3 rounded-2xl items-center border"
                              style={{
                                backgroundColor: isDark
                                  ? "rgba(249, 115, 22, 0.08)"
                                  : "#fff7ed",
                                borderColor: isDark
                                  ? "rgba(249, 115, 22, 0.3)"
                                  : "#fed7aa",
                              }}
                            >
                              <Text
                                style={{ fontFamily: "Outfit_800ExtraBold" }}
                                className="text-orange-600 dark:text-orange-400 text-[10px] uppercase"
                              >
                                Returned to Heat
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => setCongratsModalVisible(true)}
                              className="flex-1 py-3 rounded-2xl items-center"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Text
                                style={{ fontFamily: "Outfit_900Black" }}
                                className="text-white text-[10px] uppercase"
                              >
                                Possible Pregnancy
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {nextAction?.type ===
                          "PERFORM_PREGNANCY_DIAGNOSIS" ? (
                            <TouchableOpacity
                              onPress={() =>
                                router.push({
                                  pathname:
                                    "/(farmer)/report-breeding-observation",
                                  params: {
                                    animalId: id,
                                    requestId: latestInsemination?._id,
                                    defaultReport: "unsure",
                                    requestVerification: "true",
                                  },
                                } as any)
                              }
                              className="w-full py-3 mt-3 rounded-2xl items-center"
                              style={{ backgroundColor: colors.primary }}
                            >
                              <Text
                                style={{ fontFamily: "Outfit_900Black" }}
                                className="text-white text-[10px] uppercase tracking-widest"
                              >
                                Request Technician Review
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })()}
                  {/* Calving Countdown */}
                  {animal.reproductiveStatus === "Pregnant" &&
                    (() => {
                      const latest = animal.inseminations?.[0];
                      const aiDateValue =
                        latest?.inseminationDate ||
                        latest?.dateOfAI ||
                        latest?.createdAt ||
                        animal.lastInseminationDate;
                      const aiDate = aiDateValue ? new Date(aiDateValue) : null;
                      const canonicalCalvingDate =
                        nextAction?.type === "PREPARE_FOR_CALVING" &&
                        nextAction.at
                          ? new Date(nextAction.at)
                          : null;
                      const dueDate =
                        canonicalCalvingDate &&
                        !Number.isNaN(canonicalCalvingDate.getTime())
                          ? canonicalCalvingDate
                          : animal.expectedCalvingDate
                            ? new Date(animal.expectedCalvingDate)
                            : aiDate
                              ? calculateTargetCalvingDate(
                                  aiDate,
                                  animal.species || "Cattle",
                                  undefined,
                                  animal.breed,
                                )
                              : null;

                      if (!dueDate) return null;

                      const daysRemaining = Math.max(
                        0,
                        differenceInCalendarDays(dueDate, new Date()),
                      );
                      const normSpecies = normalizeSpecies(animal.species);
                      const profile =
                        SPECIES_PROFILES[normSpecies] ||
                        SPECIES_PROFILES["Cattle"];
                      const gestationDays =
                        aiDate && dueDate
                          ? Math.max(
                              1,
                              differenceInCalendarDays(dueDate, aiDate),
                            )
                          : profile.avgGestationDays;
                      const elapsedDays = aiDate
                        ? Math.max(
                            0,
                            differenceInCalendarDays(new Date(), aiDate),
                          )
                        : 0;
                      const progress = Math.min(
                        100,
                        Math.round((elapsedDays / gestationDays) * 100),
                      );

                      const cardBg = isDark
                        ? "rgba(147, 51, 234, 0.15)"
                        : "#f5f3ff";
                      const cardBorder = isDark
                        ? "rgba(147, 51, 234, 0.3)"
                        : "#ede9fe";
                      const brandPurple = isDark ? "#c084fc" : "#7e22ce";

                      return (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() =>
                            router.push({
                              pathname: "/(farmer)/pregnancy-tracker",
                              params: { id: id },
                            })
                          }
                          className="p-5 rounded-3xl border mb-4"
                          style={{
                            backgroundColor: cardBg,
                            borderColor: cardBorder,
                            borderWidth: 1,
                          }}
                        >
                          <View className="flex-row justify-between items-end mb-3">
                            <View>
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: brandPurple,
                                }}
                                className="text-[9px] uppercase tracking-widest"
                              >
                                Expected Calving
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: colors.textPrimary,
                                }}
                                className="text-lg"
                              >
                                {dueDate.toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </Text>
                            </View>
                            <View className="items-end">
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: colors.textPrimary,
                                }}
                                className="text-xl"
                              >
                                {daysRemaining}
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: brandPurple,
                                }}
                                className="text-[8px] uppercase"
                              >
                                Days Left
                              </Text>
                            </View>
                          </View>

                          <View
                            className="w-full h-3 rounded-full overflow-hidden shadow-inner"
                            style={{
                              backgroundColor: isDark
                                ? "rgba(147, 51, 234, 0.3)"
                                : "#e9d5ff",
                            }}
                          >
                            <View
                              className="h-full rounded-full"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: isDark ? "#a855f7" : "#7e22ce",
                              }}
                            />
                          </View>
                          <Text
                            style={{
                              fontFamily: "Outfit_700Bold",
                              color: brandPurple,
                            }}
                            className="text-[10px] mt-2 text-center uppercase tracking-tighter"
                          >
                            {progress.toFixed(0)}% of Gestation Period Completed
                          </Text>
                          {/* Simplified Tracker Link */}
                          <View className="mt-4 flex-row items-center justify-center gap-1">
                            <Text
                              style={{
                                fontFamily: "Outfit_800ExtraBold",
                                color: brandPurple,
                              }}
                              className="text-[10px] uppercase tracking-wider"
                            >
                              View Tracker Milestones
                            </Text>
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={12}
                              color={brandPurple}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })()}
                </View>
              )}

              {/* Breeding Statistics */}
              {animal.gender === "Female" && (
                <View
                  className="p-5 rounded-2xl border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center mb-5 gap-2">
                    <MaterialCommunityIcons
                      name="chart-bell-curve-cumulative"
                      size={20}
                      color={primaryColor}
                    />
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: colors.textPrimary,
                      }}
                      className="text-lg"
                    >
                      Breeding Statistics
                    </Text>
                  </View>

                  <View className="flex-row gap-4 mb-4">
                    <View
                      className="flex-1 p-4 rounded-2xl border items-center justify-center"
                      style={{
                        backgroundColor: isDark ? colors.background : "#f8fafc",
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textMuted,
                        }}
                        className="text-[9px] uppercase tracking-widest mb-1 text-center"
                      >
                        A.I. Success Rate
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color:
                            successRate >= 50 ? "#10b981" : colors.textPrimary,
                        }}
                        className="text-2xl mt-1"
                      >
                        {totalAttempts > 0 ? `${successRate}%` : "0%"}
                      </Text>
                      <View
                        className="px-2 py-0.5 rounded-full mt-2"
                        style={{
                          backgroundColor:
                            successRate >= 50
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(148, 163, 184, 0.15)",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            color:
                              successRate >= 50 ? "#10b981" : colors.textMuted,
                          }}
                          className="text-[8px] uppercase tracking-tighter"
                        >
                          {totalAttempts}{" "}
                          {totalAttempts === 1 ? "Attempt" : "Attempts"}
                        </Text>
                      </View>
                    </View>

                    <View
                      className="flex-1 p-4 rounded-2xl border items-center justify-center"
                      style={{
                        backgroundColor: isDark ? colors.background : "#f8fafc",
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textMuted,
                        }}
                        className="text-[9px] uppercase tracking-widest mb-1 text-center"
                      >
                        Parity (Births)
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: primaryColor,
                        }}
                        className="text-2xl mt-1"
                      >
                        {animal.parity || 0}
                      </Text>
                      <View
                        className="px-2 py-0.5 rounded-full mt-2"
                        style={{ backgroundColor: colors.tint }}
                      >
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            color: primaryColor,
                          }}
                          className="text-[8px] uppercase tracking-tighter"
                        >
                          Total Offspring
                        </Text>
                      </View>
                    </View>
                  </View>

                  {animal.lastCalvingDate && (
                    <View
                      className="p-4 rounded-2xl border flex-row items-center justify-between"
                      style={{
                        backgroundColor: isDark ? colors.background : "#f8fafc",
                        borderColor: colors.border,
                      }}
                    >
                      <View className="flex-row items-center gap-2">
                        <Calendar size={14} color={colors.textMuted} />
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            color: colors.textSecondary,
                          }}
                          className="text-xs"
                        >
                          Last Calving Date
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textPrimary,
                        }}
                        className="text-xs"
                      >
                        {new Date(animal.lastCalvingDate).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Family Lineage */}
              {(animal.motherId ||
                (animal.offspring && animal.offspring.length > 0)) && (
                <View
                  className="p-5 rounded-2xl border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center mb-5 gap-2">
                    <MaterialCommunityIcons
                      name="family-tree"
                      size={20}
                      color={primaryColor}
                    />
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: colors.textPrimary,
                      }}
                      className="text-lg"
                    >
                      Family Lineage
                    </Text>
                  </View>

                  <View className="gap-y-4">
                    {animal.motherId && (
                      <View>
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            color: colors.textMuted,
                          }}
                          className="text-[9px] uppercase tracking-widest mb-2 ml-1"
                        >
                          Mother (Dam)
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname: "/(farmer)/animal-details",
                              params: {
                                id: animal.motherId._id || animal.motherId,
                              },
                            })
                          }
                          className="flex-row items-center justify-between p-3 rounded-2xl border"
                          style={{
                            backgroundColor: isDark
                              ? colors.background
                              : "#f8fafc",
                            borderColor: colors.border,
                          }}
                        >
                          <View className="flex-row items-center gap-3">
                            <View
                              className="w-10 h-10 rounded-xl items-center justify-center border"
                              style={{
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                              }}
                            >
                              {animal.motherId.imageUrl ? (
                                <Image
                                  source={{ uri: animal.motherId.imageUrl }}
                                  className="w-full h-full rounded-xl"
                                  resizeMode="cover"
                                />
                              ) : (
                                <MaterialCommunityIcons
                                  name="cow"
                                  size={20}
                                  color={primaryColor}
                                />
                              )}
                            </View>
                            <View>
                              <Text
                                style={{
                                  fontFamily: "Outfit_800ExtraBold",
                                  color: colors.textPrimary,
                                }}
                                className="text-sm"
                              >
                                Tag {animal.motherId.earTag || "not recorded"}
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textSecondary,
                                }}
                                className="text-[10px] uppercase mt-0.5"
                              >
                                {animal.motherId.breed} •{" "}
                                {animal.motherId.species}
                              </Text>
                            </View>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <View className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: "#10b981",
                                }}
                                className="text-[8px] uppercase tracking-wider"
                              >
                                {animal.motherId.reproductiveStatus || "Normal"}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}

                    {animal.offspring && animal.offspring.length > 0 && (
                      <View>
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            color: colors.textMuted,
                          }}
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
                                  pathname: "/(farmer)/animal-details",
                                  params: { id: calf._id },
                                })
                              }
                              className="flex-row items-center justify-between p-3 rounded-2xl border"
                              style={{
                                backgroundColor: isDark
                                  ? colors.background
                                  : "#f8fafc",
                                borderColor: colors.border,
                              }}
                            >
                              <View className="flex-row items-center gap-3">
                                <View
                                  className="w-10 h-10 rounded-xl items-center justify-center border"
                                  style={{
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                  }}
                                >
                                  {calf.imageUrl ? (
                                    <Image
                                      source={{ uri: calf.imageUrl }}
                                      className="w-full h-full rounded-xl"
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <MaterialCommunityIcons
                                      name="cow"
                                      size={20}
                                      color={primaryColor}
                                    />
                                  )}
                                </View>
                                <View>
                                  <Text
                                    style={{
                                      fontFamily: "Outfit_800ExtraBold",
                                      color: colors.textPrimary,
                                    }}
                                    className="text-sm"
                                  >
                                    Tag {calf.earTag || "not recorded"}
                                  </Text>
                                  <Text
                                    style={{
                                      fontFamily: "Outfit_500Medium",
                                      color: colors.textSecondary,
                                    }}
                                    className="text-[10px] uppercase mt-0.5"
                                  >
                                    {calf.gender === "Male"
                                      ? "Male ♂"
                                      : "Female ♀"}{" "}
                                    • {calf.breed}
                                  </Text>
                                </View>
                              </View>
                              <View className="flex-row items-center gap-2">
                                <View
                                  className="px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: colors.border }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: "Outfit_800ExtraBold",
                                      color: colors.textSecondary,
                                    }}
                                    className="text-[8px] uppercase tracking-wide"
                                  >
                                    {calf.reproductiveStatus || "Normal"}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Ownership Details */}
              <View
                className="p-5 rounded-2xl border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-center mb-5 gap-2">
                  <User size={20} color={primaryColor} />
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textPrimary,
                    }}
                    className="text-lg"
                  >
                    Owner details
                  </Text>
                </View>

                <View
                  className="flex-row items-center gap-4 mb-5 p-3 rounded-2xl border"
                  style={{
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                    borderColor: colors.border,
                  }}
                >
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center border border-slate-200 dark:border-slate-800"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.15)"
                        : "#d1fae5",
                      overflow: "hidden",
                    }}
                  >
                    {animal.farmerId?.imageUrl ? (
                      <Image
                        source={{ uri: animal.farmerId.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: isDark ? colors.primary : "#065f46",
                        }}
                        className="text-lg"
                      >
                        {(animal.farmerId?.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: colors.textPrimary,
                      }}
                      className="text-base"
                    >
                      {farmerName}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Outfit_500Medium",
                        color: colors.textSecondary,
                      }}
                      className="text-[12px] mt-0.5"
                    >
                      {farmerPhone}
                    </Text>
                    <View
                      className="px-2.5 py-0.5 rounded-full self-start mt-2 border"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.15)"
                          : "#ecfdf5",
                        borderColor: isDark ? "transparent" : "#d1fae5",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: isDark ? colors.primary : "#065f46",
                        }}
                        className="text-[9px] uppercase tracking-widest"
                      >
                        Registered Owner
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="gap-y-5">
                  <View className="flex-col gap-1">
                    <Text
                      style={{
                        fontFamily: "Outfit_900Black",
                        color: colors.textMuted,
                      }}
                      className="text-[10px] uppercase tracking-widest"
                    >
                      Location Address
                    </Text>
                    <View className="flex-row items-start gap-2 mt-2 pr-4">
                      <MapPin
                        size={16}
                        color={isDark ? colors.primary : "#00643B"}
                        style={{ marginTop: 2 }}
                      />
                      <Text
                        style={{
                          fontFamily: "Outfit_600SemiBold",
                          color: colors.textPrimary,
                        }}
                        className="text-[15px] leading-5 w-11/12"
                      >
                        {farmerAddress}
                      </Text>
                    </View>
                  </View>
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
                    <View
                      className="rounded-2xl p-6 items-center mt-4 border"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                    >
                      <History size={32} color={colors.textMuted} />
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: colors.textPrimary,
                        }}
                        className="text-lg mt-2 mb-1"
                      >
                        No matching timeline events
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textSecondary,
                        }}
                        className="text-center text-xs leading-5"
                      >
                        Choose another event type, or check again after a new
                        activity is recorded.
                      </Text>
                    </View>
                  ) : null}
                  {hasNextTimelinePage && timelineEvents.length > 0 && (
                    <TouchableOpacity
                      onPress={() => fetchNextTimelinePage()}
                      disabled={isFetchingNextTimelinePage}
                      className="py-3.5 px-4 rounded-2xl items-center justify-center border mt-4"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          color: primaryColor,
                        }}
                        className="text-xs"
                      >
                        {isFetchingNextTimelinePage
                          ? "Loading more..."
                          : "Load More Records"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View className="px-6">
              {/* Records Filters selector */}
              <View className="mb-4 flex-row items-center justify-between gap-4">
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textSecondary,
                  }}
                  className="text-xs"
                >
                  Category Filter:
                </Text>
                <SelectDropdown
                  label="All Records"
                  options={[...ANIMAL_RECORD_CATEGORY_OPTIONS]}
                  value={medicalFilter}
                  onChange={(val) => setMedicalFilter(val)}
                  flex={1}
                />
              </View>

              {loadingAnimalRecords && healthRecords.length === 0 ? (
                <MedicalHistorySkeleton />
              ) : healthRecords.length > 0 ? (
                <View className="mt-2 text-primary">
                  {healthRecords.map((record: any, idx: number) => {
                    const presentation = formatAnimalRecord(record, animal);
                    const recordKind = record.recordKind || record.type;
                    const isAi = recordKind === "insemination";
                    const isPregnancy = recordKind === "pregnancy";
                    const isCalving = recordKind === "calving";
                    const isRequest = recordKind === "health_request";
                    const recType = isAi
                      ? "AI"
                      : isPregnancy
                        ? "Pregnancy"
                        : isCalving
                          ? "Calving"
                          : isRequest
                            ? "Health"
                            : record.type || "Medical";
                    const medicineVal =
                      record.details?.medicineName || record.advice || "";
                    const weightVal = record.details?.weight;
                    const noteVal =
                      record.note ||
                      record.technicianNote ||
                      record.notes ||
                      record.summary ||
                      record.comment ||
                      "";
                    const recordedByVal =
                      record.technicianId?.name ||
                      record.handledBy?.name ||
                      record.approvedBy?.name ||
                      "";
                    const iconBg = isAi
                      ? isDark
                        ? "rgba(59, 130, 246, 0.15)"
                        : "#eff6ff"
                      : isPregnancy
                        ? isDark
                          ? "rgba(236, 72, 153, 0.15)"
                          : "#fdf2f8"
                        : isCalving
                          ? isDark
                            ? "rgba(132, 204, 22, 0.15)"
                            : "#f7fee7"
                          : recType === "Health" || recType === "Treatment"
                            ? isDark
                              ? "rgba(245, 158, 11, 0.15)"
                              : "#fff7ed"
                            : isDark
                              ? "rgba(100, 116, 139, 0.15)"
                              : "#f8fafc";

                    return (
                      <TouchableOpacity
                        key={record._id || idx}
                        onPress={() => {
                          router.push({
                            pathname: "/(farmer)/animal-record-detail",
                            params: {
                              animalId: id,
                              sourceId: record.sourceId || record._id || record.id,
                              sourceKind: record.recordKind || "",
                              recordId: record.sourceId || record._id || record.id,
                              recordType: record.recordKind || record.type || "",
                            },
                          });
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${presentation.title}. Full animal identifier ${presentation.fullAnimalReference}. ${presentation.badges.map((badge) => badge.label).join(". ")}.`}
                        className="p-4 rounded-2xl mb-3 flex-row border"
                        style={{
                          minHeight: 108,
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        }}
                      >
                        <View
                          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                          style={{
                            backgroundColor: iconBg,
                          }}
                        >
                          {isAi && <Syringe size={22} color="#2563EB" />}
                          {isPregnancy && (
                            <MaterialCommunityIcons
                              name="calendar-check"
                              size={22}
                              color="#DB2777"
                            />
                          )}
                          {isCalving && (
                            <MaterialCommunityIcons
                              name="cow"
                              size={24}
                              color="#65A30D"
                            />
                          )}
                          {!isAi &&
                            !isPregnancy &&
                            !isCalving &&
                            recType === "Vaccination" && (
                              <Syringe size={22} color="#10B981" />
                            )}
                          {!isAi &&
                            !isPregnancy &&
                            !isCalving &&
                            recType === "Deworming" && (
                              <MaterialCommunityIcons
                                name="pill"
                                size={22}
                                color="#3B82F6"
                              />
                            )}
                          {!isAi &&
                            !isPregnancy &&
                            !isCalving &&
                            (recType === "Treatment" ||
                              recType === "Health") && (
                              <Stethoscope size={22} color="#F59E0B" />
                            )}
                          {!isAi &&
                            !isPregnancy &&
                            !isCalving &&
                            (recType === "Weight Log" ||
                              recType === "Weight") && (
                              <Scale size={22} color="#6366F1" />
                            )}
                          {!isAi &&
                            !isPregnancy &&
                            !isCalving &&
                            (recType === "Check-up" ||
                              recType === "Medical") && (
                              <ClipboardList size={22} color="#64748B" />
                            )}
                          {!isAi &&
                            !isPregnancy &&
                            !isCalving &&
                            recType === "General Note" && (
                              <ClipboardList size={22} color="#64748B" />
                            )}
                        </View>

                        <View className="flex-1 min-w-0">
                          <View className="flex-row justify-between items-start mb-1">
                            <Text
                              style={{
                                fontFamily: "Outfit_800ExtraBold",
                                color: colors.textPrimary,
                              }}
                              className="text-[16px]"
                            >
                              {presentation.title}
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
                                {presentation.category}
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
                              {presentation.date
                                ? new Date(
                                    presentation.date,
                                  ).toLocaleDateString()
                                : "Date unavailable"}
                            </Text>
                          </View>

                          <View className="flex-row flex-wrap gap-1.5 mb-2">
                            {presentation.badges.map((badge) => (
                              <StatusBadge
                                key={`${badge.domain}-${badge.label}`}
                                label={badge.label}
                                domain={badge.domain}
                                variant={badge.variant}
                                compact
                                size={9}
                              />
                            ))}
                          </View>

                          {presentation.details.slice(0, 3).map((detail) => (
                            <Text
                              key={detail}
                              numberOfLines={2}
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textSecondary,
                              }}
                              className="text-[11px] leading-4 mt-1"
                            >
                              {detail}
                            </Text>
                          ))}

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

                  {hasNextRecordsPage && (
                    <TouchableOpacity
                      onPress={() => fetchNextRecordsPage()}
                      disabled={isFetchingNextRecordsPage}
                      className="py-3.5 px-4 rounded-2xl items-center justify-center border mt-4"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          color: primaryColor,
                        }}
                        className="text-xs"
                      >
                        {isFetchingNextRecordsPage
                          ? "Loading more records..."
                          : "Load more records"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View
                  className="rounded-2xl p-6 items-center mt-4 border"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: colors.background }}
                  >
                    <History size={28} color={colors.textMuted} />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textPrimary,
                    }}
                    className="text-lg mb-1"
                  >
                    No matching records
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      color: colors.textSecondary,
                    }}
                    className="text-center text-sm px-4 leading-5"
                  >
                    Choose another record type, or check again after a service
                    has been completed.
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
          <View
            style={{ backgroundColor: colors.card }}
            className="rounded-t-[32px] p-6 pb-8 shadow-2xl"
          >
            <View
              className="w-10 h-1 rounded-full align-self-center mb-5"
              style={{ backgroundColor: colors.border }}
            />

            <View className="flex-row justify-between items-start mb-4 gap-4">
              <View className="flex-1 pr-3">
                <Text
                  style={{
                    fontFamily: "Outfit_900Black",
                    color: isDark ? colors.primary : "#047857",
                  }}
                  className="text-[10px] uppercase tracking-widest mb-1.5"
                >
                  Record Details
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_900Black",
                    color: colors.textPrimary,
                  }}
                  className="text-[22px] leading-7"
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
                className="w-9 h-9 rounded-full items-center justify-center flex-shrink-0"
                style={{ backgroundColor: colors.background }}
              >
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {selectedRecord && (
                <View
                  className="rounded-2xl p-5 gap-y-4 mb-2"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                >
                  {selectedRecord.imageUrl && (
                    <View
                      className="mb-2 rounded-xl overflow-hidden border shadow-sm"
                      style={{ borderColor: colors.border }}
                    >
                      <Image
                        source={{ uri: selectedRecord.imageUrl }}
                        className="w-full h-48"
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  <View className="flex-row justify-between items-start gap-4">
                    <Text
                      style={{
                        fontFamily: "Outfit_500Medium",
                        color: colors.textMuted,
                      }}
                      className="text-[12px] uppercase tracking-wider"
                    >
                      Activity Date
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: colors.textPrimary,
                      }}
                      className="text-[14px] text-right flex-1 leading-5"
                    >
                      {new Date(selectedRecord.recordDate).toLocaleDateString(
                        "en-US",
                        { month: "long", day: "numeric", year: "numeric" },
                      )}
                    </Text>
                  </View>
                  <View
                    className="h-[1px] w-full"
                    style={{ backgroundColor: colors.border }}
                  />

                  {selectedRecord.type === "insemination" && (
                    <>
                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Attempt No.
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            color: colors.textPrimary,
                          }}
                          className="text-[14px] text-right flex-1 leading-5"
                        >
                          #{selectedRecord.attemptNumber || 1}
                        </Text>
                      </View>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Estrus Cycle Type
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            color: colors.textPrimary,
                          }}
                          className="text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.estrus ||
                            selectedRecord.estrusType ||
                            "Natural"}
                        </Text>
                      </View>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Sire Breed
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            color: colors.textPrimary,
                          }}
                          className="text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.sireBreed || "Not recorded"}
                        </Text>
                      </View>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Sire Code
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            color: colors.textPrimary,
                          }}
                          className="text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.sireCode || "Not recorded"}
                        </Text>
                      </View>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Current Status
                        </Text>
                        {(() => {
                          const badge = getInseminationBadge(selectedRecord);
                          return (
                            <View
                              className="px-2.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: badge.bg,
                                borderColor: isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.05)",
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: badge.color,
                                }}
                                className="text-[10px] uppercase tracking-wider"
                              >
                                {badge.text}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
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
                              className="px-3 py-1 rounded-full border"
                              style={{
                                backgroundColor: isSuccess
                                  ? isDark
                                    ? "rgba(52, 211, 153, 0.15)"
                                    : "#ecfdf5"
                                  : isFailed
                                    ? isDark
                                      ? "rgba(239, 68, 68, 0.15)"
                                      : "#fef2f2"
                                    : colors.border,
                                borderColor: isSuccess
                                  ? isDark
                                    ? "rgba(52, 211, 153, 0.3)"
                                    : "#d1fae5"
                                  : isFailed
                                    ? isDark
                                      ? "rgba(239, 68, 68, 0.3)"
                                      : "#fecaca"
                                    : "transparent",
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: isSuccess
                                    ? isDark
                                      ? "#34d399"
                                      : "#047857"
                                    : isFailed
                                      ? colors.error
                                      : colors.textSecondary,
                                }}
                                className="text-[12px]"
                              >
                                {outcomeText}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      {selectedRecord.dateOfPD && (
                        <>
                          <View
                            className="h-[1px] w-full"
                            style={{ backgroundColor: colors.border }}
                          />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textMuted,
                              }}
                              className="text-[12px] uppercase tracking-wider"
                            >
                              Diagnosis Date
                            </Text>
                            <Text
                              style={{
                                fontFamily: "Outfit_800ExtraBold",
                                color: colors.textPrimary,
                              }}
                              className="text-[14px] text-right flex-1 leading-5"
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
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Number of Calves
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            color: colors.textPrimary,
                          }}
                          className="text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.numberOfCalves ||
                            selectedRecord.calves?.length ||
                            1}
                        </Text>
                      </View>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />

                      <View className="flex-row justify-between items-start gap-4">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Calving Ease
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            color: colors.textPrimary,
                          }}
                          className="text-[14px] text-right flex-1 leading-5"
                        >
                          {selectedRecord.calvingEase || "Natural"}
                        </Text>
                      </View>

                      {selectedRecord.locationAddress ? (
                        <>
                          <View
                            className="h-[1px] w-full"
                            style={{ backgroundColor: colors.border }}
                          />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textMuted,
                              }}
                              className="text-[12px] uppercase tracking-wider"
                            >
                              Calving Location
                            </Text>
                            <Text
                              style={{
                                fontFamily: "Outfit_600SemiBold",
                                color: colors.textPrimary,
                              }}
                              className="text-[13px] text-right flex-1 leading-5"
                            >
                              {selectedRecord.locationAddress}
                            </Text>
                          </View>
                        </>
                      ) : null}

                      {selectedRecord.calves &&
                      selectedRecord.calves.length > 0 ? (
                        <>
                          <View
                            className="h-[1px] w-full"
                            style={{ backgroundColor: colors.border }}
                          />
                          <Text
                            style={{
                              fontFamily: "Outfit_800ExtraBold",
                              color: colors.textSecondary,
                            }}
                            className="text-[10px] uppercase tracking-wider mt-1"
                          >
                            Offspring Born
                          </Text>
                          <View className="gap-y-2 mt-1">
                            {selectedRecord.calves.map(
                              (calf: any, cidx: number) => (
                                <View
                                  key={cidx}
                                  className="p-3 rounded-xl border"
                                  style={{
                                    backgroundColor: colors.card,
                                    borderColor: colors.border,
                                  }}
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
                                          color: colors.textPrimary,
                                        }}
                                        className="text-[12px]"
                                      >
                                        Tag: {calf.earTag || `Calf ${cidx + 1}`}
                                      </Text>
                                    </View>
                                    <View className="flex-row gap-2.5 items-center">
                                      <View
                                        className="px-2 py-0.5 rounded-full"
                                        style={{
                                          backgroundColor:
                                            calf.sex === "M"
                                              ? isDark
                                                ? "rgba(59, 130, 246, 0.15)"
                                                : "#eff6ff"
                                              : isDark
                                                ? "rgba(244, 114, 182, 0.15)"
                                                : "#fdf2f8",
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontFamily: "Outfit_900Black",
                                            color:
                                              calf.sex === "M"
                                                ? "#3b82f6"
                                                : "#ec4899",
                                          }}
                                          className="text-[9px]"
                                        >
                                          {calf.sex === "M"
                                            ? "Male ♂"
                                            : "Female ♀"}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                  {calf.imageUrl ? (
                                    <View
                                      className="mt-2.5 rounded-lg overflow-hidden border"
                                      style={{ borderColor: colors.border }}
                                    >
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
                          <View
                            className="h-[1px] w-full"
                            style={{ backgroundColor: colors.border }}
                          />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textMuted,
                              }}
                              className="text-[12px] uppercase tracking-wider"
                            >
                              Calf Tag ID
                            </Text>
                            <Text
                              style={{
                                fontFamily: "Outfit_900Black",
                                color: colors.textPrimary,
                              }}
                              className="text-[14px] text-right flex-1 leading-5"
                            >
                              {selectedRecord.calfId || "Not recorded"}
                            </Text>
                          </View>
                          <View
                            className="h-[1px] w-full"
                            style={{ backgroundColor: colors.border }}
                          />
                          <View className="flex-row justify-between items-start gap-4">
                            <Text
                              style={{
                                fontFamily: "Outfit_500Medium",
                                color: colors.textMuted,
                              }}
                              className="text-[12px] uppercase tracking-wider"
                            >
                              Offspring Sex
                            </Text>
                            <Text
                              style={{
                                fontFamily: "Outfit_800ExtraBold",
                                color: colors.textPrimary,
                              }}
                              className="text-[14px] text-right flex-1 leading-5"
                            >
                              {selectedRecord.calfSex === "M"
                                ? "Male ♂"
                                : selectedRecord.calfSex === "F"
                                  ? "Female ♀"
                                  : selectedRecord.calfSex || "Not recorded"}
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </>
                  )}

                  {displayRecord &&
                    selectedRecord.type !== "insemination" &&
                    selectedRecord.type !== "calving" && (
                      <>
                        <View className="flex-row justify-between items-start gap-4">
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              color: colors.textMuted,
                            }}
                            className="text-[12px] uppercase tracking-wider"
                          >
                            Check Category
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Outfit_800ExtraBold",
                              color: colors.textPrimary,
                            }}
                            className="text-[14px] text-right flex-1 leading-5"
                          >
                            {displayRecord.type}
                          </Text>
                        </View>

                        {displayRecord.diagnosis ? (
                          <>
                            <View
                              className="h-[1px] w-full"
                              style={{ backgroundColor: colors.border }}
                            />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textMuted,
                                }}
                                className="text-[12px] uppercase tracking-wider"
                              >
                                Diagnosis
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_800ExtraBold",
                                  color: colors.textPrimary,
                                }}
                                className="text-[13px] text-right flex-1 leading-5"
                              >
                                {displayRecord.diagnosis}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.treatment ? (
                          <>
                            <View
                              className="h-[1px] w-full"
                              style={{ backgroundColor: colors.border }}
                            />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textMuted,
                                }}
                                className="text-[12px] uppercase tracking-wider"
                              >
                                Treatment Given
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_800ExtraBold",
                                  color: colors.textPrimary,
                                }}
                                className="text-[13px] text-right flex-1 leading-5"
                              >
                                {displayRecord.treatment}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.medicineName ? (
                          <>
                            <View
                              className="h-[1px] w-full"
                              style={{ backgroundColor: colors.border }}
                            />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textMuted,
                                }}
                                className="text-[12px] uppercase tracking-wider"
                              >
                                Medicine Administered
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_800ExtraBold",
                                  color: isDark ? colors.primary : "#047857",
                                }}
                                className="text-[14px] text-right flex-1 leading-5"
                              >
                                {displayRecord.medicineName}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.dosage ? (
                          <>
                            <View
                              className="h-[1px] w-full"
                              style={{ backgroundColor: colors.border }}
                            />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textMuted,
                                }}
                                className="text-[12px] uppercase tracking-wider"
                              >
                                Dosage / Route
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_800ExtraBold",
                                  color: colors.textPrimary,
                                }}
                                className="text-[14px] text-right flex-1 leading-5"
                              >
                                {displayRecord.dosage}
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.weight ? (
                          <>
                            <View
                              className="h-[1px] w-full"
                              style={{ backgroundColor: colors.border }}
                            />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textMuted,
                                }}
                                className="text-[12px] uppercase tracking-wider"
                              >
                                Recorded Weight
                              </Text>
                              <Text
                                style={{
                                  fontFamily: "Outfit_900Black",
                                  color: isDark ? "#818cf8" : "#4f46e5",
                                }}
                                className="text-[14px] text-right flex-1 leading-5"
                              >
                                {displayRecord.weight} kg
                              </Text>
                            </View>
                          </>
                        ) : null}

                        {displayRecord.followUpDate ? (
                          <>
                            <View
                              className="h-[1px] w-full"
                              style={{ backgroundColor: colors.border }}
                            />
                            <View className="flex-row justify-between items-start gap-4">
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textMuted,
                                }}
                                className="text-[12px] uppercase tracking-wider"
                              >
                                Follow-Up Date
                              </Text>
                              <View
                                className="px-2.5 py-1 rounded-lg border"
                                style={{
                                  backgroundColor: isDark
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "#fffbeb",
                                  borderColor: isDark
                                    ? "rgba(245, 158, 11, 0.3)"
                                    : "#fef3c7",
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: "Outfit_800ExtraBold",
                                    color: isDark ? "#fbbf24" : "#d97706",
                                  }}
                                  className="text-[12px]"
                                >
                                  {new Date(
                                    displayRecord.followUpDate,
                                  ).toLocaleDateString("en-US", {
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

                  {selectedRecord.type === "insemination" &&
                  selectedRecord.heatSigns &&
                  selectedRecord.heatSigns.length > 0 ? (
                    <>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />
                      <View className="flex-col gap-1.5">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
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
                                // Using index for unique key
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

                  {displayRecord && displayRecord.note ? (
                    <>
                      <View
                        className="h-[1px] w-full"
                        style={{ backgroundColor: colors.border }}
                      />
                      <View className="flex-col gap-1">
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textMuted,
                          }}
                          className="text-[12px] uppercase tracking-wider"
                        >
                          Notes & Remarks
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            color: colors.textSecondary,
                          }}
                          className="text-[13px] italic leading-5 mt-1"
                        >
                          &quot;{displayRecord.note}&quot;
                        </Text>
                      </View>
                    </>
                  ) : null}

                  <View
                    className="h-[1px] w-full"
                    style={{ backgroundColor: colors.border }}
                  />
                  <View className="flex-row justify-between items-start gap-4">
                    <Text
                      style={{
                        fontFamily: "Outfit_500Medium",
                        color: colors.textMuted,
                      }}
                      className="text-[12px] uppercase tracking-wider"
                    >
                      Recorded by
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: colors.textPrimary,
                      }}
                      className="text-[14px] text-right flex-1 leading-5"
                    >
                      {displayRecord?.recordedBy ||
                        "Agriculture Office Technician"}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setRecordModalVisible(false)}
              style={{ backgroundColor: colors.primary }}
              className="w-full py-4 rounded-2xl items-center justify-center active:opacity-75 shadow-md mt-2"
            >
              <Text
                style={{ fontFamily: "Outfit_800ExtraBold" }}
                className="text-white text-base"
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${animal?.earTag || animal?.animalId || "animal"}?`}
        message={`Are you sure you want to permanently delete ${animal?.animalId || "this animal"} and all its history? This action cannot be undone.`}
        confirmText="Delete animal"
        cancelText="Keep animal"
        isDestructive={true}
      />

      <ConfirmationModal
        visible={validationModalVisible}
        onClose={() => setValidationModalVisible(false)}
        onConfirm={() => setValidationModalVisible(false)}
        title={validationTitle}
        message={validationMessage}
        confirmText="Got it"
        cancelText=""
        isDestructive={false}
      />

      {/* Congrats Pregnancy Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={congratsModalVisible}
        onRequestClose={() => setCongratsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View
            className="rounded-[30px] w-full p-6 items-center border shadow-2xl relative overflow-hidden"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <View className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full" />
            <View className="absolute -bottom-12 -left-12 w-28 h-28 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full" />

            <View className="absolute top-6 left-8 opacity-25">
              <Sparkles size={20} color="#fbbf24" />
            </View>
            <View className="absolute top-16 right-6 opacity-25">
              <Sparkles size={24} color="#34d399" />
            </View>
            <View className="absolute bottom-28 left-6 opacity-25">
              <Sparkles size={16} color="#fbbf24" />
            </View>

            <View className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/30 items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-900/30">
              <View className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 items-center justify-center">
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={30}
                  color="#10b981"
                />
              </View>
            </View>

            <Text
              className="text-xl font-outfit-black text-center"
              style={{ color: colors.textPrimary }}
            >
              Report Possible Pregnancy
            </Text>

            <View className="mt-3 px-1 items-center flex-row flex-wrap justify-center gap-1.5">
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                Submit possible pregnancy signs for
              </Text>
              <View className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-900/30 px-2.5 py-0.5 rounded-full">
                <Text
                  style={{ fontFamily: "Outfit_800ExtraBold" }}
                  className="text-emerald-700 dark:text-emerald-400 text-xs"
                >
                  #{animal?.earTag || animal?.animalId}
                </Text>
              </View>
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                ? A technician must review this observation before pregnancy is
                confirmed.
              </Text>
            </View>

            {(() => {
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
                  ? calculateTargetCalvingDate(
                      aiDate,
                      animal.species || "Cattle",
                      undefined,
                      animal.breed,
                    )
                  : null;

              const normSpecies = normalizeSpecies(animal.species);
              const profile =
                SPECIES_PROFILES[normSpecies] || SPECIES_PROFILES["Cattle"];
              const gestationDays =
                aiDate && dueDate
                  ? Math.max(1, differenceInCalendarDays(dueDate, aiDate))
                  : profile.avgGestationDays;

              const formattedDueDate = dueDate
                ? dueDate.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Not calculated";

              return (
                <View
                  className="w-full rounded-2xl p-4 mt-6 border items-center flex-row gap-4"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(16, 185, 129, 0.05)"
                      : "#f0fdf4",
                    borderColor: isDark
                      ? "rgba(16, 185, 129, 0.15)"
                      : "#dcfce7",
                  }}
                >
                  <View className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center">
                    <MaterialCommunityIcons
                      name="calendar-heart"
                      size={26}
                      color={isDark ? "#34d399" : "#047857"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-outfit-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Estimated date if pregnancy is confirmed
                    </Text>
                    <Text className="text-[16px] font-outfit-black text-slate-800 dark:text-white mt-0.5">
                      {formattedDueDate}
                    </Text>
                    <Text className="text-[10px] font-outfit-medium text-slate-400 dark:text-slate-500 mt-0.5">
                      Gestation: ~{gestationDays} days ({normSpecies})
                    </Text>
                  </View>
                </View>
              );
            })()}

            <View className="flex-row gap-3 mt-6 w-full">
              <TouchableOpacity
                onPress={() => setCongratsModalVisible(false)}
                disabled={isUpdatingStatus}
                className="flex-1 py-3.5 border rounded-2xl items-center justify-center"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textSecondary,
                  }}
                  className="text-xs"
                >
                  Not now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmPregnancy}
                disabled={isUpdatingStatus}
                className="flex-1 py-3.5 bg-emerald-600 rounded-2xl items-center shadow-md justify-center flex-row gap-2 active:opacity-90"
              >
                {isUpdatingStatus ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="check-bold"
                      size={14}
                      color="white"
                    />
                    <Text className="text-white font-outfit-bold text-xs tracking-wide">
                      Report observation
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reheat Choice Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={reheatModalVisible}
        onRequestClose={() => setReheatModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View
            className="rounded-[30px] w-full p-6 items-center border shadow-2xl relative overflow-hidden"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <View className="absolute -top-12 -right-12 w-28 h-28 bg-orange-500/5 dark:bg-orange-500/10 rounded-full" />
            <View className="absolute -bottom-12 -left-12 w-28 h-28 bg-orange-500/5 dark:bg-orange-500/10 rounded-full" />

            <View className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-950/30 items-center justify-center mb-4 border border-orange-100 dark:border-orange-900/30">
              <View className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/40 items-center justify-center">
                <MaterialCommunityIcons name="fire" size={28} color="#f97316" />
              </View>
            </View>

            <Text
              className="text-xl font-outfit-black text-center"
              style={{ color: colors.textPrimary }}
            >
              Report return-to-heat signs?
            </Text>

            <View className="mt-3 px-1 items-center flex-row flex-wrap justify-center gap-1.5">
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                Did you observe signs of heat in
              </Text>
              <View className="bg-orange-50 dark:bg-orange-950/40 border border-orange-100/50 dark:border-orange-900/30 px-2.5 py-0.5 rounded-full">
                <Text
                  style={{ fontFamily: "Outfit_800ExtraBold" }}
                  className="text-orange-700 dark:text-orange-400 text-xs"
                >
                  #{animal?.earTag || animal?.animalId}
                </Text>
              </View>
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                ? This may indicate a return to heat and needs technician
                review.
              </Text>
            </View>

            <View className="flex-row gap-3 mt-6 w-full">
              <TouchableOpacity
                onPress={() => setReheatModalVisible(false)}
                disabled={isUpdatingStatus}
                className="flex-1 py-3.5 border rounded-2xl items-center justify-center"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: colors.textSecondary,
                  }}
                  className="text-xs"
                >
                  Not now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmReheat}
                disabled={isUpdatingStatus}
                className="flex-1 py-3.5 bg-orange-600 rounded-2xl items-center shadow-md justify-center flex-row gap-2 active:opacity-90"
              >
                {isUpdatingStatus ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={14}
                      color="white"
                    />
                    <Text className="text-white font-outfit-bold text-xs tracking-wide">
                      Report heat signs
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useTheme();
  return (
    <View className="flex-row justify-between items-start gap-4">
      <Text
        style={{ fontFamily: "Outfit_500Medium", color: colors.textMuted }}
        className="text-[13px]"
      >
        {label}
      </Text>
      <Text
        style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}
        className="text-[15px]"
      >
        {value}
      </Text>
    </View>
  );
};

const BasicInfoCell = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useTheme();
  return (
    <View style={{ width: "50%", paddingVertical: 8, paddingRight: 10 }}>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: "Outfit_600SemiBold",
          color: colors.textMuted,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: "Outfit_800ExtraBold",
          color: colors.textPrimary,
          fontSize: 13,
          marginTop: 4,
        }}
      >
        {value || "Not provided"}
      </Text>
    </View>
  );
};

const BasicInfoInput = ({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) => {
  const { colors, isDark } = useTheme();
  return (
    <View className="flex-1">
      <Text
        className="mb-1.5 ml-1"
        style={{
          color: colors.textMuted,
          fontFamily: "Outfit_800ExtraBold",
          fontSize: 10,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        className="min-h-12 rounded-xl border px-4 py-3"
        style={{
          backgroundColor: isDark ? colors.background : "#f8fafc",
          borderColor: colors.border,
          color: colors.textPrimary,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 13,
        }}
      />
    </View>
  );
};

const Divider = () => {
  const { colors } = useTheme();
  return (
    <View
      className="h-[1px] w-full"
      style={{ backgroundColor: colors.border }}
    />
  );
};

interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  color: string;
  bg: string;
  disabled?: boolean;
  disabledReason?: string;
}

const ActionCard = ({
  title,
  subtitle,
  icon,
  onPress,
  color,
  bg,
  disabled,
  disabledReason,
}: ActionCardProps) => {
  const { isDark } = useTheme();
  return (
    <TouchableOpacity
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={`${title}. ${disabled && disabledReason ? disabledReason : subtitle}`}
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
        opacity: disabled ? 0.45 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 80,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.7)",
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
            fontSize: 11,
            lineHeight: 16,
            marginTop: 4,
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
