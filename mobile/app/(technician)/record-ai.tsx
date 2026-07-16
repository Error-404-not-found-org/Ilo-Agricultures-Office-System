import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  User,
  Save,
  ChevronDown,
  Dog,
  X,
} from "lucide-react-native";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CATTLE_BREEDS } from "@/lib/constants";
import { getSireCodeByBreed } from "@/lib/sireRegistry";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/lib/theme";
import { useTechnicianClients } from "@/features/technician/hooks/useTechnicianClients";
import { useWalkInInseminationMutation } from "@/features/technician/hooks/useTechnicianFieldRecords";
import { getAnimalsByFarmer } from "@/features/technician/services/animalManagement.service";
import { ILOILO_MUNICIPALITY_OPTIONS } from "@/constants/address";
import { checkInseminationAgeEligibility, verifyPostpartumWindow } from "@/lib/cattleCore";

const getReproductiveStatusStyle = (status?: string) => {
  switch (status) {
    case "Pregnant":
      return {
        bg: "bg-pink-50 dark:bg-pink-950/30",
        text: "text-pink-600 dark:text-pink-400",
      };
    case "Inseminated":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-600 dark:text-blue-400",
      };
    case "Normal":
    default:
      return {
        bg: "bg-slate-100 dark:bg-slate-800",
        text: "text-slate-600 dark:text-slate-400",
      };
  }
};

