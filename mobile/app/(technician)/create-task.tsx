import React, { useState, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  User,
  Save,
  ChevronDown,
  Calendar,
  X,
} from "lucide-react-native";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { useTechnicianClients } from "@/features/technician/hooks/useTechnicianClients";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import { useTechnicianFullAgendaQuery } from "@/features/technician/hooks/useTechnicianDashboard";
import { getAnimalsByFarmer } from "@/features/technician/services/animalManagement.service";
import DateTimePicker from "@react-native-community/datetimepicker";
// 1. Import your validation utility (Make sure the path matches your structure)
import { validateRequestTime } from "@/lib/utils"

const SERVICE_TYPES = [
  {
    label: "General Visit",
    value: "GeneralVisit",
    icon: "calendar-account",
    color: "#64748b",
    bg: "#f8fafc",
  },
  {
    label: "Farm Inspection",
    value: "FarmInspection",
    icon: "barn",
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
  {
    label: "Registration Support",
    value: "Registration",
    icon: "clipboard-account-outline",
    color: "#2563eb",
    bg: "#eff6ff",
  },
  {
    label: "Other Field Work",
    value: "Other",
    icon: "cog-outline",
    color: "#475569",
    bg: "#f8fafc",
  },
];

const CATEGORIES = ["Urgent", "Routine", "Follow-up"];
const OFFICIAL_SERVICE_TYPES = new Set(["AI", "Health", "PD", "CD"]);
const CATEGORY_HELPER: Record<string, string> = {
  Urgent: "Needs attention soon",
  Routine: "Normal scheduled visit",
  "Follow-up": "Return visit or check-in",
};

const getReproductiveStatusStyle = (status?: string) => {
  switch (status) {
    case "Pregnant":
      return { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400" };
    case "Inseminated":
      return { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400" };
    case "Normal":
    default:
      return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" };
  }
};

export default function CreateTaskScreen() {
  const router = useRouter();
  const {
    type,
    farmerId,
    farmerName,
    phoneNumber,
    barangay,
    municipality,
    source,
  } = useLocalSearchParams<{
    type?: string;
    farmerId?: string;
    farmerName?: string;
    phoneNumber?: string;
    barangay?: string;
    municipality?: string;
    source?: string;
  }>();
  const api = useApi();
  const { isDark, colors } = useTheme();

  const { clientsQuery } = useTechnicianClients();
  const { createTaskMutation, tasksQuery } = useTechnicianTasks();
  const dashboardQuery = useTechnicianFullAgendaQuery();
  const farmers = clientsQuery.data || [];

  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);

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

  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [loadingAnimals, setLoadingAnimals] = useState(false);

  const [serviceType, setServiceType] = useState(
    SERVICE_TYPES.some((option) => option.value === type)
      ? (type as string)
      : "GeneralVisit",
  );
  const [category, setCategory] = useState("Routine");
  const [notes, setNotes] = useState("");

  const [visitDate, setVisitDate] = useState<Date | null>(null);
  const [showVisitDatePicker, setShowVisitDatePicker] = useState(false);
  const [showVisitTimePicker, setShowVisitTimePicker] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saving = createTaskMutation.isPending || isSubmitting;
  const dashboardData = dashboardQuery.data;

  const agendaItemsOnSelectedDay = React.useMemo(() => {
    if (!visitDate || !dashboardData?.agendaItems) return [];
    return dashboardData.agendaItems.filter((item: any) => {
      const itemDate = new Date(item.displayDate);
      return (
        itemDate.getFullYear() === visitDate.getFullYear() &&
        itemDate.getMonth() === visitDate.getMonth() &&
        itemDate.getDate() === visitDate.getDate()
      );
    });
  }, [visitDate, dashboardData]);

  const hasTechConflict = React.useMemo(() => {
    if (!visitDate) return false;
    return agendaItemsOnSelectedDay.some((item: any) => {
      const itemDate = new Date(item.displayDate);
      return (
        itemDate.getHours() === visitDate.getHours() &&
        itemDate.getMinutes() === visitDate.getMinutes()
      );
    });
  }, [visitDate, agendaItemsOnSelectedDay]);

  const hasFarmerVisitToday = React.useMemo(() => {
    if (!selectedFarmer || !visitDate) return false;
    return agendaItemsOnSelectedDay.some((item: any) => {
      const itemFarmer = item.raw?.farmerId || item.farmerId;
      const itemFarmerId = typeof itemFarmer === "object" ? itemFarmer._id : itemFarmer;
      return String(itemFarmerId) === String(selectedFarmer._id);
    });
  }, [selectedFarmer, visitDate, agendaItemsOnSelectedDay]);

  const hasActiveServiceRequest = React.useMemo(() => {
    if (!selectedFarmer || !visitDate || selectedAnimalIds.length === 0) return false;
    const isOfficialService = OFFICIAL_SERVICE_TYPES.has(serviceType);
    if (!isOfficialService) return false;

    return selectedAnimalIds.some((animalId) => {
      const dupReq = dashboardData?.pendingRequests?.find((req: any) => {
        const reqAnimalId = req.animalId?._id || req.raw?.animalId?._id || req.animalId;
        const reqType = req.type || req.raw?.requestType || "";
        return String(reqAnimalId) === String(animalId) && reqType.toLowerCase() === serviceType.toLowerCase();
      });
      const dupAgenda = dashboardData?.agendaItems?.find((task: any) => {
        const animalIdsArray = task.raw?.animalIds || [];
        const hasAnimalInTask = animalIdsArray.some((id: any) => String(id?._id || id) === String(animalId));
        const hasAnimalInRecord = String(task.animalId?._id || task.animalId || task.raw?.animalId?._id) === String(animalId);
        const taskType = task.task || task.taskType || task.raw?.taskType || "";
        return (hasAnimalInTask || hasAnimalInRecord) && taskType.toLowerCase() === serviceType.toLowerCase();
      });
      const dupBacklog = tasksQuery.data?.find((task: any) => {
        const animalIdsArray = task.animalIds || [];
        const hasAnimalInTask = animalIdsArray.some((a: any) => String(a?._id || a) === String(animalId));
        const taskType = task.task || task.taskType || "";
        return hasAnimalInTask && taskType.toLowerCase() === serviceType.toLowerCase();
      });
      return !!(dupReq || dupAgenda || dupBacklog);
    });
  }, [selectedFarmer, visitDate, selectedAnimalIds, serviceType, dashboardData, tasksQuery.data]);

  const isFarmPinMissing = React.useMemo(() => {
    if (!selectedFarmer) return false;
    const loc = selectedFarmer.farmLocation;
    return !(loc && typeof loc.latitude === "number" && typeof loc.longitude === "number");
  }, [selectedFarmer]);

  const hasNearbyBarangayVisit = React.useMemo(() => {
    if (!selectedFarmer || !visitDate) return false;
    const proposedBrgy = selectedFarmer.address?.barangay?.toLowerCase() || "";
    if (!proposedBrgy) return false;

    return agendaItemsOnSelectedDay.some((item: any) => {
      const itemBrgy = item.location ? item.location.split(",")[0].trim().toLowerCase() : "";
      if (itemBrgy !== proposedBrgy) return false;

      const itemDate = new Date(item.displayDate);
      const diffMs = Math.abs(itemDate.getTime() - visitDate.getTime());
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours <= 2 && diffHours > 0;
    });
  }, [selectedFarmer, visitDate, agendaItemsOnSelectedDay]);

  const handleFarmerSelect = async (farmer: any) => {
    setSelectedFarmer(farmer);
    setShowFarmerModal(false);
    setSelectedAnimalIds([]);
    setLoadingAnimals(true);
    try {
      const res = await getAnimalsByFarmer(api, farmer._id);
      const list = Array.isArray(res) ? res : res?.data || [];
      setAnimals(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load animals");
    } finally {
      setLoadingAnimals(false);
    }
  };

  const toggleAnimalSelect = (id: string) => {
    if (selectedAnimalIds.includes(id)) {
      setSelectedAnimalIds((prev) => prev.filter((a) => a !== id));
    } else {
      setSelectedAnimalIds((prev) => [...prev, id]);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    if (!selectedFarmer || !category) {
      toast.error("Please select a farmer and visit category.", { id: "task-validation" });
      return;
    }

    if (!visitDate) {
      toast.error("Please pick a schedule date and time.", { id: "task-validation" });
      return;
    }

    if (hasTechConflict) {
      toast.error("You already have a visit scheduled at this time.", { id: "task-validation" });
      return;
    }

    if (hasActiveServiceRequest) {
      toast.error("This animal already has an active service request.", { id: "task-validation" });
      return;
    }

    // 3. Evaluate the custom date-fns calendar constraint business logic
    const timeValidation = validateRequestTime(visitDate, false); // pass true if holiday state engine is added later
    if (!timeValidation.isValid) {
      toast.error(timeValidation.message || "Invalid time selected.", { id: "task-validation" });
      return;
    }

    const isOfficialServiceTask = OFFICIAL_SERVICE_TYPES.has(serviceType);
    if (isOfficialServiceTask && selectedAnimalIds.length === 0) {
      toast.error("Please select the animal for this service visit.", { id: "task-validation" });
      return;
    }

    if (selectedAnimalIds.length === 1) {
      const selectedAnimalId = selectedAnimalIds[0];
      const selectedAnimal = animals.find((a) => a._id === selectedAnimalId);
      if (selectedAnimal) {
        // Gender check
        if (selectedAnimal.gender === "Male" && ["AI", "PD", "CD"].includes(serviceType)) {
          toast.error("Ineligible Gender: Breeding services (AI, PD, Calving) cannot be scheduled for male animals.", { id: "task-validation" });
          return;
        }

        // Calving check
        if (serviceType === "CD" && selectedAnimal.reproductiveStatus !== "Pregnant") {
          toast.error("Calving service requires a pregnant animal. Please check the reproductive status.", { id: "task-validation" });
          return;
        }

        // Pregnancy check days since insemination check
        if (serviceType === "PD" && selectedAnimal.reproductiveStatus === "Inseminated") {
          const lastInsemDate = selectedAnimal.lastInseminationDate || selectedAnimal.inseminations?.[0]?.dateOfAI || selectedAnimal.inseminations?.[0]?.inseminationDate;
          if (lastInsemDate) {
            const daysSinceInsem = Math.floor((new Date().getTime() - new Date(lastInsemDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceInsem < 30) {
              const timeStr = daysSinceInsem === 0 ? "today" : `only ${daysSinceInsem} days ago`;
              toast.error(`Pregnancy check too early: The last insemination was performed ${timeStr} (minimum 30 days required).`, { id: "task-validation" });
              return;
            }
          }
        }

        // Deduplication Check
        const duplicateRequest = dashboardData?.pendingRequests?.find((req: any) => {
          const reqAnimalId = req.animalId?._id || req.raw?.animalId?._id || req.animalId;
          const reqType = req.type || req.raw?.requestType || "";
          return reqAnimalId === selectedAnimalId && reqType.toLowerCase() === serviceType.toLowerCase();
        });

        const duplicateAgendaTask = dashboardData?.agenda?.find((task: any) => {
          const animalIdsArray = task.raw?.animalIds || [];
          const hasAnimalInTask = animalIdsArray.some((id: any) => (typeof id === "string" ? id === selectedAnimalId : id?._id === selectedAnimalId));
          const hasAnimalInRecord = task.animalId === selectedAnimalId || task.animalId?._id === selectedAnimalId || task.raw?.animalId?._id === selectedAnimalId;
          const taskType = task.task || task.taskType || task.raw?.taskType || "";
          return (hasAnimalInTask || hasAnimalInRecord) && taskType.toLowerCase() === serviceType.toLowerCase();
        });

        const duplicateBacklogTask = tasksQuery.data?.find((task: any) => {
          const animalIdsArray = task.animalIds || [];
          const hasAnimalInTask = animalIdsArray.some((a: any) => (typeof a === "string" ? a === selectedAnimalId : a?._id === selectedAnimalId));
          const taskType = task.task || task.taskType || "";
          return hasAnimalInTask && taskType.toLowerCase() === serviceType.toLowerCase();
        });

        if (duplicateRequest || duplicateAgendaTask || duplicateBacklogTask) {
          toast.error(`Duplicate visit alert: A pending ${serviceType.toUpperCase()} record already exists for this animal.`, { id: "task-validation" });
          return;
        }
      }
    }

    if (notes.length > 500) {
      toast.error("Validation Error", {
        description: "Additional Notes cannot exceed 500 characters.",
        id: "task-validation"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createTaskMutation.mutateAsync({
        farmerId: selectedFarmer._id,
        animalIds: selectedAnimalIds,
        category,
        taskType: serviceType,
        notes:
          notes.trim() ||
          `${SERVICE_TYPES.find((item) => item.value === serviceType)?.label || "Visit"} scheduled from ${source === "client-profile" ? "client profile" : "task scheduler"}.`,
        dueDate: visitDate.toISOString(),
        sourceType:
          source === "client-profile" ? "client_profile" : "task_scheduler",
        metadata: {
          source: source || "create-task",
          farmerName,
          phoneNumber,
          barangay,
          municipality,
        },
      });
      toast.success("Field work scheduled successfully!");
      router.back();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save record.");
    } finally {
      setIsSubmitting(false);
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
          className="mr-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-full"
        >
          <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e293b"} />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Outfit_900Black",
            fontSize: 20,
            color: colors.textPrimary,
          }}
        >
          Schedule Field Work
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SERVICE SELECTION */}
        <View className="mb-8">
          <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
            Field Work Type
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {SERVICE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setServiceType(type.value)}
                activeOpacity={0.8}
                style={{
                  width: "47%",
                  backgroundColor:
                    serviceType === type.value
                      ? isDark
                        ? type.color + "20"
                        : type.bg
                      : isDark
                        ? "#111827"
                        : "#fff",
                  borderWidth: 2,
                  borderColor:
                    serviceType === type.value
                      ? type.color
                      : isDark
                        ? "#1f2937"
                        : "#f1f5f9",
                  borderRadius: 20,
                  padding: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor:
                      serviceType === type.value
                        ? isDark
                          ? "#1f2937"
                          : "#fff"
                        : isDark
                          ? type.color + "20"
                          : type.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name={type.icon as any}
                    size={18}
                    color={type.color}
                  />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 11,
                    color:
                      serviceType === type.value
                        ? type.color
                        : isDark
                          ? "#94a3b8"
                          : "#64748b",
                  }}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* VISIT DATE */}
        <View className="mb-8">
          <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
            Visit Schedule
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full items-center justify-center mr-3">
                <Calendar size={20} color={isDark ? "#34d399" : "#00643B"} />
              </View>
              <View className="flex-1">
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color: colors.textPrimary,
                  }}
                  className="text-base"
                >
                  {visitDate
                    ? visitDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Not Set"}
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-medium mt-0.5">
                  {visitDate
                    ? visitDate.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Select a time..."}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowVisitDatePicker(true)}
                className="flex-1 py-3 rounded-xl border border-emerald-100 dark:border-slate-700 bg-emerald-50 dark:bg-slate-800 items-center"
              >
                <Text className="text-[#00643B] dark:text-emerald-400 text-xs font-outfit-bold">
                  {visitDate ? "Change Date" : "Set Date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowVisitTimePicker(true)}
                className="flex-1 py-3 rounded-xl border border-emerald-100 dark:border-slate-700 bg-emerald-50 dark:bg-slate-800 items-center"
              >
                <Text className="text-[#00643B] dark:text-emerald-400 text-xs font-outfit-bold">
                  {visitDate ? "Change Time" : "Set Time"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SCHEDULE PREVIEW & WARNINGS */}
        {visitDate && (
          <View className="mb-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3">
              Schedule Status & Preview
            </Text>
            
            {/* Existing Visits List or Available */}
            <View className="mb-4">
              <Text className="text-xs font-outfit-bold text-slate-500 dark:text-slate-400 mb-2">
                Existing Visits on {visitDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}:
              </Text>
              {agendaItemsOnSelectedDay.length === 0 ? (
                <View className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex-row items-center">
                  <MaterialCommunityIcons name="calendar-check" size={16} color="#10b981" />
                  <Text className="text-emerald-700 dark:text-emerald-400 text-xs font-outfit-bold ml-2">
                    Available (No visits scheduled)
                  </Text>
                </View>
              ) : (
                agendaItemsOnSelectedDay.map((item: any, idx: number) => (
                  <View key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl mb-2 flex-row justify-between items-center border border-slate-100 dark:border-slate-800">
                    <Text className="text-slate-800 dark:text-slate-200 text-xs font-outfit-medium">
                      {item.preferredTime || item.time} · {item.farmerName || item.farmer}
                    </Text>
                    <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-outfit-bold uppercase">
                      {item.type || item.taskType}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Warning and conflict alerts */}
            <View style={{ gap: 8 }}>
              {hasTechConflict && (
                <View className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 flex-row items-start">
                  <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" style={{ marginTop: 1 }} />
                  <Text className="text-red-700 dark:text-red-400 text-xs font-outfit-medium ml-2 flex-1">
                    You already have a visit scheduled at this time.
                  </Text>
                </View>
              )}

              {hasActiveServiceRequest && (
                <View className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 flex-row items-start">
                  <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" style={{ marginTop: 1 }} />
                  <Text className="text-red-700 dark:text-red-400 text-xs font-outfit-medium ml-2 flex-1">
                    This animal already has an active service request.
                  </Text>
                </View>
              )}

              {hasFarmerVisitToday && (
                <View className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 flex-row items-start">
                  <MaterialCommunityIcons name="alert" size={16} color="#f59e0b" style={{ marginTop: 1 }} />
                  <Text className="text-amber-700 dark:text-amber-400 text-xs font-outfit-medium ml-2 flex-1">
                    This farmer already has a scheduled visit today.
                  </Text>
                </View>
              )}

              {isFarmPinMissing && selectedFarmer && (
                <View className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 flex-row items-start">
                  <MaterialCommunityIcons name="alert" size={16} color="#f59e0b" style={{ marginTop: 1 }} />
                  <Text className="text-amber-700 dark:text-amber-400 text-xs font-outfit-medium ml-2 flex-1">
                    Farm location is missing. Travel planning may be less accurate.
                  </Text>
                </View>
              )}

              {hasNearbyBarangayVisit && (
                <View className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex-row items-start">
                  <MaterialCommunityIcons name="map-marker-distance" size={16} color="#10b981" style={{ marginTop: 1 }} />
                  <Text className="text-emerald-700 dark:text-emerald-400 text-xs font-outfit-medium ml-2 flex-1">
                    Nearby visit in same barangay around this time.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* FARMER SELECTION */}
        <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
          Assign To Farmer
        </Text>
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
              {OFFICIAL_SERVICE_TYPES.has(serviceType)
                ? "Target Animal"
                : "Target Animals (Optional)"}
            </Text>
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
                    className={`text-base ${selectedAnimalIds.length > 0 ? "text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-600"}`}
                  >
                    {selectedAnimalIds.length === 0
                      ? "Choose Animal..."
                      : selectedAnimalIds.length === 1
                      ? (animals.find((a) => a._id === selectedAnimalIds[0])?.earTag || animals.find((a) => a._id === selectedAnimalIds[0])?.animalId || "Animal Selected")
                      : `${selectedAnimalIds.length} Animals Selected`}
                  </Text>
                  {selectedAnimalIds.length === 1 && (
                    <View className="flex-row items-center flex-wrap gap-2 mt-1">
                      <Text className="text-slate-400 dark:text-slate-500 text-xs">
                        {animals.find((a) => a._id === selectedAnimalIds[0])?.breed || "Crossbreed"} · {animals.find((a) => a._id === selectedAnimalIds[0])?.species || "Cattle"}
                      </Text>
                      {animals.find((a) => a._id === selectedAnimalIds[0])?.reproductiveStatus && (
                        <View className={`px-2 py-0.5 rounded-full ${getReproductiveStatusStyle(animals.find((a) => a._id === selectedAnimalIds[0])?.reproductiveStatus).bg}`}>
                          <Text className={`text-[10px] font-outfit-bold ${getReproductiveStatusStyle(animals.find((a) => a._id === selectedAnimalIds[0])?.reproductiveStatus).text}`}>
                            {animals.find((a) => a._id === selectedAnimalIds[0])?.reproductiveStatus}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {selectedAnimalIds.length > 1 && (
                    <Text className="text-slate-400 dark:text-slate-500 text-xs" numberOfLines={1}>
                      {selectedAnimalIds.map((id) => animals.find((a) => a._id === id)?.earTag || animals.find((a) => a._id === id)?.animalId).join(", ")}
                    </Text>
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
          </View>
        )}

        {/* BREEDING SAFETY WARNINGS */}
        {serviceType === "AI" && selectedAnimalIds.length === 1 && (() => {
          const selectedAnimal = animals.find((a) => a._id === selectedAnimalIds[0]);
          const status = selectedAnimal?.reproductiveStatus;
          if (["Inseminated", "Pregnant", "Lactating"].includes(status)) {
            let message = "";
            let color = "amber";
            if (status === "Pregnant") {
              message = "Warning: This animal is already marked as Pregnant. Performing AI on a pregnant cow may cause abortion or pregnancy loss.";
              color = "rose";
            } else if (status === "Inseminated") {
              message = "Notice: This animal is already marked as Inseminated. Ensure a Pregnancy Diagnosis (PD) is performed before re-inseminating to prevent disrupting a potential pregnancy.";
              color = "amber";
            } else if (status === "Lactating") {
              message = "Notice: This animal is marked as Lactating. Ensure the post-calving voluntary waiting period has passed and she is ready for breeding.";
              color = "amber";
            }

            const bgClass = color === "rose" ? "bg-rose-50 dark:bg-rose-950/20" : "bg-amber-50 dark:bg-amber-950/20";
            const borderClass = color === "rose" ? "border-rose-100 dark:border-rose-900/40" : "border-amber-100 dark:border-amber-900/40";
            const textHeaderClass = color === "rose" ? "text-rose-800 dark:text-rose-400" : "text-amber-800 dark:text-amber-400";
            const textDescClass = color === "rose" ? "text-rose-600 dark:text-rose-500" : "text-amber-600 dark:text-amber-500";

            return (
              <View className={`p-4 rounded-2xl mb-8 border ${bgClass} ${borderClass}`}>
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className={`text-sm mb-1 ${textHeaderClass}`}>
                  {status === "Pregnant" ? "Critical Breeding Alert" : "Breeding Guidance"}
                </Text>
                <Text className={`text-xs font-outfit-medium leading-5 ${textDescClass}`}>
                  {message}
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {/* HEALTH SAFETY WARNINGS */}
        {serviceType === "Health" && selectedAnimalIds.length === 1 && (() => {
          const selectedAnimal = animals.find((a) => a._id === selectedAnimalIds[0]);
          const status = selectedAnimal?.reproductiveStatus;
          if (["Inseminated", "Pregnant", "Lactating"].includes(status)) {
            let message = "";
            let color = "amber";
            if (status === "Pregnant") {
              message = "Warning: This animal is Pregnant. Ensure that any medications, vaccinations, or health treatments administered are pregnancy-safe to prevent fetal harm or abortion.";
              color = "rose";
            } else if (status === "Lactating") {
              message = "Notice: This animal is Lactating. Please verify if any administered drugs require a milk-withdrawal period before the milk can be consumed or sold.";
              color = "amber";
            } else if (status === "Inseminated") {
              message = "Notice: This animal is Inseminated (Possible Pregnancy). Exercise caution with treatments or stress-inducing procedures that could impact early embryonic development.";
              color = "amber";
            }

            const bgClass = color === "rose" ? "bg-rose-50 dark:bg-rose-950/20" : "bg-amber-50 dark:bg-amber-950/20";
            const borderClass = color === "rose" ? "border-rose-100 dark:border-rose-900/40" : "border-amber-100 dark:border-amber-900/40";
            const textHeaderClass = color === "rose" ? "text-rose-800 dark:text-rose-400" : "text-amber-800 dark:text-amber-400";
            const textDescClass = color === "rose" ? "text-rose-600 dark:text-rose-500" : "text-amber-600 dark:text-amber-500";

            return (
              <View className={`p-4 rounded-2xl mb-8 border ${bgClass} ${borderClass}`}>
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className={`text-sm mb-1 ${textHeaderClass}`}>
                  {status === "Pregnant" ? "Pregnancy Health Alert" : "Health Guidance"}
                </Text>
                <Text className={`text-xs font-outfit-medium leading-5 ${textDescClass}`}>
                  {message}
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {/* CALVING (CD) SAFETY WARNINGS */}
        {serviceType === "CD" && selectedAnimalIds.length === 1 && (() => {
          const selectedAnimal = animals.find((a) => a._id === selectedAnimalIds[0]);
          const status = selectedAnimal?.reproductiveStatus;
          if (status !== "Pregnant") {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-rose-100 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-rose-800 dark:text-rose-400">
                  Pregnancy Record Missing
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-rose-600 dark:text-rose-500">
                  Warning: This animal is not registered as Pregnant in the database (current status: {status || "Normal"}). Calving (CD) services should only be scheduled for pregnant animals. Please verify the animal&apos;s reproductive status.
                </Text>
              </View>
            );
          }
        })()}

        {/* PREGNANCY DIAGNOSIS (PD) SAFETY WARNINGS */}
        {serviceType === "PD" && selectedAnimalIds.length === 1 && (() => {
          const selectedAnimal = animals.find((a) => a._id === selectedAnimalIds[0]);
          const status = selectedAnimal?.reproductiveStatus;
          if (status === "Pregnant") {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-amber-800 dark:text-amber-400">
                  Redundant Check Warning
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-amber-600 dark:text-amber-500">
                  Notice: This animal is already confirmed as Pregnant in the database. A Pregnancy Diagnosis (PD) check may be redundant at this stage.
                </Text>
              </View>
            );
          }
          if (status !== "Inseminated" && status !== "Likely Pregnant") {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-amber-800 dark:text-amber-400">
                  No Recent Insemination
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-amber-600 dark:text-amber-500">
                  Notice: This animal is not currently marked as Inseminated. Pregnancy Check (PD) services are typically scheduled 30 to 60 days following an Artificial Insemination (AI) service to confirm success.
                </Text>
              </View>
            );
          }

          // If status is Inseminated, check the days since last insemination
          const lastInsemDate = selectedAnimal.lastInseminationDate || selectedAnimal.inseminations?.[0]?.dateOfAI || selectedAnimal.inseminations?.[0]?.inseminationDate;
          if (!lastInsemDate) {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-amber-800 dark:text-amber-400">
                  Missing Insemination Date
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-amber-600 dark:text-amber-500">
                  Notice: This animal is marked as Inseminated, but no insemination date could be found in the database. Please verify breeding logs before performing a Pregnancy Diagnosis (PD).
                </Text>
              </View>
            );
          }

          const daysSinceInsem = Math.floor((new Date().getTime() - new Date(lastInsemDate).getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceInsem > 120) {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-amber-800 dark:text-amber-400">
                  Stale Insemination Record
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-amber-600 dark:text-amber-500">
                  Notice: This animal is marked as Inseminated, but the last recorded insemination date was {daysSinceInsem} days ago (stale). Please verify the breeding logs or record a new insemination before performing a Pregnancy Diagnosis (PD).
                </Text>
              </View>
            );
          }

          if (daysSinceInsem < 30) {
            const timeStr = daysSinceInsem === 0 ? "today" : `only ${daysSinceInsem} days`;
            return (
              <View className="p-4 rounded-2xl mb-8 border border-rose-100 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-rose-800 dark:text-rose-400">
                  Pregnancy Check Too Early
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-rose-600 dark:text-rose-500">
                  Warning: Too Early. The last insemination was performed {timeStr === "today" ? "today" : `${timeStr} ago`}. A reliable Pregnancy Diagnosis (PD) should be performed at least 30-45 days (via ultrasound) or 60+ days (via rectal palpation) post-AI.
                </Text>
              </View>
            );
          }
          if (daysSinceInsem >= 30 && daysSinceInsem < 60) {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-emerald-800 dark:text-emerald-400">
                  Ultrasound Diagnostic Window
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-emerald-600 dark:text-emerald-500">
                  Recommended: It has been {daysSinceInsem} days since insemination. An ultrasound scan is currently the most recommended method for pregnancy checks in this period (30-45 days).
                </Text>
              </View>
            );
          }
          if (daysSinceInsem >= 60) {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-emerald-800 dark:text-emerald-400">
                  Optimal Diagnostic Window
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-emerald-600 dark:text-emerald-500">
                  Optimal: It has been {daysSinceInsem} days since insemination. Manual rectal palpation check is now highly recommended and reliable (60+ days).
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {/* MALE BREEDING SAFETY WARNINGS */}
        {["AI", "PD", "CD"].includes(serviceType) && selectedAnimalIds.length === 1 && (() => {
          const selectedAnimal = animals.find((a) => a._id === selectedAnimalIds[0]);
          const gender = selectedAnimal?.gender;
          if (gender === "Male") {
            return (
              <View className="p-4 rounded-2xl mb-8 border border-rose-100 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-rose-800 dark:text-rose-400">
                  Ineligible Gender Alert
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-rose-600 dark:text-rose-500">
                  Critical Warning: This animal is registered as Male. Breeding services (Artificial Insemination, Pregnancy Diagnosis, and Calving) cannot be scheduled or performed on male livestock.
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {/* BACKGROUND ACTIVITY WARNINGS */}
        {selectedAnimalIds.length === 1 && (() => {
          const selectedAnimalId = selectedAnimalIds[0];
          
          // Scan for active pending requests for this animal
          const activeReq = dashboardData?.pendingRequests?.find((req: any) => {
            const reqAnimalId = req.animalId?._id || req.raw?.animalId?._id || req.animalId;
            return reqAnimalId === selectedAnimalId;
          });
          
          // Scan for active scheduled tasks for this animal in the calendar agenda
          const activeAgendaTask = dashboardData?.agenda?.find((task: any) => {
            const animalIdsArray = task.raw?.animalIds || [];
            const hasAnimalInTask = animalIdsArray.some((id: any) => (typeof id === "string" ? id === selectedAnimalId : id?._id === selectedAnimalId));
            const hasAnimalInRecord = task.animalId === selectedAnimalId || task.animalId?._id === selectedAnimalId || task.raw?.animalId?._id === selectedAnimalId;
            return hasAnimalInTask || hasAnimalInRecord;
          });

          // Also scan the general tasks backlog list
          const activeBacklogTask = tasksQuery.data?.find((task: any) => {
            const animalIdsArray = task.animalIds || [];
            return animalIdsArray.some((a: any) => (typeof a === "string" ? a === selectedAnimalId : a?._id === selectedAnimalId));
          });

          const activeTask = activeAgendaTask || activeBacklogTask;

          if (activeReq || activeTask) {
            const reqType = activeReq?.type || activeReq?.raw?.requestType || "visit";
            const taskTypeDesc = activeTask?.task || activeTask?.taskType || activeTask?.raw?.taskType || "task";
            const message = activeReq 
              ? `Note: This animal already has a pending ${reqType.toUpperCase()} request in the queue.`
              : `Note: This animal is already linked to an active scheduled task: "${taskTypeDesc}".`;

            return (
              <View className="p-4 rounded-2xl mb-8 border border-sky-100 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-950/20">
                <Text style={{ fontFamily: "Outfit_800ExtraBold" }} className="text-sm mb-1 text-sky-800 dark:text-sky-400">
                  Active Record Detected
                </Text>
                <Text className="text-xs font-outfit-medium leading-5 text-sky-600 dark:text-sky-500">
                  {message} Please verify prior breeding logs and calendar slots to prevent duplicated visits.
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {OFFICIAL_SERVICE_TYPES.has(serviceType) && (
          <View className="bg-emerald-50/70 dark:bg-emerald-900/10 p-4 rounded-2xl mb-8 border border-emerald-100 dark:border-emerald-900/40">
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                color: isDark ? "#34d399" : "#00643B",
              }}
              className="text-sm mb-1"
            >
              Official record required
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-medium leading-5">
              This schedules a visit only. Official AI, health, pregnancy, or
              calving details are recorded later in the proper service form.
            </Text>
          </View>
        )}

        {/* CATEGORY & NOTES */}
        <View className="mb-6">
          <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-1 ml-1">
            Visit Category
          </Text>
          <Text className="text-slate-400 dark:text-slate-500 text-[11px] font-outfit-medium mb-3 ml-1">
            Choose how this visit should appear in the work queue.
          </Text>
          <View className="flex-row gap-2">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                className={`flex-1 min-h-[70px] py-3 px-2 rounded-xl border items-center justify-center ${category === cat ? "bg-[#00643B] dark:bg-emerald-600 border-[#00643B] dark:border-emerald-600" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"}`}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className={`text-[13px] ${category === cat ? "text-white" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {cat}
                </Text>
                <Text
                  style={{ fontFamily: "Outfit_500Medium" }}
                  className={`text-[9px] text-center mt-1 ${category === cat ? "text-white" : "text-slate-400 dark:text-slate-500"}`}
                  numberOfLines={2}
                >
                  {CATEGORY_HELPER[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
          Additional Notes
        </Text>
        <TextInput
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 h-32 text-slate-800 dark:text-white shadow-sm mb-10 font-outfit-medium"
          multiline
          textAlignVertical="top"
          placeholder="Any other details..."
          placeholderTextColor={isDark ? "#6b7280" : "#cbd5e1"}
          value={notes}
          onChangeText={setNotes}
        />

        {/* SAVE BUTTON */}
        <TouchableOpacity
          className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-20 ${saving ? "bg-slate-400" : "bg-[#00643B]"}`}
          onPress={handleSave}
          disabled={saving}
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
                Schedule Field Work
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {showVisitDatePicker && (
        <DateTimePicker
          value={visitDate || new Date()}
          mode="date"
          onChange={(_, selectedDate) => {
            setShowVisitDatePicker(false);
            if (selectedDate) {
              const baseDate = visitDate ? new Date(visitDate) : new Date();
              baseDate.setFullYear(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
              );
              setVisitDate(baseDate);
            }
          }}
        />
      )}

      {showVisitTimePicker && (
        <DateTimePicker
          value={visitDate || new Date()}
          mode="time"
          onChange={(_, selectedTime) => {
            setShowVisitTimePicker(false);
            if (selectedTime) {
              const baseDate = visitDate ? new Date(visitDate) : new Date();
              baseDate.setHours(
                selectedTime.getHours(),
                selectedTime.getMinutes(),
                0,
                0,
              );
              setVisitDate(baseDate);
            }
          }}
        />
      )}

      {/* FARMER SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFarmerModal}
        onRequestClose={() => setShowFarmerModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[80%] min-h-[50%]">
            <View className="flex-row justify-between items-center mb-5">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-xl text-slate-800 dark:text-white"
              >
                Select Farmer
              </Text>
              <TouchableOpacity
                onPress={() => setShowFarmerModal(false)}
                className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full"
              >
                <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            {farmers.length === 0 ? (
              <ActivityIndicator
                size="large"
                color={isDark ? "#34d399" : "#0d9488"}
                className="mt-10"
              />
            ) : (
              <FlatList
                data={farmers}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleFarmerSelect(item)}
                    className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl mb-3"
                  >
                    <View className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full items-center justify-center mr-3">
                      <User size={20} color={isDark ? "#34d399" : "#0d9488"} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-slate-800 dark:text-white text-base">
                        {item.name}
                      </Text>
                      <Text
                        className="text-slate-500 dark:text-slate-400 text-xs mt-0.5"
                        numberOfLines={1}
                      >
                        {getAddressStr(item.address)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
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
          <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[80%] min-h-[50%]">
            <View className="flex-row justify-between items-center mb-5">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-xl text-slate-800 dark:text-white"
              >
                {OFFICIAL_SERVICE_TYPES.has(serviceType) ? "Select Animal" : "Select Animals"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAnimalModal(false)}
                className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full"
              >
                <X size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            {loadingAnimals ? (
              <ActivityIndicator
                size="large"
                color={isDark ? "#34d399" : "#00643B"}
                className="mt-10"
              />
            ) : animals.length === 0 ? (
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
                renderItem={({ item }) => {
                  const isSelected = selectedAnimalIds.includes(item._id);
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        if (OFFICIAL_SERVICE_TYPES.has(serviceType)) {
                          // Single-select: select and close
                          setSelectedAnimalIds([item._id]);
                          setShowAnimalModal(false);
                        } else {
                          // Multi-select: toggle selection
                          toggleAnimalSelect(item._id);
                        }
                      }}
                      className={`flex-row items-center bg-slate-50 dark:bg-slate-800 border p-4 rounded-2xl mb-3 ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20"
                          : "border-slate-100 dark:border-slate-700"
                      }`}
                    >
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
                          className="text-slate-800 dark:text-white text-base"
                        >
                          {item.earTag || item.animalId}
                        </Text>
                        <View className="flex-row items-center flex-wrap gap-2 mt-0.5">
                          <Text className="text-slate-500 dark:text-slate-400 text-xs">
                            {item.breed} · {item.species}
                          </Text>
                          {item.reproductiveStatus && (
                            <View className={`px-1.5 py-0.5 rounded-full ${getReproductiveStatusStyle(item.reproductiveStatus).bg}`}>
                              <Text className={`text-[8px] font-outfit-bold ${getReproductiveStatusStyle(item.reproductiveStatus).text}`}>
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
    </SafeAreaView>
  );
}
