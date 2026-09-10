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
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Plus,
  Trash2,
  ClipboardCheck,
  Palette,
  Hash,
  Info,
  Camera,
  Image as ImageIcon,
  X,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { toast } from "sonner-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme";
import {
  OfflineMutationLifecycleState,
  useOfflineMutation,
} from "@/hooks/useOfflineMutation";
import { animalKeys, animalRecordKeys, breedingKeys, notificationKeys, taskKeys, userKeys } from "@/lib/queryKeys";
import { farmerDashboardQueryKeys, useFarmerDashboardQueries } from "@/features/farmer-dashboard/hooks/useFarmerDashboard";
import { useUser } from "@clerk/clerk-expo";
import { format } from "date-fns";
import { usePregnancyTrackerQuery } from "@/features/breeding/hooks/usePregnancyTracker";
import EarTagGenerator from "@/components/EarTagGenerator";
import {
  getCalvingTooEarlyErrorMessage,
  getFarmerCalvingReadinessPresentation,
  omitInapplicableCalvingEase,
  validateCalvingOutcomeVitality,
} from "@/features/breeding/utils/calvingUiSemantics";

interface CalfEntry {
  sex: "M" | "F";
  earTag: string;
  color: string;
  imageUri?: string;
  imageBase64?: string;
  isLiving?: boolean;
  isCustomColor?: boolean;
}

const CALF_COLOR_OPTIONS = [
  'Black',
  'Brown',
  'White',
  'Red',
  'Gray',
  'Spotted',
  'Mixed',
];

