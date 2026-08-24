import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera, CheckCircle2, Circle, Send, X, Clock, Info, Check } from "lucide-react-native";
import { differenceInCalendarDays, format } from "date-fns";
import { toast } from "sonner-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FarmerScreen, AsyncState } from "@/features/farmer-ui/components";
import { useTheme } from "@/lib/theme";
import { safeBack } from "@/utils/navigation";
import { usePregnancyTrackerQuery } from "../hooks/usePregnancyTracker";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppPageHeader } from "@/components/AppPageHeader";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import {
  BreedingObservationType,
  BreedingObservationPayload,
} from "../services/breedingObservation.service";
import { useSubmitBreedingObservation } from "../hooks/useBreedingObservation";
import {
  getBreedingObservationDraft,
  getBreedingObservationPresentation,
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
  isBreedingObservationAuthoritativelyReviewed,
} from "../utils/breedingObservationPresentation";

type BreedingObservationScreenProps = {
  animalId: string;
  requestId?: string;
  defaultReport?: BreedingObservationType;
  requestVerification?: boolean;
};

type EvidencePhoto = {
  uri: string;
  base64: string;
};

const MAX_EVIDENCE_PHOTOS = 3;

const reportOptions: {
  value: BreedingObservationType;
  title: string;
  description: string;
}[] = [
  {
    value: "return_to_heat",
    title: "Showing signs of heat",
    description: "I noticed signs that the animal may be in heat again.",
  },
  {
    value: "possible_pregnancy",
    title: "No signs observed",
    description: "I haven't noticed signs of heat.",
  },
  {
    value: "unsure",
    title: "I'm not sure",
    description: "I'm unsure based on what I've observed.",
  },
];

const HEAT_SIGNS = [
  {
    id: "standing_heat",
    label: "Stands when mounted",
    description: "Cows stands perfectly still when mounted by others.",
  },
  {
    id: "mounting_behavior",
    label: "Mounting other cattle",
    description: "Frequently tries to mount other female cows.",
  },
  {
    id: "restlessness",
    label: "Restless / more active than usual",
    description: "Pacing fence lines, walking more, chewing cud less.",
  },
  {
    id: "mucus_discharge",
    label: "Clear mucus discharge",
    description: "Clear, viscous stringy mucus trailing from the vulva.",
  },
  {
    id: "vulvar_swelling",
    label: "Vulva looks swollen or red",
    description: "Vulva looks swollen and lining appears bright red.",
  },
  {
    id: "vocalization",
    label: "More vocal than usual",
    description: "Loud, persistent bellowing.",
  },
];

function BreedingObservationSkeleton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader title="Breeding Observation" onBack={() => safeBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* Animal Info Card Skeleton */}
        <View
          className="rounded-3xl p-4 border mb-4 gap-3"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <Skeleton width="30%" height={18} radius={4} />
          <View className="gap-2">
            <Skeleton width="95%" height={10} radius={2} />
            <Skeleton width="70%" height={10} radius={2} />
          </View>
        </View>



        {/* Observation Selector Title Skeleton */}
        <Skeleton
          width="50%"
          height={20}
          radius={4}
          style={{ marginBottom: 12 }}
        />

        {/* Observation Cards Skeletons */}
        <View className="gap-3 mb-5">
          {[1, 2, 3].map((idx) => (
            <View
              key={idx}
              className="rounded-2xl p-4 border flex-row items-center gap-3"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.border,
                }}
              />
              <View className="flex-1 gap-2">
                <Skeleton width="50%" height={14} radius={3} />
                <Skeleton width="85%" height={10} radius={2} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </FarmerScreen>
  );
}

