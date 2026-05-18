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
  Edit2,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";

export default function AnimalDetails() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();

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
          toast.error(
            error.response?.data?.message || "Could not load animal details.",
          );
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
              toast.success("Animal deleted successfully");
              router.replace("/(technician)/technician.animals" as any);
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
      recordDate: i.dateOfAI || i.createdAt,
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
          onPress={() => router.back()}
          className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/10"
        >
          <ArrowLeft size={22} color="white" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-white text-lg tracking-wide">
          Animal Profile
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push(`/(technician)/edit-animal?id=${animal._id}` as any)}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <Edit2 size={18} color="white" />
          </TouchableOpacity>
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

                          {/* Record Calf Drop Action Button */}
                          <TouchableOpacity 
                            onPress={() => {
                                // Find the pregnancy ID from inseminations
                                const latestInsem = (animal.inseminations || []).find((i: any) => i.pregnancy);
                                const pregnancyId = latestInsem?.pregnancy?._id;
                                
                                if (!pregnancyId) {
                                    toast.error("Could not locate active pregnancy record.");
                                    return;
                                }

                                router.push({
                                    pathname: "/(technician)/record-calf-drop",
                                    params: {
                                        motherId: animal._id,
                                        pregnancyId: pregnancyId,
                                        motherTag: animal.earTag || animal.animalId
                                    }
                                } as any);
                            }}
                            className="mt-6 bg-purple-600 py-4 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg shadow-purple-200"
                          >
                            <MaterialCommunityIcons name="baby-carriage" size={20} color="white" />
                            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white text-[13px] uppercase tracking-widest">
                                Record Calf Drop
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
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
                                ? "Calf Drop"
                                : record.type}
                          </Text>
                          {record.type === "insemination" && (
                            <Text
                              style={{ fontFamily: 'Outfit_800ExtraBold' }}
                              className={`text-[12px] capitalize ${
                                record.result === "Positive"
                                  ? "text-emerald-600"
                                  : record.result === "Negative"
                                    ? "text-red-500"
                                    : "text-slate-400"
                              }`}
                            >
                              {record.result || "Pending"}
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