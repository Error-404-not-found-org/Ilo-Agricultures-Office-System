import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { getAIEligibility } from "@/lib/reproductionEligibility";
import {
  formatLocalCalendarDate,
  formatLocalTime,
  validateAIRecording,
} from "@/features/technician-requests/utils/aiWorkflow";

const readRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const isMongoId = (value?: string) => Boolean(value && /^[a-f\d]{24}$/i.test(value));

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
  const params = useLocalSearchParams<{
    farmerId?: string | string[];
    animalId?: string | string[];
    source?: string | string[];
    mode?: string | string[];
    workflowId?: string | string[];
    taskId?: string | string[];
    farmerName?: string | string[];
    animalName?: string | string[];
    earTag?: string | string[];
    scheduleDate?: string | string[];
    visitPeriod?: string | string[];
  }>();
  const api = useApi();
  const { isDark, colors } = useTheme();
  const { clientsQuery } = useTechnicianClients();
  const walkInInseminationMutation = useWalkInInseminationMutation();
  const prefillAppliedRef = useRef(false);
  const saveSubmissionRef = useRef(false);
  const routeFarmerId = readRouteParam(params.farmerId);
  const routeAnimalId = readRouteParam(params.animalId);
  const routeSource = readRouteParam(params.source);
  const routeMode = readRouteParam(params.mode);
  const routeWorkflowId = readRouteParam(params.workflowId);
  const routeTaskId = readRouteParam(params.taskId);
  const routeFarmerName = readRouteParam(params.farmerName);
  const routeAnimalName = readRouteParam(params.animalName);
  const routeEarTag = readRouteParam(params.earTag);
  const routeScheduleDate = readRouteParam(params.scheduleDate);
  const routeVisitPeriod = readRouteParam(params.visitPeriod);
  const isRequestLinked = routeMode === "request-linked";
  const isProfileLaunch =
    routeSource === "animal-profile" &&
    isMongoId(routeFarmerId) &&
    isMongoId(routeAnimalId);
  const [profileContextLocked, setProfileContextLocked] = useState(false);

  const farmers = useMemo(() => clientsQuery.data || [], [clientsQuery.data]);
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
    const eligibility = getAIEligibility({ animal: selectedAnimal });
    return eligibility.isEligible ? null : eligibility.reason;
  }, [selectedAnimal]);

  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState("");
  const [semenDosesUsed, setSemenDosesUsed] = useState("1");
  const [estrus, setEstrus] = useState("Natural");
  const [notes, setNotes] = useState("");
  const saving = walkInInseminationMutation.isPending;
  const [status, setStatus] = useState<"done" | "in-progress">("done");
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);

  // Mission Date & Time Picker States
  const [inseminationDate, setInseminationDate] = useState(new Date());
  const [inseminationTime, setInseminationTime] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

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
    if (profileContextLocked) return;
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

  const handleAnimalSelect = async (animal: any) => {
    if (profileContextLocked && String(animal._id) !== String(routeAnimalId)) return;
    setLoadingAnimals(true);
    try {
      const response = await api.get(`/animals/${animal._id}`);
      setSelectedAnimal(response.data);
      setShowAnimalModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load the animal eligibility record.");
    } finally {
      setLoadingAnimals(false);
    }
  };

  useEffect(() => {
    if (!isProfileLaunch || prefillAppliedRef.current || farmers.length === 0) return;
    prefillAppliedRef.current = true;

    const applyProfileContext = async () => {
      const farmer = farmers.find((item: any) => String(item._id) === routeFarmerId);
      if (!farmer) {
        toast.error("The animal owner could not be resolved. Select the farmer manually.");
        return;
      }

      setLoadingAnimals(true);
      try {
        const [farmerAnimals, animalResponse] = await Promise.all([
          getAnimalsByFarmer(api, farmer._id),
          api.get(`/animals/${routeAnimalId}`),
        ]);
        const list = Array.isArray(farmerAnimals)
          ? farmerAnimals
          : farmerAnimals?.data || [];
        const animal = animalResponse.data;
        if (
          String(animal?._id) !== routeAnimalId ||
          String(animal?.farmerId?._id || animal?.farmerId) !== routeFarmerId
        ) {
          throw new Error("ANIMAL_FARMER_MISMATCH");
        }
        setSelectedFarmer(farmer);
        setAnimals(list);
        setSelectedAnimal(animal);
        setProfileContextLocked(true);
      } catch (error) {
        console.error(error);
        toast.error("The supplied animal and owner do not match. Select them manually.");
      } finally {
        setLoadingAnimals(false);
      }
    };

    applyProfileContext();
  }, [api, farmers, isProfileLaunch, routeAnimalId, routeFarmerId]);

  useEffect(() => {
    if (
      !isRequestLinked ||
      prefillAppliedRef.current ||
      !isMongoId(routeWorkflowId) ||
      !isMongoId(routeFarmerId) ||
      !isMongoId(routeAnimalId)
    ) {
      return;
    }
    prefillAppliedRef.current = true;

    const applyRequestContext = async () => {
      setSelectedFarmer({ _id: routeFarmerId, name: routeFarmerName || "Farmer" });
      setLoadingAnimals(true);
      try {
        const response = await api.get(`/animals/${routeAnimalId}`);
        const animal = response.data?.data || response.data;
        if (String(animal?._id) !== String(routeAnimalId)) {
          throw new Error("ANIMAL_CONTEXT_MISMATCH");
        }
        setSelectedAnimal(animal);
        setAnimals([animal]);
        setProfileContextLocked(true);
        setStatus("done");
      } catch (error) {
        console.error(error);
        toast.error("The linked animal could not be loaded. Return to My Work and try again.");
      } finally {
        setLoadingAnimals(false);
      }
    };

    void applyRequestContext();
  }, [
    api,
    isRequestLinked,
    routeAnimalId,
    routeFarmerId,
    routeFarmerName,
    routeWorkflowId,
  ]);

  const handleSave = async () => {
    if (saveSubmissionRef.current) return;
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

    if (isRequestLinked && !isMongoId(routeWorkflowId)) {
      toast.error("This AI service is missing its workflow identifier.");
      return;
    }
    if (isRequestLinked && routeTaskId && !isMongoId(routeTaskId)) {
      toast.error("This AI service has an invalid linked task identifier.");
      return;
    }
    if (
      isRequestLinked &&
      (!isMongoId(selectedFarmer?._id) || !isMongoId(selectedAnimal?._id))
    ) {
      toast.error("The linked farmer or animal context is invalid.");
      return;
    }

    const validationMessage =
      isRequestLinked || status === "done"
        ? validateAIRecording({
            sireBreed,
            sireCode,
            semenDosesUsed,
            technicianNote: notes,
            serviceDate: inseminationDate,
            serviceTime: inseminationTime,
          })
        : null;
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    saveSubmissionRef.current = true;
    try {
      const inseminationDetails = {
        sireBreed: sireBreed.trim(),
        sireCode: sireCode.trim(),
        estrus,
        semenDosesUsed: Number(semenDosesUsed),
        technicianNote: notes.trim() || undefined,
        inseminationDate: formatLocalCalendarDate(inseminationDate),
        time: formatLocalTime(inseminationTime),
      };
      const payload = isRequestLinked
        ? {
            farmerId: selectedFarmer._id,
            animalId: selectedAnimal._id,
            requestId: routeWorkflowId,
            ...(isMongoId(routeTaskId) ? { taskId: routeTaskId } : {}),
            inseminationDetails,
          }
        : {
        farmerId: selectedFarmer._id,
        animalId: selectedAnimal?._id,
        animalDetails: null,
        inseminationDetails: {
          ...inseminationDetails,
          status,
        },
      };

      const result = await walkInInseminationMutation.mutateAsync(payload);
      if (result.status === "synced") {
        toast.success(
          isRequestLinked
            ? "Insemination recorded successfully."
            : "AI Record saved successfully",
        );
      }
      router.back();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save record");
    } finally {
      saveSubmissionRef.current = false;
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
          {isRequestLinked ? "Record Insemination" : "Record AI"}
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
          onPress={() => !profileContextLocked && setShowFarmerModal(true)}
          disabled={profileContextLocked}
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
        {profileContextLocked && (
          <Text className="-mt-4 mb-5 text-xs" style={{ color: colors.textSecondary }}>
            Owner locked to the animal profile that opened this form.
          </Text>
        )}

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
                onPress={() => !profileContextLocked && setShowAnimalModal(true)}
                disabled={profileContextLocked}
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
        <View
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold", fontSize: 13 }}>
            {isRequestLinked ? "Request-linked AI service" : "Current AI field service"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 11, lineHeight: 17, marginTop: 3 }}>
            {isRequestLinked
              ? "This submission completes the selected AI request. The scheduled visit and actual service time remain separate."
              : "Use this form for a service performed now. Older AI records require the authorized historical-record workflow."}
          </Text>
        </View>
        {isRequestLinked && routeScheduleDate ? (
          <View
            className="rounded-2xl border p-4 mb-4"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: "Outfit_700Bold" }}>
              SCHEDULED VISIT
            </Text>
            <Text style={{ color: colors.textPrimary, marginTop: 5, fontFamily: "Outfit_700Bold" }}>
              {new Date(routeScheduleDate).toLocaleDateString("en-PH", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {routeVisitPeriod
                ? ` · ${routeVisitPeriod.replace(/^./, (value) => value.toUpperCase())}`
                : ""}
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 12 }}>
              {[routeFarmerName, routeAnimalName, routeEarTag]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        ) : null}
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
            {!isRequestLinked ? <View>
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
            </View> : null}

            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Sire Breed
              </Text>
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white font-outfit-medium shadow-sm"
                  placeholder="Enter sire breed"
                  placeholderTextColor={isDark ? "#6b7280" : "#94a3b8"}
                  value={sireBreed}
                  onChangeText={setSireBreed}
                  maxLength={100}
                />
                <TouchableOpacity
                  onPress={() => setShowBreedModal(true)}
                  accessibilityLabel="Browse sire breed suggestions"
                  className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl px-4 items-center justify-center"
                >
                  <ChevronDown size={18} color={isDark ? "#6b7280" : "#94a3b8"} />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Sire Code
              </Text>
              <TextInput
                className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white font-outfit-medium shadow-sm"
                placeholder="Enter sire code"
                placeholderTextColor={isDark ? "#4b5563" : "#cbd5e1"}
                value={sireCode}
                onChangeText={setSireCode}
                maxLength={64}
              />
            </View>

            <View>
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">
                Semen Doses Used
              </Text>
              <TextInput
                className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white font-outfit-medium shadow-sm"
                value={semenDosesUsed}
                onChangeText={setSemenDosesUsed}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={isDark ? "#4b5563" : "#cbd5e1"}
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
          Technician Note (Optional)
        </Text>
        <TextInput
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 h-32 text-slate-800 dark:text-white shadow-sm mb-10 font-outfit-medium"
          multiline
          textAlignVertical="top"
          placeholder="Any other details about the procedure..."
          placeholderTextColor={isDark ? "#6b7280" : "#cbd5e1"}
          value={notes}
          onChangeText={setNotes}
          maxLength={2000}
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
          accessibilityLabel={
            isRequestLinked
              ? "Record insemination"
              : status === "done"
                ? "Save AI record"
                : "Schedule AI visit"
          }
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
                {isRequestLinked
                  ? "Record Insemination"
                  : status === "done"
                    ? "Save AI Record"
                    : "Schedule Insemination"}
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
                    onPress={() => handleAnimalSelect(item)}
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
          maximumDate={status === "done" || isRequestLinked ? new Date() : undefined}
          minimumDate={
            status === "in-progress"
              ? new Date()
              : new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
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
