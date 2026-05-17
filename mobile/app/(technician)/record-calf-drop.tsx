import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, FlatList, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Plus, Trash2, Calendar, Info, User, ChevronDown, Search, X, ShieldAlert } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

export default function RecordCalfDropScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const api = useApi();
    const queryClient = useQueryClient();

    // Mother info passed via params (optional)
    const initialMotherId = params.motherId as string;
    const initialPregnancyId = params.pregnancyId as string;
    const initialMotherTag = params.motherTag as string;

    const [motherId, setMotherId] = useState(initialMotherId || '');
    const [pregnancyId, setPregnancyId] = useState(initialPregnancyId || '');
    const [motherTag, setMotherTag] = useState(initialMotherTag || '');

    const [farmers, setFarmers] = useState<any[]>([]);
    const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
    const [showFarmerModal, setShowFarmerModal] = useState(false);
    const [searchFarmerQuery, setSearchFarmerQuery] = useState('');

    const [animals, setAnimals] = useState<any[]>([]);
    const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
    const [showAnimalModal, setShowAnimalModal] = useState(false);
    const [searchAnimalQuery, setSearchAnimalQuery] = useState('');
    const [loadingPregnancies, setLoadingPregnancies] = useState(false);

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [calvingEase, setCalvingEase] = useState('Natural');
    const [numCalves, setNumCalves] = useState(1);
    const [calves, setCalves] = useState([
        { sex: 'F', earTag: '', weight: '' }
    ]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    // Fetch farmers for standalone mode
    useEffect(() => {
        if (!initialMotherId) {
            const fetchFarmers = async () => {
                try {
                    const res = await api.get('/user?role=farmer');
                    setFarmers(res.data);
                } catch (err) {
                    console.error(err);
                }
            };
            fetchFarmers();
        }
    }, [api, initialMotherId]);

    const handleFarmerSelect = async (farmer: any) => {
        setSelectedFarmer(farmer);
        setSelectedAnimal(null);
        setMotherId('');
        setPregnancyId('');
        setMotherTag('');
        setShowFarmerModal(false);

        try {
            // Load pregnant animals for the farmer
            const res = await api.get(`/animals/farmer/${farmer._id}`);
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            // Filter to only those whose status is 'Pregnant'
            const pregnantCows = list.filter((a: any) => a.reproductiveStatus === 'Pregnant');
            setAnimals(pregnantCows);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load farmer animals');
        }
    };

    const handleAnimalSelect = async (animal: any) => {
        setSelectedAnimal(animal);
        setMotherId(animal._id);
        setMotherTag(animal.earTag);
        setShowAnimalModal(false);
        setLoadingPregnancies(true);

        try {
            // Load animal history to get the latest positive pregnancy check
            const res = await api.get(`/technician/animal-history/${animal._id}`);
            const history = res.data;
            const pregnanciesList = history.pregnancies || [];
            if (pregnanciesList.length > 0) {
                // Pick the most recent pregnancy that is still active
                setPregnancyId(pregnanciesList[0]._id || pregnanciesList[0].id);
            } else {
                toast.error('No pregnancy record found for this animal');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load pregnancy details');
        } finally {
            setLoadingPregnancies(false);
        }
    };

    const handleNumChange = (val: string) => {
        const count = parseInt(val) || 1;
        if (count < 1) return;
        
        let newCalves = [...calves];
        if (count > newCalves.length) {
            for (let i = newCalves.length; i < count; i++) {
                newCalves.push({ sex: 'F', earTag: '', weight: '' });
            }
        } else {
            newCalves = newCalves.slice(0, count);
        }
        setNumCalves(count);
        setCalves(newCalves);
    };

    const updateCalf = (index: number, field: string, value: string) => {
        const newCalves = [...calves];
        (newCalves[index] as any)[field] = value;
        setCalves(newCalves);
    };

    const handleSave = async () => {
        if (!motherId || !pregnancyId) {
            toast.error("Please select a mother with an active pregnancy.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                pregnancyId,
                animalId: motherId,
                date,
                calvingEase,
                numberOfCalves: numCalves,
                calves,
                technicianNote: note
            };

            await api.post('/technician/record-calving', payload);
            toast.success("Calf Drop recorded successfully!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            router.back();
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to record calving event");
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

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            {/* Header */}
            <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100 shadow-sm z-10">
                <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-50 rounded-full">
                    <ArrowLeft size={20} color="#1e2937" />
                </TouchableOpacity>
                <View>
                    <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: '#1e293b' }}>Record Calf Drop</Text>
                    {motherTag && (
                        <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Mother: #{motherTag}</Text>
                    )}
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                
                {/* Standalone Selection Flow */}
                {!initialMotherId && (
                    <>
                        {/* Farmer Selection */}
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

                        {/* Mother selection */}
                        {selectedFarmer && (
                            <>
                                <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Pregnant Mother (Cattle)</Text>
                                <TouchableOpacity 
                                   onPress={() => setShowAnimalModal(true)} 
                                   className="bg-white border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
                                >
                                   <View className="flex-row items-center flex-1">
                                      <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center mr-3">
                                         <MaterialCommunityIcons name="cow" size={20} color="#00643B" />
                                      </View>
                                      <View className="flex-1">
                                         <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-base ${selectedAnimal ? 'text-slate-800' : 'text-slate-300'}`}>
                                            {selectedAnimal ? `Tag: #${selectedAnimal.earTag} (${selectedAnimal.breed || 'Unknown'})` : 'Select Pregnant Cow...'}
                                         </Text>
                                      </View>
                                   </View>
                                   <ChevronDown size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </>
                        )}
                    </>
                )}

                {/* Event Basics Card */}
                {motherId && pregnancyId ? (
                    <View className="bg-emerald-50/50 p-6 rounded-[32px] mb-8 border border-emerald-100">
                        <View className="flex-row items-center gap-2 mb-4">
                            <MaterialCommunityIcons name="baby-carriage" size={20} color="#00643B" />
                            <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-emerald-800 text-sm uppercase tracking-widest">Event Basics</Text>
                        </View>

                        <View className="gap-y-4">
                            <View>
                                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Drop Date</Text>
                                <TextInput 
                                    className="bg-white border border-emerald-100 rounded-2xl p-4 text-slate-800 font-outfit-medium shadow-sm"
                                    value={date}
                                    onChangeText={setDate}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>

                            <View>
                                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Ease (Calving Type)</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {['Natural', 'Difficult', 'Abortion', 'Stillbirth'].map(opt => (
                                        <TouchableOpacity 
                                            key={opt}
                                            onPress={() => setCalvingEase(opt)}
                                            className={`px-4 py-2.5 rounded-xl border ${calvingEase === opt ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-emerald-100'}`}
                                        >
                                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[11px] ${calvingEase === opt ? 'text-white' : 'text-emerald-700'}`}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View>
                                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Number of Calves</Text>
                                <View className="flex-row items-center gap-3">
                                    <TextInput 
                                        className="bg-white border border-emerald-100 rounded-2xl p-4 text-slate-800 font-outfit-black shadow-sm flex-1"
                                        value={numCalves.toString()}
                                        onChangeText={handleNumChange}
                                        keyboardType="numeric"
                                    />
                                    <Text className="text-slate-400 font-outfit-bold text-xs uppercase">Head</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : (
                    !initialMotherId && (
                        <View className="bg-blue-50 border border-blue-100 p-6 rounded-3xl items-center mb-8">
                            <Info size={32} color="#2563eb" style={{ marginBottom: 8 }} />
                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-blue-900 text-sm text-center">
                                Select a farmer and a pregnant cow to unlock calving entry details.
                            </Text>
                        </View>
                    )
                )}

                {/* Offspring Details */}
                {motherId && pregnancyId && (
                    <>
                        <View className="flex-row justify-between items-end mb-4 px-1">
                            <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest">Offspring Registry</Text>
                            <View className="flex-row items-center gap-1.5">
                                <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                <Text className="text-emerald-600 font-outfit-bold text-[9px] uppercase">Auto-Registering</Text>
                            </View>
                        </View>

                        <View className="gap-y-4 mb-8">
                            {calves.map((calf, idx) => (
                                <View key={idx} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
                                    <View className="flex-row items-center gap-2 mb-4">
                                        <View className="w-6 h-6 bg-emerald-500 rounded-full items-center justify-center">
                                            <Text className="text-white text-[10px] font-outfit-black">{idx + 1}</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-800 text-sm">Calf Details</Text>
                                    </View>

                                    <View className="gap-y-4">
                                        <View className="flex-row gap-3">
                                            <View className="flex-1">
                                                <Text className="text-slate-500 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Sex</Text>
                                                <View className="flex-row bg-slate-50 rounded-xl p-1 border border-slate-100">
                                                    <TouchableOpacity 
                                                        onPress={() => updateCalf(idx, 'sex', 'F')}
                                                        className={`flex-1 py-2 rounded-lg items-center ${calf.sex === 'F' ? 'bg-rose-100' : ''}`}
                                                    >
                                                        <Text className={`text-[10px] font-outfit-black ${calf.sex === 'F' ? 'text-rose-600' : 'text-slate-400'}`}>Female</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        onPress={() => updateCalf(idx, 'sex', 'M')}
                                                        className={`flex-1 py-2 rounded-lg items-center ${calf.sex === 'M' ? 'bg-blue-100' : ''}`}
                                                    >
                                                        <Text className={`text-[10px] font-outfit-black ${calf.sex === 'M' ? 'text-blue-600' : 'text-slate-400'}`}>Male</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-slate-500 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Weight (kg)</Text>
                                                <TextInput 
                                                    className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-slate-800 font-outfit-bold text-xs"
                                                    placeholder="0.00"
                                                    value={calf.weight}
                                                    onChangeText={(v) => updateCalf(idx, 'weight', v)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>

                                        <View>
                                            <Text className="text-slate-500 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Ear Tag / ID No.</Text>
                                            <TextInput 
                                                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-black text-xs uppercase"
                                                placeholder="CALF-XXXX"
                                                value={calf.earTag}
                                                onChangeText={(v) => updateCalf(idx, 'earTag', v)}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Technical Notes</Text>
                        <TextInput
                            className="bg-white border border-slate-100 rounded-3xl p-5 h-32 text-slate-800 shadow-sm mb-10 font-outfit-medium"
                            multiline
                            textAlignVertical="top"
                            placeholder="Observations, complications, etc..."
                            value={note}
                            onChangeText={setNote}
                        />

                        <TouchableOpacity 
                            className={`py-5 rounded-[28px] flex-row justify-center items-center shadow-xl mb-20 ${saving ? 'bg-slate-400' : 'bg-emerald-600'}`}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Save size={20} color="white" style={{ marginRight: 10 }} />
                                    <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-white text-base uppercase tracking-widest">Submit Calving Registry</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            {/* FARMER SELECTION MODAL */}
            <Modal visible={showFarmerModal} animationType="slide" transparent>
              <View className="flex-1 bg-black/50 justify-end">
                 <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[85%]">
                    <View className="flex-row justify-between items-center mb-4">
                       <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: '#1e293b' }}>Select Client</Text>
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
                       <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: '#1e293b' }}>Select Pregnant Cow</Text>
                       <TouchableOpacity onPress={() => setShowAnimalModal(false)} className="p-1 bg-slate-50 rounded-full">
                          <X size={20} color="black" />
                       </TouchableOpacity>
                    </View>

                    <View className="flex-row bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 items-center">
                       <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                       <TextInput 
                           placeholder="Search cow by tag or breed..."
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
                                   Breed: {item.breed || 'Unknown'} • Color: {item.color || 'N/A'}
                                 </Text>
                              </View>
                              <ChevronDown size={14} color="#94a3b8" style={{ transform: [{ rotate: '-90deg' }] }} />
                           </TouchableOpacity>
                       )}
                       ListEmptyComponent={
                           <View className="py-8 items-center">
                              <Text className="font-outfit-bold text-slate-400">No pregnant cows found for this client</Text>
                           </View>
                       }
                    />
                 </View>
              </View>
            </Modal>
        </SafeAreaView>
    );
}