export default function RecordAIScreen() {
  const router = useRouter();
  const api = useApi();
  const { isDark, colors } = useTheme();
  const { clientsQuery } = useTechnicianClients();
  const walkInInseminationMutation = useWalkInInseminationMutation();

  const farmers = clientsQuery.data || [];
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);

  const [searchFarmer, setSearchFarmer] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [showMunicipalityDropdown, setShowMunicipalityDropdown] = useState(false);
  const [searchMunicipality, setSearchMunicipality] = useState("");

  const filteredMunicipalities = useMemo(() => {
    const list = ["All Municipalities", ...ILOILO_MUNICIPALITY_OPTIONS];
    if (!searchMunicipality) return list;
    return list.filter((m) => m.toLowerCase().includes(searchMunicipality.toLowerCase()));
  }, [searchMunicipality]);

  const filteredFarmers = useMemo(() => {
    return farmers.filter((farmer: any) => {
      if (selectedMunicipality) {
        const farmerCity = farmer.address?.city;
        if (!farmerCity || farmerCity.toLowerCase() !== selectedMunicipality.toLowerCase()) {
          return false;
        }
      }
      if (searchFarmer) {
        const nameMatch = farmer.name?.toLowerCase().includes(searchFarmer.toLowerCase());
        const phoneMatch = farmer.phoneNumber?.includes(searchFarmer);
        return nameMatch || phoneMatch;
      }
      return true;
    });
  }, [farmers, searchFarmer, selectedMunicipality]);

  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [loadingAnimals, setLoadingAnimals] = useState(false);

  const animalWarning = useMemo(() => {
    if (!selectedAnimal) return null;

    if (selectedAnimal.gender === "Male" || (selectedAnimal.gender && selectedAnimal.gender.toLowerCase() === "male")) {
      return "Artificial insemination is only available for female cattle.";
    }

    const ageCheck = checkInseminationAgeEligibility(selectedAnimal.dob, selectedAnimal.species || "Cattle");
    if (!ageCheck.isEligible) {
      return ageCheck.reason || "Animal is too young for breeding.";
    }

    if (selectedAnimal.reproductiveStatus === "Pregnant") {
      return "There is already an active pregnancy registered for this animal.";
    }

    if (["Inseminated", "Likely Pregnant"].includes(selectedAnimal.reproductiveStatus || "")) {
      return "This animal is currently under reproductive monitoring.";
    }

    if (selectedAnimal.lastCalvingDate) {
      const recovery = verifyPostpartumWindow(
        selectedAnimal.lastCalvingDate,
        new Date(),
        selectedAnimal.species || "Cattle",
        selectedAnimal.breed
      );
      if (!recovery.isSafe) {
        return `Animal is in the postpartum recovery lockout window. Voluntary waiting period is ${recovery.requiredDays} days (${recovery.daysPassed} days passed).`;
      }
    }

    return null;
  }, [selectedAnimal]);

  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState(
    `SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
  );
  const [semenBatch, setSemenBatch] = useState("");
  const [estrus, setEstrus] = useState("Natural");
  const [notes, setNotes] = useState("");
  const saving = walkInInseminationMutation.isPending;
  const [status, setStatus] = useState<"done" | "in-progress">("done");
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);

  // Mission Date & Time Picker States
  const [inseminationDate, setInseminationDate] = useState(new Date());
  const [inseminationTime, setInseminationTime] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const getFormattedDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const getFormattedTime = (date: Date) => {
    const hrs = String(date.getHours()).padStart(2, "0");
    const mins = String(date.getMinutes()).padStart(2, "0");
    return `${hrs}:${mins}`;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setInseminationDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setInseminationTime(selectedTime);
    }
  };

  // Quick Registration States removed

  const handleFarmerSelect = async (farmer: any) => {
    setSelectedFarmer(farmer);
    setShowFarmerModal(false);
    setSelectedAnimal(null);
    setLoadingAnimals(true);
    try {
      const res = await getAnimalsByFarmer(api, farmer._id);
      const list = Array.isArray(res) ? res : res?.data || [];
      setAnimals(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load farmer animals");
    } finally {
      setLoadingAnimals(false);
    }
  };

  const handleSave = async () => {
    toast.dismiss();
    // Validation
    if (!selectedFarmer) {
      toast.error("Please select a farmer.");
      return;
    }
    if (!selectedAnimal) {
      toast.error("Please select an animal.");
      return;
    }
    if (animalWarning) {
      toast.error(animalWarning);
      return;
    }

    try {
      const payload = {
        farmerId: selectedFarmer._id,
        animalId: selectedAnimal?._id,
        animalDetails: null,
        inseminationDetails: {
          sireBreed,
          sireCode,
          estrus,
          notes: semenBatch.trim() ? `[Semen Batch: ${semenBatch.trim()}]\n${notes}` : notes,
          status,
          inseminationDate: getFormattedDate(inseminationDate),
          time: getFormattedTime(inseminationTime),
        },
      };

      const result = await walkInInseminationMutation.mutateAsync(payload);
      if (result.status === "synced") {
        toast.success("AI Record saved successfully");
      }
      router.back();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save record");
    }
  };

  const getAddressStr = (addr: any) => {
    if (!addr) return "No address provided";
    if (typeof addr === "string") return addr;
    return (
      `${addr.street || ""} ${addr.barangay || ""} ${addr.city || ""}`.trim() ||
      "No address provided"
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC] dark:bg-slate-950">
      <View className="flex-row items-center px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-full"
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e2937"} />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Outfit_900Black",
            fontSize: 20,
            color: colors.textPrimary,
          }}
        >
          Record AI
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* FARMER SELECTION */}
        <View className="flex-row justify-between items-center mb-3 ml-1">
          <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">
            Farmer Selection
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowFarmerModal(true)}
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full items-center justify-center mr-3">
              <User size={20} color={isDark ? "#34d399" : "#00643B"} />
            </View>
            <View className="flex-1">
              <Text
                style={{ fontFamily: "Outfit_700Bold" }}
                className={`text-base ${selectedFarmer ? "text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600"}`}
              >
                {selectedFarmer ? selectedFarmer.name : "Select Farmer..."}
              </Text>
            </View>
          </View>
          <ChevronDown size={20} color={isDark ? "#6b7280" : "#94a3b8"} />
        </TouchableOpacity>

        {/* ANIMAL SELECTION */}
        {selectedFarmer && (
          <View className="mb-8">
            <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
              Select Animal
            </Text>

            {selectedFarmer && !loadingAnimals && animals.length === 0 ? (
              <View className="bg-amber-50/50 dark:bg-amber-950/10 border border-dashed border-amber-200 dark:border-amber-900/50 rounded-[24px] p-5 items-center">
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={28}
                  color={isDark ? "#fbbf24" : "#d97706"}
                />
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-amber-800 dark:text-amber-400 text-sm text-center mt-2"
                >
                  No Animals Registered
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-slate-500 dark:text-slate-400 text-xs text-center mt-1 px-4"
                >
                  This farmer has no animals registered. Please register the animal first to record an AI procedure.
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/(technician)/register-animal",
                      params: {
                        farmerId: selectedFarmer._id,
                        farmerName: selectedFarmer.name,
                        phoneNumber: selectedFarmer.phoneNumber,
                        barangay: selectedFarmer.address?.barangay,
                        municipality: selectedFarmer.address?.city,
                      },
                    })
                  }
                  className="bg-emerald-600 px-5 py-2.5 rounded-xl mt-4 shadow-sm"
                >
                  <Text className="text-white font-outfit-bold text-xs">
                    Register Animal
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowAnimalModal(true)}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex-row items-center justify-between shadow-sm"
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mr-3">
                    <MaterialCommunityIcons
                      name="cow"
                      size={20}
                      color={isDark ? "#60a5fa" : "#3b82f6"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ fontFamily: "Outfit_700Bold" }}
                      className={`text-base ${selectedAnimal ? "text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600"}`}
                    >
                      {selectedAnimal
                        ? selectedAnimal.earTag || selectedAnimal.animalId
                        : "Choose Animal..."}
                    </Text>
                    {selectedAnimal && (
                      <View className="flex-row items-center flex-wrap gap-2 mt-0.5">
                        <Text className="text-slate-400 dark:text-slate-500 text-xs">
                          {selectedAnimal.breed || "Crossbreed"} · {selectedAnimal.species}
                        </Text>
                        {selectedAnimal.reproductiveStatus && (
                          <View
                            className={`px-1.5 py-0.5 rounded-full ${getReproductiveStatusStyle(selectedAnimal.reproductiveStatus).bg}`}
                          >
                            <Text
                              className={`text-[8px] font-outfit-bold ${getReproductiveStatusStyle(selectedAnimal.reproductiveStatus).text}`}
                            >
                              {selectedAnimal.reproductiveStatus}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                {loadingAnimals ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#34d399" : "#00643B"}
                  />
                ) : (
                  <ChevronDown
                    size={20}
                    color={isDark ? "#6b7280" : "#94a3b8"}
                  />
                )}
              </TouchableOpacity>
            )}
            {selectedAnimal && animalWarning && (
              <View className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-4 rounded-2xl flex-row items-center mt-3 shadow-sm">
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#ef4444"
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className="text-red-700 dark:text-red-400 text-xs flex-1"
                >
                  {animalWarning}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AI DETAILS */}
        <View className="bg-emerald-50/50 dark:bg-emerald-900/10 p-6 rounded-[32px] mb-8 border border-emerald-100 dark:border-emerald-800/50">
          <View className="flex-row items-center gap-2 mb-4">
            <MaterialCommunityIcons
              name="needle"
              size={20}
              color={isDark ? "#34d399" : "#00643B"}
            />
            <Text
              style={{ fontFamily: "Outfit_900Black" }}
              className="text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-widest"
            >
              A.I. Procedure Details
            </Text>
          </View>

          <View className="gap-y-5">
            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Record Status
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setStatus("done")}
                  className={`flex-1 py-3.5 rounded-2xl border items-center ${status === "done" ? "bg-emerald-600 border-emerald-600" : "bg-white dark:bg-slate-800 border-emerald-100 dark:border-slate-700"}`}
                  style={
                    status === "done"
                      ? {
                          shadowColor: "#059669",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.15,
                          shadowRadius: 3,
                          elevation: 2,
                        }
                      : {}
                  }
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className={`text-[12px] ${status === "done" ? "text-white" : "text-emerald-700 dark:text-emerald-400"}`}
                  >
                    Complete
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStatus("in-progress")}
                  className={`flex-1 py-3.5 rounded-2xl border items-center ${status === "in-progress" ? "bg-blue-600 border-blue-600" : "bg-white dark:bg-slate-800 border-blue-100 dark:border-slate-700"}`}
                  style={
                    status === "in-progress"
                      ? {
                          shadowColor: "#2563eb",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.15,
                          shadowRadius: 3,
                          elevation: 2,
                        }
                      : {}
                  }
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className={`text-[12px] ${status === "in-progress" ? "text-white" : "text-blue-700 dark:text-blue-400"}`}
                  >
                    Schedule
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Sire Breed
              </Text>
              <TouchableOpacity
                onPress={() => setShowBreedModal(true)}
                className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className={
                    sireBreed
                      ? "text-slate-800 dark:text-white"
                      : "text-slate-300 dark:text-slate-600"
                  }
                >
                  {sireBreed || "Select Sire Breed..."}
                </Text>
                <ChevronDown size={18} color={isDark ? "#6b7280" : "#94a3b8"} />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Sire Code / Bull ID
              </Text>
              <TextInput
                className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 text-slate-400 dark:text-slate-500 font-outfit-medium shadow-sm"
                placeholder="Auto-filled from Sire Breed selection"
                placeholderTextColor={isDark ? "#4b5563" : "#cbd5e1"}
                value={sireCode}
                editable={false}
              />
            </View>

            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Semen Batch / Lot (Optional)
              </Text>
              <TextInput
                className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white font-outfit-medium shadow-sm"
                placeholder="e.g. LOT-2026-A"
                placeholderTextColor={isDark ? "#6b7280" : "#94a3b8"}
                value={semenBatch}
                onChangeText={setSemenBatch}
                editable={!saving}
              />
            </View>

            {/* Dynamic Date & Time Selectors */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                  {status === "done" ? "Insemination Date" : "Scheduled Date"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-slate-800 dark:text-white text-xs"
                  >
                    {inseminationDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                  <MaterialCommunityIcons
                    name="calendar"
                    size={16}
                    color={isDark ? "#6b7280" : "#94a3b8"}
                  />
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                  {status === "done" ? "Insemination Time" : "Scheduled Time"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-slate-800 dark:text-white text-xs"
                  >
                    {inseminationTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={16}
                    color={isDark ? "#6b7280" : "#94a3b8"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Estrus Cycle / Type
              </Text>
              <View className="flex-row gap-2">
                {["Natural", "Synchronized", "Induced"].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setEstrus(opt)}
                    className={`flex-1 py-3.5 rounded-xl border items-center ${estrus === opt ? "bg-emerald-600 border-emerald-600" : "bg-white dark:bg-slate-800 border-emerald-100 dark:border-slate-700"}`}
                    style={
                      estrus === opt
                        ? {
                            shadowColor: "#059669",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 3,
                            elevation: 2,
                          }
                        : {}
                    }
                  >
                    <Text
                      style={{ fontFamily: "Outfit_700Bold" }}
                      className={`text-[10px] ${estrus === opt ? "text-white" : "text-emerald-700 dark:text-emerald-400"}`}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
          Additional Notes
        </Text>
        <TextInput
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 h-32 text-slate-800 dark:text-white shadow-sm mb-10 font-outfit-medium"
          multiline
          textAlignVertical="top"
          placeholder="Any other details about the procedure..."
          placeholderTextColor={isDark ? "#6b7280" : "#cbd5e1"}
          value={notes}
          onChangeText={setNotes}
        />

        {/* SAVE BUTTON */}
        <TouchableOpacity
          className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-20 ${
            saving || animalWarning
              ? "bg-slate-300 dark:bg-slate-800"
              : status === "done"
                ? "bg-emerald-600"
                : "bg-blue-600"
          }`}
          onPress={handleSave}
          disabled={saving || !!animalWarning}
          accessibilityRole="button"
          accessibilityLabel={status === "done" ? "Save AI record" : "Schedule AI visit"}
          style={
            !(saving || animalWarning)
              ? status === "done"
                ? {
                    shadowColor: "#10b981",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    elevation: 4,
                  }
                : {
                    shadowColor: "#3b82f6",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    elevation: 4,
                  }
              : {}
          }
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Save size={20} color="white" style={{ marginRight: 10 }} />
              <Text
                style={{ fontFamily: "Outfit_800ExtraBold" }}
                className="text-white text-base"
              >
                {status === "done" ? "Save AI Record" : "Schedule Insemination"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* FARMER SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFarmerModal}
        onRequestClose={() => setShowFarmerModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[40px] p-6 pb-12 max-h-[90%] min-h-[60%] shadow-2xl">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-5">
              <View>
                <Text
                  style={{ fontFamily: "Outfit_900Black" }}
                  className="text-2xl text-slate-800 dark:text-white"
                >
                  Select Farmer
                </Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 font-outfit-medium mt-0.5">
                  Choose a client to record the insemination
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFarmerModal(false)}
                className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-full"
              >
                <X size={22} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            {/* Search Input Box */}
            <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 mb-4 shadow-inner">
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={isDark ? "#94a3b8" : "#64748b"}
                style={{ marginRight: 8 }}
              />
              <TextInput
                className="flex-1 text-slate-800 dark:text-white font-outfit-medium text-sm p-0"
                placeholder="Search by name or phone..."
                placeholderTextColor={isDark ? "#6b7280" : "#94a3b8"}
                value={searchFarmer}
                onChangeText={setSearchFarmer}
              />
              {searchFarmer !== "" && (
                <TouchableOpacity onPress={() => setSearchFarmer("")}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={isDark ? "#6b7280" : "#94a3b8"}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Municipality Dropdown Filter Trigger */}
            <View className="mb-4">
              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[9px] tracking-wider mb-2 ml-1">
                Filter by Municipality
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchMunicipality("");
                  setShowMunicipalityDropdown(!showMunicipalityDropdown);
                }}
                className={`bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 flex-row justify-between items-center shadow-sm ${
                  showMunicipalityDropdown ? "border-emerald-500 dark:border-emerald-500 rounded-b-none" : ""
                }`}
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-slate-700 dark:text-slate-200 text-sm"
                >
                  {selectedMunicipality || "All Municipalities"}
                </Text>
                <ChevronDown size={18} color={isDark ? "#94a3b8" : "#64748b"} style={{ transform: [{ rotate: showMunicipalityDropdown ? "180deg" : "0deg" }] }} />
              </TouchableOpacity>

              {/* COLLAPSIBLE DROPDOWN DRAWER */}
              {showMunicipalityDropdown && (
                <View className="bg-white dark:bg-slate-900 border-x border-b border-emerald-500 dark:border-emerald-500 rounded-b-2xl p-4 shadow-lg z-50">
                  {/* Dropdown Search Box */}
                  <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 mb-3 shadow-inner">
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

                  {/* Dropdown List */}
                  <View className="max-h-48">
                    <FlatList
                      data={filteredMunicipalities}
                      keyExtractor={(item) => item}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      renderItem={({ item }) => {
                        const isAll = item === "All Municipalities";
                        const isSelected = isAll ? selectedMunicipality === null : selectedMunicipality === item;
                        return (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedMunicipality(isAll ? null : item);
                              setShowMunicipalityDropdown(false);
                            }}
                            className="py-2.5 border-b border-slate-50 dark:border-slate-800/50 flex-row justify-between items-center"
                          >
                            <Text
                              style={{ fontFamily: isSelected ? "Outfit_700Bold" : "Outfit_500Medium" }}
                              className={`text-sm ${
                                isSelected
                                  ? "text-emerald-600 dark:text-emerald-400 font-outfit-bold"
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

            {/* List of Farmers */}
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
                renderItem={({ item }) => {
                  const isSelected = selectedFarmer?._id === item._id;
                  return (
                    <TouchableOpacity
                      onPress={() => handleFarmerSelect(item)}
                      className={`flex-row items-center border p-5 rounded-[24px] mb-3 ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                      }`}
                    >
                      <View className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full items-center justify-center mr-4">
                        <User size={24} color={isDark ? "#34d399" : "#00643B"} />
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{ fontFamily: "Outfit_700Bold" }}
                          className="text-slate-800 dark:text-white text-base"
                        >
                          {item.name}
                        </Text>
                        <Text
                          className="text-slate-500 dark:text-slate-400 text-xs mt-0.5"
                          numberOfLines={1}
                        >
                          {getAddressStr(item.address)} · {item.phoneNumber || "No contact"}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color={isDark ? "#34d399" : "#00643B"}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>



      {/* ANIMAL SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAnimalModal}
        onRequestClose={() => setShowAnimalModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800 dark:text-white"
              >
                Select Animal
              </Text>
              <TouchableOpacity
                onPress={() => setShowAnimalModal(false)}
                className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-full"
              >
                <X size={22} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            {animals.length === 0 ? (
              <View className="items-center py-10">
                <MaterialCommunityIcons
                  name="cow-off"
                  size={48}
                  color={isDark ? "#4b5563" : "#cbd5e1"}
                />
                <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium mt-4">
                  No animals found for this farmer.
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
                      setShowAnimalModal(false);
                    }}
                    className={`flex-row items-center bg-slate-50 dark:bg-slate-800 border p-5 rounded-[24px] mb-3 ${selectedAnimal?._id === item._id ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20" : "border-slate-100 dark:border-slate-700"}`}
                  >
                    <View className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mr-4">
                      <MaterialCommunityIcons
                        name="cow"
                        size={24}
                        color={isDark ? "#60a5fa" : "#3b82f6"}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{ fontFamily: "Outfit_700Bold" }}
                        className="text-slate-800 dark:text-white text-base"
                      >
                        {item.earTag || item.animalId}
                      </Text>
                      <View className="flex-row items-center flex-wrap gap-2 mt-0.5">
                        <Text className="text-slate-500 dark:text-slate-400 text-xs">
                          {item.breed || "Crossbreed"} · {item.species}
                        </Text>
                        {item.reproductiveStatus && (
                          <View
                            className={`px-1.5 py-0.5 rounded-full ${getReproductiveStatusStyle(item.reproductiveStatus).bg}`}
                          >
                            <Text
                              className={`text-[8px] font-outfit-bold ${getReproductiveStatusStyle(item.reproductiveStatus).text}`}
                            >
                              {item.reproductiveStatus}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {selectedAnimal?._id === item._id && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={24}
                        color={isDark ? "#34d399" : "#00643B"}
                      />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>


      {/* BREED SELECTION MODAL (SIRE) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showBreedModal}
        onRequestClose={() => setShowBreedModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[40px] p-8 pb-12 max-h-[70%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800 dark:text-white"
              >
                Select Sire Breed
              </Text>
              <TouchableOpacity
                onPress={() => setShowBreedModal(false)}
                className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-full"
              >
                <X size={22} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={CATTLE_BREEDS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSireBreed(item);
                    const code = getSireCodeByBreed(item);
                    if (code) setSireCode(code);
                    setShowBreedModal(false);
                  }}
                  className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-5 rounded-[24px] mb-3"
                >
                  <View className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mr-4">
                    <Dog size={20} color={isDark ? "#60a5fa" : "#3b82f6"} />
                  </View>
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-slate-800 dark:text-white text-base flex-1"
                  >
                    {item}
                  </Text>
                  {sireBreed === item && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={isDark ? "#34d399" : "#10b981"}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={inseminationDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={status === "done" ? new Date() : undefined}
          minimumDate={status === "in-progress" ? new Date() : undefined}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={inseminationTime}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      )}


    </SafeAreaView>
  );
}
