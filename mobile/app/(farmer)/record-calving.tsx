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
import * as ImagePicker from "expo-image-picker";
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
import EarTagGenerator from "@/components/EarTagGenerator";

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

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [calvingEase, setCalvingEase] = useState("Normal");
  const [outcome, setOutcome] = useState<"live_birth" | "mixed" | "stillbirth" | "abortion">("live_birth");
  const [technicianNote, setTechnicianNote] = useState("");
  const [calves, setCalves] = useState<CalfEntry[]>([
    { sex: "F", earTag: "", color: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<OfflineMutationLifecycleState>("idle");
  const submitLockRef = useRef(false);
  const isLiveBirth = outcome === "live_birth";
  const isAbortion = outcome === "abortion";
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
          toast.success(outcome === "abortion"
            ? "Pregnancy-loss record saved."
            : outcome === "stillbirth"
              ? "Stillbirth record saved."
              : "Calving recorded! Living offspring were added to the registry.");
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
        setSubmissionState("idle");
        toast.error(error.response?.data?.message || "Failed to record calving");
      },
    },
  );

  const addCalf = () => {
    if (calves.length >= 5) {
      return toast.error("Maximum 5 calves per event");
    }
    setCalves([...calves, { sex: "F", earTag: "", color: "" }]);
  };

  const selectOutcome = (value: string) => {
    const nextOutcome = value as typeof outcome;
    setOutcome(nextOutcome);
    if (nextOutcome === "abortion") {
      setCalves([]);
    } else if (calves.length === 0) {
      setCalves([{ sex: "F", earTag: "", color: "", isLiving: nextOutcome !== "stillbirth" }]);
    } else {
      setCalves(calves.map((calf, index) => ({
        ...calf,
        isLiving: nextOutcome === "live_birth" ? true : nextOutcome === "stillbirth" ? false : index === 0,
      })));
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
    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() > Date.now()) {
      return toast.error("Enter a valid calving date that is not in the future.");
    }
    const livingCalves = calves.filter((calf) => calf.isLiving !== false);
    for (let i = 0; i < livingCalves.length; i++) {
      if (!livingCalves[i].earTag) {
        return toast.error(`Please provide an Ear Tag for Calf #${i + 1}`);
      }
    }
    if (outcome === "mixed" && (livingCalves.length === 0 || livingCalves.length === calves.length)) {
      return toast.error("Mixed outcome requires at least one living and one stillborn calf.");
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
      await calvingMutation.mutateAsync({
        pregnancyId,
        animalId,
        date,
        calvingEase,
        outcome,
        numberOfCalves: isAbortion ? 0 : calves.length,
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
      });
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
            Live births register offspring automatically. Abortion and stillbirth preserve the breeding history without creating living livestock profiles.
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
            {[["live_birth", "Live Birth"], ["mixed", "Mixed"], ["stillbirth", "Stillbirth"], ["abortion", "Abortion"]].map(
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

        {!isAbortion && <View className="mt-6">
          <Text className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2" style={{ color: colors.textMuted }}>Delivery Method</Text>
          <View className="flex-row flex-wrap gap-2">
            {["Natural", "Normal", "Difficult", "Cesarean"].map((option) => (
              <TouchableOpacity key={option} onPress={() => setCalvingEase(option)} className="px-4 py-3 rounded-2xl items-center border" style={{ backgroundColor: calvingEase === option ? colors.tint : colors.card, borderColor: calvingEase === option ? primaryColor : colors.border }}>
                <Text className="text-[11px] font-black" style={{ color: calvingEase === option ? primaryColor : colors.textMuted }}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>}

        {/* Outcome-specific offspring details */}
        {!isAbortion ? <>
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
            <View className="absolute -top-3 -left-2 w-8 h-8 rounded-full items-center justify-center shadow-md" style={{ backgroundColor: primaryColor }}>
              <Text className="text-white text-[10px] font-black">
                {index + 1}
              </Text>
            </View>

            {calves.length > 1 && (
              <TouchableOpacity
                onPress={() => removeCalf(index)}
                className="absolute top-4 right-4 p-2 rounded-full"
                style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2' }}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            )}

            <View className="gap-5">
              {outcome === "mixed" && <View className="flex-row gap-2">
                {[[true, "Living"], [false, "Stillborn"]].map(([value, label]) => (
                  <TouchableOpacity key={String(value)} onPress={() => updateCalf(index, "isLiving", value as any)} className="flex-1 py-2 rounded-xl items-center border" style={{ backgroundColor: (calf.isLiving !== false) === value ? primaryColor : colors.card, borderColor: colors.border }}>
                    <Text className="font-black" style={{ color: (calf.isLiving !== false) === value ? "white" : colors.textMuted }}>{label as string}</Text>
                  </TouchableOpacity>
                ))}
              </View>}
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
                      backgroundColor: calf.sex === "F" ? (isDark ? 'rgba(244, 63, 94, 0.15)' : '#fff5f5') : (isDark ? colors.background : '#f8fafc'),
                      borderColor: calf.sex === "F" ? '#f43f5e' : 'transparent'
                    }}
                  >
                    <Text
                      className="text-[10px] font-black"
                      style={{ color: calf.sex === "F" ? '#f43f5e' : colors.textMuted }}
                    >
                      Female
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateCalf(index, "sex", "M")}
                    className="flex-1 py-3 rounded-xl items-center border"
                    style={{
                      backgroundColor: calf.sex === "M" ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : (isDark ? colors.background : '#f8fafc'),
                      borderColor: calf.sex === "M" ? '#3b82f6' : 'transparent'
                    }}
                  >
                    <Text
                      className="text-[10px] font-black"
                      style={{ color: calf.sex === "M" ? '#3b82f6' : colors.textMuted }}
                    >
                      Male
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tag & Color */}
              <View className="gap-4">
                <View>
                  <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                    Ear Tag #
                  </Text>
                  <View className="rounded-xl px-4 py-3 flex-row items-center" style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}>
                    <Hash size={14} color={colors.textMuted} />
                    <TextInput
                      className="flex-1 ml-2 font-bold text-xs"
                      style={{ color: colors.textPrimary }}
                      value={calf.earTag}
                      onChangeText={(val) => updateCalf(index, "earTag", val)}
                      placeholder="TAG-XXX"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  {calf.isLiving !== false && (
                    <View className="mt-2 ml-1">
                      <EarTagGenerator
                        farmerName={farmerName}
                        animalCount={animalCount + index}
                        onGenerate={(tag) => updateCalf(index, "earTag", tag)}
                        isDark={isDark}
                      />
                    </View>
                  )}
                </View>
                <View>
                  <Text className="text-[9px] font-black uppercase tracking-widest mb-2 ml-1" style={{ color: colors.textMuted }}>
                    Calf Color
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mb-2">
                    {CALF_COLOR_OPTIONS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => {
                          updateCalf(index, "color", c);
                          updateCalf(index, "isCustomColor", false);
                        }}
                        className={`px-3 py-2 rounded-xl border ${calf.color === c && !calf.isCustomColor ? 'border-transparent' : ''}`}
                        style={{
                          backgroundColor: calf.color === c && !calf.isCustomColor ? primaryColor : colors.card,
                          borderColor: calf.color === c && !calf.isCustomColor ? 'transparent' : colors.border
                        }}
                      >
                        <Text className="font-bold text-[10px]" style={{ color: calf.color === c && !calf.isCustomColor ? "white" : colors.textMuted }}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => {
                        updateCalf(index, "isCustomColor", true);
                        if (CALF_COLOR_OPTIONS.includes(calf.color)) {
                            updateCalf(index, "color", "");
                        }
                      }}
                      className={`px-3 py-2 rounded-xl border ${calf.isCustomColor ? 'border-transparent' : ''}`}
                      style={{
                        backgroundColor: calf.isCustomColor ? primaryColor : colors.card,
                        borderColor: calf.isCustomColor ? 'transparent' : colors.border
                      }}
                    >
                      <Text className="font-bold text-[10px]" style={{ color: calf.isCustomColor ? "white" : colors.textMuted }}>
                        Other
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
        </> : (
          <View className="mt-8 p-5 rounded-3xl border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
              No living calf profile will be created. Add relevant observations below.
            </Text>
          </View>
        )}

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
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submissionLocked}
          className="h-16 rounded-[24px] flex-row items-center justify-center gap-3"
          style={{
            backgroundColor: submissionLocked ? '#34d399' : primaryColor,
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
              <ClipboardCheck size={20} color="white" />
              <Text className="text-white font-black text-base uppercase tracking-widest">
                {isLiveBirth ? "Register Offspring" : "Record Pregnancy Loss"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
