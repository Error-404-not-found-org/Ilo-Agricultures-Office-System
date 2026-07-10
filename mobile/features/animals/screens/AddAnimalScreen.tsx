import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, ChevronDown, X, ArrowLeft } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { toast } from "sonner-native";
import { useUser } from "@clerk/clerk-expo";
import EarTagGenerator from "@/components/EarTagGenerator";
import { useTheme } from "@/lib/theme";
import {
  BREED_OPTIONS_BY_SPECIES,
  CATTLE_SPECIES,
  COLOR_OPTIONS_BY_SPECIES,
} from "@/lib/constants";
import {
  useMyAnimalsInfiniteQuery,
  useRegisterAnimalMutation,
} from "../hooks/useMyAnimals";

const SPECIES_OPTIONS = CATTLE_SPECIES;

type FormData = {
  earTag: string;
  brand: string;
  species: string;
  breed: string;
  color: string;
  gender: string;
  birthDate: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const initialFormData: FormData = {
  earTag: "",
  brand: "",
  species: "",
  breed: "",
  color: "",
  gender: "Female",
  birthDate: "",
};

export function AddAnimalScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const submitLockRef = useRef(false);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    field: keyof FormData | "";
  }>({
    visible: false,
    title: "",
    options: [],
    field: "",
  });

  const registerMutation = useRegisterAnimalMutation();
  const { data: animalsData } = useMyAnimalsInfiniteQuery({ limit: 1 });
  const totalAnimals = animalsData?.total || 0;
  const primaryColor = isDark ? colors.primary : "#00643B";
  const loadingForm = registerMutation.isPending;

  useEffect(() => {
    if (!formData.species) return;
    const validBreeds = BREED_OPTIONS_BY_SPECIES[formData.species] || [];
    const validColors = COLOR_OPTIONS_BY_SPECIES[formData.species] || [];

    setFormData((prev) => ({
      ...prev,
      breed: prev.breed && !validBreeds.includes(prev.breed) ? "" : prev.breed,
      color: prev.color && !validColors.includes(prev.color) ? "" : prev.color,
    }));
  }, [formData.species]);

  const setField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const openModal = (field: keyof FormData, title: string, options: string[]) =>
    setModal({ visible: true, title, options, field });

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!formData.earTag.trim()) nextErrors.earTag = "Ear tag is required.";
    if (!formData.species) nextErrors.species = "Select the animal species.";
    if (!formData.breed) nextErrors.breed = "Select the animal breed.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (submitLockRef.current || loadingForm) return;

    submitLockRef.current = true;
    toast.dismiss();

    try {
      if (!validate()) {
        toast.error("Please complete the required animal details.");
        return;
      }

      const birthDate = formData.birthDate
        ? new Date(formData.birthDate).toISOString()
        : undefined;

      await registerMutation.mutateAsync({
        ...formData,
        imageUrl: imageBase64,
        birthDate,
      });

      toast.success("Animal added successfully!");
      router.replace("/(farmer)/(tabs)/add-animal");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to register animal.");
    } finally {
      submitLockRef.current = false;
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
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

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <View
        className="absolute top-0 left-0 right-0 h-[220px]"
        style={{ backgroundColor: "#00643B" }}
      />

      <View
        style={{ paddingTop: insets.top + 16 }}
        className="px-6 pb-6 flex-row items-center gap-4"
      >
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
        <View className="flex-1">
          <Text className="text-[22px] font-outfit-black text-white leading-tight">
            Add Animal
          </Text>
          <Text className="text-[12px] text-emerald-100 font-outfit-medium opacity-90">
            Register cattle details for your herd
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 rounded-t-[32px]"
        style={{ backgroundColor: colors.background }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: insets.bottom + 120,
          }}
        >
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
                    ? "rgba(0, 100, 59, 0.1)"
                    : "#eaf7ee",
                  borderColor: isDark ? "transparent" : "#b7dfc4",
                }}
              >
                <Text
                  className="font-outfit-black text-[13px] mb-1"
                  style={{ color: isDark ? "#a8cdb4" : "#00643b" }}
                >
                  Moowie Support
                </Text>
                <Text
                  className="font-outfit-medium text-[12px] leading-[18px]"
                  style={{ color: colors.textSecondary }}
                >
                  Add the animal details once so breeding, calving, and health
                  records can stay connected.
                </Text>
              </View>
            </View>
          </View>

          <View className="items-center mb-8">
            <TouchableOpacity
              onPress={() => setPhotoModalVisible(true)}
              className="h-24 w-24 rounded-full items-center justify-center border border-dashed overflow-hidden"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} className="w-full h-full" />
              ) : (
                <Camera size={28} color={colors.textMuted} />
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
              onChangeText={(text: string) => setField("earTag", text)}
              placeholder="Tag #"
              error={errors.earTag}
            />
            <View className="mt-1 ml-1">
              <EarTagGenerator
                farmerName={
                  user?.fullName ||
                  user?.username ||
                  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                  "Farmer"
                }
                animalCount={totalAnimals}
                onGenerate={(tag) => setField("earTag", tag)}
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
              error={errors.species}
            />
            <SelectField
              label="Breed"
              value={formData.breed}
              onPress={() => {
                if (!formData.species) {
                  setErrors((prev) => ({
                    ...prev,
                    species: "Select species before choosing a breed.",
                  }));
                  toast.dismiss();
                  toast.error("Please select a species first.");
                  return;
                }
                openModal(
                  "breed",
                  "Select Breed",
                  BREED_OPTIONS_BY_SPECIES[formData.species] || [],
                );
              }}
              error={errors.breed}
            />
          </View>

          <View className="flex-row gap-3">
            <SelectField
              label="Color"
              value={formData.color}
              onPress={() => {
                if (!formData.species) {
                  setErrors((prev) => ({
                    ...prev,
                    species: "Select species before choosing a color.",
                  }));
                  toast.dismiss();
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
              label="Brand / Markings"
              value={formData.brand}
              maxLength={15}
              onChangeText={(text: string) => setField("brand", text)}
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
            className="rounded-full py-4 items-center mt-4 flex-row justify-center"
            style={{
              backgroundColor: loadingForm ? "#34d399" : primaryColor,
              shadowColor: primaryColor,
            }}
          >
            {loadingForm ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MaterialCommunityIcons name="cow" size={20} color="white" />
                <Text className="text-white font-bold text-lg ml-2">
                  Add to My Farm
                </Text>
              </>
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
                  if (event.type === "set") {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setTempDate(selectedDate);
                      setField(
                        "birthDate",
                        selectedDate.toISOString().split("T")[0],
                      );
                    }
                  } else if (event.type === "dismissed") {
                    setShowDatePicker(false);
                  }
                } else {
                  if (selectedDate) {
                    setTempDate(selectedDate);
                    setField(
                      "birthDate",
                      selectedDate.toISOString().split("T")[0],
                    );
                  }
                  setShowDatePicker(false);
                }
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modal.visible} transparent animationType="slide">
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
              {modal.options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    if (modal.field) setField(modal.field, opt);
                    setModal({ ...modal, visible: false });
                  }}
                  className="w-[48%] py-4 rounded-2xl items-center justify-center mb-3 border"
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
                  color={colors.primary}
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
                  color={colors.primary}
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
  error,
}: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text
        className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        className="border rounded-2xl px-4 py-4 text-sm"
        style={{
          backgroundColor: colors.card,
          borderColor: error ? colors.error : colors.border,
          color: colors.textPrimary,
          elevation: 1,
        }}
        placeholderTextColor={colors.textMuted}
      />
      {error ? (
        <Text
          className="text-[11px] font-outfit-semibold mt-1.5 ml-1"
          style={{ color: colors.error }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const SelectField = ({ label, value, onPress, error }: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text
        className="text-xs font-bold uppercase tracking-widest mb-2 ml-1"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        className="border rounded-2xl px-4 py-4 flex-row justify-between items-center"
        style={{
          backgroundColor: colors.card,
          borderColor: error ? colors.error : colors.border,
          minHeight: 54,
          elevation: 1,
        }}
      >
        <Text
          className="font-medium text-sm flex-1 mr-2"
          numberOfLines={1}
          style={{ color: value ? colors.textPrimary : colors.textMuted }}
        >
          {value || "Select"}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {error ? (
        <Text
          className="text-[11px] font-outfit-semibold mt-1.5 ml-1"
          style={{ color: colors.error }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

export default AddAnimalScreen;
