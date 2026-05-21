import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
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
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import { useApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

export default function AnimalDetails() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"Info" | "History">("Info");

  const [animal, setAnimal] = useState<any>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
             router.replace("/(farmer)/farmer.records" as any);
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
    Alert.alert(
      "Delete Animal",
      "Are you sure you want to permanently delete this animal and all its history? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await api.delete(`/animals/${id}`);
              // Invalidate caches so the dashboard stats update immediately
              queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
              queryClient.invalidateQueries({ queryKey: ['animals', 'my'] });
              toast.success("Animal deleted successfully");
              router.replace("/(farmer)/farmer.records" as any);
            } catch (error: any) {
              console.error("Delete Error:", error);
              toast.error(
                error.response?.data?.message || "Failed to delete animal",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-slate-950">
        <ActivityIndicator size="large" color="#00643B" />
      </View>
    );
  }

  if (!animal) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-slate-950 px-8">
        <MaterialCommunityIcons name="cow-off" size={64} color="#CBD5E1" />
        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-500 dark:text-slate-400 text-lg mt-4">
          Animal Not Found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 px-10 py-3.5 bg-[#00643B] rounded-full shadow-lg shadow-emerald-200"
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
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      <StatusBar barStyle="light-content" />

      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[280px] bg-[#00643B]" />

      {/* Header Actions */}
      <View className="pt-14 px-6 flex-row justify-between items-center z-10">
        <TouchableOpacity
          onPress={() => router.push("/(farmer)/farmer.records" as any)}
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
        <View className="w-28 h-28 bg-white dark:bg-slate-800 rounded-[32px] items-center justify-center border-4 border-emerald-100 dark:border-emerald-900 shadow-xl mb-4 overflow-hidden">
          {animal.imageUrl ? (
            <Image
              source={{ uri: animal.imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons name="cow" size={56} color="#00643B" />
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
        className="flex-1 bg-[#F9FAFB] dark:bg-slate-950 rounded-t-[32px] pt-6 mt-4 shadow-lg flex-col"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 15,
          elevation: 8,
        }}
      >
        {/* Customized Tabs */}
        <View className="flex-row px-6 mb-6">
          <TouchableOpacity
            onPress={() => setActiveTab("Info")}
            className={`flex-1 py-4 border-b-[3px] items-center flex-row justify-center gap-2 ${activeTab === "Info" ? "border-[#00643B]" : "border-transparent"}`}
          >
            <InfoIcon
              size={18}
              color={activeTab === "Info" ? "#00643B" : "#94a3b8"}
            />
            <Text
              style={{ fontFamily: activeTab === 'Info' ? 'Outfit_800ExtraBold' : 'Outfit_600SemiBold' }}
              className={`text-[15px] ${activeTab === "Info" ? "text-[#00643B]" : "text-slate-400 dark:text-slate-500"}`}
            >
              General Info
            </Text>
          </TouchableOpacity>

          <View className="w-[1px] h-6 bg-slate-100 dark:bg-slate-800 self-center" />

          <TouchableOpacity
            onPress={() => setActiveTab("History")}
            className={`flex-1 py-4 border-b-[3px] items-center flex-row justify-center gap-2 ${activeTab === "History" ? "border-[#00643B]" : "border-transparent"}`}
          >
            <History
              size={18}
              color={activeTab === "History" ? "#00643B" : "#94a3b8"}
            />
            <Text
              style={{ fontFamily: activeTab === 'History' ? 'Outfit_800ExtraBold' : 'Outfit_600SemiBold' }}
              className={`text-[15px] ${activeTab === "History" ? "text-[#00643B]" : "text-slate-400 dark:text-slate-500"}`}
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
              <View className="flex-1 bg-[#F0FDF4] dark:bg-emerald-900/10 rounded-[28px] rounded-bl-none p-5 ml-[-15px] border border-emerald-100 dark:border-emerald-900/20 shadow-sm">
                <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-emerald-700 dark:text-emerald-400 text-[13px] mb-1">
                  Moowie Insight
                </Text>
                <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-600 dark:text-slate-300 text-[12px] leading-[18px]">
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
                  className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 mb-2"
                  style={{
                    shadowColor: "#94a3b8",
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-center mb-5 gap-2">
                    <MaterialCommunityIcons
                      name="heart-pulse"
                      size={20}
                      color="#00643B"
                    />
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-lg text-slate-800 dark:text-white">
                      Reproductive Health
                    </Text>
                  </View>

                  <View className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl mb-4 border border-slate-100 dark:border-slate-700">
                    <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest mb-1.5">
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
                      <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-xl text-slate-900 dark:text-white">
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
                    
                    console.log(`[DEBUG] Animal: ${animal.earTag} | Status: ${animal.reproductiveStatus} | AI Date: ${aiDate}`);

                    const diffTime = Math.abs(today.getTime() - startDate.getTime());
                    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    // Phases:
                    // 0-20 days: Recovery/Waiting
                    // 21 days: Heat Watch
                    // 22-59 days: Pre-Diagnosis
                    // 60+ days: PD Due
                    
                    let phase = "Recovery";
                    let advice = "The animal is in the recovery phase after insemination. Keep her calm and well-fed.";
                    let color = "#3b82f6"; // blue
                    let bg = "#eff6ff";
                    let border = "#dbeafe";
                    
                    if (diffDays === 21) {
                      phase = "Heat Watch";
                      advice = "CRITICAL: Check for signs of heat today. If she 'reheats', the AI might have failed.";
                      color = "#f59e0b"; // orange
                      bg = "#fffbeb";
                      border = "#fef3c7";
                    } else if (diffDays > 21 && diffDays < 60) {
                      phase = "Wait for PD";
                      advice = "No signs of heat? Great! Now we wait until Day 60 for a professional pregnancy check.";
                      color = "#6366f1"; // indigo
                      bg = "#eef2ff";
                      border = "#e0e7ff";
                    } else if (diffDays >= 60) {
                      phase = "PD Due";
                      advice = "It's been 60+ days! Time to request a technician for a Pregnancy Diagnosis (PD).";
                      color = "#9333ea"; // purple
                      bg = "#f5f3ff";
                      border = "#ede9fe";
                    }

                    return (
                      <View 
                        className="p-5 rounded-3xl border mb-4"
                        style={{ backgroundColor: bg, borderColor: border }}
                      >
                        <View className="flex-row justify-between items-start mb-3">
                          <View>
                            <Text style={{ fontFamily: 'Outfit_900Black', color: color }} className="text-[9px] uppercase tracking-widest">
                              {phase} Phase
                            </Text>
                            <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-slate-900 dark:text-white text-lg">
                              Day {diffDays} Post-AI
                            </Text>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-500 text-[11px]">
                              Inseminated {diffHours < 24 ? `${diffHours} hours ago` : `${diffDays} days ago`}
                            </Text>
                          </View>
                          <MaterialCommunityIcons name="timer-sand" size={24} color={color} />
                        </View>
                        
                        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-600 text-[12px] leading-4 italic mb-4">
                          "{advice}"
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
                              className="flex-1 bg-white/60 py-3 rounded-2xl items-center border border-orange-200"
                            >
                              <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-orange-600 text-[10px] uppercase">Reheated (Empty)</Text>
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
                              className="w-full py-3 mt-1 rounded-2xl items-center shadow-sm bg-slate-800"
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
                      const gestationDays = 283; // Average for Cattle
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

                      return (
                        <View className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-3xl border border-purple-100 dark:border-purple-800 mb-4">
                          <View className="flex-row justify-between items-end mb-3">
                            <View>
                              <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-purple-600 dark:text-purple-400 text-[9px] uppercase tracking-widest">
                                Expected Calving
                              </Text>
                              <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-purple-900 dark:text-purple-100 text-lg">
                                {dueDate.toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </Text>
                            </View>
                            <View className="items-end">
                              <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-purple-900 dark:text-purple-100 text-xl">
                                {daysRemaining}
                              </Text>
                              <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-purple-600 dark:text-purple-400 text-[8px] uppercase">
                                Days Left
                              </Text>
                            </View>
                          </View>

                          {/* Progress Bar */}
                          <View className="w-full h-3 bg-purple-200 dark:bg-purple-900/50 rounded-full overflow-hidden shadow-inner">
                            <View
                              className="h-full bg-purple-600 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </View>
                          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-purple-500 text-[10px] mt-2 text-center uppercase tracking-tighter">
                            {progress.toFixed(0)}% of Gestation Period Completed
                          </Text>

                          <TouchableOpacity
                            onPress={() => router.push({
                              pathname: "/(farmer)/record-calving",
                              params: { 
                                animalId: animal._id,
                                earTag: animal.earTag,
                                pregnancyId: animal.inseminations?.[0]?.pregnancy?._id
                              }
                            } as any)}
                            className="w-full py-3 mt-4 rounded-2xl items-center shadow-sm bg-purple-600"
                          >
                            <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-white text-[11px] uppercase tracking-widest">Report Calf Drop (Testing)</Text>
                          </TouchableOpacity>
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
                          className="flex-1 bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-900/50 py-3.5 rounded-2xl items-center"
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
                className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700"
                style={{
                  shadowColor: "#94a3b8",
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center mb-5 gap-2">
                  <Activity size={20} color="#00643B" />
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-lg text-slate-800 dark:text-white">
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
                className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700"
                style={{
                  shadowColor: "#94a3b8",
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center mb-5 gap-2">
                  <User size={20} color="#00643B" />
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-lg text-slate-800 dark:text-white">
                    Ownership Details
                  </Text>
                </View>

                <View className="flex-row items-center gap-4 mb-5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center">
                    <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-emerald-800 text-lg">
                      {(animal.farmerId?.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-base text-slate-800">
                      {farmerName}
                    </Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-500 text-[12px] mt-0.5">
                      {farmerPhone}
                    </Text>
                    <View className="px-2.5 py-0.5 rounded-full bg-emerald-50 self-start mt-2 border border-emerald-100">
                      <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-[9px] text-emerald-700 uppercase tracking-widest">
                        Registered Owner
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="gap-y-5">
                  <View className="flex-col gap-1">
                    <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-slate-400 text-[10px] uppercase tracking-widest">
                      Location Address
                    </Text>
                    <View className="flex-row items-start gap-2 mt-2 pr-4">
                      <MapPin
                        size={16}
                        color="#00643B"
                        style={{ marginTop: 2 }}
                      />
                      <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-800 dark:text-slate-200 text-[15px] leading-5 w-11/12">
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
                    <View
                      key={idx}
                      className="bg-white p-5 rounded-[24px] mb-4 border border-slate-100 flex-row"
                      style={{
                        shadowColor: "#94a3b8",
                        shadowOpacity: 0.05,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      <View
                        className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
                          record.type === "insemination"
                            ? "bg-blue-50 dark:bg-blue-900/30"
                            : record.type === "calving"
                              ? "bg-orange-50 dark:bg-orange-900/30"
                              : record.type === "Vaccination"
                                ? "bg-emerald-50 dark:bg-emerald-900/30"
                                : record.type === "Weight Log"
                                  ? "bg-indigo-50 dark:bg-indigo-900/30"
                                  : "bg-slate-50 dark:bg-slate-900/30"
                        }`}
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
                          <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-[16px] text-slate-800 dark:text-white">
                            {record.type === "insemination"
                              ? `A.I. Attempt #${record.attemptNumber || 1}`
                              : record.type === "calving"
                                ? "Calving Event"
                                : record.type}
                          </Text>
                          {record.type === "insemination" && (
                            <Text
                              style={{ fontFamily: 'Outfit_800ExtraBold' }}
                              className={`text-[12px] capitalize ${
                                (record.outcome === "Pregnant" || record.outcome === "Successful")
                                  ? "text-emerald-600"
                                  : record.outcome?.startsWith("Failed")
                                    ? "text-red-500"
                                    : record.status?.toLowerCase() === "done"
                                      ? "text-blue-500"
                                      : "text-slate-400"
                              }`}
                            >
                              {record.status?.toLowerCase() === "done" 
                                ? (record.outcome === "Pending" ? "Inseminated" : record.outcome || "Inseminated") 
                                : (record.status || "Pending")}
                            </Text>
                          )}
                        </View>

                        <View className="flex-row items-center gap-1 mb-2">
                          <Calendar size={12} color="#94a3b8" />
                          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-500 dark:text-slate-400 text-xs">
                            {new Date(record.recordDate).toLocaleDateString()}
                          </Text>
                        </View>

                        {record.details?.medicineName && (
                          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-600 dark:text-slate-300 text-sm mt-1">
                            Medicine:{" "}
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-800 dark:text-white">
                              {record.details.medicineName}
                            </Text>
                          </Text>
                        )}
                        {record.details?.weight && (
                          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-indigo-600 dark:text-indigo-400 text-sm mt-1">
                            Weight:{" "}
                            <Text style={{ fontFamily: 'Outfit_900Black' }}>
                              {record.details.weight} kg
                            </Text>
                          </Text>
                        )}
                        {record.note && (
                          <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 dark:text-slate-500 text-[12px] mt-1 italic leading-4">
                            &quot;{record.note}&quot;
                          </Text>
                        )}
                        {record.technicianId?.name && (
                          <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-slate-400 dark:text-slate-500 text-[9px] mt-2 uppercase tracking-tight">
                            Recorded by {record.technicianId.name}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  className="bg-white rounded-[32px] p-8 items-center border border-slate-100 mt-4"
                  style={{
                    shadowColor: "#94a3b8",
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full items-center justify-center mb-4">
                    <History size={32} color="#94a3b8" />
                  </View>
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-700 dark:text-slate-200 text-lg mb-1">
                    No Medical Records
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 dark:text-slate-500 text-center text-sm px-4 leading-5">
                    This animal does not have any recorded artificial
                    inseminations or pregnancy checks yet.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// --- HELPER COMPONENTS ---
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between items-center">
    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 dark:text-slate-500 text-[13px]">
      {label}
    </Text>
    <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-800 dark:text-white text-[15px]">
      {value}
    </Text>
  </View>
);

const Divider = () => (
  <View className="h-[1px] w-full bg-slate-50 dark:bg-slate-900/50" />
);
