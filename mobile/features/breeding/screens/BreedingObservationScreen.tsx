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
import { Camera, CheckCircle2, Circle, Send, X } from "lucide-react-native";
import { differenceInCalendarDays, format } from "date-fns";
import { toast } from "sonner-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FarmerScreen, AsyncState } from "@/features/farmer-ui/components";
import { useTheme } from "@/lib/theme";
import { safeBack } from "@/utils/navigation";
import { generatePregnancyTimeline } from "@/lib/cattleCore";
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
    value: "possible_pregnancy",
    title: "Possible pregnancy",
    description:
      "The animal did not return to heat or shows possible pregnancy signs.",
  },
  {
    value: "return_to_heat",
    title: "Returned to heat",
    description:
      "The animal shows heat signs after AI and may need another service.",
  },
  {
    value: "unsure",
    title: "Unsure",
    description: "You observed changes but need technician guidance.",
  },
];

const signsByReport: Record<BreedingObservationType, string[]> = {
  possible_pregnancy: [
    "Did not return to heat",
    "Calmer behavior",
    "Positive milk or blood test",
    "Physical changes observed",
  ],
  return_to_heat: [
    "Standing heat",
    "Clear mucus discharge",
    "Mounting or being mounted",
    "Restlessness or vocalization",
  ],
  unsure: [
    "Behavior changed",
    "Eating pattern changed",
    "Needs technician check",
    "Farmer is unsure",
  ],
};

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

        {/* AI Milestones Card Skeleton */}
        <View
          className="rounded-3xl p-4 border mb-4 gap-3"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <Skeleton width="35%" height={16} radius={4} />
          <Skeleton width="20%" height={12} radius={3} />
          <View className="gap-4 mt-2">
            {[1, 2, 3, 4].map((idx) => (
              <View key={idx} className="flex-row justify-between items-center">
                <Skeleton width="40%" height={12} radius={3} />
                <Skeleton width="30%" height={12} radius={3} />
              </View>
            ))}
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
  requestVerification = false,
}: BreedingObservationScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const animalQuery = usePregnancyTrackerQuery(animalId);
  const submitMutation = useSubmitBreedingObservation();

  const [reportType, setReportType] =
    useState<BreedingObservationType>(defaultReport);
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [verificationRequested, setVerificationRequested] =
    useState(requestVerification);
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

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

  const aiDateValue =
    latestInsemination?.inseminationDate ||
    latestInsemination?.dateOfAI ||
    latestInsemination?.createdAt ||
    animal?.lastInseminationDate;
  const aiDate = aiDateValue ? new Date(aiDateValue) : null;
  const timeline =
    aiDate && animal
      ? generatePregnancyTimeline(
          aiDate,
          animal.species || "Cattle",
          undefined,
          animal.breed,
        )
      : null;
  const dayAfterAi = aiDate
    ? Math.max(0, differenceInCalendarDays(new Date(), aiDate))
    : null;
  const pregnancyReadiness = latestInsemination?.pregnancyReadiness;
  const verificationBlocked = reportType === "return_to_heat"
    ? dayAfterAi !== null && dayAfterAi < 18
    : pregnancyReadiness?.isEligible === false;
  const verificationNotice =
    reportType === "return_to_heat"
      ? `Return-to-heat follow-up is usually useful around Day 18 post-AI. You can still save this observation.`
      : pregnancyReadiness?.reason ||
        "Pregnancy verification is not yet available under the current policy. You can still save this observation.";

  useEffect(() => {
    if (verificationBlocked && verificationRequested) {
      setVerificationRequested(false);
    }
  }, [verificationBlocked, verificationRequested]);

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

    const payload: BreedingObservationPayload = {
      reportType,
      signs: selectedSigns,
      notes,
      evidencePhotos: evidencePhotos.map((photo) => photo.base64),
      verificationRequested,
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
        setVerificationRequested(false);
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
          className="rounded-3xl p-4 border mb-4"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
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
              fontSize: 12,
              marginTop: 4,
            }}
          >
            This report records your observation only. A technician pregnancy
            check is still required to confirm pregnancy.
          </Text>
        </View>

        {timeline ? (
          <View
            className="rounded-3xl p-4 border mb-4"
            style={{
              backgroundColor: isDark ? colors.card : "#ecfdf5",
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_800ExtraBold",
                fontSize: 15,
              }}
            >
              AI Milestones
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {dayAfterAi === null
                ? "AI date unavailable"
                : `Day ${dayAfterAi} after AI`}
            </Text>
            {(
              [
                ["Heat return check", timeline.heatReturnCheckDate],
                ["Ultrasound window", timeline.ultrasoundCheckDate],
                ["Pregnancy check", timeline.palpationCheckDate],
                ["Expected calving", timeline.expectedCalvingDate],
              ] as [string, Date][]
            ).map(([label, value]) => (
              <View
                key={String(label)}
                className="flex-row justify-between mt-3"
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  {label}
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 12,
                  }}
                >
                  {format(value as Date, "MMM d, yyyy")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_900Black",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          What did you observe?
        </Text>
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

        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_900Black",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          Signs observed
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-5">
          {signsByReport[reportType].map((sign) => {
            const active = selectedSigns.includes(sign);
            return (
              <TouchableOpacity
                key={sign}
                onPress={() => toggleSign(sign)}
                className="px-3 py-2 rounded-full border"
                style={{
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? "white" : colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 11,
                  }}
                >
                  {sign}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes for the technician..."
          placeholderTextColor={colors.textMuted}
          className="rounded-2xl p-4 min-h-[110px] border mb-5"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.textPrimary,
            fontFamily: "Outfit_500Medium",
            textAlignVertical: "top",
          }}
        />

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

        <View
          className="rounded-2xl p-4 border flex-row items-center justify-between mb-6"
          style={{
            backgroundColor: colors.card,
            borderColor: verificationBlocked
              ? isDark
                ? "rgba(234, 179, 8, 0.3)"
                : "#fef3c7"
              : colors.border,
          }}
        >
          <View className="flex-1 pr-4">
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_800ExtraBold",
                fontSize: 14,
              }}
            >
              Request technician verification
            </Text>
            {verificationBlocked ? (
              <Text
                style={{
                  color: isDark ? "#fbbf24" : "#b45309",
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
                  marginTop: 3,
                }}
              >
                {verificationNotice} Currently Day {dayAfterAi}.
              </Text>
            ) : (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Adds this to the technician pregnancy check queue.
              </Text>
            )}
          </View>
          <Switch
            value={verificationRequested}
            onValueChange={setVerificationRequested}
            disabled={verificationBlocked}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={submitMutation.isPending || isPickingPhoto}
          className="rounded-2xl py-4 items-center justify-center flex-row"
          style={{
            backgroundColor: colors.primary,
            opacity: submitMutation.isPending || isPickingPhoto ? 0.7 : 1,
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
                Submit Observation
              </Text>
            </>
          )}
        </TouchableOpacity>
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
