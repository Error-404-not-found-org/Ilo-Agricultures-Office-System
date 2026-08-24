import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  HeartPulse,
  User,
  MapPin,
  ChevronDown,
  Camera,
  X,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";

import { useTheme } from "@/lib/theme";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { AnimatedBottomSheet } from "@/components/shared/AnimatedBottomSheet";
import { Text as AppText } from "@/components/ui/Text";
import {
  useFarmerAnimalsForHealthQuery,
  useFarmerSelfProfileQuery,
  useMyHealthRequestsQuery,
  useSubmitHealthRequestMutation,
  useTechnicianDirectoryQuery,
} from "@/features/farmer-requests/hooks/useFarmerRequestForms";
import { buildFarmerHealthRequestPayload } from "@/features/farmer-requests/utils/payloadBuilders";
import {
  findActiveHealthCase,
  getHealthRequestErrorMessage,
} from "@/features/farmer-requests/utils/healthRequestState";
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

const formatAddress = (address?: FarmerProfile["address"]) => {
  if (!address) return "No address on file";
  return [
    address.houseNumber,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .filter(Boolean)
    .join(", ");
};

// ─── Config ───────────────────────────────────────────────────────────────────
const REQUEST_TYPES = [
  { value: "disease", label: "🦠 Disease / Infection" },
  { value: "medicine", label: "💊 Medicine Request" },
  { value: "checkup", label: "🩺 General Checkup" },
  { value: "injury", label: "🤕 Injury / Wound" },
  { value: "vaccination", label: "💉 Vaccination" },
  { value: "deworming", label: "🪱 Deworming" },
  { value: "other", label: "📋 Other" },
];

const URGENCY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    desc: "Can wait a few days",
    color: "#22c55e",
    bg: "#f0fdf4",
    darkBg: "rgba(34, 197, 94, 0.15)",
  },
  {
    value: "medium",
    label: "Medium",
    desc: "Needs attention soon",
    color: "#f59e0b",
    bg: "#fffbeb",
    darkBg: "rgba(245, 158, 11, 0.15)",
  },
  {
    value: "critical",
    label: "Critical",
    desc: "Needs attention immediately",
    color: "#b91c1c",
    bg: "#fef2f2",
    darkBg: "rgba(185, 28, 28, 0.15)",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportSickness() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const submitLockRef = useRef(false);
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.error : "#b91c1c";

  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);

  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [requestType, setRequestType] = useState("disease");
  const [urgency, setUrgency] = useState("medium");
  const [symptoms, setSymptoms] = useState("");
  const [farmerNotes, setFarmerNotes] = useState("");
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const mutation = useSubmitHealthRequestMutation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = mutation.isPending || isSubmitting;

  const showSubmitError = (
    message: string,
    options?: Parameters<typeof toast.error>[1],
  ) => {
    toast.dismiss();
    toast.error(message, options);
  };

  const [animalModalVisible, setAnimalModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [farmPinModalVisible, setFarmPinModalVisible] = useState(false);
  const [noContactModalVisible, setNoContactModalVisible] = useState(false);
  const [serverConflictCase, setServerConflictCase] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [techSelectModalVisible, setTechSelectModalVisible] = useState(false);
  const { height } = useWindowDimensions();

  // ── Load profile ────────────────────────────────────────────────────────────
  const { data: profile, isLoading: loadingProfile } =
    useFarmerSelfProfileQuery();

  useEffect(() => {
    if (profile) {
      setFarmer(profile);
    }
  }, [profile]);

  // Fetch farmer's animals for the dropdown
  const { data: animalsData, isLoading: isLoadingAnimals } =
    useFarmerAnimalsForHealthQuery();

  // Fetch pending health requests to block duplicates
  const { data: myHealthRequests, refetch: refetchHealthRequests } =
    useMyHealthRequestsQuery();

  const requestsArray = Array.isArray(myHealthRequests)
    ? myHealthRequests
    : myHealthRequests?.data || [];
  const activeCase = findActiveHealthCase(
    serverConflictCase ? [...requestsArray, serverConflictCase] : requestsArray,
    selectedAnimal?._id,
    requestType,
  );

  // Fetch technicians list for direct call emergency contacts
  const { data: technicians, isLoading: isLoadingTechs } =
    useTechnicianDirectoryQuery();

  useEffect(() => {
    if (animalsData) {
      const list = Array.isArray(animalsData) ? animalsData : animalsData.data;
      if (Array.isArray(list)) {
        setAnimals(list);
      }
    }
  }, [animalsData]);

  const handleSelectPhoto = async (source: "camera" | "library") => {
    if (photos.length >= 5) {
      toast.error("You can attach up to 5 photos only.");
      return;
    }
    const result = await pickImageFromSource(source, { aspect: [4, 3] });
    if (result) {
      setPhotos((prev) => [
        ...prev,
        { uri: result.uri, base64: result.base64 },
      ]);
      toast.success("Photo attached!");
    }
  };

  const submitRequest = async () => {
    if (!selectedAnimal) return;

    const base64Photos = photos.map((p) => p.base64);

    const payload = buildFarmerHealthRequestPayload(
      selectedAnimal._id,
      requestType,
      symptoms,
      urgency,
      farmerNotes,
      base64Photos,
    );

    setIsSubmitting(true);
    try {
      const result = await mutation.mutateAsync({
        ...payload,
        imageUrl: base64Photos[0] || "",
      });
      if (result.status === "synced") {
        toast.success(
          "Health request submitted. A technician will review your request and schedule the visit.",
          { duration: 4000, position: "top-center" },
        );
      }
      setSelectedAnimal(null);
      setSymptoms("");
      setFarmerNotes("");
      setPhotos([]);
      router.back();
    } catch (error: any) {
      if (error?.response?.data?.code === "ACTIVE_HEALTH_CASE_EXISTS") {
        const conflict = error.response.data;
        setServerConflictCase({
          _id: conflict.existingRequestId,
          animalId: selectedAnimal._id,
          requestType,
          status: conflict.existingRequestStatus || "pending",
        });
        await refetchHealthRequests();
        setTimeout(
          () => scrollRef.current?.scrollTo({ y: 500, animated: true }),
          100,
        );
      } else {
        toast.error(getHealthRequestErrorMessage(error));
      }
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

      if (!selectedAnimal) {
        showSubmitError("Please select an animal.");
        return;
      }

      if (activeCase) {
        scrollRef.current?.scrollTo({ y: 500, animated: true });
        return;
      }

      if (!symptoms.trim()) {
        showSubmitError("Please describe the symptoms or condition.");
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

  const selectedType = REQUEST_TYPES.find((t) => t.value === requestType);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <FarmerRequestHeader title="Report Health Concern" />

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
          {/* --- EMERGENCY CONTACT BANNER & DIRECT CALLS --- */}
          <View className="mb-6 rounded-[28px] border border-red-200 bg-red-50 dark:bg-red-950/15 dark:border-transparent p-5 shadow-sm">
            <View className="flex-row items-start gap-2.5 mb-3">
              <AlertCircle size={18} color={primaryColor} className="mt-0.5" />
              <View className="flex-1">
                <Text className="text-[12px] font-outfit-black uppercase tracking-wider text-red-700 dark:text-red-400">
                  Veterinary Emergency?
                </Text>
                <Text className="text-[12px] font-outfit-medium text-slate-500 dark:text-slate-400 mt-1 leading-[18px]">
                  This form is for scheduling routine visits (Checkups,
                  vaccinations, deworming). If your animal is in a critical
                  emergency, please call a technician directly below:
                </Text>
              </View>
            </View>

            {/* Technicians List */}
            {isLoadingTechs ? (
              <ActivityIndicator color={primaryColor} className="py-4" />
            ) : !technicians || technicians.length === 0 ? (
              <Text className="text-center font-outfit-medium text-[11px] text-slate-400 dark:text-slate-500 italic py-2">
                No active technicians registered in your area.
              </Text>
            ) : (
              <View className="gap-3 mt-2">
                {(() => {
                  const techToDisplay = selectedTechId
                    ? technicians.find((t: any) => t._id === selectedTechId) ||
                      technicians[0]
                    : technicians[0];

                  const tech = techToDisplay;
                  const initials = tech.name
                    ? tech.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "VO";
                  const techPhone =
                    tech.phoneNumber || tech.address?.phoneNumber;

                  return (
                    <View
                      key={tech._id}
                      className="flex-row items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs"
                    >
                      <View className="flex-row items-center gap-3 flex-1 mr-2">
                        {/* Avatar */}
                        <View className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center border border-red-100/50 dark:border-transparent overflow-hidden">
                          {tech.imageUrl ? (
                            <Image
                              source={{ uri: tech.imageUrl }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text
                              className="font-outfit-black text-xs"
                              style={{ color: primaryColor }}
                            >
                              {initials}
                            </Text>
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2 flex-wrap">
                            <Text className="text-[14px] font-outfit-black text-slate-800 dark:text-slate-200">
                              {tech.name}
                            </Text>
                            {/* Status Pill */}
                            <View
                              className={`px-2 py-0.5 rounded-full ${tech.status === "on-leave" ? "bg-slate-100 dark:bg-slate-800" : "bg-emerald-50 dark:bg-emerald-950/30"}`}
                            >
                              <Text
                                className="text-[8px] font-outfit-black uppercase"
                                style={{
                                  color:
                                    tech.status === "on-leave"
                                      ? "#94a3b8"
                                      : "#10b981",
                                }}
                              >
                                {tech.status || "Active"}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-[11px] font-outfit-medium text-slate-400 dark:text-slate-500 mt-0.5">
                            📍 {tech.address?.barangay || "Municipal"}, Oton
                          </Text>
                        </View>
                      </View>

                      {/* Right Side Buttons (Select / Call) */}
                      <View className="flex-row items-center gap-2">
                        {technicians.length > 1 && (
                          <TouchableOpacity
                            onPress={() => setTechSelectModalVisible(true)}
                            className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 justify-center items-center bg-slate-50 dark:bg-slate-800/50"
                          >
                            <ChevronDown
                              size={18}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => {
                            if (techPhone) {
                              Linking.openURL(
                                `tel:${techPhone.replace(/\s+/g, "")}`,
                              );
                            } else {
                              setNoContactModalVisible(true);
                            }
                          }}
                          activeOpacity={0.8}
                          className="h-10 px-4 rounded-xl flex-row items-center justify-center gap-1.5 shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <MaterialCommunityIcons
                            name="phone"
                            size={14}
                            color="white"
                          />
                          <Text className="text-white font-outfit-black text-[11px] uppercase tracking-wider">
                            Call
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}
          </View>

          {/* Farmer Info Card */}
          <View
            className="rounded-[28px] p-6 mb-6 border shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
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
              <View className="gap-4">
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center overflow-hidden"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.15)"
                        : "#fef2f2",
                    }}
                  >
                    {farmer.imageUrl ? (
                      <Image
                        source={{ uri: farmer.imageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <User size={18} color={primaryColor} />
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
                <View className="flex-row items-start gap-3">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mt-0.5"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.15)"
                        : "#fef2f2",
                    }}
                  >
                    <MapPin size={18} color={primaryColor} />
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

          {/* Animal Picker */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Affected Animal *
          </Text>
          <TouchableOpacity
            onPress={() => setAnimalModalVisible(true)}
            className="border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-5"
            style={{
              backgroundColor: colors.card,
              borderColor: selectedAnimal ? primaryColor : colors.border,
              elevation: 1,
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

          {/* Request Type */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Request Type
          </Text>
          <TouchableOpacity
            onPress={() => setTypeModalVisible(true)}
            className="border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-5"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              elevation: 1,
            }}
          >
            <Text
              className="text-sm font-bold"
              style={[
                requestFormStyles.fieldValue,
                { color: colors.textPrimary },
              ]}
            >
              {selectedType?.label || "Select type"}
            </Text>
            <ChevronDown size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {activeCase && (
            <View
              className="p-4 rounded-2xl mb-5 border"
              style={{
                backgroundColor: isDark ? "rgba(245, 158, 11, 0.1)" : "#fffbeb",
                borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#fde68a",
              }}
            >
              <View className="flex-row gap-3">
                <AlertCircle size={20} color="#d97706" />
                <View className="flex-1">
                  <Text
                    className="font-bold text-sm"
                    style={{ color: colors.textPrimary }}
                  >
                    Active health request
                  </Text>
                  <Text
                    className="text-xs mt-1 leading-5"
                    style={{ color: colors.textSecondary }}
                  >
                    {selectedType?.label?.replace(/^\S+\s*/, "") ||
                      "Health issue"}
                    {" · "}
                    {String(activeCase.status || "pending")
                      .replace(/[-_]/g, " ")
                      .replace(/\b\w/g, (character) => character.toUpperCase())}
                    {"\n"}Complete or cancel this request before creating
                    another of the same type.
                  </Text>
                  {activeCase._id && (
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: "/(farmer)/health-request-detail",
                          params: { id: String(activeCase._id) },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel="View active health request"
                      className="flex-row items-center self-start mt-3 py-1"
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: "#d97706" }}
                      >
                        View existing request
                      </Text>
                      <MaterialCommunityIcons
                        name="arrow-right"
                        size={15}
                        color="#d97706"
                        style={{ marginLeft: 4 }}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Urgency Selector */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Urgency Level
          </Text>
          <View className="flex-row gap-3 mb-5">
            {URGENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setUrgency(opt.value)}
                className="flex-1 rounded-2xl py-3 px-2 items-center border"
                style={{
                  borderColor:
                    urgency === opt.value ? opt.color : colors.border,
                  backgroundColor:
                    urgency === opt.value
                      ? isDark
                        ? opt.darkBg
                        : opt.bg
                      : colors.card,
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{
                    color: urgency === opt.value ? opt.color : colors.textMuted,
                  }}
                >
                  {opt.label}
                </Text>
                <Text
                  className="text-[10px] text-center mt-1 font-medium"
                  style={{
                    color: urgency === opt.value ? opt.color : colors.textMuted,
                  }}
                >
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photos */}
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

          {/* Symptoms / Description */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Symptoms / Description *
          </Text>
          <TextInput
            className="border rounded-2xl px-4 py-4 text-sm mb-5"
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
            value={symptoms}
            onChangeText={setSymptoms}
            onFocus={() =>
              setTimeout(
                () => scrollRef.current?.scrollTo({ y: 800, animated: true }),
                350,
              )
            }
            placeholder="Describe what you observed..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            blurOnSubmit={false}
          />

          {/* Farmer Notes */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={[requestFormStyles.fieldLabel, { color: colors.textMuted }]}
          >
            Additional Notes (Optional)
          </Text>
          <TextInput
            className="border rounded-2xl px-4 py-4 text-sm mb-6"
            style={[
              requestFormStyles.textInput,
              {
                minHeight: 100,
                textAlignVertical: "top",
                elevation: 1,
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            value={farmerNotes}
            onChangeText={setFarmerNotes}
            onFocus={() =>
              setTimeout(
                () => scrollRef.current?.scrollToEnd({ animated: true }),
                350,
              )
            }
            placeholder="Any other details for the technician..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            blurOnSubmit={false}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={() => handleSubmit()}
            disabled={submitting || Boolean(activeCase)}
            accessibilityRole="button"
            accessibilityLabel="Submit health request"
            activeOpacity={0.85}
            className="rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg"
            style={{
              backgroundColor:
                submitting || activeCase ? colors.textMuted : primaryColor,
              shadowColor: primaryColor,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : activeCase ? (
              <Text className="text-white font-bold text-base">
                Active request already exists
              </Text>
            ) : (
              <>
                <HeartPulse size={20} color="white" />
                <Text className="text-white font-bold text-lg">
                  Submit Health Request
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Animal Modal */}
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedAnimal(item);
                    setAnimalModalVisible(false);
                  }}
                  className="py-4 px-3 border-b flex-row items-center justify-between"
                  style={{
                    borderBottomColor: colors.border,
                    backgroundColor:
                      selectedAnimal?._id === item._id
                        ? isDark
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#fef2f2"
                        : undefined,
                    borderRadius: selectedAnimal?._id === item._id ? 16 : 0,
                  }}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="flex-1">
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

                        {item.reproductiveStatus && (
                          <View
                            className={`px-2 py-0.5 rounded-full ${
                              item.reproductiveStatus === "Pregnant"
                                ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-200"
                                : "bg-gray-100 dark:bg-slate-800"
                            }`}
                          >
                            <Text
                              className="text-[9px] font-outfit-black uppercase"
                              style={{
                                color:
                                  item.reproductiveStatus === "Pregnant"
                                    ? "#9333ea"
                                    : colors.textMuted,
                              }}
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
                    </View>

                    {selectedAnimal?._id === item._id && (
                      <Check size={18} color={primaryColor} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </AnimatedBottomSheet>

      {/* Request Type Modal */}
      <AnimatedBottomSheet
        visible={typeModalVisible}
        onClose={() => setTypeModalVisible(false)}
        backgroundColor={colors.card}
      >
        <View className="p-6" style={{ backgroundColor: colors.card }}>
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-lg font-bold"
              style={[
                requestFormStyles.modalTitle,
                { color: colors.textPrimary },
              ]}
            >
              Request Type
            </Text>
            <TouchableOpacity
              onPress={() => setTypeModalVisible(false)}
              className="p-1 rounded-full"
              style={{
                backgroundColor: isDark ? colors.background : "#f8fafc",
              }}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {REQUEST_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              onPress={() => {
                setRequestType(type.value);
                setTypeModalVisible(false);
              }}
              className="py-4 px-3 border-b flex-row items-center justify-between"
              style={{
                borderBottomColor: colors.border,
                backgroundColor:
                  requestType === type.value
                    ? isDark
                      ? "rgba(239, 68, 68, 0.15)"
                      : "#fef2f2"
                    : undefined,
                borderRadius: requestType === type.value ? 16 : 0,
              }}
            >
              <Text
                className="text-[15px] font-bold"
                style={[
                  requestFormStyles.modalItemTitle,
                  { color: colors.textPrimary },
                ]}
              >
                {type.label}
              </Text>
              {requestType === type.value && (
                <Check size={18} color={primaryColor} />
              )}
            </TouchableOpacity>
          ))}
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
        message="Please provide your contact number and home address in your profile before submitting a request."
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
        message="You can still submit this health request, but technicians will only see your barangay. Add an exact farm pin if you want them to navigate directly to the animal."
        confirmText="Continue Anyway"
        cancelText="Add Farm Pin"
        isDestructive={false}
        icon={<MapPin size={26} color={colors.warning} />}
      />

      <ConfirmationModal
        visible={noContactModalVisible}
        onClose={() => setNoContactModalVisible(false)}
        onConfirm={() => setNoContactModalVisible(false)}
        title="No Contact Number"
        message="This technician does not have a registered contact number."
        confirmText="OK"
        cancelText={null}
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />

      <AnimatedBottomSheet
        visible={techSelectModalVisible}
        onClose={() => setTechSelectModalVisible(false)}
        backgroundColor={colors.card}
      >
        <View className="p-6" style={{ backgroundColor: colors.card }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text
              className="text-lg font-outfit-bold"
              style={{ color: colors.textPrimary }}
            >
              Select Technician
            </Text>
            <TouchableOpacity
              onPress={() => setTechSelectModalVisible(false)}
              style={{ padding: 4 }}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {technicians?.map((tech: any) => {
              const initials = tech.name
                ? tech.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "VO";
              const isSelected =
                selectedTechId === tech._id ||
                (!selectedTechId && technicians[0]?._id === tech._id);

              return (
                <TouchableOpacity
                  key={tech._id}
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedTechId(tech._id);
                    setTechSelectModalVisible(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(52,211,153,0.1)"
                        : "#ecfdf5"
                      : isDark
                        ? colors.background
                        : "#f8fafc",
                    borderColor: isSelected
                      ? isDark
                        ? "rgba(52,211,153,0.3)"
                        : "#a7f3d0"
                      : isDark
                        ? colors.border
                        : "#e2e8f0",
                  }}
                >
                  <View className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center overflow-hidden mr-3">
                    {tech.imageUrl ? (
                      <Image
                        source={{ uri: tech.imageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        className="font-outfit-black text-xs"
                        style={{ color: primaryColor }}
                      >
                        {initials}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 15,
                      }}
                    >
                      {tech.name}
                    </Text>
                    <Text className="text-[11px] font-outfit-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      📍 {tech.address?.barangay || "Municipal"}, Oton
                    </Text>
                  </View>
                  {isSelected && <Check size={18} color={primaryColor} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </AnimatedBottomSheet>
    </View>
  );
}
