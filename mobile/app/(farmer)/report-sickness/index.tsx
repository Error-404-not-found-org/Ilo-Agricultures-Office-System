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
  Activity
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { validateRequestTime } from "@/lib/utils";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";

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
  { value: "other", label: "📋 Other" },
];

const URGENCY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    desc: "Can wait a few days",
    color: "#22c55e",
    bg: "#f0fdf4",
    darkBg: "#064e3b",
  },
  {
    value: "medium",
    label: "Medium",
    desc: "Needs attention soon",
    color: "#f59e0b",
    bg: "#fffbeb",
    darkBg: "#78350f",
  },
  {
    value: "high",
    label: "Urgent",
    desc: "Emergency / critical now",
    color: "#ef4444",
    bg: "#fef2f2",
    darkBg: "#7f1d1d",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportSickness() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);

  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [requestType, setRequestType] = useState("disease");
  const [urgency, setUrgency] = useState("medium");
  const [symptoms, setSymptoms] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState(new Date());

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

  const TIME_SLOTS = [
    "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // 1. Profile Completeness Check
    const hasPhone = farmer?.phoneNumber || profile?.phoneNumber;
    const hasAddress = farmer?.address?.barangay || profile?.address?.barangay;

    if (!hasPhone || !hasAddress) {
      Alert.alert(
        "Profile Incomplete",
        "Please provide your contact number and home address in your profile before submitting a request.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Go to Profile",
            onPress: () => router.push("/(farmer)/profile"),
          },
        ],
      );
      return;
    }

    if (!selectedAnimal) return toast.error("Please select an animal.");

    // Check for duplicate pending requests (safely handle the paginated response object)
    const requestsArray = Array.isArray(myHealthRequests) ? myHealthRequests : myHealthRequests?.data || [];
    const isAlreadyPending = requestsArray.some(
      (r: any) => r.animalId?._id === selectedAnimal._id && r.status === "pending"
    );
    if (isAlreadyPending) {
      return Alert.alert(
        "Request Already Pending",
        "This animal already has an active health request waiting for a technician. Please wait for an update or contact support if urgent."
      );
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
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const newDate = new Date(preferredDate);
    newDate.setHours(hours, minutes, 0, 0);
    setPreferredDate(newDate);
  };

  const selectedType = REQUEST_TYPES.find((t) => t.value === requestType);

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      <StatusBar barStyle="light-content" />

      {/* Red-tinted top bar to signal health/urgency */}
      <View className="absolute top-0 left-0 right-0 h-[260px] bg-[#b91c1c]" />

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
        className="flex-1 bg-[#F9FAFB] dark:bg-slate-950 rounded-t-[32px] px-6 pt-6 mt-2 shadow-2xl"
        style={{ elevation: 12 }}
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
                  source={{ uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png" }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>

              {/* Speech Bubble */}
              <View className="flex-1 bg-red-50 dark:bg-red-900/10 rounded-[28px] rounded-bl-none p-5 ml-[-15px] border border-red-100 dark:border-red-900/20 shadow-sm">
                <Text className="text-red-700 dark:text-red-400 font-outfit-black text-[13px] mb-1">
                  Moowie Support
                </Text>
                <Text className="text-slate-600 dark:text-slate-300 font-outfit-medium text-[12px] leading-[18px]">
                  "Oh no, is one of our friends not feeling well? 🐮 Don't worry, fill out the details and I'll make sure a technician sees this immediately!"
                </Text>
              </View>
            </View>
          </View>

          {/* Farmer Info Card */}
          <View
            className="bg-white dark:bg-slate-800 rounded-[28px] p-6 mb-6 border border-slate-100 dark:border-slate-700 shadow-sm"
          >
            <Text className="text-[10px] font-outfit-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              Your Information
            </Text>
            {loadingProfile && !farmer ? (
              <ActivityIndicator color="#b91c1c" />
            ) : farmer ? (
              <View className="gap-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full items-center justify-center">
                    <User size={18} color="#b91c1c" />
                  </View>
                  <View>
                    <Text className="text-[10px] text-slate-400 dark:text-slate-500 font-outfit-bold uppercase tracking-tighter">
                      Full Name
                    </Text>
                    <Text className="text-[15px] font-outfit-bold text-slate-800 dark:text-white">
                      {farmer.name}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full items-center justify-center mt-0.5">
                    <MapPin size={18} color="#b91c1c" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] text-slate-400 dark:text-slate-500 font-outfit-bold uppercase tracking-tighter">
                      Address
                    </Text>
                    <Text className="text-[15px] font-outfit-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {formatAddress(farmer.address)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <AlertCircle size={16} color="#ef4444" />
                <Text className="text-red-500 text-sm font-outfit-bold">
                  Could not load profile
                </Text>
              </View>
            )}
          </View>

          {/* Animal Picker */}
          <Text className="text-[11px] font-outfit-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Affected Animal *
          </Text>
          <TouchableOpacity
            onPress={() => setAnimalModalVisible(true)}
            className={`bg-white dark:bg-slate-800 border rounded-[22px] px-5 py-5 flex-row items-center justify-between mb-6 shadow-sm ${selectedAnimal ? "border-red-400 dark:border-red-500" : "border-slate-100 dark:border-slate-700"}`}
          >
            {selectedAnimal ? (
              <View>
                <Text className="text-[16px] font-outfit-black text-slate-800 dark:text-white">
                  {selectedAnimal.animalId}
                  {selectedAnimal.earTag ? ` · ${selectedAnimal.earTag}` : ""}
                </Text>
                <Text className="text-[13px] text-slate-400 dark:text-slate-500 font-outfit-medium">
                  {selectedAnimal.species} — {selectedAnimal.breed}
                </Text>
              </View>
            ) : (
              <Text className="text-slate-400 font-outfit-medium text-[15px]">
                Tap to choose an animal
              </Text>
            )}
            <ChevronDown
              size={20}
              color={selectedAnimal ? "#b91c1c" : "#94a3b8"}
            />
          </TouchableOpacity>

          {/* Request Type */}
          <Text className="text-[11px] font-outfit-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Request Type
          </Text>
          <TouchableOpacity
            onPress={() => setTypeModalVisible(true)}
            className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[22px] px-5 py-5 flex-row items-center justify-between mb-6 shadow-sm"
          >
            <Text className="text-[16px] font-outfit-bold text-slate-800 dark:text-white">
              {selectedType?.label || "Select type"}
            </Text>
            <ChevronDown size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Urgency Selector */}
          <Text className="text-[11px] font-outfit-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Urgency Level
          </Text>
          <View className="flex-row gap-3 mb-6">
            {URGENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setUrgency(opt.value)}
                className={`flex-1 rounded-[22px] py-4 px-2 items-center border-2 shadow-sm ${urgency === opt.value ? 'shadow-md' : ''}`}
                style={{
                  borderColor: urgency === opt.value ? opt.color : "transparent",
                  backgroundColor: urgency === opt.value ? opt.bg : "white",
                }}
              >
                <Text
                  className="text-[12px] font-outfit-black uppercase tracking-tighter"
                  style={{
                    color: urgency === opt.value ? opt.color : "#94a3b8",
                  }}
                >
                  {opt.label}
                </Text>
                <Text
                  className="text-[9px] text-center mt-1 font-outfit-medium"
                  style={{
                    color: urgency === opt.value ? opt.color : "#CBD5E1",
                  }}
                >
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Preferred Date/Time Picker */}
          <Text className="text-[11px] font-outfit-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Preferred Visit Date/Time *
          </Text>
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[22px] px-5 py-5 flex-row items-center justify-between shadow-sm"
            >
              <View>
                <Text className="text-[9px] text-slate-400 dark:text-slate-500 font-outfit-black uppercase tracking-widest mb-0.5">
                  Date
                </Text>
                <Text className="text-[15px] font-outfit-bold text-slate-800 dark:text-white">
                  {preferredDate.toLocaleDateString()}
                </Text>
              </View>
              <Clock size={16} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTimeModalVisible(true)}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[22px] px-5 py-5 flex-row items-center justify-between shadow-sm"
            >
              <View>
                <Text className="text-[9px] text-slate-400 dark:text-slate-500 font-outfit-black uppercase tracking-widest mb-0.5">
                  Time Slot
                </Text>
                <Text className="text-[15px] font-outfit-bold text-slate-800 dark:text-white">
                  {preferredDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Clock size={16} color="#94a3b8" />
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
          <Text className="text-[11px] font-outfit-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Attach Photo (Optional)
          </Text>
          {imageUri ? (
            <View className="mb-6 relative shadow-lg">
              <Image
                source={{ uri: imageUri }}
                className="w-full h-52 rounded-[28px]"
                resizeMode="cover"
              />
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
              onPress={pickImage}
              className="w-full h-36 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[28px] items-center justify-center mb-6 gap-2 shadow-sm"
            >
              <Camera size={32} color="#94a3b8" />
              <Text className="text-[14px] text-slate-400 dark:text-slate-500 font-outfit-bold">
                Tap to attach a photo
              </Text>
              <Text className="text-[11px] text-slate-300 dark:text-slate-500 font-outfit-medium">
                of the wound, swelling, or symptom
              </Text>
            </TouchableOpacity>
          )}

          {/* Symptoms / Description */}
          <Text className="text-[11px] font-outfit-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
            Symptoms / Description *
          </Text>
          <TextInput
            className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[28px] px-5 py-5 text-slate-800 dark:text-white text-[14px] mb-8 shadow-sm font-outfit-medium"
            style={{ minHeight: 140, textAlignVertical: "top" }}
            value={symptoms}
            onChangeText={setSymptoms}
            onFocus={() =>
              setTimeout(
                () => scrollRef.current?.scrollToEnd({ animated: true }),
                350,
              )
            }
            placeholder="Describe what you observed..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={5}
            blurOnSubmit={false}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            className={`rounded-full py-5 items-center flex-row justify-center gap-2 shadow-xl ${submitting ? "bg-red-400" : "bg-[#b91c1c] shadow-red-200"}`}
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
          <View className="bg-white dark:bg-slate-900 rounded-t-[40px] p-8 pb-12 max-h-[80%] shadow-2xl">
            <View className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full self-center mb-6" />
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[22px] font-outfit-black text-slate-800 dark:text-white">
                Select Animal
              </Text>
              <TouchableOpacity
                onPress={() => setAnimalModalVisible(false)}
                className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full items-center justify-center"
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {isLoadingAnimals ? (
              <View className="items-center py-20">
                <ActivityIndicator color="#b91c1c" size="large" />
                <Text className="text-slate-400 mt-4 font-outfit-bold">
                  Loading your animals...
                </Text>
              </View>
            ) : animals.length === 0 ? (
              <View className="items-center py-10 gap-3">
                <AlertCircle size={48} color="#E2E8F0" />
                <Text className="text-slate-400 text-center font-outfit-bold text-lg">
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
                    className={`py-5 px-4 border-b border-slate-50 dark:border-slate-800 flex-row items-center justify-between ${selectedAnimal?._id === item._id ? "bg-red-50 dark:bg-red-900/30 rounded-2xl" : ""}`}
                  >
                    <View className="flex-row items-center gap-4">
                       <View className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full items-center justify-center">
                          <MaterialCommunityIcons name="cow" size={24} color={selectedAnimal?._id === item._id ? "#b91c1c" : "#94a3b8"} />
                       </View>
                      <View className="flex-1">
                        <Text className="text-[16px] font-outfit-black text-slate-800 dark:text-white">
                          {item.animalId}
                          {item.earTag ? ` · ${item.earTag}` : ""}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                          <Text className="text-[12px] text-slate-400 dark:text-slate-500 font-outfit-medium">
                            {item.species} · {item.breed}
                          </Text>
                          {item.reproductiveStatus && (
                            <View className={`px-2 py-0.5 rounded-full ${item.reproductiveStatus === 'Pregnant' ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-200' : 'bg-gray-100 dark:bg-slate-800'}`}>
                              <Text className={`text-[9px] font-outfit-black uppercase ${item.reproductiveStatus === 'Pregnant' ? 'text-purple-600' : 'text-slate-500'}`}>{item.reproductiveStatus}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {selectedAnimal?._id === item._id && (
                        <Check size={20} color="#b91c1c" />
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
          <View className="bg-white dark:bg-slate-900 rounded-t-[40px] p-8 pb-12 shadow-2xl">
            <View className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full self-center mb-6" />
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[22px] font-outfit-black text-slate-800 dark:text-white">
                Request Type
              </Text>
              <TouchableOpacity
                onPress={() => setTypeModalVisible(false)}
                className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full items-center justify-center"
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            {REQUEST_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => {
                  setRequestType(type.value);
                  setTypeModalVisible(false);
                }}
                className={`py-5 px-4 border-b border-slate-50 dark:border-slate-800 flex-row items-center justify-between ${requestType === type.value ? "bg-red-50 dark:bg-red-900/30 rounded-2xl" : ""}`}
              >
                <Text className="text-[16px] text-slate-800 dark:text-white font-outfit-bold">
                  {type.label}
                </Text>
                {requestType === type.value && (
                  <Check size={20} color="#b91c1c" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      {/* Time Slot Selection Modal */}
      <Modal animationType="fade" transparent visible={timeModalVisible} onRequestClose={() => setTimeModalVisible(false)}>
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-[22px] font-outfit-black text-slate-800 dark:text-white">Select Time Slot</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-outfit-medium">Available service hours: 8 AM - 5 PM</Text>
              </View>
              <TouchableOpacity onPress={() => setTimeModalVisible(false)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-3 justify-between">
              {TIME_SLOTS.map((slot) => {
                const isSelected = preferredDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) === slot.replace(/^0/, '');
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => handleSelectTime(slot)}
                    className={`w-[30%] py-4 rounded-[22px] items-center border ${isSelected ? 'bg-red-600 border-red-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}
                  >
                    <Text className={`text-[12px] font-outfit-black ${isSelected ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{slot}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setTimeModalVisible(false)}
              className="mt-8 py-5 bg-slate-100 dark:bg-slate-800 rounded-[22px] items-center"
            >
              <Text className="text-slate-600 dark:text-slate-400 font-outfit-black">CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
