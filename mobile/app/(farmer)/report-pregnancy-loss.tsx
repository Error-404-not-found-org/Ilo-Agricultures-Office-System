import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  X,
  Send,
  Info,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppPageHeader } from "@/components/AppPageHeader";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { toast } from "sonner-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import {
  OfflineMutationLifecycleState,
  useOfflineMutation,
} from "@/hooks/useOfflineMutation";
import { animalKeys, breedingKeys, notificationKeys, taskKeys } from "@/lib/queryKeys";
import { farmerDashboardQueryKeys } from "@/features/farmer-dashboard/hooks/useFarmerDashboard";
import { usePregnancyLossReportsQuery } from "@/features/breeding/hooks/usePregnancyTracker";
import {
  findActivePregnancyLossReport,
  isPregnancyLossDuplicateSubmissionBlocked,
  reconcilePregnancyLossSubmission,
  evaluatePregnancyLossSubmissionRecovery,
  getFarmerPregnancyLossPresentation,
} from "@/features/breeding/utils/pregnancyLossWorkflow";

export default function ReportPregnancyLossScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const api = useApi();
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : "#00643B";

  const animalId = params.animalId as string;
  const pregnancyId = params.pregnancyId as string;
  const earTag = (params.earTag as string) || "N/A";

  const lossReportsQuery = usePregnancyLossReportsQuery(animalId);
  const activeReport = findActivePregnancyLossReport(
    lossReportsQuery.data,
    pregnancyId,
  );
  const activePresentation = activeReport
    ? getFarmerPregnancyLossPresentation(activeReport)
    : null;
  const isDuplicateBlocked = isPregnancyLossDuplicateSubmissionBlocked(
    lossReportsQuery.data,
    pregnancyId,
  );

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<OfflineMutationLifecycleState>("idle");
  const submitLockRef = useRef(false);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: animalKeys.detail(animalId) });
    queryClient.invalidateQueries({ queryKey: breedingKeys.tracker(animalId) });
    queryClient.invalidateQueries({ queryKey: ["animals", animalId, "pregnancy-loss-reports"] });
    queryClient.invalidateQueries({ queryKey: farmerDashboardQueryKeys.milestones });
    queryClient.invalidateQueries({ queryKey: farmerDashboardQueryKeys.myAnimals });
    queryClient.invalidateQueries({ queryKey: farmerDashboardQueryKeys.activityFeed });
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
  };

  const reportMutation = useOfflineMutation(
    {
      url: `/animals/${animalId}/report-pregnancy-loss`,
      method: "POST",
      description: `Pregnancy loss report for ${earTag}`,
      reconcileOnTimeout: true,
      reconcileServerState: (apiInstance) =>
        reconcilePregnancyLossSubmission({
          api: apiInstance,
          animalId,
          pregnancyId,
        }),
    },
    {
      onLifecycleStateChange: setSubmissionState,
      onSuccess: (result) => {
        if (result.status === "synced") {
          toast.success("Pregnancy loss report submitted. A technician will review your report.");
          invalidateQueries();
          router.back();
        }
      },
      onError: async (error: any) => {
        const recovery = await evaluatePregnancyLossSubmissionRecovery({
          api,
          animalId,
          pregnancyId,
          error,
        });

        if (recovery.recoveredAsSuccess) {
          toast.success(recovery.message || "Pregnancy loss report submitted.");
          invalidateQueries();
          router.back();
          return;
        }

        if (recovery.shouldKeepLocked) {
          toast.info(recovery.message || "We're checking whether your report was received. Please wait a moment.");
          submitLockRef.current = false;
          setIsSubmitting(false);
          setSubmissionState("idle");
          return;
        }

        submitLockRef.current = false;
        setIsSubmitting(false);
        setSubmissionState("idle");
        toast.error(recovery.message || "Failed to submit pregnancy loss report");
      },
    },
  );

  const handleAddPhoto = async (source: "camera" | "library") => {
    if (photos.length >= 3) {
      toast.error("You can attach up to 3 photos.");
      return;
    }
    const result = await pickImageFromSource(source, { aspect: [4, 3] });
    if (result) {
      setPhotos([...photos, { uri: result.uri, base64: result.base64 }]);
      toast.success(`Photo ${photos.length + 1} attached.`);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const updated = [...photos];
    updated.splice(index, 1);
    setPhotos(updated);
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (isDuplicateBlocked) {
      return toast.info("A pregnancy loss report is already awaiting technician review.");
    }
    toast.dismiss();

    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() > Date.now()) {
      return toast.error("Enter a valid observation date that is not in the future.");
    }

    if (!notes.trim() || notes.trim().length < 5) {
      return toast.error("Please describe what you observed (at least 5 characters).");
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await reportMutation.mutateAsync({
        observationDate: date,
        notes: notes.trim(),
        evidencePhotos: photos.map((p) => p.base64),
      });
    } catch (error: any) {
      const recovery = await evaluatePregnancyLossSubmissionRecovery({
        api,
        animalId,
        pregnancyId,
        error,
      });

      if (recovery.recoveredAsSuccess) {
        toast.success(recovery.message || "Pregnancy loss report submitted.");
        invalidateQueries();
        router.back();
        return;
      }

      if (recovery.shouldKeepLocked) {
        toast.info(recovery.message || "We're checking whether your report was received. Please wait a moment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submissionLocked =
    submitLockRef.current ||
    isSubmitting ||
    reportMutation.isPending ||
    ["submitting", "reconciling", "replaying", "queued"].includes(submissionState);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <AppPageHeader
        title="Report Pregnancy Loss"
        onBack={() => router.back()}
        rightAction={
          earTag && earTag !== "N/A" ? (
            <View
              className="px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: isDark ? "rgba(0, 100, 59, 0.15)" : "#ecfdf5",
                borderColor: isDark ? colors.primary : "#059669",
              }}
            >
              <Text
                className="text-[10px] font-black uppercase tracking-wider"
                style={{ color: isDark ? colors.primary : "#059669" }}
              >
                Dam: {earTag}
              </Text>
            </View>
          ) : undefined
        }
      />

      {activeReport ? (
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 160, paddingTop: 24 }}
        >
          <View
            className="p-6 rounded-[28px] border"
            style={{
              backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#f8fafc",
              borderColor: isDark ? "#334155" : "#e2e8f0",
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <AlertTriangle
                  size={18}
                  color={
                    activeReport.status === "needs_visit"
                      ? isDark
                        ? "#fbbf24"
                        : "#d97706"
                      : isDark
                        ? "#60a5fa"
                        : "#2563eb"
                  }
                />
                <Text
                  className="font-bold text-xs uppercase tracking-wider"
                  style={{
                    color:
                      activeReport.status === "needs_visit"
                        ? isDark
                          ? "#fbbf24"
                          : "#b45309"
                        : isDark
                          ? "#93c5fd"
                          : "#1d4ed8",
                  }}
                >
                  Pregnancy Loss Report
                </Text>
              </View>
              <View
                className="px-2.5 py-1 rounded-full border"
                style={{
                  backgroundColor:
                    activeReport.status === "needs_visit"
                      ? isDark
                        ? "rgba(245, 158, 11, 0.25)"
                        : "#fef3c7"
                      : isDark
                        ? "rgba(59, 130, 246, 0.25)"
                        : "#dbeafe",
                  borderColor:
                    activeReport.status === "needs_visit"
                      ? isDark
                        ? "#f59e0b"
                        : "#d97706"
                      : isDark
                        ? "#3b82f6"
                        : "#2563eb",
                }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color:
                      activeReport.status === "needs_visit"
                        ? isDark
                          ? "#fbbf24"
                          : "#92400e"
                        : isDark
                          ? "#60a5fa"
                          : "#1e40af",
                  }}
                >
                  {activePresentation?.badgeLabel ||
                    (activeReport.status === "needs_visit"
                      ? "Follow-up needed"
                      : "Awaiting review")}
                </Text>
              </View>
            </View>

            <Text
              className="text-base font-black mb-2"
              style={{ color: colors.textPrimary }}
            >
              Pregnancy Loss Report
            </Text>

            <Text
              className="text-xs font-medium leading-5 mb-4"
              style={{ color: colors.textSecondary }}
            >
              {activePresentation?.explanation}
            </Text>

            {activePresentation?.noticedDate ? (
              <View
                className="p-3.5 rounded-2xl mb-3"
                style={{ backgroundColor: isDark ? colors.card : "white" }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: colors.textMuted }}
                >
                  {activePresentation.noticedDateLabel}
                </Text>
                <Text
                  className="text-xs font-bold mt-0.5"
                  style={{ color: colors.textPrimary }}
                >
                  {activePresentation.noticedDate}
                </Text>
              </View>
            ) : null}

            {activePresentation?.reportSentDate ? (
              <View
                className="p-3.5 rounded-2xl mb-3"
                style={{ backgroundColor: isDark ? colors.card : "white" }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: colors.textMuted }}
                >
                  {activePresentation.reportSentLabel}
                </Text>
                <Text
                  className="text-xs font-bold mt-0.5"
                  style={{ color: colors.textPrimary }}
                >
                  {activePresentation.reportSentDate}
                </Text>
              </View>
            ) : null}

            {activeReport.notes ? (
              <View
                className="p-3.5 rounded-2xl mb-4"
                style={{ backgroundColor: isDark ? colors.card : "white" }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: colors.textMuted }}
                >
                  Your Notes
                </Text>
                <Text
                  className="text-xs font-medium leading-5"
                  style={{ color: colors.textPrimary }}
                >
                  {activeReport.notes}
                </Text>
              </View>
            ) : null}

            {activePresentation?.technicianNote ? (
              <View
                className="p-3.5 rounded-2xl mb-4"
                style={{ backgroundColor: isDark ? colors.card : "white" }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: colors.textMuted }}
                >
                  {activePresentation.technicianNoteLabel}
                </Text>
                <Text
                  className="text-xs font-medium leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  {activePresentation.technicianNote}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={() => router.back()}
              className="w-full h-14 rounded-2xl items-center justify-center border mt-2"
              style={{
                backgroundColor: primaryColor,
                borderColor: primaryColor,
              }}
              activeOpacity={0.8}
            >
              <Text className="text-white font-black text-xs uppercase tracking-wider">
                Back to Reproductive Status
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 160 }}
          >
            {/* Intro Guidance Banner */}
            <View
              className="mt-6 p-4 rounded-3xl border flex-row items-start"
              style={{
                backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#fffbeb",
                borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a",
              }}
            >
              <AlertTriangle
                size={20}
                color={isDark ? "#fbbf24" : "#d97706"}
                style={{ marginTop: 2 }}
              />
              <View className="ml-3 flex-1">
                <Text
                  className="text-xs font-bold leading-5"
                  style={{ color: isDark ? "#fef3c7" : "#92400e" }}
                >
                  Tell us what you noticed.
                </Text>
                <Text
                  className="text-[11px] font-medium leading-4 mt-0.5"
                  style={{ color: isDark ? "#fde68a" : "#b45309" }}
                >
                  Your report will be reviewed before the pregnancy status is updated. Pregnancy monitoring will continue until the report is reviewed.
                </Text>
              </View>
            </View>

            {/* Observation Date */}
            <View className="mt-8">
              <Text
                className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2"
                style={{ color: colors.textMuted }}
              >
                Observation Date
              </Text>
              <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-outfit-medium mb-2 ml-1">
                When did you observe the signs or event?
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setTempDate(date ? new Date(`${date}T00:00:00`) : new Date());
                  setShowDatePicker(true);
                }}
                className="border rounded-2xl px-4 py-4 flex-row items-center"
                style={{ backgroundColor: colors.card, borderColor: colors.border }}
              >
                <Calendar size={18} color={primaryColor} />
                <Text
                  className="flex-1 ml-3 font-bold text-sm"
                  style={{ color: colors.textPrimary }}
                >
                  {date
                    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Select date"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* What Did You Notice? */}
            <View className="mt-6">
              <Text
                className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2"
                style={{ color: colors.textMuted }}
              >
                What Did You Notice?
              </Text>
              <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-outfit-medium mb-2 ml-1">
                Describe any signs or changes you observed.
              </Text>
              <TextInput
                className="border rounded-[24px] p-4 text-xs min-h-[140px]"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                }}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholder="e.g. Observed blood or discharge, saw expelled fetus/tissue, animal returned to heat..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {/* Evidence Photos (Optional, max 3) */}
            <View className="mt-6">
              <View className="flex-row justify-between items-center ml-1 mb-2">
                <Text
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: colors.textMuted }}
                >
                  Evidence Photos (Optional)
                </Text>
                <Text className="text-[10px] font-bold" style={{ color: colors.textMuted }}>
                  {photos.length}/3 photos
                </Text>
              </View>
              <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-outfit-medium mb-3 ml-1">
                Attach clear photos of any expelled tissue, discharge, or observations.
              </Text>

              {/* Photo Thumbnails */}
              {photos.length > 0 && (
                <View className="flex-row flex-wrap gap-3 mb-4">
                  {photos.map((photo, idx) => (
                    <View
                      key={idx}
                      className="rounded-2xl overflow-hidden relative border"
                      style={{
                        width: 100,
                        height: 100,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Image
                        source={{ uri: photo.uri }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full items-center justify-center"
                        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                      >
                        <X size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Photo Add Buttons */}
              {photos.length < 3 && (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => handleAddPhoto("camera")}
                    className="flex-1 py-3.5 rounded-2xl border flex-row justify-center items-center gap-2"
                    style={{
                      backgroundColor: isDark ? colors.card : "#f8fafc",
                      borderColor: colors.border,
                    }}
                  >
                    <Camera size={16} color={primaryColor} />
                    <Text className="text-xs font-bold" style={{ color: primaryColor }}>
                      Take Photo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAddPhoto("library")}
                    className="flex-1 py-3.5 rounded-2xl border flex-row justify-center items-center gap-2"
                    style={{
                      backgroundColor: isDark ? colors.card : "#f8fafc",
                      borderColor: colors.border,
                    }}
                  >
                    <ImageIcon size={16} color={primaryColor} />
                    <Text className="text-xs font-bold" style={{ color: primaryColor }}>
                      Gallery
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Floating Save Button */}
          <View
            style={{
              paddingBottom: Math.max(insets.bottom + 16, 24),
              backgroundColor: colors.card,
              borderTopColor: colors.border,
            }}
            className="px-6 pt-4 border-t absolute bottom-0 left-0 right-0"
          >
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submissionLocked}
              className="h-16 rounded-[24px] flex-row items-center justify-center gap-3"
              style={{
                backgroundColor: submissionLocked ? "#34d399" : primaryColor,
                elevation: 8,
                shadowColor: primaryColor,
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              {submissionLocked ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send size={20} color="white" />
                  <Text className="text-white font-black text-base uppercase tracking-widest">
                    Submit Pregnancy Loss Report
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            if (Platform.OS === "android") {
              if (event.type === "set" && selectedDate) {
                setShowDatePicker(false);
                setTempDate(selectedDate);
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                const day = String(selectedDate.getDate()).padStart(2, "0");
                setDate(`${year}-${month}-${day}`);
              } else if (event.type === "dismissed") {
                setShowDatePicker(false);
              }
            } else if (Platform.OS === "ios" && selectedDate) {
              setTempDate(selectedDate);
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
              const day = String(selectedDate.getDate()).padStart(2, "0");
              setDate(`${year}-${month}-${day}`);
            }
          }}
        />
      )}
      {Platform.OS === "ios" && showDatePicker && (
        <View
          style={{
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            flexDirection: "row",
            justifyContent: "flex-end",
            padding: 16,
          }}
        >
          <TouchableOpacity onPress={() => setShowDatePicker(false)}>
            <Text style={{ color: primaryColor, fontWeight: "bold" }}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
