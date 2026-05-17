import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Save, ChevronDown, Dog, X } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const SERVICE_TYPES = [
  { label: "Artificial Insemination", value: "AI", icon: "needle", color: "#10b981", bg: "#f0fdf4" },
  { label: "Health Check-up", value: "Health", icon: "stethoscope", color: "#f59e0b", bg: "#fffbeb" },
  { label: "Vaccination / Meds", value: "Vaccination", icon: "pill", color: "#3b82f6", bg: "#eff6ff" },
  { label: "Other Operation", value: "Other", icon: "cog-outline", color: "#64748b", bg: "#f8fafc" },
];

const CATEGORIES = ["Urgent", "Routine", "Follow-up"];

export default function CreateTaskScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams();
  const api = useApi();
  
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  
  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  
  const [serviceType, setServiceType] = useState((type as string) || 'AI');
  const [category, setCategory] = useState('Routine');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Specialized Fields
  const [sireBreed, setSireBreed] = useState('');
  const [sireCode, setSireCode] = useState('');
  const [estrus, setEstrus] = useState('Natural');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [medicine, setMedicine] = useState('');
  const [vaccineName, setVaccineName] = useState('');

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const res = await api.get('/user?role=farmer');
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
    setSelectedAnimalIds([]);
    setLoadingAnimals(true);
    try {
      const res = await api.get(`/animals/farmer/${farmer._id}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setAnimals(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load animals');
    } finally {
      setLoadingAnimals(false);
    }
  };

  const toggleAnimalSelect = (id: string) => {
    if (selectedAnimalIds.includes(id)) {
      setSelectedAnimalIds(prev => prev.filter(a => a !== id));
    } else {
      setSelectedAnimalIds(prev => [...prev, id]);
    }
  };

  const handleSave = async () => {
    if (!selectedFarmer || !category) {
      toast.error('Please select a farmer and priority level.');
      return;
    }

    if (selectedAnimalIds.length === 0) {
      toast.error('Please select at least one target animal.');
      return;
    }
    
    // Validations & Protections
    if (serviceType === 'AI') {
      if (!sireBreed.trim() || !sireCode.trim()) {
        toast.error("Validation Error", { description: "Sire Breed and Sire Code are required for Artificial Insemination." });
        return;
      }
    } else if (serviceType === 'Health') {
      if (!diagnosis.trim()) {
        toast.error("Validation Error", { description: "Please provide a Diagnosis for the Health Log." });
        return;
      }
    } else if (serviceType === 'Vaccination') {
      if (!vaccineName.trim()) {
        toast.error("Validation Error", { description: "Please specify the Vaccine/Medicine name." });
        return;
      }
    }

    if (notes.length > 500) {
      toast.error("Validation Error", { description: "Additional Notes cannot exceed 500 characters." });
      return;
    }

    // Construct specialized notes
    let finalNotes = notes;
    if (serviceType === 'AI') {
      finalNotes = `[AI RECORD] Sire: ${sireBreed.trim()} | Code: ${sireCode.trim()} | Estrus: ${estrus}\n\nNotes: ${notes}`;
    } else if (serviceType === 'Health') {
      finalNotes = `[HEALTH CHECK] Diagnosis: ${diagnosis.trim()} | Treatment: ${treatment.trim() || 'N/A'} | Meds: ${medicine.trim() || 'N/A'}\n\nNotes: ${notes}`;
    } else if (serviceType === 'Vaccination') {
      finalNotes = `[VACCINATION] Vaccine: ${vaccineName.trim()}\n\nNotes: ${notes}`;
    }
    
    setSaving(true);
    try {
      await api.post('/tasks', {
        farmerId: selectedFarmer._id,
        animalIds: selectedAnimalIds,
        category,
        taskType: serviceType, // Matches Task model enum
        notes: finalNotes
      });
      toast.success('Record saved successfully!');
      router.back();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  const getAddressStr = (addr: any) => {
      if (!addr) return 'No address provided';
      if (typeof addr === 'string') return addr;
      return `${addr.street || ''} ${addr.barangay || ''} ${addr.city || ''}`.trim() || 'No address provided';
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-50 rounded-full">
          <ArrowLeft size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: '#1e293b' }}>
          {serviceType === 'AI' ? 'Record AI' : serviceType === 'Health' ? 'Health Log' : 'Schedule Visit'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* SERVICE SELECTION */}
        <View className="mb-8">
          <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Service Type</Text>
          <View className="flex-row flex-wrap gap-3">
              {SERVICE_TYPES.map(type => (
                 <TouchableOpacity
                    key={type.value}
                    onPress={() => setServiceType(type.value)}
                    activeOpacity={0.8}
                    style={{ 
                      width: '47%', 
                      backgroundColor: serviceType === type.value ? type.bg : '#fff', 
                      borderWidth: 2, 
                      borderColor: serviceType === type.value ? type.color : '#f1f5f9',
                      borderRadius: 20,
                      padding: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: 10
                    }}
                 >
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: serviceType === type.value ? '#fff' : type.bg, alignItems: 'center', justifyContent: 'center' }}>
                       <MaterialCommunityIcons name={type.icon as any} size={18} color={type.color} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 11, color: serviceType === type.value ? type.color : '#64748b' }}>{type.label}</Text>
                 </TouchableOpacity>
              ))}
          </View>
        </View>

        {/* FARMER SELECTION */}
        <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Assign To Farmer</Text>
        <TouchableOpacity 
           onPress={() => setShowFarmerModal(true)} 
           className="bg-white border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
        >
           <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center mr-3">
                 <User size={20} color="#00643B" />
              </View>
              <View className="flex-1">
                 <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-base ${selectedFarmer ? 'text-slate-800' : 'text-slate-300'}`}>
                    {selectedFarmer ? selectedFarmer.name : 'Select Farmer...'}
                 </Text>
              </View>
           </View>
           <ChevronDown size={20} color="#94a3b8" />
        </TouchableOpacity>

        {/* ANIMAL SELECTION */}
        {selectedFarmer && (
            <View className="mb-8">
              <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Target Animals</Text>
              {loadingAnimals ? (
                  <ActivityIndicator size="small" color="#00643B" className="my-4" />
              ) : animals.length === 0 ? (
                  <View className="bg-slate-50 rounded-2xl p-6 items-center border border-dashed border-slate-200">
                      <Text className="text-slate-400 text-sm font-outfit-medium">No animals found for this farmer.</Text>
                  </View>
              ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {animals.map((a: any) => (
                      <TouchableOpacity
                          key={a._id}
                          className={`px-4 py-2.5 rounded-full flex-row items-center border ${selectedAnimalIds.includes(a._id) ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-200'}`}
                          onPress={() => toggleAnimalSelect(a._id)}
                      >
                          <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[13px] ${selectedAnimalIds.includes(a._id) ? 'text-white' : 'text-slate-600'}`}>
                            {a.earTag || a.animalId}
                          </Text>
                          {selectedAnimalIds.includes(a._id) && <MaterialCommunityIcons name="check" size={14} color="white" style={{ marginLeft: 6 }} />}
                      </TouchableOpacity>
                    ))}
                  </View>
              )}
            </View>
        )}

        {/* SPECIALIZED FIELDS */}
        {serviceType === 'AI' && (
          <View className="bg-emerald-50/50 p-5 rounded-[28px] mb-8 border border-emerald-100">
            <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-emerald-800 text-sm uppercase tracking-widest mb-4">A.I. Details</Text>
            <View className="gap-y-4">
              <View>
                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">Sire Breed</Text>
                <TextInput
                  className="bg-white border border-emerald-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                  placeholder="e.g. Brahman, Angus..."
                  value={sireBreed}
                  onChangeText={setSireBreed}
                />
              </View>
              <View>
                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">Sire Code / Bull ID</Text>
                <TextInput
                  className="bg-white border border-emerald-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                  placeholder="e.g. BULL-123"
                  value={sireCode}
                  onChangeText={setSireCode}
                />
              </View>
              <View>
                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">Estrus Type</Text>
                <View className="flex-row gap-2">
                  {['Natural', 'Induced'].map(opt => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setEstrus(opt)}
                      className={`flex-1 py-2.5 rounded-xl border items-center ${estrus === opt ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-emerald-100'}`}
                    >
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-xs ${estrus === opt ? 'text-white' : 'text-emerald-700'}`}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {serviceType === 'Health' && (
          <View className="bg-amber-50/50 p-5 rounded-[28px] mb-8 border border-amber-100">
            <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-amber-800 text-sm uppercase tracking-widest mb-4">Health Log</Text>
            <View className="gap-y-4">
              <View>
                <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">Diagnosis</Text>
                <TextInput
                  className="bg-white border border-amber-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                  placeholder="What was found?"
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                />
              </View>
              <View>
                <Text className="text-amber-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">Treatment / Medicine</Text>
                <TextInput
                  className="bg-white border border-amber-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                  placeholder="Medicine name & dosage"
                  value={medicine}
                  onChangeText={setMedicine}
                />
              </View>
            </View>
          </View>
        )}

        {serviceType === 'Vaccination' && (
          <View className="bg-blue-50/50 p-5 rounded-[28px] mb-8 border border-blue-100">
            <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-blue-800 text-sm uppercase tracking-widest mb-4">Vaccination</Text>
            <View>
              <Text className="text-blue-700 text-[11px] font-outfit-bold mb-1 ml-1 uppercase">Vaccine / Med Name</Text>
              <TextInput
                className="bg-white border border-blue-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                placeholder="e.g. FMD, Anthrax..."
                value={vaccineName}
                onChangeText={setVaccineName}
              />
            </View>
          </View>
        )}

        {/* CATEGORY & NOTES */}
        <View className="mb-6">
          <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Priority Level</Text>
          <View className="flex-row gap-2">
              {CATEGORIES.map(cat => (
                 <TouchableOpacity
                    key={cat}
                    className={`flex-1 py-3 rounded-xl border items-center ${category === cat ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}
                    onPress={() => setCategory(cat)}
                 >
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[13px] ${category === cat ? 'text-white' : 'text-slate-600'}`}>{cat}</Text>
                 </TouchableOpacity>
              ))}
          </View>
        </View>

        <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Additional Notes</Text>
        <TextInput
            className="bg-white border border-slate-100 rounded-2xl p-4 h-32 text-slate-800 shadow-sm mb-10 font-outfit-medium"
            multiline
            textAlignVertical="top"
            placeholder="Any other details..."
            placeholderTextColor="#cbd5e1"
            value={notes}
            onChangeText={setNotes}
        />

        {/* SAVE BUTTON */}
        <TouchableOpacity 
            className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-20 ${saving ? 'bg-slate-400' : 'bg-[#00643B]'}`}
            onPress={handleSave}
            disabled={saving}
        >
            {saving ? <ActivityIndicator color="white" /> : (
               <>
                  <Save size={20} color="white" style={{ marginRight: 10 }} />
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white text-base">Save Record</Text>
               </>
            )}
        </TouchableOpacity>

      </ScrollView>

      {/* FARMER SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showFarmerModal} onRequestClose={() => setShowFarmerModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[80%] min-h-[50%]">
               <View className="flex-row justify-between items-center mb-5">
                   <Text className="text-xl font-bold text-slate-800">Select Farmer</Text>
                   <TouchableOpacity onPress={() => setShowFarmerModal(false)} className="bg-slate-100 p-2 rounded-full">
                       <X size={20} color="#64748b" />
                   </TouchableOpacity>
               </View>

               {farmers.length === 0 ? (
                   <ActivityIndicator size="large" color="#0d9488" className="mt-10" />
               ) : (
                   <FlatList 
                      data={farmers}
                      keyExtractor={(item) => item._id}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                          <TouchableOpacity 
                             onPress={() => handleFarmerSelect(item)}
                             className="flex-row items-center bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-3"
                          >
                             <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mr-3">
                                <User size={20} color="#0d9488" />
                             </View>
                             <View className="flex-1">
                                <Text className="font-bold text-slate-800 text-base">{item.name}</Text>
                                <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>{getAddressStr(item.address)}</Text>
                             </View>
                          </TouchableOpacity>
                      )}
                   />
               )}
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}
