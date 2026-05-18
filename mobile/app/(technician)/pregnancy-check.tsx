import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, FlatList, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, ChevronDown, Sparkles, X, Plus, Calendar, AlertCircle, HeartPulse, History, Search } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function PregnancyCheckScreen() {
  const router = useRouter();
  const api = useApi();

  const [saving, setSaving] = useState(false);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [searchFarmerQuery, setSearchFarmerQuery] = useState('');

  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [searchAnimalQuery, setSearchAnimalQuery] = useState('');

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [inseminations, setInseminations] = useState<any[]>([]);
  const [selectedInsemination, setSelectedInsemination] = useState<any>(null);
  const [showInsemModal, setShowInsemModal] = useState(false);

  const [result, setResult] = useState<'Pregnant' | 'Empty' | ''>('');
  const [note, setNote] = useState('');

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
    setSelectedAnimal(null);
    setInseminations([]);
    setSelectedInsemination(null);
    setResult('');
    setShowFarmerModal(false);

    try {
      const res = await api.get(`/animals/farmer/${farmer._id}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setAnimals(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load farmer animals');
    }
  };

  const handleAnimalSelect = async (animal: any) => {
    setSelectedAnimal(animal);
    setSelectedInsemination(null);
    setInseminations([]);
    setResult('');
    setShowAnimalModal(false);
    setLoadingHistory(true);

    try {
      const res = await api.get(`/technician/animal-history/${animal._id}`);
      const history = res.data;
      const insemList = history.inseminations || [];
      setInseminations(insemList);
      if (insemList.length > 0) {
        setSelectedInsemination(insemList[0]); // default to most recent attempt
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load animal history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSave = async () => {
    if (!selectedAnimal) {
      toast.error('Please select an animal first');
      return;
    }
    if (!selectedInsemination) {
      toast.error('No breeding reference found. Please select an attempt.');
      return;
    }
    if (!result) {
      toast.error('Please select a diagnosis result');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        animalId: selectedAnimal._id,
        inseminationId: selectedInsemination._id || selectedInsemination.id,
        result,
        technicianNote: note,
      };

      await api.post('/technician/pregnancy-check', payload);
      toast.success(`Diagnosis saved successfully: ${result}`);
      router.back();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save pregnancy record');
    } finally {
      setSaving(false);
    }
  };

  const filteredFarmers = farmers.filter(f => 
    f.name?.toLowerCase().includes(searchFarmerQuery.toLowerCase()) ||
    f.address?.phoneNumber?.includes(searchFarmerQuery)
  );

  const filteredAnimals = animals.filter(a => 
    a.earTag?.toLowerCase().includes(searchAnimalQuery.toLowerCase()) ||
    a.breed?.toLowerCase().includes(searchAnimalQuery.toLowerCase())
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Calculate standard 280 days est calving date
  const estCalvingDate = new Date(Date.now() + 280 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-50 rounded-full">
          <ArrowLeft size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: '#1e293b' }}>
          Pregnancy Check
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          <View className="bg-purple-50 rounded-2xl p-4 mb-6 border border-purple-100 flex-row items-center">
             <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                <Sparkles size={20} color="#7c3aed" />
             </View>
             <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-purple-800 text-xs flex-1">
               Record pregnancy diagnosis outcome for breeding tracking. This directly updates the cow's status in the system registry.
             </Text>
          </View>

          {/* FARMER SELECTION */}
          <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Owner / Client</Text>
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
            <>
              <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Livestock Animal</Text>
              <TouchableOpacity 
                 onPress={() => setShowAnimalModal(true)} 
                 className="bg-white border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
              >
                 <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-purple-50 rounded-full items-center justify-center mr-3">
                       <HeartPulse size={20} color="#7c3aed" />
                    </View>
                    <View className="flex-1">
                       <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-base ${selectedAnimal ? 'text-slate-800' : 'text-slate-300'}`}>
                          {selectedAnimal ? `Tag: #${selectedAnimal.earTag} (${selectedAnimal.breed || 'Unknown'})` : 'Select Animal...'}
                       </Text>
                    </View>
                 </View>
                 <ChevronDown size={20} color="#94a3b8" />
              </TouchableOpacity>
            </>
          )}

          {/* BREEDING ATTEMPT SELECTION */}
          {selectedAnimal && (
            <>
              <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Breeding Attempt Reference</Text>
              {loadingHistory ? (
                <ActivityIndicator color="#00643B" style={{ marginVertical: 16 }} />
              ) : inseminations.length > 0 ? (
                <TouchableOpacity 
                   onPress={() => setShowInsemModal(true)} 
                   className="bg-white border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
                >
                   <View className="flex-row items-center flex-1">
                      <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3">
                         <History size={20} color="#3b82f6" />
                      </View>
                      <View className="flex-1">
                         <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-base">
                            Attempt #{selectedInsemination?.attemptNumber || 1} ({formatDate(selectedInsemination?.inseminationDate)})
                         </Text>
                         <Text className="text-[10px] text-slate-400 font-outfit-bold uppercase mt-0.5">
                            Sire Code: {selectedInsemination?.sireCode || 'N/A'} • Breed: {selectedInsemination?.sireBreed || 'N/A'}
                         </Text>
                      </View>
                   </View>
                   <ChevronDown size={20} color="#94a3b8" />
                </TouchableOpacity>
              ) : (
                <View className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-6 flex-row items-center">
                  <AlertCircle size={20} color="#d97706" style={{ marginRight: 8 }} />
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-amber-800 text-xs flex-1">
                    No active breeding attempts found. Please log a Walk-in A.I. request first.
                  </Text>
                </View>
              )}
            </>
          )}

          {/* DIAGNOSIS RESULT */}
          {selectedInsemination && (
            <>
              <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Diagnosis Result</Text>
              <View className="flex-row gap-4 mb-6">
                <TouchableOpacity
                  onPress={() => setResult('Pregnant')}
                  className={`flex-1 py-6 rounded-2xl border-2 items-center gap-2 ${result === 'Pregnant' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-100 bg-white text-slate-400 shadow-sm'}`}
                >
                  <Sparkles size={24} color={result === 'Pregnant' ? '#7c3aed' : '#cbd5e1'} />
                  <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-[11px] uppercase tracking-widest">Pregnant</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setResult('Empty')}
                  className={`flex-1 py-6 rounded-2xl border-2 items-center gap-2 ${result === 'Empty' ? 'border-rose-600 bg-rose-50 text-rose-700' : 'border-slate-100 bg-white text-slate-400 shadow-sm'}`}
                >
                  <AlertCircle size={24} color={result === 'Empty' ? '#e11d48' : '#cbd5e1'} />
                  <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-[11px] uppercase tracking-widest">Not Pregnant</Text>
                </TouchableOpacity>
              </View>

              {/* Estimated Calving Date Banner */}
              {result === 'Pregnant' && (
                <View className="bg-purple-600 rounded-3xl p-5 flex-row justify-between items-center mb-6 shadow-lg shadow-purple-200">
                  <View className="flex-row items-center gap-3">
                    <Calendar size={22} color="rgba(255,255,255,0.7)" />
                    <View>
                      <Text className="text-[8px] font-outfit-bold text-white/70 uppercase tracking-widest">Est. Calving Date</Text>
                      <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-white text-base leading-tight mt-0.5">{estCalvingDate}</Text>
                    </View>
                  </View>
                  <Sparkles size={20} color="white" />
                </View>
              )}

              {/* Technical findings */}
              <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Findings / Technical Observations</Text>
              <TextInput
                  className="bg-white border border-slate-100 rounded-3xl p-5 h-28 text-slate-800 shadow-sm mb-8 font-outfit-medium"
                  multiline
                  textAlignVertical="top"
                  placeholder="Optional details, conditions, notes..."
                  value={note}
                  onChangeText={setNote}
              />

              {/* SAVE BUTTON */}
              <TouchableOpacity 
                  className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-10 ${saving ? 'bg-slate-400' : 'bg-[#00643B]'}`}
                  onPress={handleSave}
                  disabled={saving}
              >
                  {saving ? <ActivityIndicator color="white" /> : (
                     <>
                        <Sparkles size={20} color="white" style={{ marginRight: 10 }} />
                        <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white text-base">Save Diagnosis</Text>
                     </>
                  )}
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* FARMER SELECTION MODAL */}
      <Modal visible={showFarmerModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
           <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[85%]">
              <View className="flex-row justify-between items-center mb-4">
                 <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: '#1e293b' }}>Select Owner</Text>
                 <TouchableOpacity onPress={() => setShowFarmerModal(false)} className="p-1 bg-slate-50 rounded-full">
                    <X size={20} color="black" />
                 </TouchableOpacity>
              </View>

              <View className="flex-row bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 items-center">
                 <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                 <TextInput 
                     placeholder="Search client by name..."
                     className="flex-1 font-outfit-medium text-slate-800 text-sm"
                     value={searchFarmerQuery}
                     onChangeText={setSearchFarmerQuery}
                 />
              </View>

              <FlatList 
                 data={filteredFarmers}
                 keyExtractor={(item) => item._id}
                 renderItem={({ item }) => (
                     <TouchableOpacity 
                        onPress={() => handleFarmerSelect(item)} 
                        className="py-4 border-b border-slate-100 flex-row justify-between items-center"
                     >
                        <View>
                           <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-base">{item.name}</Text>
                           <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-xs text-slate-400 uppercase mt-0.5">
                             {item.address?.barangay || 'No Barangay'} • {item.address?.phoneNumber || 'No Phone'}
                           </Text>
                        </View>
                        <ChevronDown size={14} color="#94a3b8" style={{ transform: [{ rotate: '-90deg' }] }} />
                     </TouchableOpacity>
                 )}
                 ListEmptyComponent={
                     <View className="py-8 items-center">
                        <Text className="font-outfit-bold text-slate-400">No clients found</Text>
                     </View>
                 }
              />
           </View>
        </View>
      </Modal>

      {/* ANIMAL SELECTION MODAL */}
      <Modal visible={showAnimalModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
           <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[85%]">
              <View className="flex-row justify-between items-center mb-4">
                 <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: '#1e293b' }}>Select Animal</Text>
                 <TouchableOpacity onPress={() => setShowAnimalModal(false)} className="p-1 bg-slate-50 rounded-full">
                    <X size={20} color="black" />
                 </TouchableOpacity>
              </View>

              <View className="flex-row bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 items-center">
                 <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                 <TextInput 
                     placeholder="Search animal by tag or breed..."
                     className="flex-1 font-outfit-medium text-slate-800 text-sm"
                     value={searchAnimalQuery}
                     onChangeText={setSearchAnimalQuery}
                 />
              </View>

              <FlatList 
                 data={filteredAnimals}
                 keyExtractor={(item) => item._id}
                 renderItem={({ item }) => (
                     <TouchableOpacity 
                        onPress={() => handleAnimalSelect(item)} 
                        className="py-4 border-b border-slate-100 flex-row justify-between items-center"
                     >
                        <View>
                           <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-base">Ear Tag: #{item.earTag || 'N/A'}</Text>
                           <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-xs text-slate-400 uppercase mt-0.5">
                             Breed: {item.breed || 'Unknown'} • Status: {item.reproductiveStatus || 'Open'}
                           </Text>
                        </View>
                        <ChevronDown size={14} color="#94a3b8" style={{ transform: [{ rotate: '-90deg' }] }} />
                     </TouchableOpacity>
                 )}
                 ListEmptyComponent={
                     <View className="py-8 items-center">
                        <Text className="font-outfit-bold text-slate-400">No animals found for this farmer</Text>
                     </View>
                 }
              />
           </View>
        </View>
      </Modal>

      {/* INSEMINATION SELECTOR MODAL */}
      <Modal visible={showInsemModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
           <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[70%]">
              <View className="flex-row justify-between items-center mb-4">
                 <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: '#1e293b' }}>Select Breeding Reference</Text>
                 <TouchableOpacity onPress={() => setShowInsemModal(false)} className="p-1 bg-slate-50 rounded-full">
                    <X size={20} color="black" />
                 </TouchableOpacity>
              </View>
              <FlatList 
                 data={inseminations} 
                 keyExtractor={(item) => item._id || item.id} 
                 renderItem={({ item }) => (
                     <TouchableOpacity 
                        onPress={() => {
                          setSelectedInsemination(item);
                          setShowInsemModal(false);
                        }} 
                        className="py-4 border-b border-slate-100"
                     >
                         <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-sm">
                           Attempt #{item.attemptNumber || 1} • {formatDate(item.inseminationDate)}
                         </Text>
                         <Text className="text-[10px] text-slate-400 font-outfit-bold uppercase mt-0.5">
                           Sire Code: {item.sireCode || 'N/A'} • Status: {item.status || 'Done'}
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
