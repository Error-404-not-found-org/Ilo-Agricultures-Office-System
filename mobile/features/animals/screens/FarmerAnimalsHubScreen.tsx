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
import { safeBack } from "@/utils/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronDown,
  Camera,
  Plus,
  Search,
  X,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useRef, useEffect, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import { toast } from "sonner-native";
import { format } from "date-fns";
import {
  CATTLE_BREEDS,
  CATTLE_SPECIES,
  BREED_OPTIONS_BY_SPECIES,
  COLOR_OPTIONS_BY_SPECIES,
} from "@/lib/constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/lib/theme";
import EarTagGenerator from "@/components/EarTagGenerator";
import { useTranslation } from "../../../contexts/TranslationContext";
import {
  useMyAnimalsInfiniteQuery,
  useRegisterAnimalMutation,
} from "../hooks/useMyAnimals";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { AnimalCardSkeletonList } from "../components/skeletons/AnimalCardSkeleton";
import { AnimalRegistryCard } from "../components/AnimalRegistryCard";

const SPECIES_OPTIONS = CATTLE_SPECIES;

export function FarmerAnimalsHubScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // --- View State ---
  const [showAddForm, setShowAddForm] = useState(false);

  const params = useLocalSearchParams();
  const openForm = params?.openForm;

  useEffect(() => {
    if (openForm === "true") {
      router.push("/(farmer)/register-animal");
      router.setParams({ openForm: "" });
    }
  }, [openForm]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowAddForm(false);
      };
    }, []),
  );

  // --- List State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Fetch Animals via Feature Hook ---
  const {
    data: animalsData,
    isLoading: loadingList,
    refetch,
    isRefetching: refreshing,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyAnimalsInfiniteQuery({ limit: 10, search: debouncedSearch });

  const animals = animalsData?.animals || [];
  const totalAnimals = animalsData?.total || 0;
  const loadedAnimals = animalsData?.loaded || animals.length;

  const registerMutation = useRegisterAnimalMutation();

  const getFarmerCardDetails = (animal: any) => {
    const reproductiveStatus = animal.reproductiveStatus || "Normal";
    const healthStatus = animal.status || "";
    const hasHealthConcern =
      healthStatus &&
      !["active", "normal", "healthy"].includes(healthStatus.toLowerCase());
    const statuses = [
      reproductiveStatus,
      ...(hasHealthConcern ? [healthStatus] : []),
    ];

    if (hasHealthConcern) {
      return {
        statuses,
        actionEyebrow: "Health attention",
        actionLabel: "Review health and service records",
      };
    }

    if (reproductiveStatus === "Pregnant" && animal.expectedCalvingDate) {
      const expectedDate = new Date(animal.expectedCalvingDate);
      if (!Number.isNaN(expectedDate.getTime())) {
        return {
          statuses,
          actionEyebrow: "Expected calving",
          actionLabel: format(expectedDate, "MMM d, yyyy"),
        };
      }
    }

    if (["Inseminated", "Likely Pregnant"].includes(reproductiveStatus)) {
      return {
        statuses,
        actionEyebrow: "Next step",
        actionLabel: "Track breeding and pregnancy checks",
      };
    }

    if (reproductiveStatus === "In Heat") {
      return {
        statuses,
        actionEyebrow: "Next step",
        actionLabel: "Review AI service options",
      };
    }

    return {
      statuses,
      actionEyebrow: "Animal record",
      actionLabel: "View history and available services",
    };
  };

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

  const loadingForm = registerMutation.isPending;

  // --- Form Handlers ---
  const handleSave = async () => {
    if (loadingForm) return;
    if (!formData.species || !formData.breed || !formData.earTag?.trim()) {
      return toast.error(
        "Please fill all required fields (Species, Breed, and Ear Tag).",
      );
    }

    let birthDate = undefined;
    if (formData.birthDate) {
      birthDate = new Date(formData.birthDate).toISOString();
    }

    try {
      await registerMutation.mutateAsync({
        ...formData,
        imageUrl: imageBase64,
        birthDate,
      });
      toast.success("Animal added successfully!");
      setShowAddForm(false);
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to register animal.");
    }
  };

  const handleSelectPhoto = async (source: "camera" | "library") => {
    const result = await pickImageFromSource(source);
    if (result) {
      setImageUri(result.uri);
      setImageBase64(result.base64);
    }
  };

  // --- Modals ---
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    field: string;
  }>({
    visible: false,
    title: "",
    options: [],
    field: "",
  });

  const openModal = (field: string, title: string, options: string[]) =>
    setModal({ visible: true, title, options, field });

  return (
    <View
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? colors.card : "#fff"}
      />

      {/* --- HEADER --- */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: isDark ? colors.card : "#fff",
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingTop: insets.top + 14,
          zIndex: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
            marginRight: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => safeBack()}
            style={{
              padding: 8,
              backgroundColor: isDark ? "#1e293b" : "#f8fafc",
              borderRadius: 999,
            }}
          >
            <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e293b"} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_900Black",
                fontSize: 20,
              }}
              numberOfLines={1}
            >
              My Animals
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              Herd management & registry
            </Text>
          </View>
        </View>
        {!showAddForm && (
          <TouchableOpacity
            onPress={() => router.push("/(farmer)/register-animal")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: colors.primary,
            }}
          >
            <Plus size={14} color="#fff" />
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 11,
                color: "#fff",
              }}
            >
              Add Animal
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        className="flex-1"
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          backgroundColor: colors.background,
        }}
      >
        <Modal
          visible={showAddForm}
          animationType="slide"
          onRequestClose={() => setShowAddForm(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
            style={{ backgroundColor: colors.background }}
          >
            {/* Modal Header */}
            <View
              style={{ paddingTop: insets.top + 16 }}
              className="px-6 pb-4 flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800"
            >
              <View>
                <Text className="text-[20px] font-outfit-black text-slate-800 dark:text-white">
                  Register New Animal
                </Text>
                <Text className="text-[11px] text-slate-400 dark:text-slate-500 font-outfit-medium">
                  Add details to register cattle
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddForm(false)}
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "#f1f5f9",
                }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 20,
                paddingBottom: 120,
              }}
            >
              {/* Moowie greeting bubble inside the modal */}
              <View
                className="flex-row items-center p-4 rounded-[24px] mb-6 border shadow-sm"
                style={{
                  backgroundColor: isDark ? "#102A20" : "#EAF7EE",
                  borderColor: isDark ? "#24563A" : "#B7DFC4",
                }}
              >
                <View
                  className="w-12 h-12 mr-3 rounded-full overflow-hidden items-center justify-center"
                  style={{
                    backgroundColor: isDark ? "#173C2A" : "#FFFFFF",
                  }}
                >
                  <Image
                    source={{
                      uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                    }}
                    className="w-10 h-10"
                    resizeMode="contain"
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="font-outfit-black text-[13px] mb-0.5"
                    style={{ color: isDark ? "#DDF7E5" : "#123B24" }}
                  >
                    Moowie
                  </Text>
                  <Text
                    className="font-outfit-medium text-[11px] leading-relaxed"
                    style={{ color: isDark ? "#A8CDB4" : "#4E6F59" }}
                  >
                    Yay! A new addition to the family! 🐮 Fill in the details
                    below so we can start tracking their progress!
                  </Text>
                </View>
              </View>

              {/* Photo Pick */}
              <View className="align-center items-center mb-8">
                <TouchableOpacity
                  onPress={() => setPhotoModalVisible(true)}
                  className="bg-slate-50 dark:bg-slate-800 h-24 w-24 rounded-full items-center justify-center border border-slate-200 dark:border-slate-700 border-dashed overflow-hidden"
                >
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      className="w-full h-full"
                    />
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
                    animalCount={animals ? animals.length : 0}
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
                        ? new Date(`${formData.birthDate}T00:00:00`)
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
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === "android") {
                      if (event.type === "set") {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          setTempDate(selectedDate);
                          const year = selectedDate.getFullYear();
                          const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                          const day = String(selectedDate.getDate()).padStart(2, "0");
                          setFormData({
                            ...formData,
                            birthDate: `${year}-${month}-${day}`,
                          });
                        }
                      } else if (event.type === "dismissed") {
                        setShowDatePicker(false);
                      }
                    } else {
                      if (selectedDate) {
                        setTempDate(selectedDate);
                        const year = selectedDate.getFullYear();
                        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                        const day = String(selectedDate.getDate()).padStart(2, "0");
                        setFormData({
                          ...formData,
                          birthDate: `${year}-${month}-${day}`,
                        });
                      }
                      setShowDatePicker(false);
                    }
                  }}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

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

          {loadingList && animals.length === 0 ? (
            <AnimalCardSkeletonList count={5} />
          ) : animals.length === 0 ? (
            <View className="items-center py-20">
              <MaterialCommunityIcons
                name="cow-off"
                size={48}
                color={colors.textMuted}
              />
              <Text className="text-slate-400 dark:text-slate-500 font-outfit-bold text-base mt-2 text-center">
                {!animals || animals.length === 0
                  ? "No animals registered yet"
                  : "No animals found"}
              </Text>
              {(!animals || animals.length === 0) && (
                <TouchableOpacity
                  onPress={() => router.push("/(farmer)/register-animal")}
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
              data={animals}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const cardDetails = getFarmerCardDetails(item);
                const subtitle = [
                  item.species,
                  item.gender || item.sex,
                  item.color,
                ]
                  .filter(Boolean)
                  .join(" / ");

                return (
                  <AnimalRegistryCard
                    animalTag={item.earTag || item.animalId}
                    imageUrl={item.imageUrl}
                    title={item.breed || item.species || "Livestock"}
                    subtitle={subtitle}
                    statuses={cardDetails.statuses}
                    actionEyebrow={cardDetails.actionEyebrow}
                    actionLabel={cardDetails.actionLabel}
                    onPress={() =>
                      router.push(`/(farmer)/animal-details?id=${item._id}`)
                    }
                  />
                );
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refetch}
                  colors={[isDark ? colors.primary : "#00643B"]}
                />
              }
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.35}
              ListFooterComponent={
                <View className="pt-2 pb-6">
                  {isFetchingNextPage ? (
                    <AnimalCardSkeletonList count={2} />
                  ) : (
                    <View className="items-center">
                      <Text
                        className="text-[11px] font-outfit-bold"
                        style={{ color: colors.textMuted }}
                      >
                        Showing {Math.min(loadedAnimals, totalAnimals)} of{" "}
                        {totalAnimals}
                      </Text>
                      {hasNextPage ? (
                        <TouchableOpacity
                          onPress={() => fetchNextPage()}
                          className="mt-3 px-5 py-2.5 rounded-full border"
                          style={{
                            borderColor: colors.border,
                            backgroundColor: colors.card,
                          }}
                        >
                          <Text
                            className="text-[12px] font-outfit-bold"
                            style={{
                              color: isDark ? colors.primary : "#00643B",
                            }}
                          >
                            Load more animals
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                </View>
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )}
        </View>
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

      <PhotoOptionModal
        visible={photoModalVisible}
        onClose={() => setPhotoModalVisible(false)}
        onSelectCamera={() => handleSelectPhoto("camera")}
        onSelectLibrary={() => handleSelectPhoto("library")}
      />
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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
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
