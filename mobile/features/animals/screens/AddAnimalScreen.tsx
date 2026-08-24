import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, ChevronDown, X } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { toast } from "sonner-native";
import { useUser } from "@clerk/clerk-expo";
import EarTagGenerator from "@/components/EarTagGenerator";
import { AppPageHeader } from "@/components/AppPageHeader";
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
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";

const SPECIES_OPTIONS = CATTLE_SPECIES;

type FormData = {
  earTag: string;
  brand: string;
  species: string;
  breed: string;
  color: string;
  gender: string;
  birthDate: string;
  weight: string;
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
  weight: "",
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
    if (!formData.birthDate) nextErrors.birthDate = "Birth date is required.";

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

  const handleSelectPhoto = async (source: "camera" | "library") => {
    const result = await pickImageFromSource(source);
    if (result) {
      setImageUri(result.uri);
      setImageBase64(result.base64);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <AppPageHeader title="Add Animal" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        style={{ backgroundColor: colors.background }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: insets.bottom + 120,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? "rgba(52,211,153,0.25)" : "#bbf7d0",
              backgroundColor: isDark ? "rgba(16,185,129,0.10)" : "#f0fdf4",
              padding: 14,
              marginBottom: 24,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "rgba(52,211,153,0.14)" : "#dcfce7",
              }}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color={primaryColor}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 11 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 14,
                }}
              >
                Before you start
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  lineHeight: 17,
                  marginTop: 2,
                }}
              >
                Ear tag, species, and breed are required. Add a clear photo if
                one is available.
              </Text>
            </View>
          </View>

          <View className="items-center mb-7">
            <TouchableOpacity
              onPress={() => setPhotoModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={
                imageUri ? "Change animal photo" : "Add animal photo"
              }
              className="h-28 w-28 rounded-full items-center justify-center border border-dashed overflow-hidden"
              style={{
                backgroundColor: colors.card,
                borderColor: isDark ? colors.textMuted : "#94a3b8",
              }}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} className="w-full h-full" />
              ) : (
                <Camera size={28} color={colors.textMuted} />
              )}
            </TouchableOpacity>
            <Text
              className="mt-3 text-[13px] font-outfit-bold text-center"
              style={{ color: colors.textSecondary }}
            >
              {imageUri ? "Change Photo" : "Add Photo"}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              Optional, but helpful for identification
            </Text>
          </View>

          <SectionLabel title="Animal identification" />

          <View className="mb-4">
            <InputField
              label="Ear Tag"
              value={formData.earTag}
              maxLength={6}
              onChangeText={(text: string) => setField("earTag", text)}
              placeholder="Enter the ear tag number"
              error={errors.earTag}
              required
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

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SelectField
                label="Species"
                value={formData.species}
                onPress={() =>
                  openModal("species", "Select Species", SPECIES_OPTIONS)
                }
                error={errors.species}
                required
              />
            </View>
            <View style={{ flex: 1 }}>
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
                required
              />
            </View>
          </View>

          <SectionLabel title="Additional details" />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
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
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                label="Sex"
                value={formData.gender}
                onPress={() =>
                  openModal("gender", "Select Sex", ["Female", "Male"])
                }
              />
            </View>
          </View>

          <View style={{ marginBottom: 4 }}>
            <InputField
              label="Brand/Markings (optional)"
              value={formData.brand}
              maxLength={15}
              onChangeText={(text: string) => setField("brand", text)}
              placeholder="Markings"
            />
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField
                label="Estimated Weight (kg)"
                value={formData.weight}
                maxLength={6}
                keyboardType="numeric"
                onChangeText={(text: string) => setField("weight", text)}
                placeholder="e.g. 50"
              />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                label="Birth date"
                value={
                  formData.birthDate
                    ? new Date(
                        `${formData.birthDate}T00:00:00`,
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : ""
                }
                placeholder="Select date"
                onPress={() => {
                  setTempDate(
                    formData.birthDate
                      ? new Date(`${formData.birthDate}T00:00:00`)
                      : new Date(),
                  );
                  setShowDatePicker(true);
                }}
                error={errors.birthDate}
                required
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={loadingForm}
            accessibilityRole="button"
            accessibilityLabel="Add animal to my farm"
            style={{
              backgroundColor: loadingForm ? "#34d399" : primaryColor,
              shadowColor: primaryColor,
              minHeight: 56,
              borderRadius: 50,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              marginTop: 14,
            }}
          >
            {loadingForm ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MaterialCommunityIcons name="cow" size={20} color="white" />
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "Outfit_700Bold",
                    fontSize: 16,
                    marginLeft: 8,
                  }}
                >
                  Add to My Farm
                </Text>
              </>
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
                      const month = String(
                        selectedDate.getMonth() + 1,
                      ).padStart(2, "0");
                      const day = String(selectedDate.getDate()).padStart(
                        2,
                        "0",
                      );
                      setField("birthDate", `${year}-${month}-${day}`);
                    }
                  } else if (event.type === "dismissed") {
                    setShowDatePicker(false);
                  }
                } else {
                  if (selectedDate) {
                    setTempDate(selectedDate);
                    const year = selectedDate.getFullYear();
                    const month = String(selectedDate.getMonth() + 1).padStart(
                      2,
                      "0",
                    );
                    const day = String(selectedDate.getDate()).padStart(2, "0");
                    setField("birthDate", `${year}-${month}-${day}`);
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
            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
            >
              {modal.options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${opt}`}
                  onPress={() => {
                    if (modal.field) setField(modal.field, opt);
                    setModal({ ...modal, visible: false });
                  }}
                  style={{
                    minHeight: 46,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    alignItems: "flex-start",
                    justifyContent: "center",
                    marginBottom: 8,
                    borderWidth: 1,
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                    borderColor: isDark ? colors.border : "#e2e8f0",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 14,
                    }}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  error,
  required = false,
}: any) => {
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: "Outfit_700Bold",
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        {label}
        {required ? <Text style={{ color: colors.error }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          backgroundColor: colors.card,
          borderColor: error
            ? colors.error
            : isFocused
              ? isDark
                ? colors.primary
                : "#00643B"
              : colors.border,
          color: colors.textPrimary,
          borderWidth: isFocused || error ? 2 : 1,
          borderRadius: 12,
          height: 48,
          paddingHorizontal: 14,
          fontFamily: "Outfit_500Medium",
          fontSize: 15,
          textAlignVertical: "center",
        }}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
      />
      {error ? (
        <Text
          style={{
            color: colors.error,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 11,
            marginTop: 4,
            marginLeft: 2,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const SelectField = ({
  label,
  value,
  onPress,
  error,
  placeholder = "Select",
  required = false,
}: any) => {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: "Outfit_700Bold",
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        {label}
        {required ? <Text style={{ color: colors.error }}> *</Text> : null}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value || placeholder}`}
        style={{
          backgroundColor: colors.card,
          borderColor: error ? colors.error : colors.border,
          borderWidth: error ? 2 : 1,
          borderRadius: 12,
          minHeight: 48,
          paddingHorizontal: 14,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginRight: 10,
            color: value ? colors.textPrimary : colors.textMuted,
            fontFamily: "Outfit_500Medium",
            fontSize: 15,
          }}
        >
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {error ? (
        <Text
          style={{
            color: colors.error,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 11,
            marginTop: 4,
            marginLeft: 2,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const SectionLabel = ({ title }: { title: string }) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_800ExtraBold",
          fontSize: 16,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          flex: 1,
          height: 1,
          backgroundColor: colors.border,
          marginLeft: 12,
        }}
      />
    </View>
  );
};

export default AddAnimalScreen;