export default function RecordCalving() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const { user } = useUser();
  const { myAnimalsQuery } = useFarmerDashboardQueries();

  const farmerName = user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.username || "";
  const animalCount = myAnimalsQuery.data?.length || 0;

  const primaryColor = isDark ? colors.primary : '#00643B';

  const pregnancyId = params.pregnancyId as string;
  const animalId = params.animalId as string;
  const earTag = params.earTag as string;
  const taskId = params.taskId as string;

  const { data: animalData, refetch: refetchAnimalData } = usePregnancyTrackerQuery(animalId);
  const [submissionError, setSubmissionError] = useState("");

  const activePregnancy = animalData?.inseminations
    ?.map((item: any) => item.pregnancy)
    .find(
      (p: any) =>
        p &&
        (pregnancyId
          ? String(p._id) === String(pregnancyId) || String(p.id) === String(pregnancyId)
          : true) &&
        p?.pregnancyDiagnosis?.result === "Pregnant" &&
        !["completed", "lost"].includes(p?.cycleStatus),
    ) ||
    animalData?.inseminations
      ?.map((item: any) => item.pregnancy)
      .find(
        (p: any) =>
          p &&
          p?.pregnancyDiagnosis?.result === "Pregnant" &&
          !["completed", "lost"].includes(p?.cycleStatus),
      );

  const readiness = activePregnancy?.calvingReadiness;
  const farmerReadiness = getFarmerCalvingReadinessPresentation(readiness);
  const isReadinessUnavailable = Boolean(!readiness || typeof readiness.minimumDays !== "number");
  const isCalvingBlocked = Boolean(isReadinessUnavailable || readiness?.isEligible === false);
  const hasActiveConfirmedPregnancy = Boolean(
    activePregnancy &&
    activePregnancy?.pregnancyDiagnosis?.result === "Pregnant" &&
    !["completed", "lost"].includes(activePregnancy?.cycleStatus),
  );

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [calvingEase, setCalvingEase] = useState("Normal");
  const [outcome, setOutcome] = useState<"live_birth" | "mixed" | "stillbirth">("live_birth");
  const [technicianNote, setTechnicianNote] = useState("");
  const [calves, setCalves] = useState<CalfEntry[]>([
    { sex: "F", earTag: "", color: "", isLiving: true },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<OfflineMutationLifecycleState>("idle");
  const submitLockRef = useRef(false);
  const isLiveBirth = outcome === "live_birth";
  const isMixedInvalid =
    outcome === "mixed" &&
    (calves.filter((c) => c.isLiving !== false).length < 1 ||
      calves.filter((c) => c.isLiving === false).length < 1);


  const calvingMutation = useOfflineMutation(
    {
      url: "/animals/record-calving",
      method: "POST",
      description: `Farmer calving record for ${earTag || "animal"}`,
      reconcileOnTimeout: true,
    },
    {
      onLifecycleStateChange: setSubmissionState,
      onSuccess: (result) => {
        if (result.status === "synced") {
          toast.success(
            outcome === "stillbirth"
              ? "Stillbirth record saved."
              : "Calving recorded! Living offspring were added to the registry."
          );
          queryClient.invalidateQueries({ queryKey: animalKeys.mine() });
          queryClient.invalidateQueries({ queryKey: animalKeys.detail(animalId) });
          queryClient.invalidateQueries({ queryKey: animalKeys.timeline(animalId) });
          queryClient.invalidateQueries({ queryKey: breedingKeys.tracker(animalId) });
          queryClient.invalidateQueries({ queryKey: farmerDashboardQueryKeys.milestones });
          queryClient.invalidateQueries({ queryKey: farmerDashboardQueryKeys.myAnimals });
          queryClient.invalidateQueries({ queryKey: farmerDashboardQueryKeys.activityFeed });
          queryClient.invalidateQueries({ queryKey: animalRecordKeys.records(animalId) });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
          queryClient.invalidateQueries({ queryKey: userKeys.activity() });
          queryClient.invalidateQueries({ queryKey: taskKeys.all });
          router.back();
        }
      },
      onError: (error: any) => {
        submitLockRef.current = false;
        setIsSubmitting(false);
        setSubmissionState("idle");
        const errorCode = error.response?.data?.code;
        if (errorCode === "PREGNANCY_LOSS_REQUIRES_REVIEW") {
          toast.error("Pregnancy loss cannot be recorded directly as a delivery. Redirecting to Pregnancy Loss Report...");
          router.replace({
            pathname: "/(farmer)/report-pregnancy-loss" as any,
            params: {
              animalId,
              pregnancyId,
              earTag,
            },
          });
          return;
        }
        if (errorCode === "CALVING_TOO_EARLY") {
          const details = error.response?.data?.details;
          const errorMessage = getCalvingTooEarlyErrorMessage(
            details,
            error.response?.data?.message,
          );
          setSubmissionError(errorMessage);
          toast.error(errorMessage);
          return;
        }
        const defaultError = error.response?.data?.message || "Failed to record calving";
        setSubmissionError(defaultError);
        toast.error(defaultError);
      },
    },
  );

  const addCalf = () => {
    if (calves.length >= 5) {
      return toast.error("Maximum 5 calves per event");
    }
    setCalves([...calves, { sex: "F", earTag: "", color: "", isLiving: outcome !== "stillbirth" }]);
  };

  const selectOutcome = (value: string) => {
    const nextOutcome = value as "live_birth" | "mixed" | "stillbirth";
    setOutcome(nextOutcome);
    if (calves.length === 0) {
      setCalves([{ sex: "F", earTag: "", color: "", isLiving: nextOutcome !== "stillbirth" }]);
    } else {
      setCalves(
        calves.map((calf, index) => ({
          ...calf,
          isLiving: nextOutcome === "live_birth" ? true : nextOutcome === "stillbirth" ? false : index === 0,
        }))
      );
    }
  };

  const removeCalf = (index: number) => {
    if (calves.length === 1) return;
    const newCalves = [...calves];
    newCalves.splice(index, 1);
    setCalves(newCalves);
  };

  const updateCalf = (index: number, field: keyof CalfEntry, value: any) => {
    const newCalves = [...calves];
    (newCalves[index] as any)[field] = value;
    setCalves(newCalves);
  };

  const handleSelectCalfPhoto = async (index: number, source: "camera" | "library") => {
    const result = await pickImageFromSource(source, { aspect: [4, 3] });
    if (result) {
      const newCalves = [...calves];
      newCalves[index].imageUri = result.uri;
      newCalves[index].imageBase64 = result.base64;
      setCalves(newCalves);
      toast.success(`Photo attached to Calf #${index + 1}`);
    }
  };

  const removeCalfImage = (index: number) => {
    const newCalves = [...calves];
    newCalves[index].imageUri = undefined;
    newCalves[index].imageBase64 = undefined;
    setCalves(newCalves);
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    toast.dismiss();
    setSubmissionError("");
    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() > Date.now()) {
      return toast.error("Enter a valid calving date that is not in the future.");
    }

    const vitalityValidation = validateCalvingOutcomeVitality({ outcome, calves });
    if (!vitalityValidation.isValid && vitalityValidation.error) {
      return toast.error(vitalityValidation.error);
    }

    const livingCalves = calves.filter((calf) => calf.isLiving !== false);
    for (let i = 0; i < livingCalves.length; i++) {
      if (!livingCalves[i].earTag?.trim()) {
        return toast.error(`Please provide an Ear Tag for Calf #${i + 1}`);
      }
    }
    if (livingCalves.length) {
      const normalizedTags = livingCalves.map((calf) => calf.earTag.trim().toLowerCase());
      if (new Set(normalizedTags).size !== normalizedTags.length) {
        return toast.error("Each living calf must have a unique ear tag.");
      }
    }


    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await calvingMutation.mutateAsync(omitInapplicableCalvingEase({
        pregnancyId,
        animalId,
        date,
        calvingEase,
        outcome,
        numberOfCalves: calves.length,
        calves: calves.filter((c) => c.isLiving !== false).map((c) => ({
          sex: c.sex,
          earTag: c.earTag,
          color: c.color,
          imageUrl: c.imageBase64 || "",
        })),
        nonLivingCalves: calves.filter((c) => c.isLiving === false).map((c) => ({
          sex: c.sex, earTag: c.earTag, color: c.color,
        })),
        technicianNote,
        taskId: taskId || undefined,
      }));
    } catch {
      // Handled by mutation callbacks.
    } finally {
      setIsSubmitting(false);
    }
  };

  const submissionLocked =
    submitLockRef.current ||
    isSubmitting ||
    calvingMutation.isPending ||
    ["submitting", "reconciling", "replaying", "queued"].includes(
      submissionState,
    );
  const submissionStatusMessage =
    submissionState === "queued"
      ? "Submission saved safely and queued. It will continue with the same operation ID."
      : ["reconciling", "replaying"].includes(submissionState)
        ? "Checking submission status…"
        : submissionState === "submitting"
          ? "Submitting calving record…"
          : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{ paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }}
        className="border-b"
      >
        <View className="px-6 py-4 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}
          >
            <ArrowLeft size={20} color={primaryColor} />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-lg font-black" style={{ color: colors.textPrimary }}>
              Record Calving
            </Text>
            <Text className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: colors.textMuted }}>
              Mother: {earTag || "N/A"}
            </Text>
          </View>
          <View className="w-10" />
        </View>
      </View>

      {isCalvingBlocked ? (
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 40,
            paddingTop: 32,
          }}
        >
          {isReadinessUnavailable ? (
            <View
              className="p-6 rounded-[28px] border items-center text-center"
              style={{
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#f8fafc",
                borderColor: isDark ? "#334155" : "#e2e8f0",
              }}
            >
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{
                  backgroundColor: isDark
                    ? "rgba(148, 163, 184, 0.15)"
                    : "#f1f5f9",
                }}
              >
                <AlertTriangle
                  size={32}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </View>

              <Text
                className="text-base font-black text-center mb-2 tracking-wide uppercase"
                style={{ color: colors.textPrimary }}
              >
                Calving Readiness Unavailable
              </Text>

              <Text
                className="text-xs text-center leading-5 mb-6"
                style={{ color: colors.textSecondary }}
              >
                We couldn't verify the delivery recording window for this animal.
              </Text>

              {/* Try Again */}
              <TouchableOpacity
                onPress={() => {
                  refetchAnimalData();
                  queryClient.invalidateQueries({ queryKey: breedingKeys.tracker(animalId) });
                }}
                className="w-full h-14 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: primaryColor }}
                activeOpacity={0.8}
              >
                <Text className="text-white font-black text-sm uppercase tracking-wider">
                  Try Again
                </Text>
              </TouchableOpacity>

              {/* Back to Reproductive Status */}
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-full h-14 rounded-2xl items-center justify-center mb-3 border"
                style={{
                  borderColor: colors.border,
                  backgroundColor: isDark ? colors.card : "white",
                }}
                activeOpacity={0.8}
              >
                <Text
                  className="font-black text-sm uppercase tracking-wider"
                  style={{ color: colors.textPrimary }}
                >
                  Back to Reproductive Status
                </Text>
              </TouchableOpacity>

              {/* Secondary Action: Report Pregnancy Loss (Only when active confirmed pregnancy exists) */}
              {hasActiveConfirmedPregnancy ? (
                <TouchableOpacity
                  onPress={() =>
                    router.replace({
                      pathname: "/(farmer)/report-pregnancy-loss" as any,
                      params: {
                        animalId,
                        pregnancyId: activePregnancy?._id || pregnancyId,
                        earTag: earTag || animalData?.earTag || "",
                      },
                    })
                  }
                  className="w-full h-14 rounded-2xl items-center justify-center border flex-row gap-2"
                  style={{
                    borderColor: isDark ? "rgba(245, 158, 11, 0.4)" : "#fcd34d",
                    backgroundColor: isDark ? "rgba(245, 158, 11, 0.08)" : "#fffbeb",
                  }}
                  activeOpacity={0.8}
                >
                  <AlertTriangle
                    size={16}
                    color={isDark ? "#fbbf24" : "#d97706"}
                  />
                  <Text
                    className="font-bold text-xs uppercase tracking-wider"
                    style={{ color: isDark ? "#fbbf24" : "#b45309" }}
                  >
                    Report Pregnancy Loss
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View
              className="p-6 rounded-[28px] border items-center text-center"
              style={{
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#f8fafc",
                borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a",
              }}
            >
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#fef3c7",
                }}
              >
                <AlertTriangle
                  size={32}
                  color={isDark ? "#fbbf24" : "#d97706"}
                />
              </View>

              <Text
                className="text-base font-black text-center mb-2 tracking-wide uppercase"
                style={{ color: isDark ? "#fef3c7" : "#92400e" }}
              >
                Calving Not Yet Available
              </Text>

              <Text
                className="text-xs text-center leading-5 mb-4"
                style={{ color: colors.textSecondary }}
              >
                This animal has not yet reached the minimum gestation day for recording Live Birth, Mixed, or Stillbirth.
              </Text>

              {/* Timing Details Card */}
              <View
                className="w-full p-4 rounded-2xl mb-6 border gap-2"
                style={{
                  backgroundColor: isDark ? colors.card : "white",
                  borderColor: colors.border,
                }}
              >
                {farmerReadiness.expectedCalvingDateFormatted ? (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
                      Expected Calving
                    </Text>
                    <Text className="text-xs font-bold" style={{ color: colors.textPrimary }}>
                      {farmerReadiness.expectedCalvingDateFormatted}
                    </Text>
                  </View>
                ) : null}

                {farmerReadiness.gestationProgressLabel ? (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
                      Current Gestation
                    </Text>
                    <Text className="text-xs font-bold" style={{ color: colors.textPrimary }}>
                      {farmerReadiness.gestationProgressLabel}
                    </Text>
                  </View>
                ) : null}

                {farmerReadiness.minimumThresholdLabel ? (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
                      Delivery recording available from
                    </Text>
                    <Text className="text-xs font-bold" style={{ color: colors.textPrimary }}>
                      {farmerReadiness.minimumThresholdLabel}
                    </Text>
                  </View>
                ) : null}

                {farmerReadiness.countdownLabel ? (
                  <View className="mt-1 pt-2 border-t items-center" style={{ borderTopColor: colors.border }}>
                    <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {farmerReadiness.countdownLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Primary Action: Back to Reproductive Status */}
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-full h-14 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: primaryColor }}
                activeOpacity={0.8}
              >
                <Text className="text-white font-black text-sm uppercase tracking-wider">
                  Back to Reproductive Status
                </Text>
              </TouchableOpacity>

              {/* Secondary Action: Report Pregnancy Loss (Only when active confirmed pregnancy exists) */}
              {hasActiveConfirmedPregnancy ? (
                <TouchableOpacity
                  onPress={() =>
                    router.replace({
                      pathname: "/(farmer)/report-pregnancy-loss" as any,
                      params: {
                        animalId,
                        pregnancyId: activePregnancy?._id || pregnancyId,
                        earTag: earTag || animalData?.earTag || "",
                      },
                    })
                  }
                  className="w-full h-14 rounded-2xl items-center justify-center border flex-row gap-2"
                  style={{
                    borderColor: isDark ? "rgba(245, 158, 11, 0.4)" : "#fcd34d",
                    backgroundColor: isDark ? "rgba(245, 158, 11, 0.08)" : "#fffbeb",
                  }}
                  activeOpacity={0.8}
                >
                  <AlertTriangle
                    size={16}
                    color={isDark ? "#fbbf24" : "#d97706"}
                  />
                  <Text
                    className="font-bold text-xs uppercase tracking-wider"
                    style={{ color: isDark ? "#fbbf24" : "#b45309" }}
                  >
                    Report Pregnancy Loss
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </ScrollView>
      ) : (
        <>
          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 220 }}
          >
        {/* Info Box */}
        <View 
          className="mt-6 p-4 rounded-3xl border flex-row items-start"
          style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff', borderColor: isDark ? 'transparent' : '#bfdbfe' }}
        >
          <Info size={18} color={isDark ? '#60a5fa' : '#3B82F6'} style={{ marginTop: 2 }} />
          <Text className="ml-3 flex-1 text-[12px] leading-5 font-medium" style={{ color: isDark ? '#dbeafe' : '#1e3a8a' }}>
            Live births register offspring automatically into your livestock inventory. Stillbirth preserves breeding history without creating living profiles. Suspected pregnancy loss before delivery should be reported through Pregnancy Loss Report.
          </Text>
        </View>

        <View className="mt-8">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>
              Calving Date
            </Text>
            <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-outfit-medium mb-2 ml-1">Date the calf was born or the calving occurred.</Text>
            <TouchableOpacity
              onPress={() => {
                setTempDate(date ? new Date(`${date}T00:00:00`) : new Date());
                setShowDatePicker(true);
              }}
              className="border rounded-2xl px-4 py-4 flex-row items-center" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
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
        </View>

        <View className="mt-6">
          <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>
            Outcome
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[["live_birth", "Live Birth"], ["mixed", "Mixed"], ["stillbirth", "Stillbirth"]].map(
              ([value, label]) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => selectOutcome(value)}
                  className="flex-1 py-3 rounded-2xl items-center border"
                  style={{
                    backgroundColor: outcome === value ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : colors.card,
                    borderColor: outcome === value ? (isDark ? colors.primary : '#10b981') : colors.border
                  }}
                >
                  <Text
                    className="text-[11px] font-black"
                    style={{ color: outcome === value ? (isDark ? colors.primary : '#065f46') : colors.textMuted }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>Delivery Method</Text>
          <View className="flex-row flex-wrap gap-2">
            {["Natural", "Normal", "Difficult", "Cesarean"].map((option) => (
              <TouchableOpacity key={option} onPress={() => setCalvingEase(option)} className="px-4 py-3 rounded-2xl items-center border" style={{ backgroundColor: calvingEase === option ? colors.tint : colors.card, borderColor: calvingEase === option ? primaryColor : colors.border }}>
                <Text className="text-[11px] font-black" style={{ color: calvingEase === option ? primaryColor : colors.textMuted }}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Offspring Details */}
        <View className="mt-10 flex-row justify-between items-center mb-4">
          <Text className="text-sm font-black uppercase tracking-widest" style={{ color: colors.textPrimary }}>
            {isLiveBirth ? "Offspring Registry" : outcome === "mixed" ? "Living & Stillborn Details" : "Stillborn Calf Details"}
          </Text>
          <TouchableOpacity
            onPress={addCalf}
            className="px-4 py-2 rounded-full flex-row items-center gap-2"
            style={{ backgroundColor: colors.tint }}
          >
            <Plus size={14} color={primaryColor} />
            <Text className="text-[11px] font-black" style={{ color: primaryColor }}>
              Add Calf
            </Text>
          </TouchableOpacity>
        </View>

        {calves.map((calf, index) => (
          <View
            key={index}
            className="rounded-[32px] p-6 mb-6 border shadow-sm relative"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Corner Badge */}
            <View
              className="absolute -top-3 -left-2 w-8 h-8 rounded-full items-center justify-center shadow-md z-10"
              style={{ backgroundColor: primaryColor }}
            >
              <Text className="text-white text-[10px] font-black">
                {index + 1}
              </Text>
            </View>

            {/* Card Header: Calf Title + Delete Action in natural flow */}
            <View className="flex-row items-center justify-between mb-4 mt-1 pl-6">
              <Text
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: colors.textPrimary }}
              >
                Calf #{index + 1}
              </Text>
              {calves.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeCalf(index)}
                  className="w-8 h-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2' }}
                  accessibilityLabel={`Remove Calf #${index + 1}`}
                >
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>

            <View className="gap-5">
              {outcome === "mixed" && (
                <View>
                  <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                    Status / Vitality
                  </Text>
                  <View className="flex-row gap-2">
                    {([[true, "Living"], [false, "Stillborn"]] as const).map(([value, label]) => {
                      const isSelected = (calf.isLiving !== false) === value;
                      return (
                        <TouchableOpacity
                          key={String(value)}
                          onPress={() => updateCalf(index, "isLiving", value)}
                          className="flex-1 py-3 rounded-xl items-center border"
                          style={{
                            backgroundColor: isSelected ? primaryColor : colors.card,
                            borderColor: isSelected ? primaryColor : colors.border,
                          }}
                        >
                          <Text
                            className="font-black text-xs"
                            style={{ color: isSelected ? "white" : colors.textMuted }}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Sex Toggle */}
              <View>
                <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                  Gender / Sex
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => updateCalf(index, "sex", "F")}
                    className="flex-1 py-3 rounded-xl items-center border"
                    style={{
                      backgroundColor: calf.sex === "F" ? (isDark ? 'rgba(236, 72, 153, 0.15)' : '#fdf2f8') : colors.card,
                      borderColor: calf.sex === "F" ? '#ec4899' : colors.border
                    }}
                  >
                    <Text className="text-xs font-black" style={{ color: calf.sex === "F" ? '#ec4899' : colors.textMuted }}>Female (Heifer)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateCalf(index, "sex", "M")}
                    className="flex-1 py-3 rounded-xl items-center border"
                    style={{
                      backgroundColor: calf.sex === "M" ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : colors.card,
                      borderColor: calf.sex === "M" ? '#3b82f6' : colors.border
                    }}
                  >
                    <Text className="text-xs font-black" style={{ color: calf.sex === "M" ? '#3b82f6' : colors.textMuted }}>Male (Bull)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Ear Tag (living calves) */}
              {calf.isLiving !== false ? (
                <View>
                  <View className="flex-row justify-between items-center mb-2 ml-1">
                    <Text className="text-[9px] font-black uppercase tracking-widest" style={{ color: colors.textMuted }}>
                      Offspring Ear Tag
                    </Text>
                    <EarTagGenerator
                      farmerName={farmerName}
                      animalCount={animalCount + index}
                      onGenerate={(tag: string) => updateCalf(index, "earTag", tag)}
                    />
                  </View>
                  <View className="rounded-2xl px-4 py-3 border flex-row items-center" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                    <Hash size={16} color={colors.textMuted} />
                    <TextInput
                      className="flex-1 ml-2 font-bold text-sm"
                      style={{ color: colors.textPrimary }}
                      placeholder="e.g. TAG-2024-001"
                      placeholderTextColor={colors.textMuted}
                      value={calf.earTag}
                      onChangeText={(val) => updateCalf(index, "earTag", val)}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              ) : (
                <View className="p-3 rounded-2xl border" style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fecaca' }}>
                  <Text className="text-xs font-bold" style={{ color: isDark ? '#f87171' : '#b91c1c' }}>
                    Stillborn calf recorded for reproductive history. No active tag assigned.
                  </Text>
                </View>
              )}

              {/* Color Selection */}
              <View>
                <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                  Coat Color / Markings
                </Text>
                <View className="gap-2">
                  <View className="flex-row flex-wrap gap-1.5">
                    {CALF_COLOR_OPTIONS.map((c) => {
                      const isSelected = calf.color === c && !calf.isCustomColor;
                      return (
                        <TouchableOpacity
                          key={c}
                          onPress={() => {
                            const newCalves = [...calves];
                            newCalves[index].color = c;
                            newCalves[index].isCustomColor = false;
                            setCalves(newCalves);
                          }}
                          className="px-3 py-2 rounded-xl border"
                          style={{
                            backgroundColor: isSelected ? primaryColor : colors.card,
                            borderColor: isSelected ? primaryColor : colors.border
                          }}
                        >
                          <Text
                            className="text-[10px] font-bold"
                            style={{ color: isSelected ? 'white' : colors.textMuted }}
                          >
                            {c}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      onPress={() => {
                        const newCalves = [...calves];
                        newCalves[index].isCustomColor = true;
                        newCalves[index].color = "";
                        setCalves(newCalves);
                      }}
                      className="px-3 py-2 rounded-xl border"
                      style={{
                        backgroundColor: calf.isCustomColor ? primaryColor : colors.card,
                        borderColor: calf.isCustomColor ? primaryColor : colors.border
                      }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: calf.isCustomColor ? 'white' : colors.textMuted }}
                      >
                        Other...
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {calf.isCustomColor && (
                    <View className="rounded-xl px-4 py-3 flex-row items-center" style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}>
                      <Palette size={14} color={colors.textMuted} />
                      <TextInput
                        className="flex-1 ml-2 font-bold text-xs"
                        style={{ color: colors.textPrimary }}
                        value={calf.color}
                        onChangeText={(val) => updateCalf(index, "color", val)}
                        placeholder="Describe color..."
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  )}
                </View>
              </View>

              {/* Calf Image Picker */}
              {calf.isLiving !== false && <View>
                <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                  Calf Image / Photo (Optional)
                </Text>
                {calf.imageUri ? (
                  <View
                    style={{
                      borderRadius: 16,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                      position: "relative",
                    }}
                  >
                    <Image
                      source={{ uri: calf.imageUri }}
                      style={{ width: "100%", height: 128 }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => removeCalfImage(index)}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        padding: 8,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        borderRadius: 999,
                      }}
                    >
                      <X size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleSelectCalfPhoto(index, "camera")}
                      className="flex-1 py-3.5 rounded-xl border flex-row justify-center items-center gap-2"
                      style={{ backgroundColor: isDark ? colors.background : '#f8fafc', borderColor: colors.border }}
                    >
                      <Camera size={14} color={primaryColor} />
                      <Text className="text-[10px] font-black" style={{ color: primaryColor }}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSelectCalfPhoto(index, "library")}
                      className="flex-1 py-3.5 rounded-xl border flex-row justify-center items-center gap-2"
                      style={{ backgroundColor: isDark ? colors.background : '#f8fafc', borderColor: colors.border }}
                    >
                      <ImageIcon size={14} color={primaryColor} />
                      <Text className="text-[10px] font-black" style={{ color: primaryColor }}>Choose Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>}
            </View>
          </View>
        ))}

        {/* Note Box */}
        <View className="mt-4">
          <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>
            Observations (Optional)
          </Text>
          <TextInput
            className="border rounded-[28px] p-5 text-xs min-h-[120px]"
            style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Any special notes about the birth or the offspring's condition..."
            placeholderTextColor={colors.textMuted}
            value={technicianNote}
            onChangeText={setTechnicianNote}
          />
        </View>
      </ScrollView>

      {/* Floating Save Button */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom + 16, 24), backgroundColor: colors.card, borderTopColor: colors.border }}
        className="px-6 pt-4 border-t absolute bottom-0 left-0 right-0"
      >
        {submissionError ? (
          <View
            className="mb-3 p-3 rounded-2xl border flex-row items-center gap-2.5"
            style={{
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
              borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca",
            }}
          >
            <AlertTriangle size={16} color={colors.error || "#ef4444"} />
            <Text
              className="flex-1 text-xs font-bold"
              style={{ color: colors.error || "#ef4444" }}
            >
              {submissionError}
            </Text>
          </View>
        ) : null}
        {submissionStatusMessage ? (
          <View
            className="mb-3 rounded-2xl border px-4 py-3"
            style={{
              backgroundColor: isDark ? colors.background : "#eff6ff",
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-center text-xs font-bold"
              style={{ color: colors.textPrimary }}
            >
              {submissionStatusMessage}
            </Text>
          </View>
        ) : null}
        {outcome === "mixed" && isMixedInvalid && (
          <View
            className="mb-3 p-3 rounded-2xl border flex-row items-center gap-2.5"
            style={{
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
              borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a",
            }}
          >
            <AlertTriangle size={16} color={isDark ? "#fbbf24" : "#d97706"} />
            <Text
              className="flex-1 text-xs font-bold"
              style={{ color: isDark ? "#fef3c7" : "#92400e" }}
            >
              Mixed delivery must include at least one living and one stillborn calf.
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submissionLocked}
          className="h-16 rounded-[24px] flex-row items-center justify-center gap-3"
          style={{
            backgroundColor: submissionLocked ? '#34d399' : primaryColor,
            opacity: isMixedInvalid ? 0.6 : 1,
            elevation: isMixedInvalid ? 2 : 8,
            shadowColor: primaryColor,
            shadowOpacity: isMixedInvalid ? 0.1 : 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          {submissionLocked ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <ClipboardCheck size={20} color="white" />
              <Text className="text-white font-black text-base uppercase tracking-widest">
                {isLiveBirth ? "Register Offspring" : outcome === "mixed" ? "Record Mixed Delivery" : "Record Stillbirth"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  )}
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
        <View style={{ backgroundColor: colors.card, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
          <TouchableOpacity onPress={() => setShowDatePicker(false)}>
            <Text style={{ color: primaryColor, fontWeight: 'bold' }}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
