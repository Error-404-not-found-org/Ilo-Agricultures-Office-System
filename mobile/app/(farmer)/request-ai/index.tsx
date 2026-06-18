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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Syringe,
  User,
  MapPin,
  ChevronDown,
  Camera,
  X,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react-native";
import React, { useState, useEffect, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { validateRequestTime } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { checkInseminationAgeEligibility } from "@/lib/cattleCore";

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
    description: "Cows stands perfectly still when mounted by others. The definitive sign of true peak heat.",
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
    description: "Actively sniffing other cows' vulva and curling the upper lip.",
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
    description: "Blood-stained mucus 1-3 days after heat, indicating heat window has closed.",
    category: "secondary_physical",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function RequestAI() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : "#00643B";

  // Data states
  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);

  // Form states
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState(new Date());

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [maleModalVisible, setMaleModalVisible] = useState(false);
  const [pregnantModalVisible, setPregnantModalVisible] = useState(false);
  const [pregnantSubmitModalVisible, setPregnantSubmitModalVisible] = useState(false);
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [ageCheckReason, setAgeCheckReason] = useState("");

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

  const { data: config } = useQuery({
    queryKey: ["system", "config"],
    queryFn: async () => {
      const res = await api.get("/config");
      return res.data;
    },
  });

  const mutation = useOfflineMutation(
    {
      url: "/ai-request",
      method: "POST",
      description: `AI Request for ${selectedAnimal?.earTag || "Livestock"}`,
    },
    {
      onSuccess: () => {
        toast.success(
          "AI request submitted! A technician will contact you soon.",
          { duration: 4000, position: "top-center" },
        );
        // Reset Form
        setSelectedAnimal(null);
        setComment("");
        setImageUri(null);
        setImageBase64(null);

        queryClient.invalidateQueries({ queryKey: ["farmer", "requests"] });
        router.back();
      },
      onError: (error: any) => {
        if (error.message !== "OFFLINE_SAVED") {
          toast.error(
            error.response?.data?.message ||
              "Failed to submit request. Please try again.",
          );
        } else {
          router.back();
        }
      },
    },
  );

  const submitting = mutation.isPending;

  // UI states
  const [animalModalVisible, setAnimalModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

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

  const { data: animalsData, isLoading: isLoadingAnimals } = useQuery({
    queryKey: ["animals", "my-all"],
    queryFn: async () => {
      const res = await api.get("/animals/my?limit=100");
      return res.data;
    },
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

  const removeImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const handleSubmit = async () => {
    const hasPhone = farmer?.phoneNumber || profile?.phoneNumber;
    const hasAddress = farmer?.address?.barangay || profile?.address?.barangay;

    if (!hasPhone || !hasAddress) {
      setProfileModalVisible(true);
      return;
    }

    if (!selectedAnimal)
      return toast.error("Please select an animal for this request.");

    if (selectedAnimal.reproductiveStatus === "Pregnant") {
      setPregnantSubmitModalVisible(true);
      return;
    }

    const ageCheck = checkInseminationAgeEligibility(selectedAnimal.birthDate, selectedAnimal.species);
    if (!ageCheck.isEligible) {
      setAgeCheckReason(ageCheck.reason || "Animal is too young for insemination.");
      setAgeModalVisible(true);
      return;
    }

    if (selectedSigns.length === 0) {
      return toast.error("Please select at least 1 observed heat sign.");
    }

    if (selectedSigns.length > 5) {
      return toast.error("You can select a maximum of 5 heat signs.");
    }

    const validation = validateRequestTime(preferredDate, !!config?.isHoliday);
    if (!validation.isValid) {
      return toast.error(validation.message || "Invalid request time.", {
        duration: 5000,
      });
    }

    const selectedLabels = HEAT_SIGNS.filter((s) => selectedSigns.includes(s.id)).map(
      (s) => `• ${s.label}`
    );
    const formattedComment = [
      "Observed Heat Signs:\n" + selectedLabels.join("\n"),
      comment.trim() ? `Additional Notes:\n${comment.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    mutation.mutate({
      animalId: selectedAnimal._id,
      imageUrl: imageBase64,
      comment: formattedComment,
      heatSigns: selectedSigns,
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

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <View
        className="absolute top-0 left-0 right-0 h-[230px]"
        style={{ backgroundColor: "#00643B" }}
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
          <Text className="text-[20px] font-bold text-white leading-tight">
            Request AI Service
          </Text>
          <Text className="text-[12px] text-emerald-100 font-medium">
            Artificial Insemination Request
          </Text>
        </View>
      </View>

      {/* Content card */}
      <View
        className="flex-1 rounded-t-[32px] px-6 pt-6 mt-2"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 15,
          elevation: 8,
          backgroundColor: colors.background,
        }}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 160 }}
        >
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
            <Text
              className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: colors.textMuted }}
            >
              Your Information
            </Text>

            {loadingProfile && !farmer ? (
              <ActivityIndicator color={primaryColor} />
            ) : farmer ? (
              <View className="gap-3">
                {/* Name */}
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.tint }}
                  >
                    <User size={15} color={primaryColor} />
                  </View>
                  <View>
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.textMuted }}
                    >
                      Full Name
                    </Text>
                    <Text
                      className="text-[14px] font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      {farmer.name}
                    </Text>
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
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.textMuted }}
                    >
                      Address
                    </Text>
                    <Text
                      className="text-[14px] font-semibold leading-tight"
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
                <Text className="text-sm" style={{ color: colors.error }}>
                  Could not load profile
                </Text>
              </View>
            )}
          </View>

          {/* ── Animal Picker ─────────────────────────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Select Animal *
          </Text>
          <TouchableOpacity
            onPress={() => setAnimalModalVisible(true)}
            className="border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-5"
            style={{
              elevation: 1,
              backgroundColor: colors.card,
              borderColor: selectedAnimal ? primaryColor : colors.border,
            }}
          >
            {selectedAnimal ? (
              <View>
                <Text
                  className="text-[15px] font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {selectedAnimal.animalId}
                  {selectedAnimal.earTag ? ` · ${selectedAnimal.earTag}` : ""}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: colors.textSecondary }}
                >
                  {selectedAnimal.species} — {selectedAnimal.breed}
                </Text>
              </View>
            ) : (
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                Tap to choose an animal
              </Text>
            )}
            <ChevronDown
              size={20}
              color={selectedAnimal ? primaryColor : colors.textMuted}
            />
          </TouchableOpacity>

          {/* ── Preferred Date/Time Picker ───────────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Preferred Visit Date/Time *
          </Text>
          <View className="flex-row gap-3 mb-5">
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-1 border rounded-2xl px-4 py-4 flex-row items-center justify-between"
              style={{
                elevation: 1,
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View>
                <Text
                  className="text-[11px] font-medium uppercase tracking-widest"
                  style={{ color: colors.textMuted }}
                >
                  Date
                </Text>
                <Text
                  className="text-[15px] font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {preferredDate.toLocaleDateString()}
                </Text>
              </View>
              <Clock size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTimeModalVisible(true)}
              className="flex-1 border rounded-2xl px-4 py-4 flex-row items-center justify-between"
              style={{
                elevation: 1,
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <View>
                <Text
                  className="text-[11px] font-medium uppercase tracking-widest"
                  style={{ color: colors.textMuted }}
                >
                  Time Slot
                </Text>
                <Text
                  className="text-[15px] font-bold"
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

          {/* ── Observed Heat Signs Checklists ───────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
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
                  {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                </View>
                <View className="flex-1">
                  <Text
                    className="font-bold text-sm"
                    style={{ color: colors.textPrimary }}
                  >
                    {sign.label}
                  </Text>
                  <Text className="text-xs mt-1 leading-normal" style={{ color: colors.textMuted }}>
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
                <Text className="font-bold text-red-600 text-sm">Metestrus Bleeding Warning</Text>
                <Text className="text-xs mt-1 text-red-500 leading-relaxed">
                  Bleeding indicates ovulation has already occurred and the current heat window is closed. Artificial Insemination (AI) is unlikely to succeed. We recommend waiting for the next window, expected in approximately 18-24 days.
                </Text>
              </View>
            </View>
          )}

          {selectedSigns.length > 0 && !selectedSigns.includes("standing_heat") && (
            <View
              className="p-4 rounded-2xl mb-5 flex-row gap-3 border"
              style={{
                backgroundColor: isDark ? "rgba(245, 158, 11, 0.1)" : "#fffbeb",
                borderColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7",
              }}
            >
              <AlertCircle size={20} color="#f59e0b" className="mt-0.5" />
              <View className="flex-1">
                <Text className="font-bold text-amber-600 text-sm">Standing Heat Advisory</Text>
                <Text className="text-xs mt-1 text-amber-500 leading-relaxed">
                  "Standing to be Mounted" is the gold standard indicator of true peak heat. Proceeding with AI based solely on secondary signs might result in a lower success rate.
                </Text>
              </View>
            </View>
          )}

          {/* ── Photo Attachment ─────────────────────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Attach Photo (Optional)
          </Text>
          {imageUri ? (
            <View className="mb-5 relative">
              <TouchableOpacity
                onPress={() => setPhotoModalVisible(true)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-48 rounded-2xl"
                  resizeMode="cover"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={removeImage}
                className="absolute top-2 right-2 bg-black/50 rounded-full w-8 h-8 items-center justify-center"
              >
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setPhotoModalVisible(true)}
              className="w-full h-36 border-2 border-dashed rounded-2xl items-center justify-center mb-5 gap-2"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <Camera size={28} color={colors.textMuted} />
              <Text
                className="text-sm font-medium"
                style={{ color: colors.textSecondary }}
              >
                Tap to attach a photo
              </Text>
              <Text className="text-xs" style={{ color: colors.textMuted }}>
                of the animal in heat
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Comment Box ──────────────────────────────────────────────── */}
          <Text
            className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
            style={{ color: colors.textMuted }}
          >
            Additional Comments / Notes (Optional)
          </Text>
          <TextInput
            className="border rounded-2xl px-4 py-4 text-sm mb-6"
            style={{
              minHeight: 120,
              textAlignVertical: "top",
              elevation: 1,
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
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
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            className="rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg"
            style={{
              backgroundColor: submitting ? "#34d399" : primaryColor,
              shadowColor: primaryColor,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Syringe size={20} color="white" />
                <Text className="text-white font-bold text-lg">
                  Submit AI Request
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Animal Selection Modal ──────────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={animalModalVisible}
        onRequestClose={() => setAnimalModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="rounded-t-[32px] p-6 pb-12 max-h-[75%]"
            style={{ backgroundColor: colors.card }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                Select Animal
              </Text>
              <TouchableOpacity
                onPress={() => setAnimalModalVisible(false)}
                className="p-1 rounded-full"
                style={{
                  backgroundColor: isDark ? colors.background : "#f1f5f9",
                }}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {isLoadingAnimals ? (
              <View className="items-center py-20">
                <ActivityIndicator color={primaryColor} size="large" />
                <Text
                  className="mt-4 font-medium"
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
                  Please register an animal first before requesting AI.
                </Text>
              </View>
            ) : (
              <FlatList
                data={animals}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      if (item.reproductiveStatus === "Pregnant") {
                        setPregnantModalVisible(true);
                        return;
                      }
                      if (item.gender === "Male") {
                        setMaleModalVisible(true);
                        return;
                      }
                      const ageCheck = checkInseminationAgeEligibility(item.birthDate, item.species);
                      if (!ageCheck.isEligible) {
                        setAgeCheckReason(ageCheck.reason || "Animal is too young for insemination.");
                        setAgeModalVisible(true);
                        return;
                      }
                      setSelectedAnimal(item);
                      setAnimalModalVisible(false);
                    }}
                    className={`py-4 px-3 border-b flex-row items-center justify-between ${(item.reproductiveStatus === "Pregnant" || item.gender === "Male" || !checkInseminationAgeEligibility(item.birthDate, item.species).isEligible) ? "opacity-50" : ""}`}
                    style={{
                      borderBottomColor: colors.border,
                      backgroundColor:
                        selectedAnimal?._id === item._id
                          ? colors.tint
                          : undefined,
                      borderRadius: selectedAnimal?._id === item._id ? 16 : 0,
                    }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="flex-1">
                        <Text
                          className="text-[15px] font-bold"
                          style={{ color: colors.textPrimary }}
                        >
                          {item.animalId}
                          {item.earTag ? ` · ${item.earTag}` : ""}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                          <Text
                            className="text-xs"
                            style={{ color: colors.textMuted }}
                          >
                            {item.species} · {item.breed}
                          </Text>
                          {item.reproductiveStatus && (
                            <View
                              className={`px-2 py-0.5 rounded-full ${item.reproductiveStatus === "Pregnant" ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-200" : "bg-gray-100 dark:bg-slate-800"}`}
                            >
                              <Text
                                className={`text-[9px] font-black uppercase ${item.reproductiveStatus === "Pregnant" ? "text-purple-600" : "text-gray-500"}`}
                              >
                                {item.reproductiveStatus}
                              </Text>
                            </View>
                          )}
                          {item.gender === "Male" && (
                            <View className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200">
                              <Text className="text-[9px] font-black uppercase text-red-600">
                                Male
                              </Text>
                            </View>
                          )}
                          {!checkInseminationAgeEligibility(item.birthDate, item.species).isEligible && (
                            <View className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200">
                              <Text className="text-[9px] font-black uppercase text-amber-600">
                                Underage
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {item.reproductiveStatus === "Pregnant" && (
                        <AlertCircle size={16} color="#9333ea" />
                      )}
                      {item.gender === "Male" && (
                        <AlertCircle size={16} color="#ef4444" />
                      )}
                      {!checkInseminationAgeEligibility(item.birthDate, item.species).isEligible && (
                        <AlertCircle size={16} color="#d97706" />
                      )}
                      {selectedAnimal?._id === item._id && (
                        <Check size={18} color={primaryColor} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Time Slot Selection Modal ─────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={timeModalVisible}
        onRequestClose={() => setTimeModalVisible(false)}
      >
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View
            className="rounded-[32px] p-6 shadow-2xl"
            style={{ backgroundColor: colors.card }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  Select Time Slot
                </Text>
                <Text
                  className="text-xs mt-1"
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
                    className="w-[30%] py-3 rounded-2xl items-center border"
                    style={{
                      backgroundColor: isSelected
                        ? isDark
                          ? colors.primary
                          : "#00643B"
                        : isDark
                          ? colors.background
                          : "#f8fafc",
                      borderColor: isSelected
                        ? isDark
                          ? colors.primary
                          : "#00643B"
                        : colors.border,
                    }}
                  >
                    <Text
                      className="text-[12px] font-bold"
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
              className="mt-8 py-4 rounded-2xl items-center"
              style={{
                backgroundColor: isDark ? colors.background : "#f1f5f9",
              }}
            >
              <Text
                className="font-bold"
                style={{ color: colors.textSecondary }}
              >
                Close
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
              <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
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
                <Camera size={24} color={primaryColor} style={{ marginBottom: 8 }} />
                <Text
                  className="font-bold text-xs"
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
                <MaterialCommunityIcons name="image-multiple" size={24} color={primaryColor} style={{ marginBottom: 8 }} />
                <Text
                  className="font-bold text-xs"
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
                  removeImage();
                }}
                className="mt-4 py-4 rounded-2xl items-center justify-center border flex-row gap-2"
                style={{
                  backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
                  borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
                }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
                <Text className="font-bold text-sm text-red-500">
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
        message="Please provide your contact number and home address in your profile before requesting AI services."
        confirmText="Go to Profile"
        cancelText="Cancel"
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />

      <ConfirmationModal
        visible={maleModalVisible}
        onClose={() => setMaleModalVisible(false)}
        onConfirm={() => setMaleModalVisible(false)}
        title="Selection Unavailable"
        message="This animal is Male. Insemination is restricted to female animals only."
        confirmText="OK"
        cancelText={null}
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />

      <ConfirmationModal
        visible={pregnantModalVisible}
        onClose={() => setPregnantModalVisible(false)}
        onConfirm={() => setPregnantModalVisible(false)}
        title="Selection Unavailable"
        message="This animal is currently pregnant and cannot be selected for A.I. services."
        confirmText="OK"
        cancelText={null}
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />

      <ConfirmationModal
        visible={pregnantSubmitModalVisible}
        onClose={() => setPregnantSubmitModalVisible(false)}
        onConfirm={() => setPregnantSubmitModalVisible(false)}
        title="Action Blocked"
        message="This animal is already marked as Pregnant. You cannot request artificial insemination unless you report heat signs first from the animal's profile."
        confirmText="OK"
        cancelText={null}
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />

      <ConfirmationModal
        visible={ageModalVisible}
        onClose={() => setAgeModalVisible(false)}
        onConfirm={() => setAgeModalVisible(false)}
        title="Selection Unavailable"
        message={ageCheckReason}
        confirmText="OK"
        cancelText={null}
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />
    </View>
  );
}
