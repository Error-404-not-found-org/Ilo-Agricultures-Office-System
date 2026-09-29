import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Syringe,
  User,
  MapPin,
  ChevronDown,
  Camera,
  X,
  Check,
  AlertCircle,
  Info,
} from "lucide-react-native";
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { getAIEligibility } from "@/lib/reproductionEligibility";
import { pickAttachmentsFromSource } from "@/lib/imagePickerHelper";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { AnimatedBottomSheet } from "@/components/shared/AnimatedBottomSheet";
import { Text as AppText } from "@/components/ui/Text";
import { safeBack } from "@/utils/navigation";
import { useApi } from "@/lib/api";
import {
  useFarmerAnimalsForAiQuery,
  useFarmerSelfProfileQuery,
  useMyAIRequestsQuery,
} from "@/features/farmer-requests/hooks/useFarmerRequestForms";
import { buildFarmerAIRequestPayload } from "@/features/farmer-requests/utils/payloadBuilders";
import {
  getAttachmentAssetKey,
  getAttachmentPayloadError,
  mergeAttachmentImages,
  remainingAttachmentSlots,
  type RequestAttachment,
} from "@/features/farmer-requests/utils/attachmentSafety";
import {
  findActiveAIRequestForAnimal,
  AI_REQUEST_INVALIDATION_KEYS,
  getAIRequestSubmitErrorMessage,
  getAIRequestSubmitState,
  getAIRequestInlineNotice,
  getAnimalPickerAdvisory,
  classifyAnimalSelection,
  checkAIRequestEligibilityForSubmit,
} from "@/features/farmer-requests/utils/aiRequestState";
import { FarmerRequestHeader } from "@/features/farmer-requests/components/FarmerRequestHeader";
import { requestFormStyles } from "@/features/farmer-requests/components/requestFormStyles";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Animal {
  _id: string;
  animalId: string;
  earTag?: string;
  species: string;
  breed: string;
  reproductiveStatus?: string;
  gender?: string;
  birthDate?: string | Date;
  [key: string]: any;
}
interface FarmerProfile {
  _id: string;
  name: string;
  imageUrl?: string;
  phoneNumber?: string;
  address?: {
    houseNumber?: string;
    street: string;
    barangay: string;
    city: string;
    province: string;
  };
  farmLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  animals: Animal[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatAddress = (address?: FarmerProfile["address"]) => {
  if (!address) return "No address on file";
  const parts = [
    address.houseNumber,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ].filter(Boolean);
  return parts.join(", ");
};

interface HeatSign {
  id: string;
  label: string;
  description: string;
  category: "primary" | "secondary_behavioral" | "secondary_physical";
}

const HEAT_SIGNS: HeatSign[] = [
  {
    id: "standing_heat",
    label: "Standing to be Mounted (Standing Heat)",
    description:
      "Cows stands perfectly still when mounted by others. The definitive sign of true peak heat.",
    category: "primary",
  },
  {
    id: "attempt_mount",
    label: "Attempting to Mount Other Cows",
    description: "Frequently tries to mount other female cows.",
    category: "secondary_behavioral",
  },
  {
    id: "restlessness",
    label: "Increased Restlessness and Activity",
    description: "Pacing fence lines, walking more, chewing cud less.",
    category: "secondary_behavioral",
  },
  {
    id: "vocalization",
    label: "Vocalization (Bellowing)",
    description: "Loud, persistent bellowing to call out to potential mates.",
    category: "secondary_behavioral",
  },
  {
    id: "flehmen",
    label: "Flehmen Response and Sniffing",
    description:
      "Actively sniffing other cows' vulva and curling the upper lip.",
    category: "secondary_behavioral",
  },
  {
    id: "grouping",
    label: "Friendly Grouping / Tail-to-Tail",
    description: "Cows in heat tend to stand together in a distinct group.",
    category: "secondary_behavioral",
  },
  {
    id: "mucus_discharge",
    label: "Clear Mucus Discharge (Bleeding out indicator)",
    description: "Clear, viscous stringy mucus trailing from the vulva.",
    category: "secondary_physical",
  },
  {
    id: "swollen_vulva",
    label: "Swollen, Moist, and Red Vulva",
    description: "Vulva looks swollen and lining appears bright red.",
    category: "secondary_physical",
  },
  {
    id: "muddy_flanks",
    label: "Muddy Flanks & Abraded Tailhead",
    description: "Dirt on flanks from being mounted, rubbed tailhead hair.",
    category: "secondary_physical",
  },
  {
    id: "metestrus_bleeding",
    label: "Metestrus Bleeding (Bleeding Out)",
    description:
      "Blood-stained mucus 1-3 days after heat, indicating heat window has closed.",
    category: "secondary_physical",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function RequestAI() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const previousAttemptId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;
  const isReInsemination =
    params.mode === "re-inseminate" && Boolean(previousAttemptId);
  const scrollRef = useRef<ScrollView>(null);
  const submitLockRef = useRef(false);
  const photoPickLockRef = useRef(false);
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : "#00643B";

  // Data states
  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);

  // Form states
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<RequestAttachment[]>([]);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [farmPinModalVisible, setFarmPinModalVisible] = useState(false);
  const [maleModalVisible, setMaleModalVisible] = useState(false);
  const [pregnantModalVisible, setPregnantModalVisible] = useState(false);
  const [pregnantSubmitModalVisible, setPregnantSubmitModalVisible] =
    useState(false);
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [ageCheckReason, setAgeCheckReason] = useState("");
  const { height } = useWindowDimensions();

  const handleToggleSign = (id: string) => {
    setSelectedSigns((prev) => {
      if (prev.includes(id)) {
        return prev.filter((s) => s !== id);
      }
      if (prev.length >= 5) {
        toast.error("You can select a maximum of 5 heat signs.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const queryClient = useQueryClient();
  const api = useApi();
  const [serverConflictRequest, setServerConflictRequest] = useState<any>(null);

  const { data: previousAttemptData, isLoading: loadingPreviousAttempt } =
    useQuery({
      queryKey: ["ai-request", previousAttemptId, "re-insemination-context"],
      queryFn: async () => {
        const response = await api.get(`/ai-request/${previousAttemptId}`);
        return response.data?.data || response.data;
      },
      enabled: isReInsemination,
    });
  const previousAttempt = previousAttemptData;

  const mutation = useOfflineMutation(
    {
      url: isReInsemination
        ? `/ai-request/${previousAttemptId}/re-insemination`
        : "/ai-request",
      method: "POST",
      description: `AI Service Request for ${selectedAnimal?.earTag || "Livestock"}`,
    },
    {
      onSuccess: (result) => {
        if (result.status === "synced") {
          toast.success(
            "AI request submitted. A technician will review your request and schedule the visit.",
            { duration: 4000, position: "top-center" },
          );
        }
        // Reset Form
        setSelectedAnimal(null);
        setComment("");
        setPhotos([]);

        for (const queryKey of AI_REQUEST_INVALIDATION_KEYS) {
          queryClient.invalidateQueries({ queryKey: [...queryKey] });
        }
        safeBack();
      },
      onError: (error: any) => {
        if (error?.response?.data?.code === "ACTIVE_AI_REQUEST_EXISTS") {
          const conflict = error.response.data;
          setServerConflictRequest({
            _id: conflict.existingRequestId,
            animalId: selectedAnimal?._id,
            status: conflict.existingRequestStatus || "pending",
          });
          queryClient.invalidateQueries({
            queryKey: ["farmer", "ai-requests", "active-check"],
          });
          setTimeout(
            () => scrollRef.current?.scrollTo({ y: 500, animated: true }),
            100,
          );
        } else if (error.message !== "OFFLINE_SAVED") {
          toast.error(getAIRequestSubmitErrorMessage(error));
        } else {
          safeBack();
        }
      },
    },
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = mutation.isPending || isSubmitting;

  const showSubmitError = (
    message: string,
    options?: Parameters<typeof toast.error>[1],
  ) => {
    toast.dismiss();
    toast.error(message, options);
  };

  // UI states
  const [animalModalVisible, setAnimalModalVisible] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const { data: profile, isLoading: loadingProfile } =
    useFarmerSelfProfileQuery();

  useEffect(() => {
    if (profile) {
      setFarmer(profile);
    }
  }, [profile]);

  const { data: animalsData, isLoading: isLoadingAnimals } =
    useFarmerAnimalsForAiQuery();
  const { data: aiRequestsData } = useMyAIRequestsQuery();
  const aiRequests = Array.isArray(aiRequestsData)
    ? aiRequestsData
    : aiRequestsData?.data || [];
  const activeRequest = findActiveAIRequestForAnimal(
    serverConflictRequest ? [...aiRequests, serverConflictRequest] : aiRequests,
    selectedAnimal?._id,
  );
  const selectedAnimalEligibility = selectedAnimal
    ? getAIEligibility({
        animal: selectedAnimal,
        activeRequest,
      })
    : null;
  const isSelectedAnimalIneligible = Boolean(
    selectedAnimal &&
      selectedAnimalEligibility &&
      !selectedAnimalEligibility.isEligible &&
      !isReInsemination,
  );
  const submitState = getAIRequestSubmitState({
    hasActiveRequest: Boolean(activeRequest),
    isSubmitting: submitting,
    isIneligible: isSelectedAnimalIneligible,
    ineligibleReason: selectedAnimalEligibility?.reason,
    reproductiveStatus: selectedAnimal?.reproductiveStatus,
  });

  const inlineNotice = getAIRequestInlineNotice({
    activeRequest,
    selectedAnimal,
    eligibility: selectedAnimalEligibility,
  });

  useEffect(() => {
    if (animalsData) {
      const list = Array.isArray(animalsData) ? animalsData : animalsData.data;
      if (Array.isArray(list)) {
        setAnimals(list);
        if (params.animalId) {
          const found = (list as Animal[]).find(
            (a) => a._id === params.animalId,
          );
          if (found) {
            setSelectedAnimal(found);
          }
        }
      }
    }
  }, [animalsData, params.animalId, params.mode]);

  const handleSelectPhoto = async (source: "camera" | "library") => {
    if (photoPickLockRef.current) return;
    if (photos.length >= 5) {
      toast.error("You can attach up to 5 photos only.");
      return;
    }
    photoPickLockRef.current = true;
    try {
      const { images, failedCount } = await pickAttachmentsFromSource(source, remainingAttachmentSlots(photos.length));
      if (images.length) {
        setPhotos((prev) => mergeAttachmentImages(prev, images.map((image) => ({
          uri: image.uri,
          base64: image.base64,
          assetKey: getAttachmentAssetKey({ assetId: image.assetId, uri: image.sourceUri }),
        }))));
      }
      if (failedCount) toast.error(`${failedCount} photo${failedCount === 1 ? "" : "s"} could not be processed. Other photos were kept.`);
    } finally {
      photoPickLockRef.current = false;
    }
  };

  const submitRequest = async () => {
    if (!selectedAnimal) return;

    const base64Photos = photos.map((p) => p.base64);

    const payload = buildFarmerAIRequestPayload(
      selectedAnimal._id,
      base64Photos,
      comment,
      selectedSigns,
      HEAT_SIGNS,
    );

    const payloadError = getAttachmentPayloadError(payload);
    if (payloadError) {
      showSubmitError(payloadError);
      return;
    }

    setIsSubmitting(true);
    try {
      await mutation.mutateAsync(payload);
    } catch {
      // Handled by react-query mutation callbacks
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (skipFarmPinWarning = false) => {
    if (submitLockRef.current || isSubmitting || mutation.isPending) return;

    submitLockRef.current = true;
    toast.dismiss();

    try {
      const hasPhone = farmer?.phoneNumber || profile?.phoneNumber;
      const hasAddress =
        farmer?.address?.barangay || profile?.address?.barangay;
      const farmLocation = farmer?.farmLocation || profile?.farmLocation;
      const hasFarmPin = Boolean(
        farmLocation?.latitude && farmLocation?.longitude,
      );

      if (!hasPhone || !hasAddress) {
        setProfileModalVisible(true);
        return;
      }

      const eligibility = getAIEligibility({
        animal: selectedAnimal,
        activeRequest,
      });

      const submitEligibility = checkAIRequestEligibilityForSubmit({
        selectedAnimal,
        activeRequest,
        eligibility,
      });

      if (!submitEligibility.canSubmit) {
        if (submitEligibility.blockType === "no_animal") {
          showSubmitError(
            submitEligibility.blockReason ||
              "Please select an animal for this request.",
          );
          return;
        }
        if (submitEligibility.blockType === "active_request") {
          scrollRef.current?.scrollTo({ y: 500, animated: true });
          return;
        }
        if (submitEligibility.blockType === "pregnant") {
          setPregnantSubmitModalVisible(true);
          return;
        }
        if (submitEligibility.blockType === "ineligible") {
          setAgeCheckReason(
            submitEligibility.blockReason ||
              "This animal is not currently eligible for insemination.",
          );
          setAgeModalVisible(true);
          return;
        }
        return;
      }

      if (selectedSigns.length === 0) {
        showSubmitError("Please select at least 1 observed heat sign.");
        return;
      }

      if (selectedSigns.length > 5) {
        showSubmitError("You can select a maximum of 5 heat signs.");
        return;
      }

      if (photos.length === 0) {
        showSubmitError(
          "Please attach at least one photo of the animal to help technicians assess the condition.",
        );
        return;
      }

      if (!skipFarmPinWarning && !hasFarmPin) {
        setFarmPinModalVisible(true);
        return;
      }

      await submitRequest();
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <FarmerRequestHeader
        title={
          isReInsemination ? "Request Re-insemination" : "Request AI Service"
        }
        onBack={safeBack}
      />

      {/* Content card */}
      <View
        className="flex-1"
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          backgroundColor: colors.background,
        }}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          <View
            className="rounded-2xl p-4 mb-5 border flex-row items-start"
            style={{
              backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "#f0fdf4",
              borderColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#bbf7d0",
            }}
          >
            <View
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: isDark ? colors.tint : "#dcfce7" }}
            >
              <Syringe size={18} color={primaryColor} />
            </View>
            <View className="flex-1 ml-3">
              <Text
                className="text-sm font-bold"
                style={{ color: colors.textPrimary }}
              >
                Prepare your AI request
              </Text>
              <Text
                className="text-xs mt-1 leading-5"
                style={{ color: colors.textSecondary }}
              >
                Select an eligible female animal and record the heat signs you
                observed. A technician will review your request and schedule the
                visit.
              </Text>
            </View>
          </View>

          {/* ── Farmer Info Card ─────────────────────────────────────────── */}
          <View
            className="rounded-3xl p-5 mb-5 border"
            style={{
              elevation: 2,
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 8,
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            <AppText
              textRole="label"
              style={{ color: colors.textMuted, marginBottom: 16 }}
            >
              Your Information
            </AppText>

            {loadingProfile && !farmer ? (
              <ActivityIndicator color={primaryColor} />
            ) : farmer ? (
              <View className="gap-3">
                {/* Name */}
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center overflow-hidden"
                    style={{ backgroundColor: colors.tint }}
                  >
                    {farmer.imageUrl ? (
                      <Image
                        source={{ uri: farmer.imageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <User size={15} color={primaryColor} />
                    )}
                  </View>
                  <View>
                    <AppText
                      textRole="label"
                      style={{ color: colors.textMuted }}
                    >
                      Full Name
                    </AppText>
                    <AppText
                      textRole="bodyStrong"
                      style={{ color: colors.textPrimary }}
                    >
                      {farmer.name}
                    </AppText>
                  </View>
                </View>

                {/* Address */}
                <View className="flex-row items-start gap-3">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mt-0.5"
                    style={{ backgroundColor: colors.tint }}
                  >
                    <MapPin size={15} color={primaryColor} />
                  </View>
                  <View className="flex-1">
                    <AppText
                      textRole="label"
                      style={{ color: colors.textMuted }}
                    >
                      Address
                    </AppText>
                    <AppText
                      textRole="bodyStrong"
                      style={{ color: colors.textSecondary }}
                    >
                      {formatAddress(farmer.address)}
                    </AppText>
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <AlertCircle size={16} color={colors.error} />
                <AppText textRole="body" style={{ color: colors.error }}>
                  Could not load profile
                </AppText>
              </View>
            )}
          </View>

          {isReInsemination && (
            <View
              className="rounded-3xl p-5 mb-5 border"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <Text
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: colors.textMuted }}
              >
                Previous AI attempt
              </Text>
              {loadingPreviousAttempt ? (
                <ActivityIndicator color={primaryColor} />
              ) : previousAttempt ? (
                <View className="gap-2">
                  <Text
                    className="text-base font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    Attempt #{previousAttempt.attemptNumber || 1}
                  </Text>
                  <Text
                    className="text-sm"
                    style={{ color: colors.textSecondary }}
                  >
                    Service date:{" "}
                    {previousAttempt.inseminationDate
                      ? new Date(
                          previousAttempt.inseminationDate,
                        ).toLocaleDateString()
                      : "Not recorded"}
                  </Text>
                  <Text
                    className="text-sm"
                    style={{ color: colors.textSecondary }}
                  >
                    Outcome: {previousAttempt.outcome || "Pending"}
                  </Text>
                  <Text
                    className="text-sm"
                    style={{ color: colors.textSecondary }}
                  >
                    Confirmed by:{" "}
                    {previousAttempt.outcomeConfirmationSource
                      ? previousAttempt.outcomeConfirmationSource.replaceAll(
                          "_",
                          " ",
                        )
                      : "Not recorded"}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textMuted }}
                  >
                    The new request will be linked as Attempt #
                    {(previousAttempt.attemptNumber || 1) + 1}.
                  </Text>
                </View>
              ) : (
                <Text className="text-sm" style={{ color: colors.error }}>
                  Previous attempt details could not be loaded.
                </Text>
              )}
            </View>
          )}

          {/* ── Animal Picker ─────────────────────────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Select Animal *
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (!isReInsemination) setAnimalModalVisible(true);
            }}
            disabled={isReInsemination}
            className="border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-5"
            style={{
              elevation: 1,
              backgroundColor: colors.card,
              borderColor: selectedAnimal ? primaryColor : colors.border,
            }}
          >
            {selectedAnimal ? (
              <View className="flex-1 mr-3">
                <Text
                  className="text-[15px] font-bold"
                  style={[
                    requestFormStyles.fieldValue,
                    { color: colors.textPrimary },
                  ]}
                >
                  {selectedAnimal.earTag
                    ? `Ear tag ${selectedAnimal.earTag}`
                    : `Registry ID ${selectedAnimal.animalId}`}
                </Text>
                <Text
                  className="text-sm"
                  style={[
                    requestFormStyles.fieldPlaceholder,
                    { color: colors.textSecondary },
                  ]}
                >
                  {selectedAnimal.breed} · {selectedAnimal.species}
                </Text>
                {selectedAnimal.earTag && (
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textMuted }}
                  >
                    Registry ID: {selectedAnimal.animalId}
                  </Text>
                )}
              </View>
            ) : (
              <Text
                className="text-sm"
                style={[
                  requestFormStyles.fieldPlaceholder,
                  { color: colors.textMuted },
                ]}
              >
                Tap to choose an animal
              </Text>
            )}
            <ChevronDown
              size={20}
              color={selectedAnimal ? primaryColor : colors.textMuted}
            />
          </TouchableOpacity>

          {inlineNotice && (
            <View
              className="p-4 rounded-2xl mb-5 flex-row gap-3 border"
              style={{
                backgroundColor:
                  inlineNotice.type === "active_request"
                    ? isDark
                      ? "rgba(245, 158, 11, 0.1)"
                      : "#fffbeb"
                    : inlineNotice.type === "pregnant"
                      ? isDark
                        ? "rgba(147, 51, 234, 0.08)"
                        : "#faf5ff"
                      : isDark
                        ? "rgba(245, 158, 11, 0.08)"
                        : "#fffdfa",
                borderColor:
                  inlineNotice.type === "active_request"
                    ? isDark
                      ? "rgba(245, 158, 11, 0.25)"
                      : "#fde68a"
                    : inlineNotice.type === "pregnant"
                      ? isDark
                        ? "rgba(147, 51, 234, 0.2)"
                        : "#e9d5ff"
                      : isDark
                        ? "rgba(245, 158, 11, 0.18)"
                        : "#fef3c7",
              }}
            >
              {inlineNotice.type === "active_request" ? (
                <AlertCircle size={20} color="#d97706" />
              ) : inlineNotice.type === "pregnant" ? (
                <Info size={20} color={isDark ? "#c084fc" : "#9333ea"} />
              ) : (
                <Info size={20} color={isDark ? "#fcd34d" : "#b45309"} />
              )}
              <View className="flex-1">
                <Text
                  className="font-bold text-sm"
                  style={{ color: colors.textPrimary }}
                >
                  {inlineNotice.title}
                </Text>
                <Text
                  className="text-xs mt-1 leading-relaxed"
                  style={{ color: colors.textSecondary }}
                >
                  {inlineNotice.description}
                </Text>
                {inlineNotice.actionLabel && inlineNotice.actionRoute && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push(inlineNotice.actionRoute as any)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={inlineNotice.actionLabel}
                    className="flex-row items-center self-start mt-3 py-1"
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{
                        color:
                          inlineNotice.type === "active_request"
                            ? "#d97706"
                            : inlineNotice.type === "pregnant"
                              ? isDark
                                ? "#c084fc"
                                : "#9333ea"
                              : isDark
                                ? "#fbbf24"
                                : "#b45309",
                      }}
                    >
                      {inlineNotice.actionLabel}
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={15}
                      color={
                        inlineNotice.type === "active_request"
                          ? "#d97706"
                          : inlineNotice.type === "pregnant"
                            ? isDark
                              ? "#c084fc"
                              : "#9333ea"
                            : isDark
                              ? "#fbbf24"
                              : "#b45309"
                      }
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Observed Heat Signs Checklists ───────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Observed Heat Signs * (Select up to 5)
          </Text>

          {HEAT_SIGNS.map((sign) => {
            const isSelected = selectedSigns.includes(sign.id);
            const isDisabled = !isSelected && selectedSigns.length >= 5;
            return (
              <TouchableOpacity
                key={sign.id}
                disabled={isDisabled}
                onPress={() => handleToggleSign(sign.id)}
                className="flex-row items-start p-4 rounded-2xl mb-3 border"
                style={{
                  backgroundColor: colors.card,
                  borderColor: isSelected ? primaryColor : colors.border,
                  opacity: isDisabled ? 0.4 : 1,
                }}
              >
                <View
                  className="w-5 h-5 rounded-md border items-center justify-center mr-3 mt-0.5"
                  style={{
                    borderColor: isSelected ? primaryColor : colors.textMuted,
                    backgroundColor: isSelected ? primaryColor : "transparent",
                  }}
                >
                  {isSelected && (
                    <Check size={12} color="white" strokeWidth={3} />
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className="font-bold text-sm"
                    style={{ color: colors.textPrimary }}
                  >
                    {sign.label}
                  </Text>
                  <Text
                    className="text-xs mt-1 leading-normal"
                    style={{ color: colors.textMuted }}
                  >
                    {sign.description}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* ── Banners ────────────────────────────────────────────────── */}
          {selectedSigns.includes("metestrus_bleeding") && (
            <View
              className="p-4 rounded-2xl mb-5 flex-row gap-3 border"
              style={{
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
                borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fecaca",
              }}
            >
              <AlertCircle size={20} color="#ef4444" className="mt-0.5" />
              <View className="flex-1">
                <Text className="font-bold text-red-600 text-sm">
                  Metestrus Bleeding Warning
                </Text>
                <Text className="text-xs mt-1 text-red-500 leading-relaxed">
                  Bleeding indicates ovulation has already occurred and the
                  current heat window is closed. Artificial Insemination (AI) is
                  unlikely to succeed. We recommend waiting for the next window,
                  expected in approximately 18-24 days.
                </Text>
              </View>
            </View>
          )}

          {selectedSigns.length > 0 &&
            !selectedSigns.includes("standing_heat") && (
              <View
                className="p-4 rounded-2xl mb-5 flex-row gap-3 border"
                style={{
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.1)"
                    : "#fffbeb",
                  borderColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7",
                }}
              >
                <AlertCircle size={20} color="#f59e0b" className="mt-0.5" />
                <View className="flex-1">
                  <Text className="font-bold text-amber-600 text-sm">
                    Standing Heat Advisory
                  </Text>
                  <Text className="text-xs mt-1 text-amber-500 leading-relaxed">
                    &quot;Standing to be Mounted&quot; is the gold standard
                    indicator of true peak heat. Proceeding with AI based solely
                    on secondary signs might result in a lower success rate.
                  </Text>
                </View>
              </View>
            )}

          {/* ── Photo Attachment ─────────────────────────────────────────── */}
          <View className="flex-row items-center justify-between mb-3 mt-2">
            <Text
              className="text-xs font-bold uppercase tracking-widest ml-1"
              style={[
                requestFormStyles.fieldLabel,
                { color: colors.textMuted },
              ]}
            >
              Attach Photos * {photos.length > 0 ? `(${photos.length}/5)` : ""}
            </Text>
            {photos.length > 0 && photos.length < 5 && (
              <TouchableOpacity
                onPress={() => setPhotoModalVisible(true)}
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: isDark ? "rgba(52,211,153,0.15)" : "#ecfdf5",
                }}
              >
                <Camera size={14} color={primaryColor} />
                <Text
                  className="text-[11px] font-outfit-bold uppercase tracking-wider"
                  style={{ color: primaryColor }}
                >
                  Add Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {photos.length === 0 ? (
            <TouchableOpacity
              onPress={() => setPhotoModalVisible(true)}
              activeOpacity={0.7}
              className="w-full h-32 border-2 border-dashed rounded-3xl items-center justify-center gap-3 mb-6"
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                borderColor: isDark ? colors.border : "#e2e8f0",
              }}
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: isDark ? colors.border : "#f1f5f9" }}
              >
                <Camera size={22} color={colors.textSecondary} />
              </View>
              <Text
                className="text-[13px] font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                Tap to upload up to 5 photos
              </Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-6"
            >
              <View className="flex-row gap-3">
                {photos.map((photo, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: photo.uri }}
                      className="w-28 h-28 rounded-[20px]"
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setPhotos((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="absolute top-2 right-2 bg-black/60 rounded-full w-8 h-8 items-center justify-center backdrop-blur-md border border-white/20"
                    >
                      <X size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* ── Comment Box ──────────────────────────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Additional Comments / Notes (Optional)
          </Text>
          <TextInput
            className="border rounded-2xl px-4 py-4 text-sm mb-6"
            style={[
              requestFormStyles.textInput,
              {
                minHeight: 120,
                textAlignVertical: "top",
                elevation: 1,
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            value={comment}
            onChangeText={setComment}
            onFocus={() => {
              setTimeout(
                () => scrollRef.current?.scrollToEnd({ animated: true }),
                350,
              );
            }}
            placeholder="Describe any other relevant details for the technician..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            blurOnSubmit={false}
          />

          {/* ── Submit Button ─────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => handleSubmit()}
            disabled={submitState.disabled}
            accessibilityRole="button"
            accessibilityLabel="Submit AI service request"
            activeOpacity={0.85}
            className="rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg"
            style={{
              backgroundColor: submitState.disabled
                ? colors.textMuted
                : primaryColor,
              shadowColor: primaryColor,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : submitState.disabled ? (
              <Text className="text-white font-bold text-base">
                {submitState.label}
              </Text>
            ) : (
              <>
                <Syringe size={20} color="white" />
                <Text className="text-white font-bold text-lg">
                  Submit AI Service Request
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Animal Selection Modal ──────────────────────────────────────────── */}
      {/* Animal Modal */}
      <AnimatedBottomSheet
        visible={animalModalVisible}
        onClose={() => setAnimalModalVisible(false)}
        backgroundColor={colors.card}
      >
        <View
          className="px-6 pt-6 pb-0"
          style={{
            backgroundColor: colors.card,
          }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-lg font-bold"
              style={[
                requestFormStyles.modalTitle,
                { color: colors.textPrimary },
              ]}
            >
              Select Animal
            </Text>

            <TouchableOpacity
              onPress={() => setAnimalModalVisible(false)}
              className="p-1 rounded-full"
              style={{
                backgroundColor: isDark ? colors.background : "#f8fafc",
              }}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {isLoadingAnimals ? (
            <View className="items-center py-20">
              <ActivityIndicator color={primaryColor} size="large" />

              <Text
                className="mt-4 font-outfit-bold"
                style={{ color: colors.textMuted }}
              >
                Loading your animals...
              </Text>
            </View>
          ) : animals.length === 0 ? (
            <View className="items-center py-10 gap-3">
              <AlertCircle size={36} color={colors.textMuted} />

              <Text
                className="text-center font-medium"
                style={{ color: colors.textSecondary }}
              >
                You have no registered animals yet.
              </Text>

              <Text
                className="text-xs text-center"
                style={{ color: colors.textMuted }}
              >
                Register an animal before reporting a health concern.
              </Text>
            </View>
          ) : (
            <FlatList
              data={animals}
              keyExtractor={(item) => item._id}
              // IMPORTANT:
              // only the LIST gets capped
              style={{
                maxHeight: height * 0.55,
                flexGrow: 0,
              }}
              contentContainerStyle={{
                paddingBottom: 12,
              }}
              showsVerticalScrollIndicator={animals.length > 4}
              nestedScrollEnabled
              renderItem={({ item }) => {
                const itemActiveReq = findActiveAIRequestForAnimal(
                  serverConflictRequest
                    ? [...aiRequests, serverConflictRequest]
                    : aiRequests,
                  item._id,
                );
                const itemEligibility = getAIEligibility({
                  animal: item,
                  activeRequest: itemActiveReq,
                });
                const isItemIneligible = !itemEligibility.isEligible;

                const handlePressAnimal = () => {
                  const decision = classifyAnimalSelection(
                    item,
                    itemEligibility,
                  );
                  if (!decision.canSelectDirectly) {
                    setAnimalModalVisible(false);
                    if (decision.modalType === "male") {
                      setTimeout(() => setMaleModalVisible(true), 250);
                    } else if (decision.modalType === "age") {
                      setAgeCheckReason(
                        decision.reason ||
                          "This animal has not reached the minimum breeding age yet.",
                      );
                      setTimeout(() => setAgeModalVisible(true), 250);
                    }
                    return;
                  }

                  setSelectedAnimal(item);
                  setAnimalModalVisible(false);
                };

                const isPregnant = item.reproductiveStatus === "Pregnant";
                const isInseminated = item.reproductiveStatus === "Inseminated";

                return (
                  <TouchableOpacity
                    onPress={handlePressAnimal}
                    className="py-4 px-3 border-b flex-row items-center justify-between"
                    style={{
                      borderBottomColor: colors.border,
                      opacity: isItemIneligible ? 0.8 : 1,
                      backgroundColor:
                        selectedAnimal?._id === item._id
                          ? isDark
                            ? "rgba(0, 100, 59, 0.15)"
                            : "#f0fdf4"
                          : undefined,
                      borderRadius: selectedAnimal?._id === item._id ? 16 : 0,
                    }}
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text
                            className="text-[15px] font-bold"
                            style={[
                              requestFormStyles.modalItemTitle,
                              { color: colors.textPrimary },
                            ]}
                          >
                            {item.earTag
                              ? `Ear tag ${item.earTag}`
                              : `Registry ID ${item.animalId}`}
                          </Text>

                          {isPregnant && (
                            <View className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/40">
                              <Text className="text-[10px] font-outfit-bold text-purple-700 dark:text-purple-300">
                                Pregnant
                              </Text>
                            </View>
                          )}

                          {!isPregnant && isInseminated && (
                            <View className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/30">
                              <Text className="text-[10px] font-outfit-bold text-amber-800/90 dark:text-amber-300/90">
                                Inseminated
                              </Text>
                            </View>
                          )}

                          {!isPregnant && !isInseminated && itemActiveReq && (
                            <View className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40">
                              <Text className="text-[10px] font-outfit-bold text-blue-800 dark:text-blue-300">
                                Request Active
                              </Text>
                            </View>
                          )}
                        </View>

                        <View className="flex-row items-center gap-2 mt-1">
                          <Text
                            className="text-xs"
                            style={[
                              requestFormStyles.modalItemMeta,
                              { color: colors.textMuted },
                            ]}
                          >
                            {item.breed} · {item.species}
                          </Text>

                          {!isPregnant && !isInseminated && !itemActiveReq && item.reproductiveStatus && (
                            <View className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800">
                              <Text
                                className="text-[9px] font-outfit-black uppercase"
                                style={{ color: colors.textMuted }}
                              >
                                {item.reproductiveStatus}
                              </Text>
                            </View>
                          )}
                        </View>

                        {item.earTag && (
                          <Text
                            className="text-xs mt-1"
                            style={{ color: colors.textMuted }}
                          >
                            Registry ID: {item.animalId}
                          </Text>
                        )}

                        {isItemIneligible && (
                          <View className="flex-row items-center gap-1.5 mt-1.5">
                            <Info size={12} color={isDark ? "#fde68a" : "#92400e"} />
                            <Text
                              className="text-xs font-medium flex-1"
                              style={{ color: isDark ? "#fde68a" : "#92400e" }}
                            >
                              {getAnimalPickerAdvisory(
                                itemEligibility,
                                Boolean(itemActiveReq),
                              )}
                            </Text>
                          </View>
                        )}
                      </View>

                      {selectedAnimal?._id === item._id && (
                        <Check size={18} color={primaryColor} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </AnimatedBottomSheet>
      {/* Photo Selector Modal */}
      <PhotoOptionModal
        visible={photoModalVisible}
        onClose={() => setPhotoModalVisible(false)}
        onSelectCamera={() => handleSelectPhoto("camera")}
        onSelectLibrary={() => handleSelectPhoto("library")}
      />

      <ConfirmationModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        onConfirm={() => {
          setProfileModalVisible(false);
          router.push("/(farmer)/(tabs)/profile");
        }}
        title="Complete Your Profile"
        message="Please provide your contact number and home address in your profile before requesting AI services."
        confirmText="Go to Profile"
        cancelText="Cancel"
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />

      <ConfirmationModal
        visible={farmPinModalVisible}
        onClose={() => setFarmPinModalVisible(false)}
        onCancel={() => {
          setFarmPinModalVisible(false);
          router.push("/(farmer)/(tabs)/profile");
        }}
        onConfirm={() => {
          setFarmPinModalVisible(false);
          handleSubmit(true);
        }}
        title="Farm Pin Missing"
        message="You can still submit this AI request, but technicians will only see your barangay. Add an exact farm pin so they can find your cattle faster."
        confirmText="Continue Anyway"
        cancelText="Add Farm Pin"
        isDestructive={false}
        icon={<MapPin size={26} color={colors.warning} />}
      />

      <ConfirmationModal
        visible={maleModalVisible}
        onClose={() => setMaleModalVisible(false)}
        onConfirm={() => setMaleModalVisible(false)}
        title="Breeding Service Notice"
        message="This animal is male. Artificial insemination service is dedicated to female breeding animals."
        confirmText="Understood"
        cancelText={null}
        isDestructive={false}
        icon={<Info size={26} color={primaryColor} />}
      />

      <ConfirmationModal
        visible={pregnantModalVisible}
        onClose={() => setPregnantModalVisible(false)}
        onConfirm={() => setPregnantModalVisible(false)}
        title="Active Pregnancy"
        message="There is already an active pregnancy registered for this animal. Technicians will assist with pregnancy monitoring and calving preparation."
        confirmText="Understood"
        cancelText={null}
        isDestructive={false}
        icon={<Info size={26} color="#9333ea" />}
      />

      <ConfirmationModal
        visible={pregnantSubmitModalVisible}
        onClose={() => setPregnantSubmitModalVisible(false)}
        onConfirm={() => setPregnantSubmitModalVisible(false)}
        title="Active Pregnancy"
        message="There is already an active pregnancy registered for this animal. AI service cannot be submitted while pregnant."
        confirmText="Understood"
        cancelText={null}
        isDestructive={false}
        icon={<Info size={26} color="#9333ea" />}
      />

      <ConfirmationModal
        visible={ageModalVisible}
        onClose={() => setAgeModalVisible(false)}
        onConfirm={() => setAgeModalVisible(false)}
        title="Breeding Status Notice"
        message={ageCheckReason}
        confirmText="Understood"
        cancelText={null}
        isDestructive={false}
        icon={<Info size={26} color={primaryColor} />}
      />
    </View>
  );
}
