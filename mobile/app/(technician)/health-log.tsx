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
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  User,
  Save,
  ChevronDown,
  X,
  Stethoscope,
  Calendar,
  Clock,
  Camera,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import EarTagGenerator from "@/components/EarTagGenerator";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  CATTLE_BREEDS,
  CATTLE_SPECIES,
  CATTLE_COLORS,
  COLOR_OPTIONS_BY_SPECIES,
} from "@/lib/constants";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import { useAnimalContext } from "@/hooks/useAnimalContext";
import AnimalContextHeader from "@/components/AnimalContextHeader";
import { useTechnicianClients } from "@/features/technician/hooks/useTechnicianClients";
import { completeTask } from "@/features/technician/services/tasks.service";
import { ILOILO_MUNICIPALITY_OPTIONS } from "@/constants/address";

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

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  secureTextEntry = false,
  editable = true,
}: any) => (
  <View className="mb-4">
    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1.5 ml-1 uppercase">
      {label}
    </Text>
    <TextInput
      style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14 }}
      className={`bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-semibold ${!editable ? "bg-slate-100 text-slate-400" : ""}`}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder?.toLowerCase()}
      placeholderTextColor="#cbd5e1"
      keyboardType={keyboardType}
      maxLength={maxLength}
      secureTextEntry={secureTextEntry}
      editable={editable}
    />
  </View>
);

const SelectorField = ({
  label,
  value,
  onPress,
  placeholder,
  disabled = false,
}: any) => (
  <View className="mb-4">
    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1.5 ml-1 uppercase">
      {label}
    </Text>
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: 46 }}
      className={`bg-white border border-slate-100 rounded-xl p-3 flex-row justify-between items-center ${disabled ? "opacity-60" : ""}`}
    >
      <Text
        style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14 }}
        className={value ? "text-slate-800" : "text-slate-300"}
      >
        {value || placeholder?.toLowerCase()}
      </Text>
      <ChevronDown size={16} color="#cbd5e1" />
    </TouchableOpacity>
  </View>
);

const SERVICE_TYPES = [
  { value: "disease", label: "Disease Control" },
  { value: "medicine", label: "Medicine/Supplies" },
  { value: "checkup", label: "Routine Checkup" },
  { value: "injury", label: "Injury Treatment" },
  { value: "vaccination", label: "Vaccination" },
  { value: "deworming", label: "Deworming" },
  { value: "other", label: "Other Veterinary" },
];

