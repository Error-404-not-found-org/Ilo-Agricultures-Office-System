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
} from "lucide-react-native";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CATTLE_BREEDS, CATTLE_SPECIES, OTON_BARANGAYS } from "@/lib/constants";

const SERVICE_TYPES = [
  { value: "disease", label: "Disease Control" },
  { value: "medicine", label: "Medicine/Supplies" },
  { value: "checkup", label: "Routine Checkup" },
  { value: "injury", label: "Injury Treatment" },
  { value: "other", label: "Other Veterinary" },
];

export default function HealthLogScreen() {
  const router = useRouter();
  const api = useApi();

  // Mode: Existing vs Manual
  const [isNewFarmer, setIsNewFarmer] = useState(false);

  // Existing mode states
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);

  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [loadingAnimals, setLoadingAnimals] = useState(false);

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
  });

  const [showBrgyModal, setShowBrgyModal] = useState(false);
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
  
  // Date/Time
  const [preferredDate, setPreferredDate] = useState(new Date());
  const [preferredTime, setPreferredTime] = useState(() => {
    const t = new Date();
    t.setHours(8, 0, 0, 0); // Static 8:00 AM baseline
    return t;
  });
  
  // Modal visibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  
  const [saving, setSaving] = useState(false);

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
    setShowFarmerModal(false);
    setSelectedAnimal(null);
    setLoadingAnimals(true);
    try {
      const res = await api.get(`/animals/farmer/${farmer._id}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setAnimals(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch animals");
    } finally {
      setLoadingAnimals(false);
    }
  };

  const handleSave = async () => {
    if (isNewFarmer) {
      // Validate Manual Farmer
      if (!newFarmer.firstName || !newFarmer.lastName || !newFarmer.phoneNumber) {
        toast.error("Please fill in owner name and phone number.");
        return;
      }
      if (newFarmer.phoneNumber.length < 10) {
        toast.error("Contact number must be at least 10 digits.");
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

    setSaving(true);
    try {
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
        };
      }

      await api.post("/health-request/walk-in", payload);

      toast.success(status === "resolved" ? "Health record saved!" : "Visit scheduled successfully!");
      router.back();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save health record.");
    } finally {
      setSaving(false);
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
          Health Log
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
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

            {/* ANIMAL SELECTION */}
            {selectedFarmer && (
              <View className="mb-8">
                <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">
                  Target Animal
                </Text>
                {loadingAnimals ? (
                  <ActivityIndicator
                    size="small"
                    color="#D97706"
                    className="my-4"
                  />
                ) : animals.length === 0 ? (
                  <View className="bg-slate-50 rounded-2xl p-6 items-center border border-dashed border-slate-200">
                    <Text className="text-slate-400 text-sm font-outfit-medium">
                      No animals found for this farmer.
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {animals.map((a: any) => {
                      const isSelected = selectedAnimal?._id === a._id;
                      return (
                        <TouchableOpacity
                          key={a._id}
                          className={`px-4 py-2.5 rounded-full flex-row items-center border ${
                            isSelected 
                              ? "bg-amber-600 border-amber-600 shadow-sm shadow-amber-100" 
                              : "bg-white border-slate-200"
                          }`}
                          onPress={() => setSelectedAnimal(isSelected ? null : a)}
                        >
                          <Text
                            style={{ fontFamily: "Outfit_700Bold" }}
                            className={`text-[13px] ${isSelected ? "text-white" : "text-slate-600"}`}
                          >
                            {a.earTag || a.animalId}
                          </Text>
                          {isSelected && (
                            <MaterialCommunityIcons
                              name="check"
                              size={14}
                              color="white"
                              style={{ marginLeft: 6 }}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            {/* MANUAL OWNER REGISTRATION */}
            <View className="bg-slate-50 border border-slate-100 rounded-[32px] p-6 mb-6">
              <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-amber-900 text-sm mb-4">Quick Farmer Registration</Text>
              <View className="gap-y-4">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">First Name</Text>
                    <TextInput
                      className="bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="JUAN"
                      value={newFarmer.firstName}
                      onChangeText={(v) => setNewFarmer({...newFarmer, firstName: v})}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Last Name</Text>
                    <TextInput
                      className="bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="DELA CRUZ"
                      value={newFarmer.lastName}
                      onChangeText={(v) => setNewFarmer({...newFarmer, lastName: v})}
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Email</Text>
                    <TextInput
                      className="bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="juan@example.com"
                      value={newFarmer.email}
                      onChangeText={(v) => setNewFarmer({...newFarmer, email: v})}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Contact Number</Text>
                    <TextInput
                      className="bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="917XXXXXXX"
                      maxLength={10}
                      keyboardType="numeric"
                      value={newFarmer.phoneNumber}
                      onChangeText={(v) => setNewFarmer({...newFarmer, phoneNumber: v.replace(/\D/g, '')})}
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Barangay</Text>
                    <TouchableOpacity
                      onPress={() => setShowBrgyModal(true)}
                      className="bg-white border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                      <Text className={`font-outfit-medium ${newFarmer.barangay ? 'text-slate-800' : 'text-slate-400'}`}>
                        {newFarmer.barangay || 'Select...'}
                      </Text>
                      <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-grow flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Municipality</Text>
                    <TextInput
                      className="bg-slate-100 border border-slate-100 rounded-xl p-3 text-slate-400 font-outfit-medium"
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
              <View className="gap-y-4">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Animal ID</Text>
                    <TextInput
                      className="bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="e.g. ANM-001"
                      value={newAnimal.animalId}
                      onChangeText={(v) => setNewAnimal({...newAnimal, animalId: v})}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Ear Tag</Text>
                    <TextInput
                      className="bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="104"
                      value={newAnimal.earTag}
                      onChangeText={(v) => setNewAnimal({...newAnimal, earTag: v})}
                    />
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Species</Text>
                    <TouchableOpacity 
                        onPress={() => setShowSpeciesModal(true)}
                        className="bg-white border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                        <Text className="text-slate-800 font-outfit-medium">{newAnimal.species}</Text>
                        <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Breed</Text>
                    <TouchableOpacity 
                        onPress={() => setShowBreedModal(true)}
                        className="bg-white border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                        <Text className={`font-outfit-medium ${newAnimal.breed ? 'text-slate-800' : 'text-slate-400'}`}>
                            {newAnimal.breed || 'Select...'}
                        </Text>
                        <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View>
                  <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Color</Text>
                  <TextInput
                    className="bg-white border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                    placeholder="White"
                    value={newAnimal.color}
                    onChangeText={(v) => setNewAnimal({...newAnimal, color: v})}
                  />
                </View>
              </View>
            </View>
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
                  <MaterialCommunityIcons name="calendar" size={16} color="#94a3b8" />
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
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#94a3b8" />
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
            saving 
              ? "bg-slate-400" 
              : status === "resolved" 
                ? "bg-emerald-600" 
                : "bg-blue-600"
          }`}
          onPress={handleSave}
          disabled={saving}
          style={
            !saving
              ? status === 'resolved'
                ? { shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }
                : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }
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
                {status === "resolved" ? "Save Health Log" : "Schedule Health Visit"}
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
    </SafeAreaView>
  );
}
