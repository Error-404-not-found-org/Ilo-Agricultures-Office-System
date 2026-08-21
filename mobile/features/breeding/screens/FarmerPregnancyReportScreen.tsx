import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Camera, Send, X } from "lucide-react-native";
import { toast } from "sonner-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FarmerScreen } from "@/features/farmer-ui/components";
import { useTheme } from "@/lib/theme";
import { safeBack } from "@/utils/navigation";
import { AppPageHeader } from "@/components/AppPageHeader";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { useSubmitFarmerPregnancyReport } from "../hooks/useFarmerPregnancyReport";
import { usePregnancyTrackerQuery } from "../hooks/usePregnancyTracker";
import { FarmerPregnancyReportPayload } from "../services/farmerPregnancyReport.service";

type FarmerPregnancyReportScreenProps = {
  requestId: string;
  animalId: string;
};

type EvidencePhoto = {
  uri: string;
  base64: string;
};

const MAX_EVIDENCE_PHOTOS = 3;

export function FarmerPregnancyReportScreen({
  requestId,
  animalId,
}: FarmerPregnancyReportScreenProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [presentationMode, setPresentationMode] = useState<
    "NEW" | "EXISTING" | "EDITING"
  >("NEW");
  const [notes, setNotes] = useState("");
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const query = usePregnancyTrackerQuery(animalId);
  const aiRequest = query.data?.inseminations?.find(
    (req: any) => req._id === requestId,
  );

  React.useEffect(() => {
    if (!hasInitialized && query.isSuccess && aiRequest) {
      if (aiRequest.farmerPregnancyReport === true) {
        setPresentationMode("EXISTING");
      } else {
        setPresentationMode("NEW");
      }

      if (aiRequest.farmerPregnancyNotes) {
        setNotes(aiRequest.farmerPregnancyNotes);
      }
      if (aiRequest.farmerPregnancyPhotos?.length) {
        setEvidencePhotos(
          aiRequest.farmerPregnancyPhotos.map(
            (storedPhoto: string, index: number) => ({
              uri: storedPhoto,
              base64: storedPhoto,
            }),
          ),
        );
      }

      setHasInitialized(true);
    }
  }, [hasInitialized, query.isSuccess, aiRequest]);

  const cancelEdit = () => {
    if (aiRequest?.farmerPregnancyNotes) {
      setNotes(aiRequest.farmerPregnancyNotes);
    } else {
      setNotes("");
    }
    if (aiRequest?.farmerPregnancyPhotos?.length) {
      setEvidencePhotos(
        aiRequest.farmerPregnancyPhotos.map(
          (storedPhoto: string, index: number) => ({
            uri: storedPhoto,
            base64: storedPhoto,
          }),
        ),
      );
    } else {
      setEvidencePhotos([]);
    }
    setPresentationMode("EXISTING");
  };

  const submitMutation = useSubmitFarmerPregnancyReport();

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
        toast.error(
          "This photo could not be prepared. Please choose it again.",
        );
        return;
      }

      setEvidencePhotos((current) => [
        ...current,
        { uri: result.uri, base64: result.base64 },
      ]);
      toast.success("Photo evidence added.");
    } catch (err) {
      console.error("Photo selection failed:", err);
      toast.error("Failed to add photo.");
    } finally {
      setIsPickingPhoto(false);
      setPhotoModalVisible(false);
    }
  };

  const removePhoto = (index: number) => {
    setEvidencePhotos((current) => current.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (presentationMode === "EXISTING") {
      return;
    }

    if (
      aiRequest?.pregnancyReportVerificationStatus === "pending" ||
      aiRequest?.pregnancyReportVerificationStatus === "accepted" ||
      aiRequest?.pregnancyReportVerificationStatus === "rejected"
    ) {
      toast.error(
        "A report has already been submitted and cannot be updated at this time.",
      );
      return;
    }

    if (notes.trim().length === 0 && evidencePhotos.length === 0) {
      toast.error("Please add notes or a photo to submit your report.");
      return;
    }

    const payload: FarmerPregnancyReportPayload = {
      notes: notes.trim() || undefined,
      evidencePhotos: evidencePhotos.map((p) => p.base64),
    };

    submitMutation.mutate(
      {
        requestId,
        animalId,
        payload,
        idempotencyKey: Date.now().toString(),
      },
      {
        onSuccess: () => {
          toast.success("Pregnancy report submitted for technician review.");
          router.back();
        },
        onError: (err) => {
          console.error("Submission failed:", err);
          toast.error("Failed to submit report. Please try again.");
        },
      },
    );
  };

  const isSubmitting = submitMutation.isPending;
  const isReadOnly = presentationMode === "EXISTING";
  const isMoreInfoRequested =
    aiRequest?.pregnancyReportVerificationStatus === "more_info_requested";

  const screenTitle =
    presentationMode === "EXISTING"
      ? "Pregnancy Report"
      : presentationMode === "EDITING"
        ? "Update Report"
        : "Report Pregnancy";

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader title={screenTitle} onBack={() => safeBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_700Bold",
            fontSize: 18,
            marginBottom: 8,
          }}
        >
          Evidence of Pregnancy
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_500Medium",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          Provide notes and upload photos if available (e.g. positive pregnancy
          test, vet slip, physical changes) so the technician can review and
          approve.
        </Text>

        {presentationMode === "EXISTING" && (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: isMoreInfoRequested
                ? isDark
                  ? "rgba(245, 158, 11, 0.1)"
                  : "#FFFBEB"
                : aiRequest?.pregnancyReportVerificationStatus === "accepted"
                  ? isDark
                    ? "rgba(16, 185, 129, 0.1)"
                    : "#ECFDF5"
                  : isDark
                    ? "rgba(59, 130, 246, 0.1)"
                    : "#EFF6FF",
              borderWidth: 1,
              borderColor: isMoreInfoRequested
                ? isDark
                  ? "rgba(245, 158, 11, 0.2)"
                  : "#FEF3C7"
                : aiRequest?.pregnancyReportVerificationStatus === "accepted"
                  ? isDark
                    ? "rgba(16, 185, 129, 0.2)"
                    : "#D1FAE5"
                  : isDark
                    ? "rgba(59, 130, 246, 0.2)"
                    : "#DBEAFE",
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                color: isMoreInfoRequested
                  ? isDark
                    ? "#FBBF24"
                    : "#D97706"
                  : aiRequest?.pregnancyReportVerificationStatus === "accepted"
                    ? isDark
                      ? "#34D399"
                      : "#059669"
                    : isDark
                      ? "#60A5FA"
                      : "#2563EB",
                fontFamily: "Outfit_600SemiBold",
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              {isMoreInfoRequested
                ? "Update Required"
                : aiRequest?.pregnancyReportVerificationStatus === "accepted"
                  ? "Report Accepted"
                  : aiRequest?.pregnancyReportVerificationStatus === "rejected"
                    ? "Report Rejected"
                    : "Report Submitted"}
            </Text>
            <Text
              style={{
                color: isMoreInfoRequested
                  ? isDark
                    ? "#FDE68A"
                    : "#B45309"
                  : aiRequest?.pregnancyReportVerificationStatus === "accepted"
                    ? isDark
                      ? "#A7F3D0"
                      : "#065F46"
                    : isDark
                      ? "#BFDBFE"
                      : "#1E3A8A",
                fontFamily: "Outfit_500Medium",
                fontSize: 14,
              }}
            >
              {isMoreInfoRequested
                ? "The technician has requested more information or clearer photos. Please update your report below."
                : aiRequest?.pregnancyReportVerificationStatus === "accepted"
                  ? "Your pregnancy report was reviewed and accepted by the technician."
                  : aiRequest?.pregnancyReportVerificationStatus === "rejected"
                    ? "Your pregnancy report was reviewed and rejected by the technician."
                    : "Your pregnancy report is awaiting technician review. You cannot make changes at this time."}
            </Text>
          </View>
        )}

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 15,
              marginBottom: 8,
            }}
          >
            Notes
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe what you observed..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            editable={!isReadOnly && !isSubmitting}
            style={{
              minHeight: 120,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: 16,
              color: colors.textPrimary,
              fontFamily: "Outfit_500Medium",
              fontSize: 15,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ marginBottom: 32 }}>
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
                color: colors.textPrimary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 15,
              }}
            >
              Photos
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
              }}
            >
              {evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {evidencePhotos.map((photo, index) => (
              <View
                key={`${photo.uri}-${index}`}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: "100%", height: "100%" }}
                />
                {!isReadOnly && !isSubmitting && (
                  <TouchableOpacity
                    onPress={() => removePhoto(index)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      borderRadius: 12,
                      padding: 4,
                    }}
                  >
                    <X size={14} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {!isReadOnly && evidencePhotos.length < MAX_EVIDENCE_PHOTOS && (
              <TouchableOpacity
                onPress={() => setPhotoModalVisible(true)}
                disabled={isSubmitting || isPickingPhoto}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: colors.border,
                  borderStyle: "dashed",
                  backgroundColor: colors.card,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {isPickingPhoto ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Camera size={24} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {presentationMode === "EXISTING" && isMoreInfoRequested && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setPresentationMode("EDITING")}
            style={{
              backgroundColor: isDark ? colors.primary : "#00643B",
              paddingVertical: 18,
              borderRadius: 100,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <Text
              style={{
                color: "white",
                fontFamily: "Outfit_700Bold",
                fontSize: 16,
              }}
            >
              Update Report
            </Text>
          </TouchableOpacity>
        )}

        {(presentationMode === "NEW" || presentationMode === "EDITING") && (
          <View style={{ gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={{
                backgroundColor: isDark ? colors.primary : "#00643B",
                paddingVertical: 18,
                borderRadius: 100,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send size={18} color="white" />
                  <Text
                    style={{
                      color: "white",
                      fontFamily: "Outfit_700Bold",
                      fontSize: 16,
                    }}
                  >
                    {presentationMode === "EDITING"
                      ? "Submit Updates"
                      : "Submit Evidence"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {presentationMode === "EDITING" && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={cancelEdit}
                disabled={isSubmitting}
                style={{
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 15,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