export default function HealthLogScreen() {
  const router = useRouter();
  const api = useApi();
  const { clientsQuery } = useTechnicianClients();

  const {
    selectedFarmer,
    setSelectedFarmer,
    selectedAnimal,
    setSelectedAnimal,
    animals,
    loadingAnimals,
    isLocked,
    requestId,
    taskId,
    source,
    handleClearAll,
  } = useAnimalContext();

  // Farmer Selection states
  const farmers = clientsQuery.data || [];
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);

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

  // Health log parameters
  const [status, setStatus] = useState<"resolved" | "in-progress">("resolved");
  const [requestType, setRequestType] = useState("disease");
  const [urgency, setUrgency] = useState("medium");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [medicine, setMedicine] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [withdrawalPeriodDays, setWithdrawalPeriodDays] = useState("");

  // Date/Time
  const [preferredDate, setPreferredDate] = useState(new Date());
  const [preferredTime, setPreferredTime] = useState(() => {
    const t = new Date();
    t.setHours(8, 0, 0, 0); // Static 8:00 AM baseline
    return t;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const completeLinkedTask = async (result: any) => {
    if (!taskId || result.status !== "synced") return;
    const recordId =
      result.data?.request?._id ||
      result.data?.healthRequest?._id ||
      result.data?.data?._id;
    if (!recordId) return;
    try {
      await completeTask(api, taskId, {
        relatedRecordType: "health",
        relatedRecordId: recordId,
      });
    } catch (err) {
      console.error("Failed to complete linked health task", err);
      toast.error(
        "Health record saved, but the linked task was not completed.",
      );
    }
  };

  const handleSuccess = async (result: any) => {
    if (result.status === "synced") {
      toast.success(
        status === "resolved"
          ? "Health record saved!"
          : "Visit scheduled successfully!",
      );
    }
    await completeLinkedTask(result);
    if (
      (source === "animal-profile" || source === "task") &&
      selectedAnimal?._id
    ) {
      router.replace({
        pathname: "/(technician)/animal-details",
        params: { id: selectedAnimal._id },
      });
    } else {
      router.back();
    }
  };

  // Image picker removed

  // Mutation 1: Walk-in
  const walkInMutation = useOfflineMutation(
    {
      url: "/health-request/walk-in",
      method: "POST",
      description: `Health Assistance: ${diagnosis || "Walk-in service"}`,
    },
    {
      onSuccess: handleSuccess,
      onError: (err: any) => {
        toast.error(
          err.response?.data?.message || "Failed to save health record.",
        );
      },
    },
  );

  // Mutation 2: Transition Request
  const requestMutation = useOfflineMutation(
    {
      url: `/health-request/${requestId || "placeholder"}/status`,
      method: "PATCH",
      description: `Resolve Health Request: ${diagnosis || "Routine checkup"}`,
    },
    {
      onSuccess: handleSuccess,
      onError: (err: any) => {
        toast.error(
          err.response?.data?.message || "Failed to resolve request.",
        );
      },
    },
  );

  const isMutationPending = requestId
    ? requestMutation.isPending
    : walkInMutation.isPending;

  const handleFarmerSelect = (farmer: any) => {
    setSelectedFarmer(farmer);
    setShowFarmerModal(false);
    setSelectedAnimal(null);
  };

  const handleSave = async () => {
    toast.dismiss();
    // Validate Existing
    if (!selectedFarmer) {
      toast.error("Please select a farmer.");
      return;
    }
    if (!selectedAnimal) {
      toast.error("Please select an animal.");
      return;
    }

    if (!diagnosis || diagnosis.trim() === "") {
      toast.error("Please enter findings or symptoms.");
      return;
    }

    if (requestId) {
      const patchPayload: any = {
        status: status === "resolved" ? "resolved" : "in-progress",
        technicianNote: notes,
        diagnosis,
        treatment,
        advice: medicine,
        scheduledDate: preferredDate.toISOString(),
      };
      if (status === "resolved" && followUpDate) {
        patchPayload.followUpDate = followUpDate.toISOString();
      }
      if (status === "resolved" && withdrawalPeriodDays) {
        patchPayload.withdrawalPeriodDays = Number(withdrawalPeriodDays);
      }
      requestMutation.mutate(patchPayload);
    } else {
      // Structure dates
      const yyyy = preferredDate.getFullYear();
      const mm = String(preferredDate.getMonth() + 1).padStart(2, "0");
      const dd = String(preferredDate.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const hh = String(preferredTime.getHours()).padStart(2, "0");
      const min = String(preferredTime.getMinutes()).padStart(2, "0");
      const timeStr = `${hh}:${min}`;

      let payload: any = {
        diagnosis,
        urgency,
        status,
        requestType,
        preferredDate: dateStr,
        preferredTime: timeStr,
        treatment: treatment || "",
        advice: medicine || "",
        technicianNote:
          notes ||
          (status === "resolved"
            ? "Walk-in service recorded by technician."
            : "Visit scheduled by technician."),
      };

      if (status === "resolved" && followUpDate) {
        payload.followUpDate = followUpDate.toISOString();
      }
      if (status === "resolved" && withdrawalPeriodDays) {
        payload.withdrawalPeriodDays = Number(withdrawalPeriodDays);
      }

      payload.farmerId = selectedFarmer._id;
      payload.animalId = selectedAnimal._id;

      walkInMutation.mutate(payload);
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
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-4 p-2 bg-slate-50 rounded-full"
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={20} color="#1e2937" />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Outfit_900Black",
            fontSize: 20,
            color: "#1e293b",
          }}
        >
          Record Health Assistance
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {selectedAnimal ? (
          <AnimalContextHeader
            animal={selectedAnimal}
            isLocked={isLocked}
            onClear={handleClearAll}
          />
        ) : (
          <>
            {/* FARMER SELECTION */}
            <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">
              Assign To Farmer
            </Text>
            <TouchableOpacity
              onPress={() => setShowFarmerModal(true)}
              className="bg-white border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-amber-50 rounded-full items-center justify-center mr-3">
                  <User size={20} color="#D97706" />
                </View>
                <View className="flex-1">
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className={`text-base ${selectedFarmer ? "text-slate-800" : "text-slate-300"}`}
                  >
                    {selectedFarmer
                      ? selectedFarmer.name
                      : "Select Farmer..."}
                  </Text>
                </View>
              </View>
              <ChevronDown size={20} color="#94a3b8" />
            </TouchableOpacity>

            {selectedFarmer && (
              <View className="mb-8">
                <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">
                  Target Animal
                </Text>

                {selectedFarmer && !loadingAnimals && animals.length === 0 ? (
                  <View className="bg-amber-50/50 border border-dashed border-amber-200 rounded-[24px] p-5 items-center">
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={28}
                      color="#d97706"
                    />
                    <Text
                      style={{ fontFamily: "Outfit_700Bold" }}
                      className="text-amber-800 text-sm text-center mt-2"
                    >
                      No Animals Registered
                    </Text>
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-slate-500 text-xs text-center mt-1 px-4"
                    >
                      This farmer has no animals registered. Please register the animal first to record a health record.
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
                      className="bg-amber-600 px-5 py-2.5 rounded-xl mt-4 shadow-sm"
                    >
                      <Text className="text-white font-outfit-bold text-xs">
                        Register Animal
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowAnimalModal(true)}
                    className="bg-white border border-slate-100 rounded-2xl p-5 flex-row items-center justify-between shadow-sm"
                  >
                    <View className="flex-row items-center flex-1">
                      <View className="w-10 h-10 bg-amber-50 rounded-full items-center justify-center mr-3">
                        <MaterialCommunityIcons
                          name="cow"
                          size={20}
                          color="#D97706"
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{ fontFamily: "Outfit_700Bold" }}
                          className={`text-base ${selectedAnimal ? "text-slate-800" : "text-slate-300"}`}
                        >
                          {selectedAnimal
                            ? selectedAnimal.earTag ||
                              selectedAnimal.animalId ||
                              "Animal Selected"
                            : "Choose Animal..."}
                        </Text>
                        {selectedAnimal && (
                          <View className="flex-row items-center flex-wrap gap-2 mt-1">
                            <Text className="text-slate-400 text-xs">
                              {selectedAnimal.breed || "Crossbreed"} ·{" "}
                              {selectedAnimal.species || "Cattle"}
                            </Text>
                            {selectedAnimal.reproductiveStatus && (
                              <View
                                className={`px-2 py-0.5 rounded-full ${getReproductiveStatusStyle(selectedAnimal.reproductiveStatus).bg}`}
                              >
                                <Text
                                  className={`text-[10px] font-outfit-bold ${getReproductiveStatusStyle(selectedAnimal.reproductiveStatus).text}`}
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
                      <ActivityIndicator size="small" color="#D97706" />
                    ) : (
                      <ChevronDown size={20} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {/* MEDICAL EXAMINATION CARD */}
        <View className="bg-amber-50/50 p-6 rounded-[32px] mb-8 border border-amber-100">
          <View className="flex-row items-center gap-2 mb-4">
            <Stethoscope size={20} color="#D97706" />
            <Text
              style={{ fontFamily: "Outfit_900Black" }}
              className="text-amber-800 text-sm uppercase tracking-widest"
            >
              Medical Examination
            </Text>
          </View>

          <View className="gap-y-5">
            {/* SERVICE MODE (Complete vs Schedule) */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Service Mode
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setStatus("resolved")}
                  className={`flex-1 py-3.5 rounded-2xl border items-center ${status === "resolved" ? "bg-amber-600 border-amber-600" : "bg-white border-amber-100"}`}
                  style={
                    status === "resolved"
                      ? {
                          shadowColor: "#d97706",
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
                    className={`text-[12px] ${status === "resolved" ? "text-white" : "text-amber-700"}`}
                  >
                    Complete
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStatus("in-progress")}
                  className={`flex-1 py-3.5 rounded-2xl border items-center ${status === "in-progress" ? "bg-blue-600 border-blue-600" : "bg-white border-amber-100"}`}
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
                    className={`text-[12px] ${status === "in-progress" ? "text-white" : "text-blue-700"}`}
                  >
                    Schedule
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SERVICE TYPE (Disease Control, Supplies, Routine check, etc.) */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Service Type
              </Text>
              <TouchableOpacity
                onPress={() => setShowTypeModal(true)}
                className="bg-white border border-amber-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-slate-800"
                >
                  {SERVICE_TYPES.find((t) => t.value === requestType)?.label}
                </Text>
                <ChevronDown size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Date & Expected Time Selectors */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                  {status === "resolved" ? "Examination Date" : "Scheduled Date"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="bg-white border border-amber-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-slate-800 text-xs"
                  >
                    {preferredDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                  <Calendar size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                  {status === "resolved" ? "Examination Time" : "Scheduled Time"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  className="bg-white border border-amber-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-slate-800 text-xs"
                  >
                    {preferredTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Clock size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* PRIORITY PROTOCOL URGENCY */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Priority Protocol
              </Text>
              <View className="flex-row gap-2">
                {["low", "medium", "high"].map((u) => {
                  const isSel = urgency === u;
                  const activeBg =
                    u === "emergency"
                      ? "bg-red-600 border-red-600"
                      : u === "high"
                        ? "bg-rose-500 border-rose-500"
                        : u === "medium"
                          ? "bg-amber-600 border-amber-600"
                          : "bg-emerald-600 border-emerald-600";

                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUrgency(u)}
                      className={`flex-1 py-3.5 rounded-xl border items-center ${isSel ? activeBg : "bg-white border-amber-100"}`}
                      style={
                        isSel
                          ? {
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.1,
                              shadowRadius: 3,
                              elevation: 1,
                            }
                          : {}
                      }
                    >
                      <Text
                        style={{ fontFamily: "Outfit_700Bold" }}
                        className={`text-[10px] uppercase tracking-wider ${isSel ? "text-white" : "text-amber-700"}`}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* DIAGNOSIS/FINDINGS */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Findings / Diagnosis
              </Text>
              <TextInput
                className="bg-white border border-amber-100 rounded-2xl p-4 text-slate-800 font-outfit-medium shadow-sm"
                placeholder={
                  status === "resolved"
                    ? "Describe clinical findings/diagnosis..."
                    : "Describe symptoms or reason for scheduled visit..."
                }
                value={diagnosis}
                onChangeText={setDiagnosis}
              />
            </View>

            {/* TREATMENT ACTION */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Treatment Action
              </Text>
              <TextInput
                className="bg-white border border-amber-100 rounded-2xl p-4 text-slate-800 font-outfit-medium shadow-sm"
                placeholder="e.g. Wound cleaning, Injection..."
                value={treatment}
                onChangeText={setTreatment}
              />
            </View>

            {/* MEDICINE & DOSAGE */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Medicine & Dosage
              </Text>
              <TextInput
                className="bg-white border border-amber-100 rounded-2xl p-4 text-slate-800 font-outfit-medium shadow-sm"
                placeholder="e.g. Penicillin 10ml"
                value={medicine}
                onChangeText={setMedicine}
              />
            </View>

            {status === "resolved" && (
              <>
                {/* FOLLOW-UP CHECKUP DATE */}
                <View>
                  <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                    Follow-up Checkup (Optional)
                  </Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setShowFollowUpPicker(true)}
                      className="flex-1 bg-white border border-amber-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                    >
                      <Text
                        style={{ fontFamily: "Outfit_700Bold" }}
                        className="text-slate-800 text-xs"
                      >
                        {followUpDate
                          ? followUpDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Set Follow-up Date..."}
                      </Text>
                      <Calendar size={16} color="#94a3b8" />
                    </TouchableOpacity>
                    {followUpDate && (
                      <TouchableOpacity
                        onPress={() => setFollowUpDate(null)}
                        className="bg-rose-50 border border-rose-100 rounded-2xl p-4 items-center justify-center shadow-sm"
                      >
                        <X size={16} color="#f43f5e" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* WITHDRAWAL PERIOD */}
                <View>
                  <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                    Withdrawal Period (Days, Optional)
                  </Text>
                  <TextInput
                    className="bg-white border border-amber-100 rounded-2xl p-4 text-slate-800 font-outfit-medium shadow-sm"
                    placeholder="e.g. 7"
                    keyboardType="numeric"
                    value={withdrawalPeriodDays}
                    onChangeText={(v) =>
                      setWithdrawalPeriodDays(v.replace(/\D/g, ""))
                    }
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* ADDITIONAL NOTES */}
        <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">
          Additional Observations
        </Text>
        <TextInput
          className="bg-white border border-slate-100 rounded-2xl p-4 h-32 text-slate-800 shadow-sm mb-10 font-outfit-medium"
          multiline
          textAlignVertical="top"
          placeholder="Any other clinical signs noticed..."
          placeholderTextColor="#cbd5e1"
          value={notes}
          onChangeText={setNotes}
        />

        {/* SAVE BUTTON */}
        <TouchableOpacity
          className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-20 ${
            isMutationPending
              ? "bg-slate-400"
              : status === "resolved"
                ? "bg-amber-600"
                : "bg-blue-600"
          }`}
          onPress={handleSave}
          disabled={isMutationPending}
          accessibilityRole="button"
          accessibilityLabel={
            status === "resolved"
              ? "Save health assistance record"
              : "Schedule health visit"
          }
          style={
            !isMutationPending
              ? status === "resolved"
                ? {
                    shadowColor: "#d97706",
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
          {isMutationPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Save size={20} color="white" style={{ marginRight: 10 }} />
              <Text
                style={{ fontFamily: "Outfit_800ExtraBold" }}
                className="text-white text-base"
              >
                {status === "resolved"
                  ? "Save Health Assistance Record"
                  : "Schedule Health Visit"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* DATE & TIME PICKERS */}
      {showDatePicker && (
        <DateTimePicker
          value={preferredDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setPreferredDate(selectedDate);
          }}
          maximumDate={status === "resolved" ? new Date() : undefined}
          minimumDate={status === "in-progress" ? new Date() : undefined}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={preferredTime}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) setPreferredTime(selectedTime);
          }}
        />
      )}

      {showFollowUpPicker && (
        <DateTimePicker
          value={followUpDate || new Date(Date.now() + 24 * 60 * 60 * 1000)}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowFollowUpPicker(false);
            if (selectedDate) setFollowUpDate(selectedDate);
          }}
        />
      )}

      {/* ANIMAL SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAnimalModal}
        onRequestClose={() => setShowAnimalModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Animal
              </Text>
              <TouchableOpacity
                onPress={() => setShowAnimalModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingAnimals ? (
              <ActivityIndicator
                size="large"
                color="#D97706"
                className="mt-10"
              />
            ) : animals.length === 0 ? (
              <View className="bg-slate-50 rounded-2xl p-6 items-center border border-dashed border-slate-200 mt-4">
                <Text className="text-slate-400 text-sm font-outfit-medium">
                  No animals found for this farmer.
                </Text>
              </View>
            ) : (
              <FlatList
                data={animals}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedAnimal?._id === item._id;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedAnimal(isSelected ? null : item);
                        setShowAnimalModal(false);
                      }}
                      className={`flex-row items-center bg-slate-50 border p-4 rounded-2xl mb-3 ${
                        isSelected
                          ? "border-amber-500 bg-amber-50/50"
                          : "border-slate-100"
                      }`}
                    >
                      <View className="w-10 h-10 bg-amber-50 rounded-full items-center justify-center mr-3">
                        <MaterialCommunityIcons
                          name="cow"
                          size={20}
                          color="#D97706"
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{ fontFamily: "Outfit_700Bold" }}
                          className="text-slate-800 text-base"
                        >
                          {item.earTag || item.animalId}
                        </Text>
                        <View className="flex-row items-center flex-wrap gap-2 mt-0.5">
                          <Text className="text-slate-500 text-xs">
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
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          color="#D97706"
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

      {/* FARMER SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFarmerModal}
        onRequestClose={() => setShowFarmerModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-6 pb-12 max-h-[90%] min-h-[60%] shadow-2xl">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-5">
              <View>
                <Text
                  style={{ fontFamily: "Outfit_900Black" }}
                  className="text-2xl text-slate-800"
                >
                  Select Farmer
                </Text>
                <Text className="text-xs text-slate-400 font-outfit-medium mt-0.5">
                  Choose a client to record the health log
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFarmerModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Search Input Box */}
            <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mb-4 shadow-inner">
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color="#64748b"
                style={{ marginRight: 8 }}
              />
              <TextInput
                className="flex-1 text-slate-800 font-outfit-medium text-sm p-0"
                placeholder="Search by name or phone..."
                placeholderTextColor="#94a3b8"
                value={searchFarmer}
                onChangeText={setSearchFarmer}
              />
              {searchFarmer !== "" && (
                <TouchableOpacity onPress={() => setSearchFarmer("")}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Municipality Dropdown Filter Trigger */}
            <View className="mb-4">
              <Text className="font-outfit-bold text-slate-400 uppercase text-[9px] tracking-wider mb-2 ml-1">
                Filter by Municipality
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchMunicipality("");
                  setShowMunicipalityDropdown(!showMunicipalityDropdown);
                }}
                className={`bg-slate-50 border border-slate-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm ${
                  showMunicipalityDropdown ? "border-amber-500 rounded-b-none" : ""
                }`}
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-slate-700 text-sm"
                >
                  {selectedMunicipality || "All Municipalities"}
                </Text>
                <ChevronDown size={18} color="#64748b" style={{ transform: [{ rotate: showMunicipalityDropdown ? "180deg" : "0deg" }] }} />
              </TouchableOpacity>

              {/* COLLAPSIBLE DROPDOWN DRAWER */}
              {showMunicipalityDropdown && (
                <View className="bg-white border-x border-b border-amber-500 rounded-b-2xl p-4 shadow-lg z-50">
                  {/* Dropdown Search Box */}
                  <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 mb-3 shadow-inner">
                    <MaterialCommunityIcons
                      name="magnify"
                      size={18}
                      color="#64748b"
                      style={{ marginRight: 6 }}
                    />
                    <TextInput
                      className="flex-1 text-slate-800 font-outfit-medium text-xs p-0"
                      placeholder="Type to filter..."
                      placeholderTextColor="#94a3b8"
                      value={searchMunicipality}
                      onChangeText={setSearchMunicipality}
                    />
                    {searchMunicipality !== "" && (
                      <TouchableOpacity onPress={() => setSearchMunicipality("")}>
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={16}
                          color="#94a3b8"
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
                            className="py-2.5 border-b border-slate-100 flex-row justify-between items-center"
                          >
                            <Text
                              style={{ fontFamily: isSelected ? "Outfit_700Bold" : "Outfit_500Medium" }}
                              className={`text-sm ${
                                isSelected
                                  ? "text-amber-600 font-outfit-bold"
                                  : "text-slate-600"
                              }`}
                            >
                              {item}
                            </Text>
                            {isSelected && (
                              <MaterialCommunityIcons
                                name="check"
                                size={16}
                                color="#D97706"
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
                color="#D97706"
                className="mt-10"
              />
            ) : filteredFarmers.length === 0 ? (
              <View className="flex-1 items-center justify-center py-10">
                <MaterialCommunityIcons
                  name="account-search-outline"
                  size={48}
                  color="#cbd5e1"
                />
                <Text className="text-slate-400 font-outfit-medium mt-4 text-center">
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
                          ? "border-amber-500 bg-amber-50/50"
                          : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center mr-4">
                        <User size={24} color="#D97706" />
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{ fontFamily: "Outfit_700Bold" }}
                          className="text-slate-800 text-base"
                        >
                          {item.name}
                        </Text>
                        <Text
                          className="text-slate-500 text-xs mt-0.5"
                          numberOfLines={1}
                        >
                          {getAddressStr(item.address)} · {item.phoneNumber || "No contact"}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color="#D97706"
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



      {/* SERVICE TYPE MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTypeModal}
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Service Type
              </Text>
              <TouchableOpacity
                onPress={() => setShowTypeModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={SERVICE_TYPES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setRequestType(item.value);
                    setShowTypeModal(false);
                  }}
                  className="py-4 border-b border-slate-50"
                >
                  <Text className="font-outfit-bold text-slate-700 text-base">
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
}
