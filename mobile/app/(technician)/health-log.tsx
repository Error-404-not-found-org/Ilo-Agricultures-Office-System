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
  Activity,
  Calendar,
  AlertTriangle,
  Check,
  Clock,
  Camera,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import EarTagGenerator from "@/components/EarTagGenerator";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CATTLE_BREEDS, CATTLE_SPECIES, OTON_BARANGAYS, CATTLE_COLORS, COLOR_OPTIONS_BY_SPECIES } from "@/lib/constants";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import { useAnimalContext } from "@/hooks/useAnimalContext";
import AnimalContextHeader from "@/components/AnimalContextHeader";

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

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', maxLength, secureTextEntry = false, editable = true }: any) => (
  <View className="mb-4">
    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1.5 ml-1 uppercase">{label}</Text>
    <TextInput 
      style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 14 }}
      className={`bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-semibold ${!editable ? 'bg-slate-100 text-slate-400' : ''}`}
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

const SelectorField = ({ label, value, onPress, placeholder }: any) => (
  <View className="mb-4">
    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1.5 ml-1 uppercase">{label}</Text>
    <TouchableOpacity 
      onPress={onPress}
      style={{ minHeight: 46 }}
      className="bg-white border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
    >
      <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 14 }} className={value ? 'text-slate-800' : 'text-slate-300'}>
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

  // Mode: Existing vs Manual
  const [isNewFarmer, setIsNewFarmer] = useState(false);

  // Existing mode states
  const [farmers, setFarmers] = useState<any[]>([]);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);

  // Manual mode states
  const [newFarmer, setNewFarmer] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    barangay: "",
    city: "Oton",
  });

  const [newAnimal, setNewAnimal] = useState({
    animalId: "",
    earTag: "",
    species: "Beef Cattle",
    breed: "",
    color: "",
    gender: "Female",
    dob: new Date().toISOString().split("T")[0],
  });

  const [animalImageUri, setAnimalImageUri] = useState<string | null>(null);
  const [animalImageBase64, setAnimalImageBase64] = useState<string | null>(null);

  const [showBrgyModal, setShowBrgyModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showAnimalDobPicker, setShowAnimalDobPicker] = useState(false);
  const [searchBrgy, setSearchBrgy] = useState('');

  const filteredBarangays = OTON_BARANGAYS.filter(b => 
    b.toLowerCase().includes(searchBrgy.toLowerCase())
  );

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
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);

  const completeLinkedTask = async (result: any) => {
    if (!taskId || result.status !== "synced") return;
    const recordId =
      result.data?.request?._id ||
      result.data?.healthRequest?._id ||
      result.data?.data?._id;
    if (!recordId) return;
    try {
      await api.put(`/tasks/${taskId}/complete`, {
        relatedRecordType: "health",
        relatedRecordId: recordId,
      });
    } catch (err) {
      console.error("Failed to complete linked health task", err);
      toast.error("Health record saved, but the linked task was not completed.");
    }
  };

  const handleSuccess = async (result: any) => {
    if (result.status === "synced") {
      toast.success(status === "resolved" ? "Health record saved!" : "Visit scheduled successfully!");
    }
    await completeLinkedTask(result);
    if ((source === "animal-profile" || source === "task") && selectedAnimal?._id) {
      router.replace({
        pathname: "/(technician)/animal-details",
        params: { id: selectedAnimal._id },
      });
    } else {
      router.back();
    }
  };

  const handlePickAnimalImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAnimalImageUri(result.assets[0].uri);
      setAnimalImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // Mutation 1: Walk-in
  const walkInMutation = useOfflineMutation({
    url: "/health-request/walk-in",
    method: "POST",
    description: `Health Assistance: ${diagnosis || "Walk-in service"}`
  }, {
    onSuccess: handleSuccess,
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to save health record.");
    }
  });

  // Mutation 2: Transition Request
  const requestMutation = useOfflineMutation({
    url: `/health-request/${requestId || "placeholder"}/status`,
    method: "PATCH",
    description: `Resolve Health Request: ${diagnosis || "Routine checkup"}`
  }, {
    onSuccess: handleSuccess,
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to resolve request.");
    }
  });

  const isMutationPending = requestId ? requestMutation.isPending : walkInMutation.isPending;

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

  const handleFarmerSelect = (farmer: any) => {
    setSelectedFarmer(farmer);
    setShowFarmerModal(false);
    setSelectedAnimal(null);
  };

  const handleSave = async () => {
    toast.dismiss();
    if (isNewFarmer) {
      // Validate Manual Farmer
      if (!newFarmer.firstName || !newFarmer.lastName || !newFarmer.phoneNumber) {
        toast.error("Please fill in owner name and phone number.");
        return;
      }
      if (!/^09\d{9}$/.test(newFarmer.phoneNumber)) {
        toast.error("Phone number must start with 09 and be exactly 11 digits.");
        return;
      }
      if (!newFarmer.barangay) {
        toast.error("Please select a Barangay.");
        return;
      }

      // Validate Manual Animal
      if (!newAnimal.animalId || !newAnimal.earTag || !newAnimal.breed) {
        toast.error("Please fill in animal ID, ear tag, and breed.");
        return;
      }
    } else {
      // Validate Existing
      if (!selectedFarmer) {
        toast.error("Please select a farmer.");
        return;
      }
      if (!selectedAnimal) {
        toast.error("Please select an animal.");
        return;
      }
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
      const mm = String(preferredDate.getMonth() + 1).padStart(2, '0');
      const dd = String(preferredDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const hh = String(preferredTime.getHours()).padStart(2, '0');
      const min = String(preferredTime.getMinutes()).padStart(2, '0');
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
        technicianNote: notes || (status === "resolved" ? "Walk-in service recorded by technician." : "Visit scheduled by technician."),
      };

      if (status === "resolved" && followUpDate) {
        payload.followUpDate = followUpDate.toISOString();
      }
      if (status === "resolved" && withdrawalPeriodDays) {
        payload.withdrawalPeriodDays = Number(withdrawalPeriodDays);
      }

      if (!isNewFarmer) {
        payload.farmerId = selectedFarmer._id;
        payload.animalId = selectedAnimal._id;
      } else {
        payload.firstName = newFarmer.firstName;
        payload.lastName = newFarmer.lastName;
        payload.phoneNumber = newFarmer.phoneNumber;
        payload.email = newFarmer.email || "";
        payload.address = {
          barangay: newFarmer.barangay,
          city: newFarmer.city,
        };
        payload.animalDetails = {
          earTag: newAnimal.earTag,
          species: newAnimal.species,
          breed: newAnimal.breed,
          gender: newAnimal.gender,
          color: newAnimal.color,
          dob: newAnimal.dob,
          imageUrl: animalImageBase64 || undefined,
        };
      }

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
          className="mr-4 p-2 bg-slate-50 rounded-full"
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
            {/* EXISTING RECORD VS MANUAL ENTRY TOGGLE */}
            <View className="flex-row p-1 rounded-2xl bg-slate-100 border border-slate-200 mb-6">
              <TouchableOpacity
                onPress={() => setIsNewFarmer(false)}
                className={`flex-1 py-2.5 rounded-xl items-center ${!isNewFarmer ? 'bg-amber-600' : ''}`}
              >
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[12px] ${!isNewFarmer ? 'text-white' : 'text-slate-500'}`}>Existing Record</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsNewFarmer(true)}
                className={`flex-1 py-2.5 rounded-xl items-center ${isNewFarmer ? 'bg-amber-600' : ''}`}
              >
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[12px] ${isNewFarmer ? 'text-white' : 'text-slate-500'}`}>Manual Entry</Text>
              </TouchableOpacity>
            </View>

            {!isNewFarmer ? (
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
                        {selectedFarmer ? selectedFarmer.name : "Select Farmer..."}
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
                              ? (selectedAnimal.earTag || selectedAnimal.animalId || "Animal Selected")
                              : "Choose Animal..."}
                          </Text>
                          {selectedAnimal && (
                            <View className="flex-row items-center flex-wrap gap-2 mt-1">
                              <Text className="text-slate-400 text-xs">
                                {selectedAnimal.breed || "Crossbreed"} · {selectedAnimal.species || "Cattle"}
                              </Text>
                              {selectedAnimal.reproductiveStatus && (
                                <View className={`px-2 py-0.5 rounded-full ${getReproductiveStatusStyle(selectedAnimal.reproductiveStatus).bg}`}>
                                  <Text className={`text-[10px] font-outfit-bold ${getReproductiveStatusStyle(selectedAnimal.reproductiveStatus).text}`}>
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
                          color="#D97706"
                        />
                      ) : (
                        <ChevronDown
                          size={20}
                          color="#94a3b8"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (              <>
                {/* MANUAL OWNER REGISTRATION */}
                <View className="bg-slate-50 border border-slate-100 rounded-[32px] p-6 mb-6">
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-amber-900 text-sm mb-4">Quick Farmer Registration</Text>
                  <View>
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <InputField 
                          label="First Name *"
                          value={newFarmer.firstName}
                          onChangeText={(v: string) => setNewFarmer({...newFarmer, firstName: v})}
                          placeholder="juan"
                        />
                      </View>
                      <View className="flex-1">
                        <InputField 
                          label="Last Name *"
                          value={newFarmer.lastName}
                          onChangeText={(v: string) => setNewFarmer({...newFarmer, lastName: v})}
                          placeholder="santos"
                        />
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <InputField 
                          label="Phone Number *"
                          value={newFarmer.phoneNumber}
                          onChangeText={(v: string) => setNewFarmer({...newFarmer, phoneNumber: v.replace(/\D/g, '')})}
                          placeholder="0912 345 6789"
                          keyboardType="phone-pad"
                          maxLength={11}
                        />
                      </View>
                      <View className="flex-grow flex-1">
                        <InputField 
                          label="Email Address"
                          value={newFarmer.email}
                          onChangeText={(v: string) => setNewFarmer({...newFarmer, email: v})}
                          placeholder="farmer@example.com"
                          keyboardType="email-address"
                        />
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <SelectorField 
                          label="Barangay *"
                          value={newFarmer.barangay}
                          onPress={() => setShowBrgyModal(true)}
                          placeholder="select..."
                        />
                      </View>
                      <View className="flex-grow flex-1">
                        <InputField 
                          label="Municipality"
                          value="OTON"
                          editable={false}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* MANUAL ANIMAL REGISTRATION */}
                <View className="bg-slate-50 border border-slate-100 rounded-[32px] p-6 mb-8">
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-amber-900 text-sm mb-4">Quick Animal Registration</Text>
                  
                  {/* Photo upload */}
                  <View className="items-center mb-4">
                    <TouchableOpacity
                      onPress={handlePickAnimalImage}
                      className="w-24 h-24 rounded-full items-center justify-center border border-dashed border-slate-200 overflow-hidden relative shadow-inner bg-white"
                    >
                      {animalImageUri ? (
                        <Image
                          source={{ uri: animalImageUri }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <>
                          <Camera size={22} color="#94a3b8" />
                          <Text className="text-[9px] text-slate-400 font-outfit-bold text-center mt-1 uppercase">
                            Add Photo
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View>
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <InputField 
                          label="Animal ID *"
                          value={newAnimal.animalId}
                          onChangeText={(v: string) => setNewAnimal({...newAnimal, animalId: v})}
                          placeholder="e.g. anm-001"
                        />
                      </View>
                      <View className="flex-1">
                        <InputField 
                          label="Ear Tag *"
                          value={newAnimal.earTag}
                          onChangeText={(v: string) => setNewAnimal({...newAnimal, earTag: v})}
                          placeholder="104"
                        />
                      </View>
                    </View>

                    <View className="mb-4">
                      <EarTagGenerator
                        farmerName={`${newFarmer.firstName} ${newFarmer.lastName}`.trim() || "Walk-in Farmer"}
                        animalCount={0}
                        onGenerate={(tag) => setNewAnimal({ ...newAnimal, earTag: tag })}
                        isDark={false}
                      />
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <SelectorField 
                          label="Species *"
                          value={newAnimal.species}
                          onPress={() => setShowSpeciesModal(true)}
                          placeholder="select..."
                        />
                      </View>
                      <View className="flex-grow flex-1">
                        <SelectorField 
                          label="Breed *"
                          value={newAnimal.breed}
                          onPress={() => setShowBreedModal(true)}
                          placeholder="select..."
                        />
                      </View>
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <SelectorField 
                          label="Gender *"
                          value={newAnimal.gender}
                          onPress={() => setShowGenderModal(true)}
                          placeholder="select..."
                        />
                      </View>
                      <View className="flex-grow flex-1">
                        <SelectorField 
                          label="Color *"
                          value={newAnimal.color}
                          onPress={() => setShowColorModal(true)}
                          placeholder="select..."
                        />
                      </View>
                    </View>

                    <SelectorField 
                      label="Date of Birth *"
                      value={newAnimal.dob}
                      onPress={() => setShowAnimalDobPicker(true)}
                      placeholder="select..."
                    />
                  </View>
                </View>
              </>
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
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Service Mode</Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setStatus('resolved')}
                  className={`flex-1 py-3.5 rounded-2xl border items-center ${status === 'resolved' ? 'bg-amber-600 border-amber-600' : 'bg-white border-amber-100'}`}
                  style={status === 'resolved' ? { shadowColor: '#d97706', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 } : {}}
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[12px] ${status === 'resolved' ? 'text-white' : 'text-amber-700'}`}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStatus('in-progress')}
                  className={`flex-1 py-3.5 rounded-2xl border items-center ${status === 'in-progress' ? 'bg-blue-600 border-blue-600' : 'bg-white border-amber-100'}`}
                  style={status === 'in-progress' ? { shadowColor: '#2563eb', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 } : {}}
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[12px] ${status === 'in-progress' ? 'text-white' : 'text-blue-700'}`}>Schedule</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SERVICE TYPE (Disease Control, Supplies, Routine check, etc.) */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Service Type</Text>
              <TouchableOpacity 
                  onPress={() => setShowTypeModal(true)}
                  className="bg-white border border-amber-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
              >
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800">
                      {SERVICE_TYPES.find(t => t.value === requestType)?.label}
                  </Text>
                  <ChevronDown size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Date & Expected Time Selectors */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Mission Date</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="bg-white border border-amber-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs">
                    {preferredDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Calendar size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Expected T-Time</Text>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  className="bg-white border border-amber-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs">
                    {preferredTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Clock size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* PRIORITY PROTOCOL URGENCY */}
            <View>
              <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Priority Protocol</Text>
              <View className="flex-row gap-2">
                {['low', 'medium', 'high'].map(u => {
                  const isSel = urgency === u;
                  const activeBg = 
                    u === 'emergency' ? 'bg-red-600 border-red-600' :
                    u === 'high' ? 'bg-rose-500 border-rose-500' :
                    u === 'medium' ? 'bg-amber-600 border-amber-600' :
                    'bg-emerald-600 border-emerald-600';
                  
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUrgency(u)}
                      className={`flex-1 py-3.5 rounded-xl border items-center ${isSel ? activeBg : 'bg-white border-amber-100'}`}
                      style={isSel ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 1 } : {}}
                    >
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[10px] uppercase tracking-wider ${isSel ? 'text-white' : 'text-amber-700'}`}>{u}</Text>
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
                placeholder={status === 'resolved' ? "Describe clinical findings/diagnosis..." : "Describe symptoms or reason for scheduled visit..."}
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
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs">
                        {followUpDate 
                          ? followUpDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : "Set Follow-up Date..."
                        }
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
                    onChangeText={(v) => setWithdrawalPeriodDays(v.replace(/\D/g, ''))}
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
          style={
            !isMutationPending
              ? status === 'resolved'
                ? { shadowColor: '#d97706', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }
                : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }
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
                {status === "resolved" ? "Save Health Assistance Record" : "Schedule Health Visit"}
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
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Farmer
              </Text>
              <TouchableOpacity
                onPress={() => setShowFarmerModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {farmers.length === 0 ? (
              <ActivityIndicator
                size="large"
                color="#D97706"
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
                    className="flex-row items-center bg-slate-50 border border-slate-100 p-5 rounded-[24px] mb-3"
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

      {/* BARANGAY SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showBrgyModal}
        onRequestClose={() => setShowBrgyModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Barangay
              </Text>
              <TouchableOpacity
                onPress={() => { setShowBrgyModal(false); setSearchBrgy(""); }}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-slate-800 font-outfit-medium mb-4"
              placeholder="Search barangay..."
              value={searchBrgy}
              onChangeText={setSearchBrgy}
            />

            <FlatList
              data={filteredBarangays}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setNewFarmer({...newFarmer, barangay: item});
                    setShowBrgyModal(false);
                    setSearchBrgy("");
                  }}
                  className="py-4 border-b border-slate-50"
                >
                  <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                </TouchableOpacity>
              )}
            />
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
                     <Text className="font-outfit-bold text-slate-700 text-base">{item.label}</Text>
                  </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* SPECIES SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSpeciesModal}
        onRequestClose={() => setShowSpeciesModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Species
              </Text>
              <TouchableOpacity
                onPress={() => setShowSpeciesModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList 
              data={CATTLE_SPECIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                  <TouchableOpacity 
                     onPress={() => {
                        setNewAnimal({...newAnimal, species: item});
                        setShowSpeciesModal(false);
                     }}
                     className="py-4 border-b border-slate-50"
                  >
                     <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                  </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* BREED SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showBreedModal}
        onRequestClose={() => setShowBreedModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Breed
              </Text>
              <TouchableOpacity
                onPress={() => setShowBreedModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList 
              data={CATTLE_BREEDS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                  <TouchableOpacity 
                     onPress={() => {
                        setNewAnimal({...newAnimal, breed: item});
                        setShowBreedModal(false);
                     }}
                     className="py-4 border-b border-slate-50"
                  >
                     <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                  </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      {/* GENDER SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showGenderModal}
        onRequestClose={() => setShowGenderModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[50%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Gender
              </Text>
              <TouchableOpacity
                onPress={() => setShowGenderModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList 
              data={["Female", "Male"]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                  <TouchableOpacity 
                     onPress={() => {
                        setNewAnimal({...newAnimal, gender: item});
                        setShowGenderModal(false);
                     }}
                     className="py-4 border-b border-slate-50"
                  >
                     <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                  </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* COLOR SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showColorModal}
        onRequestClose={() => setShowColorModal(false)}
      >
        <View className="flex-1 bg-slate-900/40 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[70%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ fontFamily: "Outfit_900Black" }}
                className="text-2xl text-slate-800"
              >
                Select Color
              </Text>
              <TouchableOpacity
                onPress={() => setShowColorModal(false)}
                className="bg-slate-100 p-2.5 rounded-full"
              >
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList 
              data={newAnimal.species ? (COLOR_OPTIONS_BY_SPECIES[newAnimal.species] || []) : CATTLE_COLORS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                  <TouchableOpacity 
                     onPress={() => {
                        setNewAnimal({...newAnimal, color: item});
                        setShowColorModal(false);
                     }}
                     className="py-4 border-b border-slate-50"
                  >
                     <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                  </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {showAnimalDobPicker && (
        <DateTimePicker
          value={new Date(newAnimal.dob)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowAnimalDobPicker(false);
            if (date) {
              setNewAnimal({
                ...newAnimal,
                dob: date.toISOString().split("T")[0],
              });
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}
