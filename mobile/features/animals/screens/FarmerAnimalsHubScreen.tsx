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
import { AppPageHeader } from "@/components/AppPageHeader";
import EarTagGenerator from "@/components/EarTagGenerator";
import { useTranslation } from "../../../contexts/TranslationContext";
import {
  useMyAnimalsQuery,
  useRegisterAnimalMutation,
} from "../hooks/useMyAnimals";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { AnimalCardSkeletonList } from "../components/skeletons/AnimalCardSkeleton";
import { AnimalRegistryCard } from "../components/AnimalRegistryCard";
import { Pagination } from "@/components/shared";

const SPECIES_OPTIONS = CATTLE_SPECIES;
const ANIMALS_PAGE_SIZE = 5;

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
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Fetch Animals via Feature Hook ---
  const {
    data: animalsData,
    isLoading: loadingList,
    refetch,
    isRefetching: refreshing,
  } = useMyAnimalsQuery({
    page,
    limit: ANIMALS_PAGE_SIZE,
    search: debouncedSearch,
  });

  const animals = animalsData?.data || [];
  const totalAnimals = animalsData?.total || 0;
  const totalPages = animalsData?.totalPages || 1;
  const firstAnimal = totalAnimals === 0 ? 0 : (page - 1) * ANIMALS_PAGE_SIZE + 1;
  const lastAnimal = Math.min(page * ANIMALS_PAGE_SIZE, totalAnimals);

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  };

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

  return (
    <View
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <AppPageHeader
        title="My Animals"
        showBackButton={false}
        rightAction={
          !showAddForm && (
            <TouchableOpacity
              onPress={() => router.push("/(farmer)/register-animal")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primary,
              }}
            >
              <Plus size={14} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Outfit_700Bold",
                  fontSize: 11,
                }}
              >
                Register
              </Text>
            </TouchableOpacity>
          )
        }
      />

      <View
        className="flex-1"
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          backgroundColor: colors.background,
        }}
      >
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
              ListFooterComponent={
                <View className="pt-2 pb-6">
                  <Text
                    className="text-xs font-outfit-semibold text-center"
                    style={{ color: colors.textMuted }}
                  >
                    Showing {firstAnimal}–{lastAnimal} of {totalAnimals}
                  </Text>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPrevious={() => goToPage(page - 1)}
                    onNext={() => goToPage(page + 1)}
                  />
                </View>
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
