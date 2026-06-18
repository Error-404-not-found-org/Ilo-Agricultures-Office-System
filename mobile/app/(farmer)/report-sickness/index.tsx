import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
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
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { validateRequestTime } from "@/lib/utils";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/lib/theme";
import { ConfirmationModal } from "@/components/ConfirmationModal";

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
  phoneNumber?: string;
  address?: {
    houseNumber?: string;
    street: string;
    barangay: string;
    city: string;
    province: string;
  };
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
    value: "high",
    label: "Urgent",
    desc: "Emergency / critical now",
    color: "#ef4444",
    bg: "#fef2f2",
    darkBg: "rgba(239, 68, 68, 0.15)",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportSickness() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.error : "#b91c1c";

  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);

  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [requestType, setRequestType] = useState("disease");
  const [urgency, setUrgency] = useState("medium");
  const [symptoms, setSymptoms] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0); // Defaults to 08:00 AM standard slot
    return d;
  });

  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["system", "config"],
    queryFn: async () => {
      const res = await api.get("/config");
      return res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/health-request", data);
    },
    onSuccess: () => {
      toast.success(
        "Request submitted! A technician will attend to your animal.",
        { duration: 4000, position: "top-center" },
      );
      // Reset Form
      setSelectedAnimal(null);
      setSymptoms("");
      setImageUri(null);
      setImageBase64(null);

      queryClient.invalidateQueries({ queryKey: ["farmer", "requests"] });
      router.back();
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to submit. Please try again.",
      );
    },
  });

  const submitting = mutation.isPending;

  const [animalModalVisible, setAnimalModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [noContactModalVisible, setNoContactModalVisible] = useState(false);

  const TIME_SLOTS = [
    "08:00 AM",
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
  ];

  // ── Load profile ────────────────────────────────────────────────────────────
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await api.get("/user/me");
      return res.data;
    },
  });

  useEffect(() => {
    if (profile) {
      setFarmer(profile);
    }
  }, [profile]);

  // Fetch farmer's animals for the dropdown
  const { data: animalsData, isLoading: isLoadingAnimals } = useQuery({
    queryKey: ["animals", "my-all"],
    queryFn: async () => {
      const res = await api.get("/animals/my?limit=100");
      return res.data;
    },
  });

  // Fetch pending health requests to block duplicates
  const { data: myHealthRequests } = useQuery({
    queryKey: ["health-requests", "my"],
    queryFn: async () => {
      const res = await api.get("/health-request/my");
      return res.data;
    },
  });

  // Fetch technicians list for direct call emergency contacts
  const { data: technicians, isLoading: isLoadingTechs } = useQuery({
    queryKey: ["technicians", "list"],
    queryFn: async () => {
      const res = await api.get("/user?role=technician");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  useEffect(() => {
    if (animalsData) {
      const list = Array.isArray(animalsData) ? animalsData : animalsData.data;
      if (Array.isArray(list)) {
        setAnimals(list);
      }
    }
  }, [animalsData]);

  // ── Image ───────────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      toast.success("Photo attached!");
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      toast.error("Permission to access camera was denied");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      toast.success("Photo attached!");
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const hasPhone = farmer?.phoneNumber || profile?.phoneNumber;
    const hasAddress = farmer?.address?.barangay || profile?.address?.barangay;

    if (!hasPhone || !hasAddress) {
      setProfileModalVisible(true);
      return;
    }

    if (!selectedAnimal) return toast.error("Please select an animal.");

    const requestsArray = Array.isArray(myHealthRequests)
      ? myHealthRequests
      : myHealthRequests?.data || [];
    const isAlreadyPending = requestsArray.some(
      (r: any) =>
        r.animalId?._id === selectedAnimal._id && r.status === "pending",
    );
    if (isAlreadyPending) {
      setPendingModalVisible(true);
      return;
    }

    if (!symptoms.trim())
      return toast.error("Please describe the symptoms or condition.");

    const validation = validateRequestTime(preferredDate, !!config?.isHoliday);
    if (!validation.isValid) {
      return toast.error(validation.message || "Invalid request time.", {
        duration: 5000,
      });
    }

    mutation.mutate({
      animalId: selectedAnimal._id,
      requestType,
      symptoms: symptoms.trim(),
      urgency,
      imageUrl: imageBase64,
      preferredDate: preferredDate.toISOString(),
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(preferredDate);
      newDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
      setPreferredDate(newDate);
    }
  };

  const handleSelectTime = (timeStr: string) => {
    setTimeModalVisible(false);
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;

    const newDate = new Date(preferredDate);
    newDate.setHours(hours, minutes, 0, 0);
    setPreferredDate(newDate);
  };

  const selectedType = REQUEST_TYPES.find((t) => t.value === requestType);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <View
        className="absolute top-0 left-0 right-0 h-[260px]"
        style={{ backgroundColor: "#b91c1c" }}
      />

      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 16 }}
        className="px-6 pb-6 flex-row items-center gap-4 z-10"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/20"
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View>
          <Text className="text-[22px] font-outfit-black text-white leading-tight">
            Report Animal Issue
          </Text>
          <Text className="text-[12px] text-red-100 font-outfit-medium opacity-90 tracking-wide">
            Disease, Injury, or Medicine Request
          </Text>
        </View>
      </View>

      {/* Content card */}
      <View
        className="flex-1 rounded-t-[32px] px-6 pt-6 mt-2 shadow-2xl"
        style={{ elevation: 12, backgroundColor: colors.background }}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          {/* --- MOOWIE HEALTH INSIGHT --- */}
          <View className="mb-8">
            <View className="flex-row items-end">
              {/* Mascot Container */}
              <View className="w-24 h-24 -mb-2 z-10">
                <Image
                  source={{
                    uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                  }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>

              {/* Speech Bubble */}
              <View
                className="flex-1 rounded-[28px] rounded-bl-none p-5 ml-[-15px] border shadow-sm"
                style={{
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.1)"
                    : "#fef2f2",
                  borderColor: isDark ? "transparent" : "#fecaca",
                }}
              >
                <Text
                  className="font-outfit-black text-[13px] mb-1"
                  style={{ color: isDark ? "#fca5a5" : "#b91c1c" }}
                >
                  Moowie Support
                </Text>
                <Text
                  className="font-outfit-medium text-[12px] leading-[18px]"
                  style={{ color: colors.textSecondary }}
                >
                  &quot;Oh no, is one of our friends not feeling well? 🐮
                  Don&apos;t worry, fill out the details and I&apos;ll make sure
                  a technician sees this immediately!&quot;
                </Text>
              </View>
            </View>
          </View>

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
                {technicians.map((tech: any) => {
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
                        <View className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center border border-red-100/50 dark:border-transparent">
                          <Text
                            className="font-outfit-black text-xs"
                            style={{ color: primaryColor }}
                          >
                            {initials}
                          </Text>
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

                      {/* Call Button */}
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
                  );
                })}
              </View>
            )}
          </View>

          {/* Farmer Info Card */}
          <View
            className="rounded-[28px] p-6 mb-6 border shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text
              className="text-[10px] font-outfit-black uppercase tracking-widest mb-4"
              style={{ color: colors.textMuted }}
            >
              Your Information
            </Text>
            {loadingProfile && !farmer ? (
              <ActivityIndicator color={primaryColor} />
            ) : farmer ? (
              <View className="gap-4">
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(239, 68, 68, 0.15)"
                        : "#fef2f2",
                    }}
                  >
                    <User size={18} color={primaryColor} />
                  </View>
                  <View>
                    <Text
                      className="text-[10px] font-outfit-bold uppercase tracking-tighter"
                      style={{ color: colors.textMuted }}
                    >
                      Full Name
                    </Text>
                    <Text
                      className="text-[15px] font-outfit-bold"
                      style={{ color: colors.textPrimary }}
                    >
                      {farmer.name}
                    </Text>
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
                    <Text
                      className="text-[10px] font-outfit-bold uppercase tracking-tighter"
                      style={{ color: colors.textMuted }}
                    >
                      Address
                    </Text>
                    <Text
                      className="text-[15px] font-outfit-bold leading-tight"
                      style={{ color: colors.textSecondary }}
                    >
                      {formatAddress(farmer.address)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <AlertCircle size={16} color={colors.error} />
                <Text
                  className="text-sm font-outfit-bold"
                  style={{ color: colors.error }}
                >
                  Could not load profile
                </Text>
              </View>
            )}
          </View>

          {/* Animal Picker */}
          <Text
            className="text-[11px] font-outfit-black uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Affected Animal *
          </Text>
          <TouchableOpacity
            onPress={() => setAnimalModalVisible(true)}
            className="border rounded-[22px] px-5 py-5 flex-row items-center justify-between mb-6 shadow-sm"
            style={{
              backgroundColor: colors.card,
              borderColor: selectedAnimal ? primaryColor : colors.border,
            }}
          >
            {selectedAnimal ? (
              <View>
                <Text
                  className="text-[16px] font-outfit-black"
                  style={{ color: colors.textPrimary }}
                >
                  {selectedAnimal.animalId}
                  {selectedAnimal.earTag ? ` · ${selectedAnimal.earTag}` : ""}
                </Text>
                <Text
                  className="text-[13px] font-outfit-medium"
                  style={{ color: colors.textSecondary }}
                >
                  {selectedAnimal.species} — {selectedAnimal.breed}
                </Text>
              </View>
            ) : (
              <Text
                className="font-outfit-medium text-[15px]"
                style={{ color: colors.textMuted }}
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
            className="text-[11px] font-outfit-black uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Request Type
          </Text>
          <TouchableOpacity
            onPress={() => setTypeModalVisible(true)}
            className="border rounded-[22px] px-5 py-5 flex-row items-center justify-between mb-6 shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text
              className="text-[16px] font-outfit-bold"
              style={{ color: colors.textPrimary }}
            >
              {selectedType?.label || "Select type"}
            </Text>
            <ChevronDown size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Urgency Selector */}
          <Text
            className="text-[11px] font-outfit-black uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Urgency Level
          </Text>
          <View className="flex-row gap-3 mb-6">
            {URGENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setUrgency(opt.value)}
                className={`flex-1 rounded-[22px] py-4 px-2 items-center border-2 shadow-sm ${urgency === opt.value ? "shadow-md" : ""}`}
                style={{
                  borderColor:
                    urgency === opt.value ? opt.color : "transparent",
                  backgroundColor:
                    urgency === opt.value
                      ? isDark
                        ? opt.darkBg
                        : opt.bg
                      : colors.card,
                }}
              >
                <Text
                  className="text-[12px] font-outfit-black uppercase tracking-tighter"
                  style={{
                    color: urgency === opt.value ? opt.color : colors.textMuted,
                  }}
                >
                  {opt.label}
                </Text>
                <Text
                  className="text-[9px] text-center mt-1 font-outfit-medium"
                  style={{
                    color: urgency === opt.value ? opt.color : colors.textMuted,
                  }}
                >
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Preferred Date/Time Picker */}
          <Text
            className="text-[11px] font-outfit-black uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Preferred Visit Date/Time *
          </Text>
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-1 border rounded-[22px] px-5 py-5 flex-row items-center justify-between shadow-sm"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View>
                <Text
                  className="text-[9px] font-outfit-black uppercase tracking-widest mb-0.5"
                  style={{ color: colors.textMuted }}
                >
                  Date
                </Text>
                <Text
                  className="text-[15px] font-outfit-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {preferredDate.toLocaleDateString()}
                </Text>
              </View>
              <Clock size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTimeModalVisible(true)}
              className="flex-1 border rounded-[22px] px-5 py-5 flex-row items-center justify-between shadow-sm"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View>
                <Text
                  className="text-[9px] font-outfit-black uppercase tracking-widest mb-0.5"
                  style={{ color: colors.textMuted }}
                >
                  Time Slot
                </Text>
                <Text
                  className="text-[15px] font-outfit-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {preferredDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Clock size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={preferredDate}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          {/* Photo */}
          <Text
            className="text-[11px] font-outfit-black uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Attach Photo (Optional)
          </Text>
          {imageUri ? (
            <View className="mb-6 relative shadow-lg">
              <TouchableOpacity
                onPress={() => setPhotoModalVisible(true)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-52 rounded-[28px]"
                  resizeMode="cover"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                }}
                className="absolute top-3 right-3 bg-black/60 rounded-full w-9 h-9 items-center justify-center"
              >
                <X size={18} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setPhotoModalVisible(true)}
              className="w-full h-36 border-2 border-dashed rounded-[28px] items-center justify-center mb-6 gap-2 shadow-sm"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <Camera size={32} color={colors.textMuted} />
              <Text
                className="text-[14px] font-outfit-bold"
                style={{ color: colors.textSecondary }}
              >
                Tap to attach a photo
              </Text>
              <Text
                className="text-[11px] font-outfit-medium"
                style={{ color: colors.textMuted }}
              >
                of the wound, swelling, or symptom
              </Text>
            </TouchableOpacity>
          )}

          {/* Symptoms / Description */}
          <Text
            className="text-[11px] font-outfit-black uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Symptoms / Description *
          </Text>
          <TextInput
            className="border rounded-[28px] px-5 py-5 text-[14px] mb-8 shadow-sm font-outfit-medium"
            style={{
              minHeight: 140,
              textAlignVertical: "top",
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
            value={symptoms}
            onChangeText={setSymptoms}
            onFocus={() =>
              setTimeout(
                () => scrollRef.current?.scrollToEnd({ animated: true }),
                350,
              )
            }
            placeholder="Describe what you observed..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            blurOnSubmit={false}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            className="rounded-full py-5 items-center flex-row justify-center gap-2 shadow-xl"
            style={{
              backgroundColor: submitting ? "#f87171" : primaryColor,
              shadowColor: primaryColor,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <HeartPulse size={22} color="white" />
                <Text className="text-white font-outfit-black text-lg uppercase tracking-wider">
                  Submit Health Request
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Animal Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={animalModalVisible}
        onRequestClose={() => setAnimalModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="rounded-t-[40px] p-8 pb-12 max-h-[80%] shadow-2xl"
            style={{ backgroundColor: colors.card }}
          >
            <View
              className="w-12 h-1.5 rounded-full self-center mb-6"
              style={{
                backgroundColor: isDark ? colors.background : "#e2e8f0",
              }}
            />
            <View className="flex-row justify-between items-center mb-6">
              <Text
                className="text-[22px] font-outfit-black"
                style={{ color: colors.textPrimary }}
              >
                Select Animal
              </Text>
              <TouchableOpacity
                onPress={() => setAnimalModalVisible(false)}
                className="w-10 h-10 rounded-full items-center justify-center"
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
                <AlertCircle size={48} color={colors.textMuted} />
                <Text
                  className="text-center font-outfit-bold text-lg"
                  style={{ color: colors.textSecondary }}
                >
                  No animals found.
                </Text>
              </View>
            ) : (
              <FlatList
                data={animals}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedAnimal(item);
                      setAnimalModalVisible(false);
                    }}
                    className={`py-5 px-4 border-b flex-row items-center justify-between`}
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
                    <View className="flex-row items-center gap-4">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: isDark
                            ? colors.background
                            : "#f8fafc",
                        }}
                      >
                        <MaterialCommunityIcons
                          name="cow"
                          size={24}
                          color={
                            selectedAnimal?._id === item._id
                              ? primaryColor
                              : colors.textMuted
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-[16px] font-outfit-black"
                          style={{ color: colors.textPrimary }}
                        >
                          {item.animalId}
                          {item.earTag ? ` · ${item.earTag}` : ""}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                          <Text
                            className="text-[12px] font-outfit-medium"
                            style={{ color: colors.textMuted }}
                          >
                            {item.species} · {item.breed}
                          </Text>
                          {item.reproductiveStatus && (
                            <View
                              className={`px-2 py-0.5 rounded-full ${item.reproductiveStatus === "Pregnant" ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-200" : "bg-gray-100 dark:bg-slate-800"}`}
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
                      </View>
                      {selectedAnimal?._id === item._id && (
                        <Check size={20} color={primaryColor} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Request Type Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={typeModalVisible}
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="rounded-t-[40px] p-8 pb-12 shadow-2xl"
            style={{ backgroundColor: colors.card }}
          >
            <View
              className="w-12 h-1.5 rounded-full self-center mb-6"
              style={{
                backgroundColor: isDark ? colors.background : "#e2e8f0",
              }}
            />
            <View className="flex-row justify-between items-center mb-6">
              <Text
                className="text-[22px] font-outfit-black"
                style={{ color: colors.textPrimary }}
              >
                Request Type
              </Text>
              <TouchableOpacity
                onPress={() => setTypeModalVisible(false)}
                className="w-10 h-10 rounded-full items-center justify-center"
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
                className="py-5 px-4 border-b flex-row items-center justify-between"
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
                  className="text-[16px] font-outfit-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {type.label}
                </Text>
                {requestType === type.value && (
                  <Check size={20} color={primaryColor} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      {/* Time Slot Selection Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={timeModalVisible}
        onRequestClose={() => setTimeModalVisible(false)}
      >
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View
            className="rounded-[40px] p-8 shadow-2xl"
            style={{ backgroundColor: colors.card }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text
                  className="text-[22px] font-outfit-black"
                  style={{ color: colors.textPrimary }}
                >
                  Select Time Slot
                </Text>
                <Text
                  className="text-xs mt-1 font-outfit-medium"
                  style={{ color: colors.textMuted }}
                >
                  Available service hours: 8 AM - 5 PM
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTimeModalVisible(false)}
                className="p-2 rounded-full"
                style={{
                  backgroundColor: isDark ? colors.background : "#f8fafc",
                }}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-3 justify-between">
              {TIME_SLOTS.map((slot) => {
                const isSelected =
                  preferredDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }) === slot.replace(/^0/, "");
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => handleSelectTime(slot)}
                    className="w-[30%] py-4 rounded-[22px] items-center border"
                    style={{
                      backgroundColor: isSelected
                        ? primaryColor
                        : isDark
                          ? colors.background
                          : "#f8fafc",
                      borderColor: isSelected ? primaryColor : colors.border,
                    }}
                  >
                    <Text
                      className="text-[12px] font-outfit-black"
                      style={{
                        color: isSelected ? "#fff" : colors.textPrimary,
                      }}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setTimeModalVisible(false)}
              className="mt-8 py-5 rounded-[22px] items-center"
              style={{
                backgroundColor: isDark ? colors.background : "#f1f5f9",
              }}
            >
              <Text
                className="font-outfit-black"
                style={{ color: colors.textSecondary }}
              >
                CLOSE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo Selector Modal */}
      <Modal visible={photoModalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="rounded-t-[32px] p-6 pb-10"
            style={{ backgroundColor: colors.card }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text
                className="text-lg font-outfit-bold"
                style={{ color: colors.textPrimary }}
              >
                Select Photo Source
              </Text>
              <TouchableOpacity
                onPress={() => setPhotoModalVisible(false)}
                style={{ padding: 4 }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => {
                  setPhotoModalVisible(false);
                  takePhoto();
                }}
                className="w-[48%] py-5 rounded-2xl items-center justify-center border"
                style={{
                  backgroundColor: isDark ? colors.background : "#f8fafc",
                  borderColor: isDark ? colors.border : "#e2e8f0",
                }}
              >
                <Camera
                  size={24}
                  color={primaryColor}
                  style={{ marginBottom: 8 }}
                />
                <Text
                  className="font-outfit-bold text-xs"
                  style={{ color: colors.textPrimary }}
                >
                  Camera
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPhotoModalVisible(false);
                  pickImage();
                }}
                className="w-[48%] py-5 rounded-2xl items-center justify-center border"
                style={{
                  backgroundColor: isDark ? colors.background : "#f8fafc",
                  borderColor: isDark ? colors.border : "#e2e8f0",
                }}
              >
                <MaterialCommunityIcons
                  name="image-multiple"
                  size={24}
                  color={primaryColor}
                  style={{ marginBottom: 8 }}
                />
                <Text
                  className="font-outfit-bold text-xs"
                  style={{ color: colors.textPrimary }}
                >
                  Albums / Gallery
                </Text>
              </TouchableOpacity>
            </View>

            {imageUri && (
              <TouchableOpacity
                onPress={() => {
                  setPhotoModalVisible(false);
                  setImageUri(null);
                  setImageBase64(null);
                }}
                className="mt-4 py-4 rounded-2xl items-center justify-center border flex-row gap-2"
                style={{
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.1)"
                    : "#fef2f2",
                  borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
                }}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={20}
                  color="#ef4444"
                />
                <Text className="font-outfit-bold text-sm text-red-500">
                  Remove Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

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
        visible={pendingModalVisible}
        onClose={() => setPendingModalVisible(false)}
        onConfirm={() => setPendingModalVisible(false)}
        title="Request Already Pending"
        message="This animal already has an active health request waiting for a technician. Please wait for an update or contact support if urgent."
        confirmText="OK"
        cancelText={null}
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
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
    </View>
  );
}
