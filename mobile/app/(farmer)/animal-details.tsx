import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from "react-native";
import {
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import {
  ArrowLeft,
  User,
  MapPin,
  Activity,
  History,
  Info as InfoIcon,
  Calendar,
  Trash2,
  Syringe,
  Stethoscope,
  ClipboardList,
  Scale,
  X,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import { useApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { SPECIES_PROFILES, normalizeSpecies } from "@/lib/cattleCore";
import { useTheme } from "@/lib/theme";
import { ConfirmationModal } from "@/components/ConfirmationModal";

export default function AnimalDetails() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const primaryColor = isDark ? colors.primary : '#00643B';

  const getAdditionalNotesOnly = (fullComment: string) => {
    if (!fullComment) return "";
    const parts = fullComment.split("Additional Notes:\n");
    if (parts.length > 1) {
      return parts[1].trim();
    }
    if (fullComment.includes("Observed Heat Signs:\n")) {
      return "";
    }
    return fullComment;
  };

  const getInseminationBadge = (record: any) => {
    if (!record) return { text: "Pending", bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb", color: isDark ? "#fbbf24" : "#d97706" };
    const status = record.status?.toLowerCase() || "pending";
    if (status !== "done") {
      switch (status) {
        case "rejected":
          return {
            text: "Rejected",
            bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
            color: isDark ? "#f87171" : "#b91c1c",
          };
        case "approved":
          return {
            text: "Approved",
            bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
            color: isDark ? "#34d399" : "#047857",
          };
        case "in-progress":
          return {
            text: "In-Progress",
            bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
            color: isDark ? "#60a5fa" : "#1d4ed8",
          };
        case "pending":
        default:
          return {
            text: "Pending",
            bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
            color: isDark ? "#fbbf24" : "#d97706",
          };
      }
    }

    // If status is "done", check the outcome
    const outcomeText = record.pregnancyStatus || record.outcome || record.result || "Pending";
    const isSuccess = outcomeText === "Pregnant" || outcomeText === "Successful" || outcomeText === "Positive";
    const isFailed = outcomeText.startsWith("Failed") || outcomeText === "Negative" || outcomeText === "Empty";

    if (isSuccess) {
      return {
        text: "Pregnant",
        bg: isDark ? "rgba(52, 211, 153, 0.15)" : "#ecfdf5",
        color: isDark ? "#34d399" : "#047857",
      };
    } else if (isFailed) {
      return {
        text: "Empty",
        bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
        color: colors.error,
      };
    } else {
      return {
        text: "Inseminated",
        bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
        color: isDark ? "#60a5fa" : "#1d4ed8",
      };
    }
  };

  const [activeTab, setActiveTab] = useState<"Info" | "History">("Info");

  const [animal, setAnimal] = useState<any>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;

      const fetchAnimal = async () => {
        try {
          const [animalRes, medicalRes] = await Promise.all([
            api.get(`/animals/${id}`),
            api.get(`/medical/${id}`),
          ]);
          setAnimal(animalRes.data);
          setMedicalRecords(medicalRes.data);
        } catch (error: any) {
          console.error("Failed to fetch animal details", error);
          if (error.response?.status === 404) {
             toast.info("This animal record has been removed.");
             router.replace("/(farmer)/(tabs)/farmer.records");
          } else {
             toast.error(error.response?.data?.message || "Could not load animal details.");
          }
        } finally {
          setLoading(false);
        }
      };

      fetchAnimal();
    }, [id, api]),
  );

  const handleDelete = () => {
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await api.delete(`/animals/${id}`);
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['animals', 'my'] });
      toast.success("Animal deleted successfully");
      router.replace("/(farmer)/(tabs)/farmer.records");
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete animal",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (!animal) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.background }}>
        <MaterialCommunityIcons name="cow-off" size={64} color={colors.textMuted} />
        <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary }} className="text-lg mt-4">
          Animal Not Found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 px-10 py-3.5 rounded-full shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Extract proper formats
  const farmerName = animal.farmerId?.name || "Unassigned";
  const addr = animal.farmerId?.address;
  const farmerPhone =
    addr?.phoneNumber || animal.farmerId?.phone || "No phone attached";
  const farmerAddress = addr
    ? [addr.street, addr.barangay, addr.city, addr.province]
        .filter(Boolean)
        .join(", ")
    : "Location Unregistered";

  // Compute dynamic age based on birthDate subtraction
  let ageDisplay = "Unknown";
  if (animal.birthDate) {
    const birth = new Date(animal.birthDate);
    const now = new Date();
    let diffMonths =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());
    if (diffMonths < 0) diffMonths = 0;

    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;

    if (years > 0 && months > 0)
      ageDisplay = `${years} Yr${years > 1 ? "s" : ""}, ${months} Mo${months > 1 ? "s" : ""}`;
    else if (years > 0) ageDisplay = `${years} Year${years > 1 ? "s" : ""}`;
    else if (months > 0) ageDisplay = `${months} Month${months > 1 ? "s" : ""}`;
    else ageDisplay = "Newborn";
  }

  // Combine and sort medical history
  const combinedHistory = [
    ...(animal.inseminations || []).map((i: any) => ({
      ...i,
      type: "insemination",
      recordDate: i.inseminationDate || i.dateOfAI || i.createdAt,
    })),
    ...(animal.calvings || []).map((c: any) => ({
      ...c,
      type: "calving",
      recordDate: c.date || c.createdAt,
    })),
    ...medicalRecords.map((m: any) => ({ ...m, recordDate: m.date })),
  ].sort(
    (a, b) =>
      new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime(),
  );

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950" style={{ backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[280px]" style={{ backgroundColor: '#00643B' }} />

      {/* Header Actions */}
      <View className="pt-14 px-6 flex-row justify-between items-center z-10">
        <TouchableOpacity
          onPress={() => router.push("/(farmer)/(tabs)/farmer.records")}
          className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/10"
        >
          <ArrowLeft size={22} color="white" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-white text-lg tracking-wide">
          Animal Profile
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            className="w-10 h-10 bg-red-500/20 rounded-full items-center justify-center"
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Trash2 size={20} color="#ef4444" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Profile Section */}
      <View className="px-6 items-center mt-6 z-10">
        <View 
          className="w-28 h-28 rounded-[32px] items-center justify-center border-4 shadow-xl mb-4 overflow-hidden"
          style={{ backgroundColor: colors.card, borderColor: isDark ? colors.border : '#e2e8f0' }}
        >
          {animal.imageUrl ? (
            <Image
              source={{ uri: animal.imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons name="cow" size={56} color={primaryColor} />
          )}
        </View>
        <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-white mb-1">
          Tag {animal.earTag ? `#${animal.earTag}` : "N/A"}
        </Text>
        <View className="flex-row items-center bg-white/20 px-4 py-1.5 rounded-full mb-3">
          <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-emerald-100 text-[10px] uppercase tracking-widest">
            {animal.status || "Active"} 🐄
          </Text>
        </View>
      </View>

      {/* Overlapping White Curve Card */}
      <View
        className="flex-1 rounded-t-[32px] pt-6 mt-4 shadow-lg flex-col"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 15,
          elevation: 8,
          backgroundColor: colors.background
        }}
      >
        {/* Customized Tabs */}
        <View className="flex-row px-6 mb-6">
          <TouchableOpacity
            onPress={() => setActiveTab("Info")}
            className="flex-1 py-4 items-center flex-row justify-center gap-2"
            style={{ borderBottomWidth: 3, borderBottomColor: activeTab === "Info" ? primaryColor : "transparent" }}
          >
            <InfoIcon
              size={18}
              color={activeTab === "Info" ? primaryColor : colors.textMuted}
            />
            <Text
              style={{ fontFamily: activeTab === 'Info' ? 'Outfit_800ExtraBold' : 'Outfit_600SemiBold', color: activeTab === "Info" ? primaryColor : colors.textMuted }}
              className="text-[15px]"
            >
              General Info
            </Text>
          </TouchableOpacity>

          <View className="w-[1px] h-6 self-center" style={{ backgroundColor: colors.border }} />

          <TouchableOpacity
            onPress={() => setActiveTab("History")}
            className="flex-1 py-4 items-center flex-row justify-center gap-2"
            style={{ borderBottomWidth: 3, borderBottomColor: activeTab === "History" ? primaryColor : "transparent" }}
          >
            <History
              size={18}
              color={activeTab === "History" ? primaryColor : colors.textMuted}
            />
            <Text
              style={{ fontFamily: activeTab === 'History' ? 'Outfit_800ExtraBold' : 'Outfit_600SemiBold', color: activeTab === "History" ? primaryColor : colors.textMuted }}
              className="text-[15px]"
            >
              Medical History
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          className="px-6"
        >
          {/* --- MOOWIE GREETING SECTION --- */}
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
                style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4', borderColor: isDark ? 'transparent' : '#d1fae5' }}
              >
                <Text style={{ fontFamily: 'Outfit_900Black', color: isDark ? '#a7f3d0' : '#065f46' }} className="text-[13px] mb-1">
                  Moowie Insight
                </Text>
                <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-[12px] leading-[18px]">
                  {animal.reproductiveStatus === "Pregnant"
                    ? `I'm tracking ${animal.earTag || "this girl"}'s pregnancy closely. She's doing great! 🐮`
                    : animal.reproductiveStatus === "In Heat"
                      ? "She's showing signs of heat! 🐮 Perfect timing to request a technician for insemination."
                      : animal.reproductiveStatus === "Inseminated" || animal.reproductiveStatus === "Likely Pregnant"
                        ? `She was recently inseminated! 🐮 I'm tracking the days for you. We'll know more soon!`
                        : `Looking at ${animal.earTag || "her"} details... ${ageDisplay} and ${animal.reproductiveStatus || "Healthy"}. She's in good hands!`}
                </Text>
              </View>
            </View>
          </View>

          {activeTab === "Info" ? (
            <View className="gap-y-6">
              {/* Reproductive Status Section (For Females) */}
              {animal.gender === "Female" && (
                <View
                  className="p-5 rounded-3xl border mb-2"
                  style={{
                    shadowColor: "#94a3b8",
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                    backgroundColor: colors.card,
                    borderColor: colors.border
                  }}
                >
                  <View className="flex-row items-center mb-5 gap-2">
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={20}
                      color={primaryColor}
                    />
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-lg">
                      Reproductive Health
                    </Text>
                  </View>

                  <View 
                    className="p-4 rounded-2xl mb-4 border"
                    style={{ backgroundColor: isDark ? colors.background : '#f8fafc', borderColor: colors.border }}
                  >
                    <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textMuted }} className="text-[10px] uppercase tracking-widest mb-1.5">
                      Current Status
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View
                        className={`w-3 h-3 rounded-full ${
                          animal.reproductiveStatus === "Pregnant"
                            ? "bg-emerald-500"
                            : animal.reproductiveStatus === "Inseminated"
                              ? "bg-blue-500"
                              : animal.reproductiveStatus === "In Heat"
                                ? "bg-orange-500"
                                : "bg-slate-300"
                        }`}
                      />
                      <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-xl">
                        {animal.reproductiveStatus || "Normal"}
                      </Text>
                    </View>
                  </View>

                  {/* Insemination Timeline for "Inseminated" Animals */}
                  {(animal.reproductiveStatus?.toLowerCase() === "inseminated") && (() => {
                    const lastInsem = animal.inseminations?.[0];
                    const aiDate = lastInsem?.dateOfAI || lastInsem?.createdAt || animal.updatedAt;
                    const startDate = new Date(aiDate);
                    const today = new Date();
                    
                    const diffTime = Math.abs(today.getTime() - startDate.getTime());
                    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    let phase = "";
                    let advice = "";
                    let color = "";
                    let bg = "";
                    let border = "";

                    if (diffDays >= 18 && diffDays <= 24) {
                      phase = "Heat Watch";
                      advice = "CRITICAL: Check for signs of heat. If she 'reheats' within this window, the AI likely failed.";
                      color = "#f59e0b"; // orange
                      bg = isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb';
                      border = isDark ? 'rgba(245, 158, 11, 0.3)' : '#fef3c7';
                    } else if (diffDays < 18) {
                      phase = "Recovery";
                      advice = "The animal is in the recovery phase after insemination. Keep her calm and well-fed.";
                      color = "#3b82f6"; // blue
                      bg = isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff';
                      border = isDark ? 'rgba(59, 130, 246, 0.3)' : '#dbeafe';
                    } else if (diffDays > 24 && diffDays < 60) {
                      phase = "Wait for PD";
                      advice = "No signs of heat? Great! Now we wait until Day 60 for a professional pregnancy check.";
                      color = "#6366f1"; // indigo
                      bg = isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff';
                      border = isDark ? 'rgba(99, 102, 241, 0.3)' : '#e0e7ff';
                    } else if (diffDays >= 60) {
                      phase = "PD Due";
                      advice = "It's been 60+ days! Time to request a technician for a Pregnancy Diagnosis (PD).";
                      color = "#9333ea"; // purple
                      bg = isDark ? 'rgba(147, 51, 234, 0.15)' : '#f5f3ff';
                      border = isDark ? 'rgba(147, 51, 234, 0.3)' : '#ede9fe';
                    }

                    return (
                      <View 
                        className="p-5 rounded-3xl border mb-4"
                        style={{ backgroundColor: bg, borderColor: border, borderWidth: 1 }}
                      >
                        <View className="flex-row justify-between items-start mb-3">
                          <View>
                            <Text style={{ fontFamily: 'Outfit_900Black', color: color }} className="text-[9px] uppercase tracking-widest">
                              {phase} Phase
                            </Text>
                            <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-lg">
                              Day {diffDays} Post-AI
                            </Text>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textSecondary }} className="text-[11px]">
                              Inseminated {diffHours < 24 ? `${diffHours} hours ago` : `${diffDays} days ago`}
                            </Text>
                          </View>
                          <MaterialCommunityIcons name="timer-sand" size={24} color={color} />
                        </View>
                        
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-[12px] leading-4 italic mb-4">
                          &quot;{advice}&quot;
                        </Text>

                        {/* Action Buttons based on phase */}
                        <View className="flex-col gap-3">
                          <View className="flex-row gap-3">
                            {/* Reheat Button */}
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert(
                                  "Report Reheat",
                                  "Did you observe signs of heat (estrus) in this animal? This means the AI was likely unsuccessful.",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { 
                                      text: "Yes, Reheated", 
                                      style: "destructive",
                                      onPress: async () => {
                                        try {
                                          if (lastInsem?._id) {
                                            await api.patch(`/ai-request/${lastInsem._id}/outcome`, {
                                              isSuccess: false,
                                              note: "Farmer manually logged reheat via profile."
                                            });
                                          } else {
                                            await api.patch(`/animals/${id}/reproductive-status`, {
                                              status: "In Heat",
                                              note: "Farmer reported reheat."
                                            });
                                          }
                                          toast.success("Status updated to In Heat.");
                                          setAnimal({ ...animal, reproductiveStatus: "In Heat" });
                                        } catch { toast.error("Failed to update."); }
                                      }
                                    }
                                  ]
                                );
                              }}
                              className="flex-1 py-3 rounded-2xl items-center"
                              style={{ backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.6)', borderColor: isDark ? 'rgba(249, 115, 22, 0.3)' : '#fed7aa', borderWidth: 1 }}
                            >
                              <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-orange-600 dark:text-orange-400 text-[10px] uppercase">Reheated (Empty)</Text>
                            </TouchableOpacity>

                            {/* Pregnant Button */}
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert(
                                  "Confirm Pregnancy",
                                  "Are you sure you want to mark this animal as successfully pregnant? This will register a PD record for the technician.",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { 
                                      text: "Yes, Pregnant", 
                                      onPress: async () => {
                                        try {
                                          if (lastInsem?._id) {
                                            await api.patch(`/ai-request/${lastInsem._id}/outcome`, {
                                              isSuccess: true,
                                              note: "Farmer confirmed pregnancy via profile."
                                            });
                                          } else {
                                            await api.patch(`/animals/${id}/reproductive-status`, {
                                              status: "Pregnant",
                                              note: "Farmer confirmed pregnancy."
                                            });
                                          }
                                          toast.success("Pregnancy Confirmed! 🎉");
                                          setAnimal({ ...animal, reproductiveStatus: "Pregnant" });
                                        } catch { toast.error("Failed to update pregnancy."); }
                                      }
                                    }
                                  ]
                                );
                              }}
                              className="flex-1 py-3 rounded-2xl items-center shadow-sm"
                              style={{ backgroundColor: color }}
                            >
                              <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-white text-[10px] uppercase">Pregnant (Success)</Text>
                            </TouchableOpacity>
                          </View>

                          {diffDays >= 60 && (
                            <TouchableOpacity
                              onPress={() => router.push({
                                pathname: "/(farmer)/report-sickness",
                                params: { 
                                  animalId: animal._id,
                                  type: "checkup",
                                  note: "Requesting Pregnancy Diagnosis (Day 60+)"
                                }
                              } as any)}
                              className="w-full py-3 mt-1 rounded-2xl items-center shadow-sm"
                              style={{ backgroundColor: colors.primary }}
                            >
                              <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-white text-[10px] uppercase tracking-widest">Request Professional PD Check</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })()}

                  {/* Calving Countdown for Pregnant Animals */}
                  {animal.reproductiveStatus === "Pregnant" &&
                    (() => {
                      const lastInsemDate =
                        animal.inseminations?.[0]?.dateOfAI || animal.updatedAt;
                      const startDate = new Date(lastInsemDate);
                      const today = new Date();
                      const normSpecies = normalizeSpecies(animal.species);
                      const profile = SPECIES_PROFILES[normSpecies] || SPECIES_PROFILES["Cattle"];
                      const gestationDays = profile.avgGestationDays;
                      const dueDate = new Date(startDate);
                      dueDate.setDate(startDate.getDate() + gestationDays);

                      const daysPassed = Math.floor(
                        (today.getTime() - startDate.getTime()) /
                          (1000 * 60 * 60 * 24),
                      );
                      const daysRemaining = Math.max(
                        0,
                        gestationDays - daysPassed,
                      );
                      const progress = Math.min(
                        100,
                        Math.max(0, (daysPassed / gestationDays) * 100),
                      );

                      const cardBg = isDark ? 'rgba(147, 51, 234, 0.15)' : '#f5f3ff';
                      const cardBorder = isDark ? 'rgba(147, 51, 234, 0.3)' : '#ede9fe';
                      const brandPurple = isDark ? '#c084fc' : '#7e22ce';

                      return (
                        <View 
                          className="p-5 rounded-3xl border mb-4"
                          style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
                        >
                          <View className="flex-row justify-between items-end mb-3">
                            <View>
                              <Text style={{ fontFamily: 'Outfit_900Black', color: brandPurple }} className="text-[9px] uppercase tracking-widest">
                                Expected Calving
                              </Text>
                              <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-lg">
                                {dueDate.toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </Text>
                            </View>
                            <View className="items-end">
                              <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-xl">
                                {daysRemaining}
                              </Text>
                              <Text style={{ fontFamily: 'Outfit_900Black', color: brandPurple }} className="text-[8px] uppercase">
                                Days Left
                              </Text>
                            </View>
                          </View>

                          {/* Progress Bar */}
                          <View className="w-full h-3 rounded-full overflow-hidden shadow-inner" style={{ backgroundColor: isDark ? 'rgba(147, 51, 234, 0.3)' : '#e9d5ff' }}>
                            <View
                              className="h-full rounded-full"
                              style={{ width: `${progress}%`, backgroundColor: isDark ? '#a855f7' : '#7e22ce' }}
                            />
                          </View>
                          <Text style={{ fontFamily: 'Outfit_700Bold', color: brandPurple }} className="text-[10px] mt-2 text-center uppercase tracking-tighter">
                            {progress.toFixed(0)}% of Gestation Period Completed
                          </Text>
                        </View>
                      );
                    })()}

                  {/* Generic "Reheat" Action for other reproductive states (if needed) */}
                  {animal.reproductiveStatus === "Likely Pregnant" && (
                    <View className="space-y-3 mt-4">
                       <View className="flex-row gap-3">
                        <TouchableOpacity
                          onPress={async () => {
                            Alert.alert(
                              "Confirm Heat Signs",
                              "Are you sure you observed heat signs? This will cancel the previous pregnancy status.",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Yes, In Heat",
                                  onPress: async () => {
                                    try {
                                      await api.patch(
                                        `/animals/${id}/reproductive-status`,
                                        {
                                          status: "In Heat",
                                          note: "Farmer observed heat signs.",
                                        },
                                      );
                                      toast.success("Status Updated.");
                                      setAnimal({
                                        ...animal,
                                        reproductiveStatus: "In Heat",
                                      });
                                    } catch {
                                      toast.error("Update failed.");
                                    }
                                  },
                                },
                              ],
                            );
                          }}
                          className="flex-1 border-2 py-3.5 rounded-2xl items-center"
                          style={{ backgroundColor: colors.card, borderColor: isDark ? 'rgba(249, 115, 22, 0.3)' : '#fed7aa' }}
                        >
                          <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-orange-600 dark:text-orange-400 text-[10px] uppercase tracking-widest">
                            Yes - In Heat
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Basic Info Section */}
              <View
                className="p-5 rounded-3xl border"
                style={{
                  shadowColor: "#94a3b8",
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }}
              >
                <View className="flex-row items-center mb-5 gap-2">
                  <Activity size={20} color={primaryColor} />
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-lg">
                    Biological Details
                  </Text>
                </View>

                <View className="gap-y-4">
                  <InfoRow
                    label="System ID"
                    value={animal.animalId || "Missing"}
                  />
                  <Divider />
                  <InfoRow label="Gender" value={animal.gender || "Female"} />
                  <Divider />
                  <InfoRow label="Current Age" value={ageDisplay} />
                  <Divider />
                  <InfoRow
                    label="Species"
                    value={animal.species || "Missing"}
                  />
                  <Divider />
                  <InfoRow
                    label="Breed Type"
                    value={animal.breed || "Missing"}
                  />
                  <Divider />
                  <InfoRow
                    label="Color / Markings"
                    value={animal.color || "Unregistered"}
                  />
                  <Divider />
                  <InfoRow
                    label="Brand Mark"
                    value={animal.brand || "Unbranded"}
                  />
                </View>
              </View>

              {/* Owner Info Section */}
              <View
                className="p-5 rounded-3xl border"
                style={{
                  shadowColor: "#94a3b8",
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }}
              >
                <View className="flex-row items-center mb-5 gap-2">
                  <User size={20} color={primaryColor} />
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-lg">
                    Ownership Details
                  </Text>
                </View>

                <View 
                  className="flex-row items-center gap-4 mb-5 p-3 rounded-2xl border"
                  style={{ backgroundColor: isDark ? colors.background : '#f8fafc', borderColor: colors.border }}
                >
                  <View 
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }}
                  >
                    <Text style={{ fontFamily: 'Outfit_900Black', color: isDark ? colors.primary : '#065f46' }} className="text-lg">
                      {(animal.farmerId?.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-base">
                      {farmerName}
                    </Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-[12px] mt-0.5">
                      {farmerPhone}
                    </Text>
                    <View 
                      className="px-2.5 py-0.5 rounded-full self-start mt-2 border"
                      style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', borderColor: isDark ? 'transparent' : '#d1fae5' }}
                    >
                      <Text style={{ fontFamily: 'Outfit_900Black', color: isDark ? colors.primary : '#065f46' }} className="text-[9px] uppercase tracking-widest">
                        Registered Owner
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="gap-y-5">
                  <View className="flex-col gap-1">
                    <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textMuted }} className="text-[10px] uppercase tracking-widest">
                      Location Address
                    </Text>
                    <View className="flex-row items-start gap-2 mt-2 pr-4">
                      <MapPin
                        size={16}
                        color={isDark ? colors.primary : "#00643B"}
                        style={{ marginTop: 2 }}
                      />
                      <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary }} className="text-[15px] leading-5 w-11/12">
                        {farmerAddress}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View>
              {combinedHistory.length > 0 ? (
                <View className="mt-2 text-primary">
                  {combinedHistory.map((record: any, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setSelectedRecord(record);
                        setRecordModalVisible(true);
                      }}
                      activeOpacity={0.7}
                      className="p-5 rounded-[24px] mb-4 flex-row"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1,
                        shadowColor: "#94a3b8",
                        shadowOpacity: isDark ? 0 : 0.05,
                        shadowRadius: 6,
                        elevation: isDark ? 0 : 2,
                      }}
                    >
                      <View
                        className="w-12 h-12 rounded-full items-center justify-center mr-4"
                        style={{
                          backgroundColor: record.type === "insemination"
                            ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff')
                            : record.type === "calving"
                              ? (isDark ? 'rgba(249, 115, 22, 0.15)' : '#fff7ed')
                              : record.type === "Vaccination"
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                                : record.type === "Weight Log"
                                  ? (isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff')
                                  : (isDark ? 'rgba(100, 116, 139, 0.15)' : '#f8fafc')
                        }}
                      >
                        {record.type === "insemination" && (
                          <MaterialCommunityIcons
                            name="needle"
                            size={24}
                            color="#3B82F6"
                          />
                        )}
                        {record.type === "calving" && (
                          <MaterialCommunityIcons
                            name="baby-carriage"
                            size={24}
                            color="#F97316"
                          />
                        )}
                        {record.type === "Vaccination" && (
                          <Syringe size={22} color="#10B981" />
                        )}
                        {record.type === "Deworming" && (
                          <MaterialCommunityIcons
                            name="pill"
                            size={22}
                            color="#3B82F6"
                          />
                        )}
                        {record.type === "Treatment" && (
                          <Stethoscope size={22} color="#F59E0B" />
                        )}
                        {record.type === "Weight Log" && (
                          <Scale size={22} color="#6366F1" />
                        )}
                        {record.type === "Check-up" && (
                          <ClipboardList size={22} color="#64748B" />
                        )}
                      </View>

                      <View className="flex-1">
                        <View className="flex-row justify-between items-start mb-1">
                          <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[16px]">
                            {record.type === "insemination"
                              ? `A.I. Attempt #${record.attemptNumber || 1}`
                              : record.type === "calving"
                                ? "Calf Drop"
                                : record.type}
                          </Text>
                          {record.type === "insemination" && (() => {
                            const badge = getInseminationBadge(record);
                            return (
                              <View 
                                className="px-2.5 py-0.5 rounded-full"
                                style={{ backgroundColor: badge.bg }}
                              >
                                <Text
                                  style={{
                                    fontFamily: 'Outfit_900Black',
                                    color: badge.color
                                  }}
                                  className="text-[10px] uppercase tracking-wider"
                                >
                                  {badge.text}
                                </Text>
                              </View>
                            );
                          })()}
                          {record.type === "calving" && (
                            <View 
                              className="px-2.5 py-0.5 rounded-full"
                              style={{ backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : '#fff7ed' }}
                            >
                              <Text style={{ fontFamily: 'Outfit_900Black', color: isDark ? '#fb923c' : '#c2410c' }} className="text-[10px] uppercase tracking-wider">
                                {record.calvingEase || "Natural"}
                              </Text>
                            </View>
                          )}
                          {record.type !== "insemination" && record.type !== "calving" && (
                            <View 
                              className="px-2.5 py-0.5 rounded-full"
                              style={{ backgroundColor: colors.border }}
                            >
                              <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textSecondary }} className="text-[9px] uppercase tracking-wider">
                                Medical
                              </Text>
                            </View>
                          )}
                        </View>

                        <View className="flex-row items-center gap-1 mb-2">
                          <Calendar size={12} color={colors.textMuted} />
                          <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-xs">
                            {new Date(record.recordDate).toLocaleDateString()}
                          </Text>
                        </View>

                        {record.details?.medicineName && (
                          <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-sm mt-1">
                            Medicine:{" "}
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }}>
                              {record.details.medicineName}
                            </Text>
                          </Text>
                        )}
                        {record.details?.weight && (
                          <Text style={{ fontFamily: 'Outfit_500Medium', color: isDark ? '#818cf8' : '#4f46e5' }} className="text-sm mt-1">
                            Weight:{" "}
                            <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }}>
                              {record.details.weight} kg
                            </Text>
                          </Text>
                        )}
                        {record.type === "insemination" && record.heatSigns && record.heatSigns.length > 0 ? (
                          <View className="flex-row flex-wrap gap-1 mt-2 mb-1">
                            {record.heatSigns.map((signId: string) => {
                              const signMap: Record<string, string> = {
                                standing_heat: "Standing Heat 🐮",
                                attempt_mount: "Attempting to Mount",
                                restlessness: "Restlessness / Activity",
                                vocalization: "Vocalization (Bellowing)",
                                flehmen: "Flehmen Response",
                                grouping: "Friendly Grouping",
                                mucus_discharge: "Clear Mucus Discharge 💧",
                                swollen_vulva: "Swollen, Red Vulva",
                                muddy_flanks: "Muddy Flanks / Tailhead",
                                metestrus_bleeding: "Metestrus Bleeding 🩸",
                              };
                              const label = signMap[signId] || signId;
                              const isPrimary = signId === "standing_heat";
                              const isBleeding = signId === "metestrus_bleeding";

                              let badgeBg = isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5";
                              let badgeText = isDark ? "#34d399" : "#065F46";
                              let badgeBorder = isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5";

                              if (isPrimary) {
                                badgeBg = isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7";
                                badgeText = isDark ? "#fbbf24" : "#92400E";
                                badgeBorder = isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7";
                              } else if (isBleeding) {
                                badgeBg = isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2";
                                badgeText = isDark ? "#f87171" : "#991B1B";
                                badgeBorder = isDark ? "rgba(239, 68, 68, 0.2)" : "#fecaca";
                              }

                              return (
                                <View
                                  key={signId}
                                  className="px-2 py-0.5 rounded-lg border"
                                  style={{
                                    backgroundColor: badgeBg,
                                    borderColor: badgeBorder,
                                  }}
                                >
                                  <Text
                                    className="text-[9px] font-black uppercase tracking-wider"
                                    style={{ color: badgeText }}
                                  >
                                    {label}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : null}

                        {(record.note || record.technicianNote || (record.type === "insemination" ? getAdditionalNotesOnly(record.comment || "") : record.comment)) ? (
                          <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] mt-1 italic leading-4">
                            &quot;{record.note || record.technicianNote || (record.type === "insemination" ? getAdditionalNotesOnly(record.comment || "") : record.comment)}&quot;
                          </Text>
                        ) : null}
                        {record.technicianId?.name && (
                          <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textMuted }} className="text-[9px] mt-2 uppercase tracking-tight">
                            Recorded by {record.technicianId.name}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View
                  className="rounded-[32px] p-8 items-center mt-4"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    shadowColor: "#94a3b8",
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View 
                    className="w-20 h-20 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: colors.background }}
                  >
                    <History size={32} color={colors.textMuted} />
                  </View>
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-lg mb-1">
                    No Medical Records
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-center text-sm px-4 leading-5">
                    This animal does not have any recorded artificial
                    inseminations or pregnancy checks yet.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* --- MEDICAL RECORD DETAIL DIALOG --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={recordModalVisible}
        onRequestClose={() => setRecordModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setRecordModalVisible(false)} 
          />
          <View style={{ backgroundColor: colors.card }} className="rounded-t-[32px] p-6 pb-8 shadow-2xl">
            <View className="w-10 h-1 rounded-full align-self-center mb-5" style={{ backgroundColor: colors.border }} />

            <View className="flex-row justify-between items-start mb-4">
              <View>
                <Text style={{ fontFamily: 'Outfit_900Black', color: isDark ? colors.primary : '#047857' }} className="text-[10px] uppercase tracking-widest mb-1.5">
                  Record Details
                </Text>
                <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-2xl leading-none">
                  {selectedRecord?.type === "insemination"
                    ? `A.I. Insemination`
                    : selectedRecord?.type === "calving"
                      ? "Calf Drop / Calving"
                      : selectedRecord?.type || "Medical Record"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRecordModalVisible(false)}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.background }}
              >
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable details container */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {selectedRecord && (
                <View 
                  className="rounded-2xl p-5 gap-y-4 mb-2"
                  style={{ backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }}
                >
                  
                  {/* Photo attachment if present */}
                  {selectedRecord.imageUrl ? (
                    <View className="mb-2 rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: colors.border }}>
                      <Image
                        source={{ uri: selectedRecord.imageUrl }}
                        className="w-full h-48"
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}

                  {/* 1. Common Info: Date */}
                  <View className="flex-row justify-between items-center">
                    <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Activity Date</Text>
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">
                      {new Date(selectedRecord.recordDate).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

                  {/* 2. Type-Specific Attributes */}
                  {selectedRecord.type === "insemination" && (
                    <>
                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Attempt No.</Text>
                        <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-[14px]">#{selectedRecord.attemptNumber || 1}</Text>
                      </View>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Estrus Cycle Type</Text>
                        <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">{selectedRecord.estrus || selectedRecord.estrusType || "Natural"}</Text>
                      </View>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Sire Breed</Text>
                        <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">{selectedRecord.sireBreed || "N/A"}</Text>
                      </View>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Sire Code</Text>
                        <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-[14px]">{selectedRecord.sireCode || "N/A"}</Text>
                      </View>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Current Status</Text>
                        {(() => {
                          const badge = getInseminationBadge(selectedRecord);
                          return (
                            <View 
                              className="px-2.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: badge.bg,
                                borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                              }}
                            >
                              <Text 
                                style={{
                                  fontFamily: 'Outfit_900Black',
                                  color: badge.color
                                }}
                                className="text-[10px] uppercase tracking-wider"
                              >
                                {badge.text}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Pregnancy Status</Text>
                        {(() => {
                          const outcomeText = selectedRecord.pregnancyStatus || selectedRecord.outcome || selectedRecord.result || "Pending";
                          const isSuccess = outcomeText === "Pregnant" || outcomeText === "Successful" || outcomeText === "Positive";
                          const isFailed = outcomeText.startsWith("Failed") || outcomeText === "Negative" || outcomeText === "Empty";
                          return (
                            <View 
                              className="px-3 py-1 rounded-full border"
                              style={{
                                backgroundColor: isSuccess
                                  ? (isDark ? 'rgba(52, 211, 153, 0.15)' : '#ecfdf5')
                                  : isFailed
                                    ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2')
                                    : colors.border,
                                borderColor: isSuccess
                                  ? (isDark ? 'rgba(52, 211, 153, 0.3)' : '#d1fae5')
                                  : isFailed
                                    ? (isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca')
                                    : 'transparent'
                              }}
                            >
                              <Text 
                                style={{
                                  fontFamily: 'Outfit_900Black',
                                  color: isSuccess
                                    ? (isDark ? '#34d399' : '#047857')
                                    : isFailed
                                      ? colors.error
                                      : colors.textSecondary
                                }}
                                className="text-[12px]"
                              >
                                {outcomeText}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      {selectedRecord.dateOfPD && (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Diagnosis Date</Text>
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">
                              {new Date(selectedRecord.dateOfPD).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}
                            </Text>
                          </View>
                        </>
                      )}
                    </>
                  )}

                  {selectedRecord.type === "calving" && (
                    <>
                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Number of Calves</Text>
                        <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-[14px]">
                          {selectedRecord.numberOfCalves || selectedRecord.calves?.length || 1}
                        </Text>
                      </View>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />

                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Calving Ease</Text>
                        <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">{selectedRecord.calvingEase || "Natural"}</Text>
                      </View>

                      {selectedRecord.locationAddress ? (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Calving Location</Text>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary }} className="text-[13px] text-right max-w-[200px]">{selectedRecord.locationAddress}</Text>
                          </View>
                        </>
                      ) : null}

                      {/* Display offspring details array */}
                      {selectedRecord.calves && selectedRecord.calves.length > 0 ? (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textSecondary }} className="text-[10px] uppercase tracking-wider mt-1">Offspring Born</Text>
                          <View className="gap-y-2 mt-1">
                            {selectedRecord.calves.map((calf: any, cidx: number) => (
                              <View 
                                key={cidx} 
                                className="p-3 rounded-xl flex-row justify-between items-center border"
                                style={{ backgroundColor: colors.card, borderColor: colors.border }}
                              >
                                <View className="flex-row items-center gap-2">
                                  <MaterialCommunityIcons name="cow" size={16} color={calf.sex === 'M' ? '#3B82F6' : '#F472B6'} />
                                  <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[12px]">
                                    Tag: {calf.earTag || `Calf ${cidx + 1}`}
                                  </Text>
                                </View>
                                <View className="flex-row gap-2.5 items-center">
                                  <View 
                                    className="px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: calf.sex === 'M' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff') : (isDark ? 'rgba(244, 114, 182, 0.15)' : '#fdf2f8') }}
                                  >
                                    <Text 
                                      style={{
                                        fontFamily: 'Outfit_900Black',
                                        color: calf.sex === 'M' ? '#3b82f6' : '#ec4899'
                                      }}
                                      className="text-[9px]"
                                    >
                                      {calf.sex === 'M' ? 'Male ♂' : 'Female ♀'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        </>
                      ) : (
                        (selectedRecord.calfId || selectedRecord.calfSex) ? (
                          <>
                            <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                            <View className="flex-row justify-between items-center">
                              <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Calf Tag ID</Text>
                              <Text style={{ fontFamily: 'Outfit_900Black', color: colors.textPrimary }} className="text-[14px]">{selectedRecord.calfId || "N/A"}</Text>
                            </View>
                            <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                            <View className="flex-row justify-between items-center">
                              <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Offspring Sex</Text>
                              <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">
                                {selectedRecord.calfSex === "M" ? "Male ♂" : selectedRecord.calfSex === "F" ? "Female ♀" : selectedRecord.calfSex || "N/A"}
                              </Text>
                            </View>
                          </>
                        ) : null
                      )}
                    </>
                  )}

                  {selectedRecord.type !== "insemination" && selectedRecord.type !== "calving" && (
                    <>
                      <View className="flex-row justify-between items-center">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Check Category</Text>
                        <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">{selectedRecord.type}</Text>
                      </View>

                      {selectedRecord.details?.diagnosis && (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Diagnosis</Text>
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[13px] text-right max-w-[200px]">{selectedRecord.details.diagnosis}</Text>
                          </View>
                        </>
                      )}

                      {selectedRecord.details?.treatment && (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Treatment Given</Text>
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[13px] text-right max-w-[200px]">{selectedRecord.details.treatment}</Text>
                          </View>
                        </>
                      )}

                      {selectedRecord.details?.medicineName && (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Medicine Administered</Text>
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: isDark ? colors.primary : '#047857' }} className="text-[14px]">{selectedRecord.details.medicineName}</Text>
                          </View>
                        </>
                      )}

                      {selectedRecord.details?.dosage && (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Dosage / Route</Text>
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">{selectedRecord.details.dosage}</Text>
                          </View>
                        </>
                      )}

                      {selectedRecord.details?.weight && (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Recorded Weight</Text>
                            <Text style={{ fontFamily: 'Outfit_900Black', color: isDark ? '#818cf8' : '#4f46e5' }} className="text-[14px]">{selectedRecord.details.weight} kg</Text>
                          </View>
                        </>
                      )}

                      {selectedRecord.followUpDate && (
                        <>
                          <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                          <View className="flex-row justify-between items-center">
                            <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Follow-Up Date</Text>
                            <View 
                              className="px-2.5 py-1 rounded-lg border"
                              style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb', borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fef3c7' }}
                            >
                              <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: isDark ? '#fbbf24' : '#d97706' }} className="text-[12px]">
                                {new Date(selectedRecord.followUpDate).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </>
                  )}

                  {/* Heat Signs List inside details modal */}
                  {selectedRecord.type === "insemination" && selectedRecord.heatSigns && selectedRecord.heatSigns.length > 0 ? (
                    <>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                      <View className="flex-col gap-1.5">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Observed Heat Signs</Text>
                        <View className="flex-row flex-wrap gap-2 mt-1">
                          {selectedRecord.heatSigns.map((signId: string) => {
                            const signMap: Record<string, string> = {
                              standing_heat: "Standing Heat 🐮",
                              attempt_mount: "Attempting to Mount",
                              restlessness: "Restlessness / Activity",
                              vocalization: "Vocalization (Bellowing)",
                              flehmen: "Flehmen Response",
                              grouping: "Friendly Grouping",
                              mucus_discharge: "Clear Mucus Discharge 💧",
                              swollen_vulva: "Swollen, Red Vulva",
                              muddy_flanks: "Muddy Flanks / Tailhead",
                              metestrus_bleeding: "Metestrus Bleeding 🩸",
                            };
                            const label = signMap[signId] || signId;
                            const isPrimary = signId === "standing_heat";
                            const isBleeding = signId === "metestrus_bleeding";

                            let badgeBg = isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5";
                            let badgeText = isDark ? "#34d399" : "#065F46";
                            let badgeBorder = isDark ? "rgba(16, 185, 129, 0.2)" : "#d1fae5";

                            if (isPrimary) {
                              badgeBg = isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7";
                              badgeText = isDark ? "#fbbf24" : "#92400E";
                              badgeBorder = isDark ? "rgba(245, 158, 11, 0.2)" : "#FEF3C7";
                            } else if (isBleeding) {
                              badgeBg = isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2";
                              badgeText = isDark ? "#f87171" : "#991B1B";
                              badgeBorder = isDark ? "rgba(239, 68, 68, 0.2)" : "#fecaca";
                            }

                            return (
                              <View
                                key={signId}
                                className="px-3 py-1.5 rounded-xl border"
                                style={{
                                  backgroundColor: badgeBg,
                                  borderColor: badgeBorder,
                                }}
                              >
                                <Text
                                  className="text-[10px] font-black uppercase tracking-wider"
                                  style={{ color: badgeText }}
                                >
                                  {label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </>
                  ) : null}

                  {/* 3. Common Info: Notes / Remarks */}
                  {(selectedRecord.note || selectedRecord.technicianNote || (selectedRecord.type === "insemination" ? getAdditionalNotesOnly(selectedRecord.comment || "") : selectedRecord.comment)) ? (
                    <>
                      <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                      <View className="flex-col gap-1">
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Notes & Remarks</Text>
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textSecondary }} className="text-[13px] italic leading-5 mt-1">
                          &quot;{selectedRecord.note || selectedRecord.technicianNote || (selectedRecord.type === "insemination" ? getAdditionalNotesOnly(selectedRecord.comment || "") : selectedRecord.comment)}&quot;
                        </Text>
                      </View>
                    </>
                  ) : null}

                  {/* 4. Common Info: Recorded By */}
                  <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
                  <View className="flex-row justify-between items-center">
                    <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[12px] uppercase tracking-wider">Logged By</Text>
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[14px]">
                      {selectedRecord.technicianId?.name || "Agriculture Office Technician"}
                    </Text>
                  </View>

                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setRecordModalVisible(false)}
              style={{ backgroundColor: colors.primary }}
              className="w-full py-4 rounded-2xl items-center justify-center active:opacity-75 shadow-md mt-2"
            >
              <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white text-base">Close Details</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Animal?"
        message={`Are you sure you want to permanently delete ${animal?.animalId || "this animal"} and all its history? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="No, Keep it"
        isDestructive={true}
      />
    </View>
  );
}

// --- HELPER COMPONENTS ---
const InfoRow = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useTheme();
  return (
    <View className="flex-row justify-between items-center">
      <Text style={{ fontFamily: 'Outfit_500Medium', color: colors.textMuted }} className="text-[13px]">
        {label}
      </Text>
      <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: colors.textPrimary }} className="text-[15px]">
        {value}
      </Text>
    </View>
  );
};

const Divider = () => {
  const { colors } = useTheme();
  return (
    <View className="h-[1px] w-full" style={{ backgroundColor: colors.border }} />
  );
};