export function BreedingObservationScreen({
  animalId,
  requestId,
  defaultReport = "unsure",
}: BreedingObservationScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const animalQuery = usePregnancyTrackerQuery(animalId);
  const submitMutation = useSubmitBreedingObservation();

  const animal = animalQuery.data;
  const latestInsemination = useMemo(() => {
    if (!animal?.inseminations?.length) return null;
    if (requestId) {
      return (
        animal.inseminations.find((item: any) => item._id === requestId) ||
        animal.inseminations[0]
      );
    }
    return animal.inseminations[0];
  }, [animal?.inseminations, requestId]);

  const [hasInitialized, setHasInitialized] = useState(false);
  const [presentationMode, setPresentationMode] = useState<"new" | "existing" | "editing">("new");
  const presentation = useMemo(() => getBreedingObservationPresentation(latestInsemination), [latestInsemination]);

  const [reportType, setReportType] = useState<BreedingObservationType>(defaultReport);
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  useEffect(() => {
    if (!hasInitialized && animalQuery.isSuccess && animal) {
      const draft = getBreedingObservationDraft(latestInsemination, defaultReport);
      setPresentationMode(draft.mode === "existing" ? "existing" : "new");
      setReportType(draft.reportType);
      setSelectedSigns(draft.signs);
      setNotes(draft.notes || "");
      setEvidencePhotos(draft.evidencePhotos.map(uri => ({ uri, base64: "" })));
      setHasInitialized(true);
    }
  }, [hasInitialized, animalQuery.isSuccess, animal, latestInsemination, defaultReport]);

  const cancelEdit = () => {
    const draft = getBreedingObservationDraft(latestInsemination, defaultReport);
    setReportType(draft.reportType);
    setSelectedSigns(draft.signs);
    setNotes(draft.notes || "");
    setEvidencePhotos(draft.evidencePhotos.map(uri => ({ uri, base64: "" })));
    setPresentationMode("existing");
  };

  const aiDateValue =
    latestInsemination?.inseminationDate ||
    latestInsemination?.dateOfAI ||
    latestInsemination?.createdAt ||
    animal?.lastInseminationDate;
  const aiDate = aiDateValue ? new Date(aiDateValue) : null;
  const toggleSign = (sign: string) => {
    setSelectedSigns((current) =>
      current.includes(sign)
        ? current.filter((item) => item !== sign)
        : [...current, sign],
    );
  };

  const handleSelectPhoto = async (source: "camera" | "library") => {
    if (evidencePhotos.length >= MAX_EVIDENCE_PHOTOS) {
      toast.error(`You can attach up to ${MAX_EVIDENCE_PHOTOS} photos.`);
      return;
    }

    setIsPickingPhoto(true);
    try {
      const result = await pickImageFromSource(source, { aspect: [4, 3] });
      if (!result) return;

      if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(result.base64)) {
        toast.error("This photo could not be prepared. Please choose it again.");
        return;
      }

      setEvidencePhotos((current) => [
        ...current,
        { uri: result.uri, base64: result.base64 },
      ]);
      toast.success("Photo evidence added.");
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const removeEvidencePhoto = (index: number) => {
    setEvidencePhotos((current) =>
      current.filter((_, photoIndex) => photoIndex !== index),
    );
  };

  const submit = async () => {
    const targetRequestId = requestId || latestInsemination?._id;
    if (!targetRequestId) {
      toast.error("No AI record is available for this observation.");
      return;
    }

    if (reportType === "return_to_heat" && selectedSigns.length === 0) {
      toast.error("Please select at least one observed sign.");
      return;
    }

    const payload: BreedingObservationPayload = {
      reportType,
      signs: reportType === "possible_pregnancy" ? [] : selectedSigns,
      notes,
      evidencePhotos: evidencePhotos.map((photo) => photo.base64),
      verificationRequested: false,
    };

    try {
      await submitMutation.mutateAsync({
        requestId: targetRequestId,
        animalId,
        payload,
      });
      toast.success("Breeding observation saved.");
      router.back();
    } catch (error: any) {
      const code = error?.response?.data?.code;
      if (code === "VERIFICATION_TOO_EARLY") {
        const days = error?.response?.data?.daysSinceAI ?? 0;
        const minimumDays = error?.response?.data?.minimumDays ?? 35;
        toast.error(
          `Verification is available after Day ${minimumDays}. Currently Day ${days}.`,
        );
      } else {
        toast.error(
          error?.response?.data?.message || "Failed to submit observation.",
        );
      }
    }
  };

  if (animalQuery.isLoading) {
    return <BreedingObservationSkeleton />;
  }

  if (animalQuery.isError || !animal) {
    return (
      <FarmerScreen scroll={false}>
        <AppPageHeader title="Breeding Observation" onBack={() => safeBack()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AsyncState
            state="error"
            message="Breeding information could not be loaded."
            onAction={() => animalQuery.refetch()}
          />
        </View>
      </FarmerScreen>
    );
  }

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader title="Breeding Observation" onBack={() => safeBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <View
          className="rounded-3xl p-5 mb-5 border"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-10 h-10 rounded-full items-center justify-center overflow-hidden"
              style={{ backgroundColor: colors.tint }}
            >
              <MaterialCommunityIcons name="cow" size={20} color={colors.primary} />
            </View>
            <View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 16,
                }}
              >
                {animal.earTag || animal.animalId}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {animal.breed} • {animal.species}
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-4 mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
            <View className="flex-1">
              <Text style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Last AI
              </Text>
              <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold", fontSize: 13, marginTop: 2 }}>
                {aiDate ? format(aiDate, "MMM d, yyyy") : "Not recorded"}
              </Text>
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Observation period
              </Text>
              <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold", fontSize: 13, marginTop: 2 }}>
                Heat-return monitoring
              </Text>
            </View>
          </View>
        </View>

        <View
          className="rounded-2xl p-4 mb-5 border flex-row items-start"
          style={{
            backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "#f0fdf4",
            borderColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#bbf7d0",
          }}
        >
          <View
            className="w-8 h-8 rounded-xl items-center justify-center"
            style={{ backgroundColor: isDark ? colors.tint : "#dcfce7" }}
          >
            <Info size={16} color={isDark ? colors.primary : "#00643B"} />
          </View>
          <View className="flex-1 ml-3 mt-1">
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              Check whether you noticed signs of heat after the AI service.
            </Text>
          </View>
        </View>

        {presentationMode === "existing" ? (
          <View className="gap-5 mb-5">
            <View
              className="rounded-2xl p-4 border gap-4"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
            >
              <View className="flex-row items-start gap-3">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: isDark ? "rgba(253, 230, 138, 0.1)" : "#FEF3C7" }}
                >
                  <Clock size={20} color="#B45309" />
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 16 }}>
                    {getBreedingObservationLabel(latestInsemination?.farmerOutcomeReport)}
                  </Text>
                  {latestInsemination?.farmerOutcomeReportedAt && (
                    <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 12, marginTop: 2 }}>
                      Submitted {format(new Date(latestInsemination.farmerOutcomeReportedAt), "MMM d, yyyy")}
                    </Text>
                  )}
                </View>
              </View>

              {latestInsemination?.farmerObservationSigns?.length ? (
                <View className="gap-2 pt-2 border-t" style={{ borderColor: colors.border }}>
                  <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                    Signs reported
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_500Medium", fontSize: 13 }}>
                    {latestInsemination.farmerObservationSigns.map(getBreedingObservationSignLabel).join(" · ")}
                  </Text>
                </View>
              ) : null}

              {latestInsemination?.farmerObservationNotes ? (
                <View className="gap-2 pt-2 border-t" style={{ borderColor: colors.border }}>
                  <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                    Notes
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_500Medium", fontSize: 13 }}>
                    {latestInsemination.farmerObservationNotes}
                  </Text>
                </View>
              ) : null}

              {latestInsemination?.evidencePhotos?.length ? (
                <View className="gap-2 pt-2 border-t" style={{ borderColor: colors.border }}>
                  <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                    Photos attached
                  </Text>
                  <View className="flex-row gap-2 mt-1">
                    {latestInsemination.evidencePhotos.map((url: string, idx: number) => (
                      <Image
                        key={idx}
                        source={{ uri: url }}
                        className="w-16 h-16 rounded-lg bg-gray-100"
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View
                className="flex-row items-start gap-3 p-3 rounded-xl mt-2"
                style={{ backgroundColor: isDark ? "rgba(180, 83, 9, 0.1)" : "#FDF8F3" }}
              >
                <Info size={16} color="#B45309" />
                <View className="flex-1">
                  <Text style={{ color: "#B45309", fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                    Observation submitted
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 11, marginTop: 2 }}>
                    {presentation.farmerMessage}
                  </Text>
                </View>
              </View>
            </View>

            {isBreedingObservationAuthoritativelyReviewed(latestInsemination) ? null : (
              <TouchableOpacity
                onPress={() => setPresentationMode("editing")}
                className="rounded-2xl py-4 items-center justify-center border"
                style={{ borderColor: colors.primary, backgroundColor: "transparent" }}
              >
                <Text style={{ color: colors.primary, fontFamily: "Outfit_700Bold", fontSize: 14 }}>
                  Report a change
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <View className="mb-4">
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 16,
                }}
              >
                What have you noticed since the AI service?
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                Choose the answer that best matches what you've observed.
              </Text>
            </View>
        <View className="gap-3 mb-5">
          {reportOptions.map((option) => {
            const active = reportType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  setReportType(option.value);
                  setSelectedSigns([]);
                }}
                className="rounded-2xl p-4 border flex-row"
                style={{
                  backgroundColor: active
                    ? isDark
                      ? "rgba(16,185,129,0.16)"
                      : "#ecfdf5"
                    : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                {active ? (
                  <CheckCircle2 size={20} color={colors.primary} />
                ) : (
                  <Circle size={20} color={colors.textMuted} />
                )}
                <View className="ml-3 flex-1">
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 14,
                    }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      marginTop: 3,
                      lineHeight: 17,
                    }}
                  >
                    {option.description}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {reportType !== "possible_pregnancy" && (
          <>
            <View className="mb-2">
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                }}
              >
                {reportType === "unsure" ? "Signs observed (optional)" : "Signs observed"}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {reportType === "unsure" ? "Select anything you noticed, even if you're unsure." : "Select everything you noticed."}
              </Text>
            </View>

            <View className="mb-5">
              {HEAT_SIGNS.map((sign) => {
                const isSelected = selectedSigns.includes(sign.id);
                return (
                  <TouchableOpacity
                    key={sign.id}
                    onPress={() => toggleSign(sign.id)}
                    className="flex-row items-start p-4 rounded-2xl mb-3 border"
                    style={{
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <View
                      className="w-5 h-5 rounded-md border items-center justify-center mr-3 mt-0.5"
                      style={{
                        borderColor: isSelected ? colors.primary : colors.textMuted,
                        backgroundColor: isSelected ? colors.primary : "transparent",
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
            </View>
          </>
        )}

        <View className="mb-5">
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted, fontFamily: "Outfit_700Bold" }}
          >
            Additional notes (optional)
          </Text>
          <TextInput
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Add anything else you noticed..."
            placeholderTextColor={colors.textMuted}
            className="rounded-2xl p-4 min-h-[110px] border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: "Outfit_500Medium",
              textAlignVertical: "top",
            }}
          />
        </View>

        <View
          className="rounded-2xl p-4 border mb-5"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
              }}
            >
              Photo evidence
            </Text>
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                }}
              >
                Optional
              </Text>
            </View>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              lineHeight: 17,
              marginTop: 6,
            }}
          >
            Add photos of visible signs to help the technician review your
            observation. Photos do not replace technician verification.
          </Text>

          <View className="flex-row flex-wrap gap-3 mt-4">
            {evidencePhotos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} className="relative">
                <Image
                  source={{ uri: photo.uri }}
                  accessibilityLabel={`Photo evidence ${index + 1}`}
                  className="w-20 h-20 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => removeEvidencePhoto(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo evidence ${index + 1}`}
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.modalBackdrop }}
                >
                  <X size={16} color={colors.onPrimary} />
                </TouchableOpacity>
              </View>
            ))}

            {evidencePhotos.length < MAX_EVIDENCE_PHOTOS ? (
              <TouchableOpacity
                onPress={() => setPhotoModalVisible(true)}
                disabled={isPickingPhoto}
                accessibilityRole="button"
                accessibilityLabel="Add photo evidence"
                className="w-20 h-20 rounded-xl border items-center justify-center"
                style={{
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  opacity: isPickingPhoto ? 0.7 : 1,
                }}
              >
                {isPickingPhoto ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Camera size={20} color={colors.primary} />
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 12,
                        marginTop: 6,
                      }}
                    >
                      Add photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          <Text
            style={{
              color: colors.textMuted,
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              marginTop: 12,
            }}
          >
            {evidencePhotos.length} of {MAX_EVIDENCE_PHOTOS} photos added
          </Text>
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={submitMutation.isPending || isPickingPhoto || (reportType === "return_to_heat" && selectedSigns.length === 0)}
          className="rounded-2xl py-4 items-center justify-center flex-row mb-3"
          style={{
            backgroundColor: colors.primary,
            opacity: submitMutation.isPending || isPickingPhoto || (reportType === "return_to_heat" && selectedSigns.length === 0) ? 0.7 : 1,
          }}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Send size={18} color="white" />
              <Text
                style={{
                  color: "white",
                  fontFamily: "Outfit_900Black",
                  fontSize: 14,
                  marginLeft: 8,
                }}
              >
                {presentationMode === "editing" ? "Save changes" : "Submit Observation"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {presentationMode === "editing" && (
          <TouchableOpacity
            onPress={cancelEdit}
            disabled={submitMutation.isPending}
            className="rounded-2xl py-4 items-center justify-center flex-row"
            style={{
              backgroundColor: "transparent",
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        )}
          </>
        )}
      </ScrollView>

      <PhotoOptionModal
        visible={photoModalVisible}
        onClose={() => setPhotoModalVisible(false)}
        onSelectCamera={() => handleSelectPhoto("camera")}
        onSelectLibrary={() => handleSelectPhoto("library")}
        title="Add photo evidence"
      />
    </FarmerScreen>
  );
}
