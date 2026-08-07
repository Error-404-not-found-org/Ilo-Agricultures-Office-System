import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronDown,
  Sparkles,
  X,
  Calendar,
  AlertCircle,
  History,
} from "lucide-react-native";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { calculateTargetCalvingDate } from "@/lib/cattleCore";
import {
  getPregnancyCheckReadiness,
  PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
} from "@/lib/reproductionEligibility";
import { useQueryClient } from "@tanstack/react-query";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Button } from "@/components/ui/Button";
import {
  TechnicianAnimalSelector,
  TechnicianFarmerListItem,
  TechnicianFarmerSelector,
  TechnicianFormInfo,
  TechnicianFormSection,
  TechnicianPickerSearch,
  TechnicianPickerSheet,
} from "@/components/technician/TechnicianFormUI";
import { AnimalSummaryCard } from "@/features/farmer-ui/components/AnimalSummaryCard";

export default function PregnancyCheckScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const initialFarmerId = params.farmerId as string | undefined;
  const initialFarmerName = params.farmerName as string | undefined;
  const initialAnimalId = params.animalId as string | undefined;

  const [saving, setSaving] = useState(false);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [searchFarmerQuery, setSearchFarmerQuery] = useState("");

  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [searchAnimalQuery, setSearchAnimalQuery] = useState("");

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [inseminations, setInseminations] = useState<any[]>([]);
  const [selectedInsemination, setSelectedInsemination] = useState<any>(null);
  const [showInsemModal, setShowInsemModal] = useState(false);

  const [result, setResult] = useState<"Pregnant" | "Empty" | "">("");
  const [note, setNote] = useState("");
  const [methodCode, setMethodCode] = useState("");

  const getPregnancyDiagnosisTiming = (attempt: any) => {
    const readiness = getPregnancyCheckReadiness(attempt);
    return {
      ...readiness,
      aiDate: attempt?.inseminationDate
        ? new Date(attempt.inseminationDate)
        : null,
      eligibleDate: readiness.availableDate
        ? new Date(readiness.availableDate)
        : null,
      isReady: readiness.isEligible,
    };
  };
  const getPregnancyDiagnosisStatus = (attempt: any) => {
    const timing = getPregnancyDiagnosisTiming(attempt);
    if (timing.policyMode === "method_based") {
      return timing.isReady
        ? "SELECT AN AVAILABLE DIAGNOSTIC METHOD"
        : "NO DIAGNOSTIC METHOD IS AVAILABLE YET";
    }
    return timing.isReady
      ? "READY FOR PREGNANCY DIAGNOSIS"
      : `MONITORING — DAY ${timing.daysPostAI ?? 0} OF ${PREGNANCY_DIAGNOSIS_MINIMUM_DAYS}`;
  };
  // VALID INSEMINATIONS FILTER
  const validInseminations = inseminations.filter(
    (item: any) => {
      const status = String(item?.status || "")
        .trim()
        .toLowerCase();
      const hasPendingOutcome =
        !item?.outcome || item.outcome === "Pending";
      const hasValidAIServiceDate = Boolean(
        item?.inseminationDate &&
          !Number.isNaN(
            new Date(item.inseminationDate).getTime(),
          ),
      );
      return (
        ["done", "completed"].includes(status) &&
        hasPendingOutcome &&
        hasValidAIServiceDate
      );
    },
  );


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

  const handleFarmerSelect = async (farmer: any) => {
    setSelectedFarmer(farmer);
    setSelectedAnimal(null);
    setInseminations([]);
    setSelectedInsemination(null);
    setMethodCode("");
    setResult("");
    setShowFarmerModal(false);

    try {
      const res = await api.get(`/animals/farmer/${farmer._id}`);
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAnimals(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load farmer animals");
    }
  };

  const loadAnimalHistory = useCallback(async (animal: any) => {
    setLoadingHistory(true);

    try {
      const res = await api.get(`/technician/animal-history/${animal._id}`);
      const history = res.data;

      const insemList = Array.isArray(history.inseminations)
        ? history.inseminations
        : [];

      setInseminations(insemList);

      const sortedInsemList = [...insemList].sort((a: any, b: any) => {
        return (b.attemptNumber || 0) - (a.attemptNumber || 0);
      });

      const latestPending = sortedInsemList.find(
        (item: any) => {
          const status = String(item?.status || "")
            .trim()
            .toLowerCase();
          return (
            ["done", "completed"].includes(status) &&
            (!item?.outcome ||
              item.outcome === "Pending") &&
            Boolean(item?.inseminationDate) &&
            !Number.isNaN(
              new Date(item.inseminationDate).getTime(),
            )
          );
        },
      );


      if (latestPending) {
        setSelectedInsemination(latestPending);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load animal history");
    } finally {
      setLoadingHistory(false);
    }
  }, [api]);

  const handleAnimalSelect = async (animal: any) => {
    setSelectedAnimal(animal);
    setSelectedInsemination(null);
    setMethodCode("");
    setInseminations([]);
    setResult("");
    setShowAnimalModal(false);
    await loadAnimalHistory(animal);
  };

  useEffect(() => {
    const prefillFromRoute = async () => {
      if (!initialFarmerId || !initialAnimalId || selectedAnimal) return;

      try {
        const farmer = {
          _id: initialFarmerId,
          name: initialFarmerName || "Selected farmer",
        };
        setSelectedFarmer(farmer);

        const animalsRes = await api.get(`/animals/farmer/${initialFarmerId}`);
        const animalList = Array.isArray(animalsRes.data)
          ? animalsRes.data
          : animalsRes.data?.data || [];
        setAnimals(animalList);

        const matchedAnimal =
          animalList.find((animal: any) => String(animal._id) === String(initialAnimalId)) ||
          (await api.get(`/animals/${initialAnimalId}`)).data;

        if (matchedAnimal) {
          setSelectedAnimal(matchedAnimal);
          await loadAnimalHistory(matchedAnimal);
        }
      } catch (err) {
        console.error(err);
        toast.error("Could not prefill pregnancy check details.");
      }
    };

    prefillFromRoute();
  }, [api, initialAnimalId, initialFarmerId, initialFarmerName, loadAnimalHistory, selectedAnimal]);

  const validatePregnancyCheck = () => {
    toast.dismiss();
    if (!selectedAnimal) {
      toast.error("Please select an animal first");
      return false;
    }
    if (!selectedInsemination) {
      toast.error("No breeding reference found. Please select an attempt.");
      return false;
    }
    const timing = getPregnancyDiagnosisTiming(
      selectedInsemination,
    );
    if (!timing.isReady) {
      const eligibleDateLabel = timing.eligibleDate
        ? timing.eligibleDate.toLocaleDateString(
            "en-US",
            {
              month: "long",
              day: "numeric",
              year: "numeric",
            },
          )
        : "the scheduled pregnancy diagnosis date";
      toast.error(
        `Pregnancy diagnosis is not yet available. It becomes available on ${eligibleDateLabel}.`,
      );
      return false;
    }
    if (!result) {
      toast.error("Please select a diagnosis result");
      return false;
    }
    if (timing.policyMode === "method_based" && !methodCode) {
      toast.error("Please select an available diagnostic method");
      return false;
    }

    return true;
  };

  const submitPregnancyCheck = async () => {
    setSaving(true);
    try {
      const payload = {
        animalId: selectedAnimal._id,
        inseminationId: selectedInsemination._id || selectedInsemination.id,
        result,
        technicianNote: note,
        methodCode: methodCode || undefined,
        policyVersion: selectedDiagnosisTiming.policyVersion,
      };

      await api.post("/technician/pregnancy-check", payload);
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "records"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["animal-details", selectedAnimal._id] });
      queryClient.invalidateQueries({ queryKey: ["animalTimeline", selectedAnimal._id] });
      toast.success(`Diagnosis saved successfully: ${result}`);
      router.back();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.message ||
        "Failed to save pregnancy record";
      if (code === "PREGNANCY_CHECK_TOO_EARLY") {
        toast.error(message);
        return;
      }
      console.error(err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (saving || !validatePregnancyCheck()) return;

    Alert.alert(
      "Save Pregnancy Diagnosis?",
      `This will mark ${selectedAnimal?.earTag || "the selected animal"} as ${result} for the selected breeding attempt and update the animal record history.`,
      [
        { text: "Review", style: "cancel" },
        {
          text: "Save Diagnosis",
          style: "default",
          onPress: submitPregnancyCheck,
        },
      ],
    );
  };

  const filteredFarmers = farmers.filter(
    (f) =>
      f.name?.toLowerCase().includes(searchFarmerQuery.toLowerCase()) ||
      f.phoneNumber?.includes(searchFarmerQuery), // Fixed phone number search
  );

  const filteredAnimals = animals.filter(
    (a) =>
      a.earTag?.toLowerCase().includes(searchAnimalQuery.toLowerCase()) ||
      a.breed?.toLowerCase().includes(searchAnimalQuery.toLowerCase()),
  );

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const selectedInseminationDate =
    selectedInsemination?.inseminationDate || null;
  const selectedDiagnosisTiming =
    getPregnancyDiagnosisTiming(selectedInsemination);
  const methodBased = selectedDiagnosisTiming.policyMode === "method_based";
  const methodOptions = selectedDiagnosisTiming.methods || [];
  const selectedMethod = methodOptions.find(
    (method: any) => method.methodCode === methodCode,
  );
  const daysSinceAI =
    selectedDiagnosisTiming.daysPostAI;
  const diagnosisEligibleDate =
    selectedDiagnosisTiming.eligibleDate;
  const isDiagnosisReady = methodBased
    ? Boolean(selectedMethod?.enabled && selectedMethod?.isEligible)
    : selectedDiagnosisTiming.isReady;
  const diagnosisEligibleDateLabel =
    diagnosisEligibleDate
      ? diagnosisEligibleDate.toLocaleDateString(
          "en-US",
          {
            month: "long",
            day: "numeric",
            year: "numeric",
          },
        )
      : "Unavailable";
  const estCalvingDate = selectedInseminationDate
    ? calculateTargetCalvingDate(
        selectedInseminationDate,
        selectedAnimal?.species || "Cattle",
        undefined,
        selectedAnimal?.breed,
      ).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Select an AI attempt";

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader title="Pregnancy Check" onBack={() => router.back()} />

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
            icon={<Sparkles size={18} color={colors.primary} />}
          >
            Record pregnancy diagnosis outcome for breeding tracking. This
            directly updates the cow&apos;s status in the system registry.
          </TechnicianFormInfo>

          <TechnicianFormSection
            title="Farmer and Animal"
            description="Choose the owner, animal, and completed breeding attempt."
          >

          {/* FARMER SELECTION */}
          <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
            Owner / Client
          </Text>
          <View className="mb-4">
            <TechnicianFarmerSelector
              farmer={selectedFarmer}
              secondaryText={
                selectedFarmer
                  ? [
                      selectedFarmer.address?.barangay,
                      selectedFarmer.address?.city,
                    ]
                      .filter(Boolean)
                      .join(", ") || selectedFarmer.phoneNumber
                  : undefined
              }
              onPress={() => setShowFarmerModal(true)}
            />
          </View>

          {/* ANIMAL SELECTION */}
          {selectedFarmer && (
            <>
              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
                Livestock Animal
              </Text>
              <View className="mb-4">
                <TechnicianAnimalSelector
                  animal={selectedAnimal}
                  placeholder="Select animal"
                  onPress={() => setShowAnimalModal(true)}
                />
              </View>
            </>
          )}

          {/* BREEDING ATTEMPT SELECTION */}
          {selectedAnimal && (
            <>
              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
                Breeding Attempt Reference
              </Text>
              {loadingHistory ? (
                <ActivityIndicator
                  color={isDark ? "#34d399" : "#00643B"}
                  style={{ marginVertical: 16 }}
                />
              ) : validInseminations.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setShowInsemModal(true)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[14px] p-4 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full items-center justify-center mr-3">
                      <History
                        size={20}
                        color={isDark ? "#60a5fa" : "#3b82f6"}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{ fontFamily: "Outfit_700Bold" }}
                        className="text-slate-800 dark:text-white text-base"
                      >
                        Attempt #{selectedInsemination?.attemptNumber || 1} (
                        {formatDate(selectedInsemination?.inseminationDate)})
                      </Text>
                      <Text className="text-[10px] text-slate-400 dark:text-slate-500 font-outfit-bold uppercase mt-0.5">
                        Sire Code: {selectedInsemination?.sireCode || "N/A"} •
                        Breed: {selectedInsemination?.sireBreed || "N/A"}
                      </Text>
                    </View>
                  </View>
                  <ChevronDown
                    size={20}
                    color={isDark ? "#6b7280" : "#94a3b8"}
                  />
                </TouchableOpacity>
              ) : (
                <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 p-4 rounded-2xl mb-6 flex-row items-center">
                  <AlertCircle
                    size={20}
                    color={isDark ? "#fbbf24" : "#d97706"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{ fontFamily: "Outfit_600SemiBold" }}
                    className="text-amber-800 dark:text-amber-300 text-xs flex-1"
                  >
                    No pending completed breeding attempts found.
                  </Text>
                </View>
              )}
            </>
          )}
          </TechnicianFormSection>

          {/* LINKED AI ATTEMPT CARD */}
          {selectedInsemination && (
            <View
              className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/45 p-5 rounded-3xl mb-6"
            >
              <Text
                style={{
                  fontFamily: "Outfit_800ExtraBold",
                  color: isDark ? "#60a5fa" : "#1e40af",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                🔗 Linked AI Attempt Details
              </Text>
              <View className="gap-y-1.5 mb-3">
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  Attempt Number:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                    }}
                  >
                    #{selectedInsemination.attemptNumber || 1}
                  </Text>
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  AI Date:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                    }}
                  >
                    {formatDate(selectedInseminationDate)}
                  </Text>
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  Days Since AI:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: isDiagnosisReady
                        ? "#059669"
                        : "#d97706",
                    }}
                  >
                    {daysSinceAI ?? "N/A"}
                    {daysSinceAI === null ? "" : " days"}
                  </Text>
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  Sire Code:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                    }}
                  >
                    {selectedInsemination.sireCode || "N/A"}
                  </Text>
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  Sire Breed:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                    }}
                  >
                    {selectedInsemination.sireBreed || "N/A"}
                  </Text>
                </Text>
                {selectedInsemination.technicianId?.name && (
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 13,
                      color: colors.textPrimary,
                    }}
                  >
                    AI Technician:{" "}
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                      }}
                    >
                      {selectedInsemination.technicianId.name}
                    </Text>
                  </Text>
                )}
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  Current Outcome:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: "#d97706",
                    }}
                  >
                    Pending
                  </Text>
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  Diagnosis Status:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: isDiagnosisReady
                        ? "#059669"
                        : "#d97706",
                    }}
                  >
                    {methodBased
                      ? methodCode
                        ? isDiagnosisReady
                          ? `${selectedMethod?.label || "Selected method"} is available`
                          : `${selectedMethod?.label || "Selected method"} is not yet available`
                        : "Select an available diagnostic method"
                      : isDiagnosisReady
                        ? "Ready for Pregnancy Diagnosis"
                        : `Monitoring — Day ${daysSinceAI ?? 0} of ${PREGNANCY_DIAGNOSIS_MINIMUM_DAYS}`}
                  </Text>
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: colors.textPrimary,
                  }}
                >
                  Diagnosis Available:{" "}
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                    }}
                  >
                    {diagnosisEligibleDateLabel}
                  </Text>
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
                  color: colors.textSecondary,
                  lineHeight: 16,
                  fontStyle: "italic"
                }}
              >
                This diagnosis will update AI Attempt #{selectedInsemination.attemptNumber || 1} from {formatDate(selectedInseminationDate)}. The result will be permanently linked to this AI service record.
              </Text>

              {!isDiagnosisReady && (
                <View
                  className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3 rounded-2xl mt-4 flex-row items-center gap-2"
                >
                  <AlertCircle size={18} color="#d97706" />
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 11,
                      color: "#b45309",
                      flex: 1,
                      lineHeight: 15,
                    }}
                  >
                    {methodBased
                      ? selectedMethod?.reason || "Select a diagnostic method that is currently available."
                      : `Pregnancy diagnosis is locked until Day ${PREGNANCY_DIAGNOSIS_MINIMUM_DAYS}. This attempt is currently at Day ${daysSinceAI ?? 0}. Diagnosis becomes available on ${diagnosisEligibleDateLabel}.`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {selectedInsemination && methodBased && (
            <>
              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
                Diagnostic Method
              </Text>
              <View className="gap-2 mb-6">
                {methodOptions.map((method: any) => (
                  <TouchableOpacity
                    key={method.methodCode}
                    disabled={!method.enabled || !method.isEligible}
                    onPress={() => setMethodCode(method.methodCode)}
                    style={{ opacity: method.enabled && method.isEligible ? 1 : 0.5 }}
                    className={`rounded-2xl border p-4 ${methodCode === method.methodCode ? "border-[#00643B] bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"}`}
                  >
                    <Text className="font-outfit-bold text-slate-800 dark:text-white">
                      {method.label}
                    </Text>
                    <Text className="font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {method.isEligible ? "Available now" : method.availableDateLabel || method.reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* DIAGNOSIS RESULT */}
          {selectedInsemination && (
            <>
              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
                Diagnosis Result
              </Text>
              <View className="flex-row gap-4 mb-6">
                <TouchableOpacity
                  onPress={() => {
                    if (isDiagnosisReady) {
                      setResult("Pregnant");
                    }
                  }}
                  disabled={!isDiagnosisReady}
                  style={{
                    opacity: isDiagnosisReady ? 1 : 0.45,
                  }}
                  className={`flex-1 min-h-[54px] py-4 rounded-[14px] border items-center justify-center gap-2 ${result === "Pregnant" ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}
                >
                  <Sparkles
                    size={24}
                    color={
                      result === "Pregnant"
                        ? "#7c3aed"
                        : isDark
                          ? "#4b5563"
                          : "#cbd5e1"
                    }
                  />
                  <Text
                    style={{ fontFamily: "Outfit_900Black" }}
                    className={`text-[11px] uppercase tracking-widest ${result === "Pregnant" ? "text-purple-700 dark:text-purple-400" : "text-slate-400 dark:text-slate-500"}`}
                  >
                    Pregnant
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (isDiagnosisReady) {
                      setResult("Empty");
                    }
                  }}
                  disabled={!isDiagnosisReady}
                  style={{
                    opacity: isDiagnosisReady ? 1 : 0.45,
                  }}
                  className={`flex-1 min-h-[54px] py-4 rounded-[14px] border items-center justify-center gap-2 ${result === "Empty" ? "border-rose-600 bg-rose-50 dark:bg-rose-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}
                >
                  <AlertCircle
                    size={24}
                    color={
                      result === "Empty"
                        ? "#e11d48"
                        : isDark
                          ? "#4b5563"
                          : "#cbd5e1"
                    }
                  />
                  <Text
                    style={{ fontFamily: "Outfit_900Black" }}
                    className={`text-[11px] uppercase tracking-widest ${result === "Empty" ? "text-rose-700 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}
                  >
                    Not Pregnant
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Estimated Calving Date Banner */}
              {result === "Pregnant" && (
                <View className="bg-purple-600 rounded-2xl p-4 flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center gap-3">
                    <Calendar size={22} color="rgba(255,255,255,0.7)" />
                    <View>
                      <Text className="text-[8px] font-outfit-bold text-white/70 uppercase tracking-widest">
                        Est. Calving Date
                      </Text>
                      <Text
                        style={{ fontFamily: "Outfit_900Black" }}
                        className="text-white text-base leading-tight mt-0.5"
                      >
                        {estCalvingDate}
                      </Text>
                    </View>
                  </View>
                  <Sparkles size={20} color="white" />
                </View>
              )}

              {/* Technical findings */}
              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">
                Findings / Technical Observations
              </Text>
              <TextInput
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[14px] px-4 py-3.5 h-28 text-slate-800 dark:text-white mb-4 font-outfit-medium"
                multiline
                textAlignVertical="top"
                placeholder="Optional details, conditions, notes..."
                placeholderTextColor={isDark ? "#6b7280" : "#94a3b8"}
                value={note}
                onChangeText={setNote}
              />

              {/* SAVE BUTTON */}
              <Button
                size="lg"
                className="mb-4"
                onPress={handleSave}
                loading={saving}
                disabled={saving || !isDiagnosisReady}
              >
                <Sparkles
                  size={19}
                  color="white"
                  style={{ marginRight: 9 }}
                />
                <Text
                  style={{ fontFamily: "Outfit_700Bold" }}
                  className="text-white text-sm"
                >
                  {isDiagnosisReady
                    ? "Save Diagnosis"
                    : "Pregnancy Diagnosis Not Yet Available"}
                </Text>
              </Button>
            </>
          )}
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
        <FlatList
          data={filteredFarmers}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 40,
              }}
            >
              No farmers match this search.
            </Text>
          }
          renderItem={({ item }) => (
            <TechnicianFarmerListItem
              farmer={item}
              selected={selectedFarmer?._id === item._id}
              secondaryText={`${
                [item.address?.barangay, item.address?.city]
                  .filter(Boolean)
                  .join(", ") || "No address provided"
              } · ${item.phoneNumber || "No phone"}`}
              onPress={() => handleFarmerSelect(item)}
            />
          )}
        />
      </TechnicianPickerSheet>

      {/* ANIMAL SELECTION MODAL */}
      <TechnicianPickerSheet
        visible={showAnimalModal}
        title="Select Animal"
        subtitle="Choose an animal for pregnancy diagnosis"
        onClose={() => setShowAnimalModal(false)}
      >
        <TechnicianPickerSearch
          value={searchAnimalQuery}
          onChangeText={setSearchAnimalQuery}
          placeholder="Search ear tag or breed"
        />
        <FlatList
          data={filteredAnimals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 40,
              }}
            >
              No animals found for this farmer.
            </Text>
          }
          renderItem={({ item }) => (
            <AnimalSummaryCard
              animal={item}
              onPress={() => handleAnimalSelect(item)}
              alert={
                selectedAnimal?._id === item._id
                  ? "Currently selected"
                  : undefined
              }
            />
          )}
        />
      </TechnicianPickerSheet>

      {/* INSEMINATION SELECTOR MODAL */}
      <Modal visible={showInsemModal} animationType="slide" transparent>
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
                Select Breeding Reference
              </Text>
              <TouchableOpacity
                onPress={() => setShowInsemModal(false)}
                className="p-1 bg-slate-50 dark:bg-slate-800 rounded-full"
              >
                <X size={20} color={isDark ? "#94a3b8" : "black"} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={validInseminations}
              keyExtractor={(item) => item._id || item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedInsemination(item);
                    setMethodCode("");
                    setShowInsemModal(false);
                  }}
                  className={`py-4 px-1 border-b border-slate-100 dark:border-slate-800 ${
                    selectedInsemination?._id === item._id
                      ? "bg-emerald-50 dark:bg-emerald-900/10 rounded-xl"
                      : ""
                  }`}
                >
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-slate-800 dark:text-white text-sm"
                  >
                    Attempt #{item.attemptNumber || 1} •{" "}
                    {formatDate(item.inseminationDate)}
                  </Text>
                  <Text className="text-[10px] text-slate-400 dark:text-slate-500 font-outfit-bold uppercase mt-0.5">
                    Sire Code: {item.sireCode || "N/A"} • Breed:{" "}
                    {item.sireBreed || "N/A"}
                  </Text>
                  <Text
                    className={`text-[10px] font-outfit-bold uppercase mt-1 ${
                      getPregnancyDiagnosisTiming(item).isReady
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {getPregnancyDiagnosisStatus(item)}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="py-10 items-center">
                  <AlertCircle
                    size={26}
                    color={isDark ? "#fbbf24" : "#d97706"}
                  />
                  <Text
                    style={{ fontFamily: "Outfit_700Bold" }}
                    className="text-slate-500 dark:text-slate-400 mt-3 text-sm"
                  >
                    No valid insemination attempts found
                  </Text>
                  <Text
                    style={{ fontFamily: "Outfit_500Medium" }}
                    className="text-slate-400 dark:text-slate-500 text-xs mt-1 text-center px-10"
                  >
                    Only active/performed insemination attempts with pending diagnosis
                    are available for pregnancy checking.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}
