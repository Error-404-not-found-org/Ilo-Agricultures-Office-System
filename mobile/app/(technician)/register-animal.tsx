import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ChevronDown,
  Camera,
  X,
  Plus,
  Calendar,
  ShieldCheck,
} from "lucide-react-native";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
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
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Button } from "@/components/ui/Button";
import {
  TechnicianFarmerListItem,
  TechnicianFarmerSelector,
  TechnicianFormInfo,
  TechnicianFormSection,
  TechnicianPickerSearch,
  TechnicianPickerSheet,
} from "@/components/technician/TechnicianFormUI";

import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import {
  formatAddressLabel,
  ILOILO_MUNICIPALITY_OPTIONS,
} from "@/constants/address";

export default function RegisterAnimalScreen() {
  const router = useRouter();
  const api = useApi();
  const { isDark, colors } = useTheme();

  const { farmerId, farmerName, phoneNumber, barangay, municipality } =
    useLocalSearchParams<{
      farmerId?: string;
      farmerName?: string;
      phoneNumber?: string;
      barangay?: string;
      municipality?: string;
      source?: string;
    }>();

  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [searchFarmerQuery, setSearchFarmerQuery] = useState("");
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [showMunicipalityDropdown, setShowMunicipalityDropdown] = useState(false);
  const [searchMunicipality, setSearchMunicipality] = useState("");

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    earTag: "",
    brand: "",
    species: CATTLE_SPECIES[0],
    breed: "",
    color: "",
    dob: formatLocalDate(new Date()),
    gender: "Female",
  });

  const [showGenderModal, setShowGenderModal] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [farmerAnimalsCount, setFarmerAnimalsCount] = useState<number>(0);

  const mutation = useOfflineMutation(
    {
      url: "/technician/walk-in-livestock",
      method: "POST",
      description: `Register Animal: Tag #${formData.earTag}`,
    },
    {
      onSuccess: (result) => {
        if (result.status === "synced") {
          toast.success("Animal registered successfully!");
        }
        router.back();
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || "Failed to register animal");
      },
    },
  );

  const handleFarmerSelect = async (farmer: any) => {
    setSelectedFarmer(farmer);
    setShowFarmerModal(false);
    if (String(farmer._id || "").startsWith("local:")) {
      setFarmerAnimalsCount(0);
      return;
    }
    try {
      const res = await api.get(`/animals/farmer/${farmer._id}`);
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setFarmerAnimalsCount(list.length);
    } catch (err) {
      console.error(err);
      setFarmerAnimalsCount(0);
    }
  };

  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const res = await api.get("/user?role=farmer");
        setFarmers(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFarmers();
  }, [api]);

  useEffect(() => {
    if (farmerId) {
      const existingFarmer = farmers.find((f: any) => f._id === farmerId);
      if (existingFarmer) {
        handleFarmerSelect(existingFarmer);
      } else {
        const fallbackFarmer = {
          _id: farmerId,
          name: farmerName || "Farmer",
          phoneNumber: phoneNumber || "",
          address: {
            barangay: barangay || "",
            municipality: municipality || "",
          },
        };
        handleFarmerSelect(fallbackFarmer);
      }
    }
  }, [farmerId, farmers]);

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

  const [showPhotoOptionModal, setShowPhotoOptionModal] = useState(false);

  const handleSelectPhoto = async (source: "camera" | "library") => {
    const result = await pickImageFromSource(source);
    if (result) {
      setImageUri(result.uri);
      setImageBase64(result.base64);
    }
  };

  const handleSave = async () => {
    toast.dismiss();
    if (!selectedFarmer) {
      toast.error("Please select an owner/farmer first");
      return;
    }
    if (!formData.earTag.trim()) {
      toast.error("Ear Tag is required");
      return;
    }
    if (!formData.breed) {
      toast.error("Breed is required");
      return;
    }

    const payload = {
      farmerName: selectedFarmer._id,
      earTag: formData.earTag.trim(),
      brand: formData.brand.trim() || undefined,
      species: formData.species,
      breed: formData.breed,
      color: formData.color,
      dob: formData.dob,
      gender: formData.gender,
      imageUrl: imageBase64 || undefined,
    };

    mutation.mutate(payload);
  };

  const filteredMunicipalities = useMemo(() => {
    const options = ["All Municipalities", ...ILOILO_MUNICIPALITY_OPTIONS];
    const query = searchMunicipality.trim().toLowerCase();
    return query
      ? options.filter((item) => item.toLowerCase().includes(query))
      : options;
  }, [searchMunicipality]);

  const filteredFarmers = useMemo(() => {
    const query = searchFarmerQuery.trim().toLowerCase();
    return farmers.filter((farmer) => {
      const farmerMunicipality =
        farmer.address?.city || farmer.address?.municipality || "";
      if (
        selectedMunicipality &&
        farmerMunicipality.toLowerCase() !== selectedMunicipality.toLowerCase()
      ) {
        return false;
      }
      if (!query) return true;
      return (
        farmer.name?.toLowerCase().includes(query) ||
        farmer.phoneNumber?.includes(query) ||
        farmer.address?.phoneNumber?.includes(query)
      );
    });
  }, [farmers, searchFarmerQuery, selectedMunicipality]);

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader title="Register Animal" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TechnicianFormInfo
            icon={<ShieldCheck size={18} color={colors.primary} />}
          >
            Manually register an animal profile for walk-in clients. Records
            are synced instantly to the city registry.
          </TechnicianFormInfo>

          {/* FARMER OWNER SELECTION */}
          <TechnicianFormSection
            title="Owner / Client"
            description="Select the farmer who owns this animal."
          >
          <TechnicianFarmerSelector
            farmer={selectedFarmer}
            secondaryText={selectedFarmer
              ? `${formatAddressLabel(
                  selectedFarmer.address,
                  selectedFarmer.farmLocation,
                  "Location not provided",
                )} · ${
                  selectedFarmer.phoneNumber ||
                  selectedFarmer.address?.phoneNumber ||
                  "No contact"
                }`
              : undefined}
            onPress={() => setShowFarmerModal(true)}
          />
          </TechnicianFormSection>

          {/* ANIMAL IDENTITY */}
          <TechnicianFormSection title="Animal Identity">
          <View className="gap-4">
            {/* Photo upload */}
            <View className="items-center mb-2 mt-1">
              <TouchableOpacity
                onPress={() => setShowPhotoOptionModal(true)}
                accessibilityRole="button"
                accessibilityLabel={imageUri ? "Change animal photo" : "Add animal photo"}
                className="w-24 h-24 rounded-full items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-inner bg-slate-50 dark:bg-slate-800"
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Camera size={22} color={isDark ? "#6b7280" : "#94a3b8"} />
                    <Text className="text-[9px] text-slate-400 dark:text-slate-500 font-outfit-bold text-center mt-1 uppercase">
                      Add Photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ROW 1: Species & Breed */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Species
                </Text>
                <TouchableOpacity
                  onPress={() => setShowSpeciesModal(true)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-slate-700 dark:text-slate-200 text-xs"
                  >
                    {formData.species}
                  </Text>
                  <ChevronDown
                    size={14}
                    color={isDark ? "#6b7280" : "#64748b"}
                  />
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Breed *
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!formData.species) {
                      toast.error("Please select a species first.");
                      return;
                    }
                    setShowBreedModal(true);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className={`text-xs ${formData.breed ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}
                  >
                    {formData.breed || "Select Breed..."}
                  </Text>
                  <ChevronDown
                    size={14}
                    color={isDark ? "#6b7280" : "#64748b"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ROW 2: Gender & Color */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Gender *
                </Text>
                <TouchableOpacity
                  onPress={() => setShowGenderModal(true)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-slate-700 dark:text-slate-200 text-xs"
                  >
                    {formData.gender}
                  </Text>
                  <ChevronDown
                    size={14}
                    color={isDark ? "#6b7280" : "#64748b"}
                  />
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">
                  Color *
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!formData.species) {
                      toast.error("Please select a species first.");
                      return;
                    }
                    setShowColorModal(true);
                  }}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className={`text-xs ${formData.color ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"}`}
                  >
                    {formData.color || "Select Color..."}
                  </Text>
                  <ChevronDown
                    size={14}
                    color={isDark ? "#6b7280" : "#64748b"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ROW 3: Ear Tag & Brand/Markings */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <View className="flex-row justify-between items-center mb-1 px-1">
                  <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">
                    Ear Tag *
                  </Text>
                </View>
                <TextInput
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white font-outfit-medium"
                  placeholder="TAG-XXXX"
                  placeholderTextColor={isDark ? "#6b7280" : "#94a3b8"}
                  value={formData.earTag}
                  onChangeText={(t) => setFormData({ ...formData, earTag: t })}
                />
              </View>

              <View className="flex-1">
                <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold mb-1 ml-1 uppercase ">
                  Brand/Markings
                </Text>
                <TextInput
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white font-outfit-medium"
                  placeholderTextColor={isDark ? "#6b7280" : "#94a3b8"}
                  value={formData.brand}
                  placeholder="optional"
                  onChangeText={(t) => setFormData({ ...formData, brand: t })}
                />
              </View>
            </View>
            <EarTagGenerator
              farmerName={selectedFarmer?.name}
              animalCount={farmerAnimalsCount}
              onGenerate={(tag) => setFormData({ ...formData, earTag: tag })}
              isDark={isDark}
            />

            {/* ROW 4: Date of Birth */}
            <View className="mb-3">
              <View className="flex-row justify-between items-center mb-1 ml-1">
                <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">
                  Date of Birth
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setFormData({
                      ...formData,
                      dob: formatLocalDate(new Date()),
                    })
                  }
                  className="active:opacity-50"
                >
                  <Text className="text-emerald-600 dark:text-emerald-400 text-[9px] font-outfit-bold uppercase tracking-wider">
                    Today
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex-row justify-between items-center"
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-slate-700 dark:text-slate-200 text-xs"
                >
                  {formData.dob}
                </Text>
                <Calendar size={16} color={isDark ? "#6b7280" : "#64748b"} />
              </TouchableOpacity>
            </View>
          </View>
          </TechnicianFormSection>

          {/* SUBMIT BUTTON */}
          <Button
            size="lg"
            className="mt-1 mb-4"
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            <Plus size={19} color="white" style={{ marginRight: 9 }} />
            <Text
              style={{ fontFamily: "Outfit_700Bold" }}
              className="text-white text-sm"
            >
              Register Livestock
            </Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FARMER SELECTION MODAL */}
      <TechnicianPickerSheet
        visible={showFarmerModal}
        title="Select Farmer"
        subtitle="Choose the owner of the animal"
        onClose={() => setShowFarmerModal(false)}
      >
        <TechnicianPickerSearch
          value={searchFarmerQuery}
          onChangeText={setSearchFarmerQuery}
          placeholder="Search name or phone"
        />

            <View className="mb-4">
              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[9px] tracking-wider mb-2 ml-1">
                Filter by Municipality
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchMunicipality("");
                  setShowMunicipalityDropdown(!showMunicipalityDropdown);
                }}
                className={`bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 flex-row justify-between items-center ${
                  showMunicipalityDropdown
                    ? "border-emerald-500 dark:border-emerald-500 rounded-b-none"
                    : ""
                }`}
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-slate-700 dark:text-slate-200 text-sm"
                >
                  {selectedMunicipality || "All Municipalities"}
                </Text>
                <ChevronDown
                  size={18}
                  color={isDark ? "#94a3b8" : "#64748b"}
                  style={{
                    transform: [
                      { rotate: showMunicipalityDropdown ? "180deg" : "0deg" },
                    ],
                  }}
                />
              </TouchableOpacity>

              {showMunicipalityDropdown && (
                <View className="bg-white dark:bg-slate-900 border-x border-b border-emerald-500 dark:border-emerald-500 rounded-b-xl p-4 z-50">
                  <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 mb-3">
                    <MaterialCommunityIcons
                      name="magnify"
                      size={18}
                      color={isDark ? "#94a3b8" : "#64748b"}
                      style={{ marginRight: 6 }}
                    />
                    <TextInput
                      className="flex-1 text-slate-800 dark:text-white font-outfit-medium text-xs p-0"
                      placeholder="Type to filter..."
                      placeholderTextColor={isDark ? "#6b7280" : "#94a3b8"}
                      value={searchMunicipality}
                      onChangeText={setSearchMunicipality}
                    />
                    {searchMunicipality !== "" && (
                      <TouchableOpacity onPress={() => setSearchMunicipality("")}>
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={16}
                          color={isDark ? "#6b7280" : "#94a3b8"}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View className="max-h-48">
                    <FlatList
                      data={filteredMunicipalities}
                      keyExtractor={(item) => item}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      renderItem={({ item }) => {
                        const isAll = item === "All Municipalities";
                        const isSelected = isAll
                          ? selectedMunicipality === null
                          : selectedMunicipality === item;
                        return (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedMunicipality(isAll ? null : item);
                              setShowMunicipalityDropdown(false);
                            }}
                            className="py-2.5 border-b border-slate-50 dark:border-slate-800/50 flex-row justify-between items-center"
                          >
                            <Text
                              style={{
                                fontFamily: isSelected
                                  ? "Outfit_700Bold"
                                  : "Outfit_500Medium",
                              }}
                              className={`text-sm ${
                                isSelected
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {item}
                            </Text>
                            {isSelected && (
                              <MaterialCommunityIcons
                                name="check"
                                size={16}
                                color={isDark ? "#34d399" : "#059669"}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      }}
                    />
                  </View>
                </View>
              )}
            </View>

            {farmers.length === 0 ? (
              <ActivityIndicator
                size="large"
                color={isDark ? "#34d399" : "#00643B"}
                className="mt-10"
              />
            ) : filteredFarmers.length === 0 ? (
              <View className="flex-1 items-center justify-center py-10">
                <MaterialCommunityIcons
                  name="account-search-outline"
                  size={48}
                  color={isDark ? "#4b5563" : "#cbd5e1"}
                />
                <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium mt-4 text-center">
                  No farmers found matching filters.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredFarmers}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TechnicianFarmerListItem
                    farmer={item}
                    selected={selectedFarmer?._id === item._id}
                    secondaryText={`${formatAddressLabel(
                      item.address,
                      item.farmLocation,
                      "Location not provided",
                    )} · ${
                      item.phoneNumber ||
                      item.address?.phoneNumber ||
                      "No contact"
                    }`}
                    onPress={() => handleFarmerSelect(item)}
                  />
                )}
              />
            )}
      </TechnicianPickerSheet>

      {/* SPECIES SELECTION MODAL */}
      <Modal visible={showSpeciesModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[50%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: colors.textPrimary,
                }}
              >
                Select Species
              </Text>
              <TouchableOpacity
                onPress={() => setShowSpeciesModal(false)}
                className="p-1 bg-slate-50 dark:bg-slate-800 rounded-full"
              >
                <X size={20} color={isDark ? "#94a3b8" : "black"} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CATTLE_SPECIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData({ ...formData, species: item });
                    setShowSpeciesModal(false);
                  }}
                  className="py-3.5 border-b border-slate-100 dark:border-slate-800"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-sm text-slate-800 dark:text-white"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* BREED SELECTION MODAL */}
      <Modal visible={showBreedModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: colors.textPrimary,
                }}
              >
                Select Breed
              </Text>
              <TouchableOpacity
                onPress={() => setShowBreedModal(false)}
                className="p-1 bg-slate-50 dark:bg-slate-800 rounded-full"
              >
                <X size={20} color={isDark ? "#94a3b8" : "black"} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={
                formData.species
                  ? BREED_OPTIONS_BY_SPECIES[formData.species] || []
                  : CATTLE_BREEDS
              }
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData({ ...formData, breed: item });
                    setShowBreedModal(false);
                  }}
                  className="py-3.5 border-b border-slate-100 dark:border-slate-800"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-sm text-slate-800 dark:text-white"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* COLOR SELECTION MODAL */}
      <Modal visible={showColorModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: colors.textPrimary,
                }}
              >
                Select Color
              </Text>
              <TouchableOpacity
                onPress={() => setShowColorModal(false)}
                className="p-1 bg-slate-50 dark:bg-slate-800 rounded-full"
              >
                <X size={20} color={isDark ? "#94a3b8" : "black"} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={
                formData.species
                  ? COLOR_OPTIONS_BY_SPECIES[formData.species] || []
                  : CATTLE_COLORS
              }
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setFormData({ ...formData, color: item });
                    setShowColorModal(false);
                  }}
                  className="py-3.5 border-b border-slate-100 dark:border-slate-800"
                >
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-sm text-slate-800 dark:text-white"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* GENDER SELECTION MODAL */}
      <Modal visible={showGenderModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 18,
                  color: colors.textPrimary,
                }}
              >
                Select Gender
              </Text>
              <TouchableOpacity
                onPress={() => setShowGenderModal(false)}
                className="p-1 bg-slate-50 dark:bg-slate-800 rounded-full"
              >
                <X size={20} color={isDark ? "#94a3b8" : "black"} />
              </TouchableOpacity>
            </View>
            {["Female", "Male"].map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => {
                  setFormData({ ...formData, gender: g });
                  setShowGenderModal(false);
                }}
                className="py-3.5 border-b border-slate-100 dark:border-slate-800"
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                  className="text-sm text-slate-800 dark:text-white"
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(`${formData.dob}T00:00:00`)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setFormData({
                ...formData,
                dob: formatLocalDate(date),
              });
            }
          }}
        />
      )}

      <PhotoOptionModal
        visible={showPhotoOptionModal}
        onClose={() => setShowPhotoOptionModal(false)}
        onSelectCamera={() => handleSelectPhoto("camera")}
        onSelectLibrary={() => handleSelectPhoto("library")}
      />
    </ScreenLayout>
  );
}
