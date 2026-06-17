import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronDown,
  Check,
  X,
  Camera,
  Plus,
  Search,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useRef, useEffect, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { useApi } from "@/lib/api";
import { useUser } from "@clerk/clerk-expo";
import { toast } from "sonner-native";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CATTLE_BREEDS,
  CATTLE_SPECIES,
  CATTLE_COLORS,
  BREED_OPTIONS_BY_SPECIES,
  COLOR_OPTIONS_BY_SPECIES,
} from "@/lib/constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/lib/theme";
import EarTagGenerator from "@/components/EarTagGenerator";

// --- OPTIONS ---
const SPECIES_OPTIONS = CATTLE_SPECIES;
const BREED_OPTIONS = CATTLE_BREEDS;
const SPECIES_PREFIX: Record<string, string> = {
  "Beef Cattle": "BEF",
  "Dairy Cattle": "DAI",
  Carabao: "CBU",
};

export default function FarmerAnimalsHub() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const api = useApi();
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  // --- View State ---
  const [showAddForm, setShowAddForm] = useState(false);

  const params = useLocalSearchParams();
  const openForm = params?.openForm;

  useFocusEffect(
    useCallback(() => {
      if (openForm === "true") {
        setShowAddForm(true);
        router.setParams({ openForm: "" });
      }

      return () => {
        setShowAddForm(false);
      };
    }, [openForm]),
  );

  const queryClient = useQueryClient();

  // --- List State ---
  const [searchQuery, setSearchQuery] = useState("");

  // --- Fetch Animals via React Query ---
  const {
    data: animalsData,
    isLoading: loadingList,
    refetch,
    isRefetching: refreshing,
  } = useQuery({
    queryKey: ["animals", "my-all"],
    queryFn: async () => {
      try {
        const res = await api.get("/animals/my?limit=100");
        const body = res.data;
        // Handle both direct array and object-wrapped responses
        const list = Array.isArray(body) ? body : body?.data || [];
        return list;
      } catch (err) {
        console.error("Failed to fetch animals:", err);
        return [];
      }
    },
    refetchInterval: 5000,
  });

  const animals = Array.isArray(animalsData) ? animalsData : [];

  // --- Form State ---
  const [formData, setFormData] = useState({
    earTag: "",
    brand: "",
    species: "",
    breed: "",
    color: "",
    gender: "Female",
    birthDate: "",
  });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  useEffect(() => {
    if (formData.species) {
      const validBreeds = BREED_OPTIONS_BY_SPECIES[formData.species] || [];
      if (formData.breed && !validBreeds.includes(formData.breed)) {
        setFormData((prev) => ({ ...prev, breed: "" }));
      }
      const validColors = COLOR_OPTIONS_BY_SPECIES[formData.species] || [];
      if (formData.color && !validColors.includes(formData.color)) {
        setFormData((prev) => ({ ...prev, color: "" }));
      }
    }
  }, [formData.species]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      return await api.post("/animals/register", payload);
    },
    onSuccess: async () => {
      toast.success("Animal added successfully!");
      setShowAddForm(false);

      // CRITICAL: Invalidate and refetch all relevant queries to update UI immediately
      await queryClient.refetchQueries({ queryKey: ["animals"] });
      await queryClient.refetchQueries({ queryKey: ["user", "me"] });

      // Reset form
      setFormData({
        earTag: "",
        brand: "",
        species: "",
        breed: "",
        color: "",
        gender: "Female",
        birthDate: "",
      });
      setImageUri(null);
      setImageBase64(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to register animal.");
    },
  });

  const loadingForm = mutation.isPending;

  // --- Form Handlers ---
  // --- Form Handlers ---
  const handleSave = async () => {
    if (loadingForm) return;
    if (!formData.species || !formData.breed || !formData.earTag?.trim())
      return toast.error(
        "Please fill all required fields (Species, Breed, and Ear Tag).",
      );

    let birthDate = undefined;
    if (formData.birthDate) {
      birthDate = new Date(formData.birthDate).toISOString();
    }

    mutation.mutate({
      ...formData,
      imageUrl: imageBase64,
      birthDate,
    });
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      toast.error("Permission to access camera was denied");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // --- Modals ---
  const [modal, setModal] = useState({
    visible: false,
    title: "",
    options: [],
    field: "",
  });
  const openModal = (field: string, title: string, options: any) =>
    setModal({ visible: true, title, options, field });

  const filteredAnimals = (animals || []).filter(
    (a: any) =>
      (a.animalId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.breed || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <View
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <StatusBar barStyle="light-content" />
      <View
        className="absolute top-0 left-0 right-0 h-[220px]"
        style={{ backgroundColor: "#00643B" }}
      />

      {/* --- HEADER --- */}
      <View
        style={{ paddingTop: insets.top + 16 }}
        className="px-6 pb-6 flex-row items-center justify-between z-10"
      >
        <View className="flex-row items-center gap-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center border border-white/10"
            style={{
              backgroundColor: isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(255,255,255,0.2)",
            }}
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-[22px] font-outfit-black text-white leading-tight">
              My Animals
            </Text>
            <Text className="text-[12px] text-emerald-100 font-outfit-medium opacity-90">
              Herd management & registry
            </Text>
          </View>
        </View>
        {!showAddForm && (
          <TouchableOpacity
            onPress={() => setShowAddForm(true)}
            className="flex-row items-center gap-1.5 px-4 py-2 rounded-full shadow-sm"
            style={{ backgroundColor: colors.card }}
          >
            <Plus size={16} color={isDark ? colors.primary : "#00643B"} />
            <Text
              className="text-[12px] font-outfit-bold"
              style={{ color: isDark ? colors.primary : "#00643B" }}
            >
              Add Animal
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        className="flex-1 bg-[#F9FAFB] dark:bg-slate-950 rounded-t-[32px] px-6 pt-6 mt-2 shadow-lg"
        style={{ elevation: 8, backgroundColor: colors.background }}
      >
        {/* --- MOOWIE GREETING SECTION (Inspired by Tarsi) --- */}
        <View className="mb-8">
          <Text className="text-[10px] font-outfit-black text-slate-400 mb-1 ml-1 uppercase tracking-[2px]">
            {format(new Date(), "EEEE, MMMM d").toUpperCase()}
          </Text>
          <Text className="text-[24px] font-outfit-black text-slate-800 dark:text-white mb-6 ml-1 leading-tight">
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 18
                ? "afternoon"
                : "evening"}
            , {user?.firstName || user?.username || "Farmer"}!
          </Text>

          <View className="flex-row items-end">
            {/* Mascot Container */}
            <View className="w-28 h-28 -mb-2 z-10">
              <Image
                source={{
                  uri: "https://res.cloudinary.com/donhulins/image/upload/v1778124094/moowie_hi_animals_section_xbocgj.png",
                }}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>

            {/* Speech Bubble */}
            <View className="flex-1 bg-white dark:bg-slate-800 rounded-[28px] rounded-bl-none p-5 ml-[-15px] border border-emerald-100/50 dark:border-emerald-900/20 shadow-sm">
              <Text className="text-emerald-700 dark:text-emerald-400 font-outfit-black text-[13px] mb-1">
                Moowie
              </Text>
              <Text className="text-slate-600 dark:text-slate-300 font-outfit-medium text-[12px] leading-[18px]">
                {showAddForm
                  ? "Yay! A new addition to the family! 🐮 I'm so excited to meet them. Fill in the details below so we can start tracking their progress!"
                  : loadingList
                    ? "Checking your herd data..."
                    : animals.length > 0
                      ? `Your herd is looking great! You have ${animals.length} cattle registered in the system. Keep them healthy!`
                      : "Welcome to your new herd registry! Tap the + button at the top right to add your first animal."}
              </Text>
            </View>
          </View>
        </View>

        {showAddForm ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-[18px] font-outfit-bold text-slate-800 dark:text-white">
                  Register New Animal
                </Text>
                <TouchableOpacity onPress={() => setShowAddForm(false)}>
                  <Text className="text-red-500 font-outfit-bold text-sm">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Photo Pick */}
              <View className="align-center items-center mb-8">
                <TouchableOpacity
                  onPress={() => setPhotoModalVisible(true)}
                  className="bg-slate-50 dark:bg-slate-800 h-24 w-24 rounded-full items-center justify-center border border-slate-200 dark:border-slate-700 border-dashed overflow-hidden"
                >
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} className="w-full h-full" />
                  ) : (
                    <Camera size={28} color="#94a3b8" />
                  )}
                </TouchableOpacity>
                <Text
                  className="mt-2 text-[12px] font-outfit-bold text-center"
                  style={{ color: colors.textSecondary }}
                >
                  {imageUri ? "Change Photo" : "Add Photo"}
                </Text>
              </View>

              <View className="mb-4">
                <InputField
                  label="Ear Tag"
                  value={formData.earTag}
                  maxLength={10}
                  onChangeText={(t: any) =>
                    setFormData({ ...formData, earTag: t })
                  }
                  placeholder="Tag #"
                />
                <View className="mt-1 ml-1">
                  <EarTagGenerator
                    farmerName={
                      user?.fullName ||
                      user?.username ||
                      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                      "Farmer"
                    }
                    animalCount={animals.length}
                    onGenerate={(tag) =>
                      setFormData({ ...formData, earTag: tag })
                    }
                    isDark={isDark}
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <SelectField
                  label="Species"
                  value={formData.species}
                  onPress={() =>
                    openModal("species", "Select Species", SPECIES_OPTIONS)
                  }
                />
                <SelectField
                  label="Breed"
                  value={formData.breed}
                  onPress={() => {
                    if (!formData.species) {
                      toast.error("Please select a species first.");
                      return;
                    }
                    openModal(
                      "breed",
                      "Select Breed",
                      BREED_OPTIONS_BY_SPECIES[formData.species] || [],
                    );
                  }}
                />
              </View>

              <View className="flex-row gap-3">
                <SelectField
                  label="Color"
                  value={formData.color}
                  onPress={() => {
                    if (!formData.species) {
                      toast.error("Please select a species first.");
                      return;
                    }
                    openModal(
                      "color",
                      "Select Color",
                      COLOR_OPTIONS_BY_SPECIES[formData.species] || [],
                    );
                  }}
                />
                <InputField
                  label="Brand/Markings"
                  value={formData.brand}
                  maxLength={15}
                  onChangeText={(t: any) =>
                    setFormData({ ...formData, brand: t })
                  }
                  placeholder="Optional"
                />
              </View>

              <View className="flex-row gap-3">
                <SelectField
                  label="Gender"
                  value={formData.gender}
                  onPress={() =>
                    openModal("gender", "Select Gender", ["Female", "Male"])
                  }
                />
                <SelectField
                  label="Birth Date"
                  value={formData.birthDate || "Select Date"}
                  onPress={() => {
                    setTempDate(
                      formData.birthDate
                        ? new Date(formData.birthDate)
                        : new Date(),
                    );
                    setShowDatePicker(true);
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={loadingForm}
                className="rounded-full py-4 items-center mt-4 shadow-md"
                style={{
                  backgroundColor: loadingForm
                    ? "#34d399"
                    : isDark
                      ? colors.primary
                      : "#00643B",
                  shadowColor: isDark ? colors.primary : "#a7f3d0",
                }}
              >
                {loadingForm ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-outfit-bold text-base">
                    Add to My Farm
                  </Text>
                )}
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === "android") {
                      // 1. User pressed "OK"
                      if (event.type === "set") {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          setTempDate(selectedDate);
                          setFormData({
                            ...formData,
                            birthDate: selectedDate.toISOString().split("T")[0],
                          });
                        }
                      }
                      // 2. User pressed "Cancel" / clicked outside
                      else if (event.type === "dismissed") {
                        setShowDatePicker(false);
                      }
                      // 3. IGNORE intermediate scrolling events on Android.
                      // Do absolutely nothing here to prevent re-renders.
                    } else {
                      // iOS Behavior (Updates inline/on-scroll beautifully)
                      if (selectedDate) {
                        setTempDate(selectedDate);
                        setFormData({
                          ...formData,
                          birthDate: selectedDate.toISOString().split("T")[0],
                        });
                      }
                      // Note: For iOS, you usually want to keep setShowDatePicker(true)
                      // if using "spinner" or "inline" display style, but if you want
                      // it to close immediately on change, keep it false as you had it.
                      setShowDatePicker(false);
                    }
                  }}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <View className="flex-1">
            {/* Search */}
            <View
              className="flex-row items-center bg-white dark:bg-slate-900 rounded-2xl px-4 h-12 mb-4 border border-slate-100 dark:border-slate-800 shadow-sm"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <Search size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Search by ID or breed..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 ml-3 font-outfit-medium text-slate-800 dark:text-white text-sm"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {loadingList ? (
              <ActivityIndicator
                color={isDark ? colors.primary : "#00643B"}
                className="mt-10"
              />
            ) : filteredAnimals.length === 0 ? (
              <View className="items-center py-20">
                <MaterialCommunityIcons
                  name="cow-off"
                  size={48}
                  color={colors.textMuted}
                />
                <Text className="text-slate-400 dark:text-slate-500 font-outfit-bold text-base mt-2 text-center">
                  {animals.length === 0
                    ? "No animals registered yet"
                    : "No animals found"}
                </Text>
                {animals.length === 0 && (
                  <TouchableOpacity
                    onPress={() => setShowAddForm(true)}
                    className="mt-6 px-6 py-3 rounded-full flex-row items-center gap-2 shadow-md"
                    style={{
                      backgroundColor: isDark ? colors.primary : "#00643B",
                      shadowColor: isDark ? colors.primary : "#a7f3d0",
                    }}
                  >
                    <Plus size={18} color="white" />
                    <Text className="text-white font-outfit-bold text-sm">
                      Add New Animal
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredAnimals}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() =>
                      router.push(`/(farmer)/animal-details?id=${item._id}`)
                    }
                    className="bg-white dark:bg-slate-900 rounded-[24px] p-4 mb-3 border border-slate-50 dark:border-slate-800 flex-row items-center shadow-sm"
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }}
                  >
                    <View className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 items-center justify-center mr-4">
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          className="w-full h-full rounded-xl"
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="cow"
                          size={24}
                          color={isDark ? colors.primary : "#00643B"}
                        />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="font-outfit-bold text-slate-800 dark:text-white text-[15px]">
                        {item.animalId}
                      </Text>
                      <Text className="font-outfit-medium text-slate-500 dark:text-slate-400 text-[11px]">
                        {item.breed} • {item.species}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refetch}
                    colors={[isDark ? colors.primary : "#00643B"]}
                  />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
              />
            )}
          </View>
        )}
      </View>

      <Modal visible={modal.visible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10"
            style={{ backgroundColor: colors.card }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-outfit-bold text-slate-800 dark:text-white">
                {modal.title}
              </Text>
              <TouchableOpacity
                onPress={() => setModal({ ...modal, visible: false })}
                style={{ padding: 4 }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap justify-between">
              {modal.options.map((opt: string) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    setFormData({ ...formData, [modal.field]: opt });
                    setModal({ ...modal, visible: false });
                  }}
                  className="w-[48%] py-4 rounded-2xl items-center justify-center mb-3 border active:bg-emerald-50 dark:active:bg-emerald-950/20"
                  style={{
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                    borderColor: isDark ? colors.border : "#e2e8f0",
                  }}
                >
                  <Text
                    className="font-outfit-bold text-[11px] uppercase tracking-tight text-center px-1"
                    style={{ color: colors.textPrimary }}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={photoModalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10"
            style={{ backgroundColor: colors.card }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-outfit-bold text-slate-800 dark:text-white">
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
                <Camera size={24} color={colors.primary} style={{ marginBottom: 8 }} />
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
                <MaterialCommunityIcons name="image-multiple" size={24} color={colors.primary} style={{ marginBottom: 8 }} />
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
                  backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
                  borderColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
                }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
                <Text className="font-outfit-bold text-sm text-red-500">
                  Remove Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
}: any) => {
  const { colors, isDark } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text className="text-[10px] font-outfit-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3.5 font-outfit-medium text-slate-800 dark:text-white text-sm"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
};

const SelectField = ({ label, value, onPress }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text className="text-[10px] font-outfit-black text-slate-400 dark:text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3.5 flex-row justify-between items-center"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          height: 50,
        }}
      >
        <Text
          className="font-outfit-medium text-sm"
          style={{ color: value ? colors.textPrimary : colors.textMuted }}
        >
          {value || "Select"}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};
