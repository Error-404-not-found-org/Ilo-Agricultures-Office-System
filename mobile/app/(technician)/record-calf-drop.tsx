import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, FlatList, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Plus, Trash2, Calendar, Info, User, ChevronDown, Search, X, ShieldAlert } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import EarTagGenerator from '@/components/EarTagGenerator';

export default function RecordCalfDropScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const api = useApi();
    const queryClient = useQueryClient();
    const { isDark, colors } = useTheme();

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
        { sex: 'F', earTag: '', weight: '', color: '', brand: '' }
    ]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const [farmerName, setFarmerName] = useState('');
    const [farmerAnimalCount, setFarmerAnimalCount] = useState(0);

    // Fetch mother details if initialMotherId is provided (to get farmer details for EarTagGenerator)
    useEffect(() => {
        const fetchDetailsForInitialMother = async () => {
            if (initialMotherId) {
                try {
                    const animalRes = await api.get(`/animals/${initialMotherId}`);
                    const animalData = animalRes.data;
                    if (animalData && animalData.farmerId) {
                        setFarmerName(animalData.farmerId.name || '');
                        
                        // Fetch all animals for this farmer to get the count
                        const farmerId = animalData.farmerId._id || animalData.farmerId;
                        const farmerAnimalsRes = await api.get(`/animals/farmer/${farmerId}`);
                        const list = Array.isArray(farmerAnimalsRes.data) 
                            ? farmerAnimalsRes.data 
                            : (farmerAnimalsRes.data?.data || []);
                        setFarmerAnimalCount(list.length);
                    }
                } catch (err) {
                    console.error("Error fetching mother details:", err);
                }
            }
        };
        fetchDetailsForInitialMother();
    }, [initialMotherId, api]);

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
        setFarmerName(farmer.name || '');
        setSelectedAnimal(null);
        setMotherId('');
        setPregnancyId('');
        setMotherTag('');
        setShowFarmerModal(false);

        try {
            // Load pregnant animals for the farmer
            const res = await api.get(`/animals/farmer/${farmer._id}`);
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setFarmerAnimalCount(list.length);

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
                newCalves.push({ sex: 'F', earTag: '', weight: '', color: '', brand: '' });
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
        <SafeAreaView className="flex-1 bg-[#F8FAFC] dark:bg-slate-950">
            {/* Header */}
            <View className="flex-row items-center px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm z-10">
                <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
                    <ArrowLeft size={20} color={isDark ? '#f8fafc' : '#1e2937'} />
                </TouchableOpacity>
                <View>
                    <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: colors.textPrimary }}>Record Calf Drop</Text>
                    {motherTag && (
                        <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 10, color: isDark ? '#6b7280' : '#94a3b8', textTransform: 'uppercase' }}>Mother: #{motherTag}</Text>
                    )}
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                
                {/* Standalone Selection Flow */}
                {!initialMotherId && (
                    <>
                        {/* Farmer Selection */}
                        <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">Owner / Client</Text>
                        <TouchableOpacity 
                           onPress={() => setShowFarmerModal(true)} 
                           className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
                        >
                           <View className="flex-row items-center flex-1">
                              <View className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full items-center justify-center mr-3">
                                 <User size={20} color={isDark ? '#34d399' : '#00643B'} />
                              </View>
                              <View className="flex-1">
                                 <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-base ${selectedFarmer ? 'text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                                    {selectedFarmer ? selectedFarmer.name : 'Select Farmer...'}
                                 </Text>
                              </View>
                           </View>
                           <ChevronDown size={20} color={isDark ? '#6b7280' : '#94a3b8'} />
                        </TouchableOpacity>

                        {/* Mother selection */}
                        {selectedFarmer && (
                            <>
                                <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">Pregnant Mother (Cattle)</Text>
                                <TouchableOpacity 
                                   onPress={() => setShowAnimalModal(true)} 
                                   className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
                                >
                                   <View className="flex-row items-center flex-1">
                                      <View className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full items-center justify-center mr-3">
                                         <MaterialCommunityIcons name="cow" size={20} color={isDark ? '#34d399' : '#00643B'} />
                                      </View>
                                      <View className="flex-1">
                                         <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-base ${selectedAnimal ? 'text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                                            {selectedAnimal ? `Tag: #${selectedAnimal.earTag} (${selectedAnimal.breed || 'Unknown'})` : 'Select Pregnant Cow...'}
                                         </Text>
                                      </View>
                                   </View>
                                   <ChevronDown size={20} color={isDark ? '#6b7280' : '#94a3b8'} />
                                </TouchableOpacity>
                            </>
                        )}
                    </>
                )}

                {/* Event Basics Card */}
                {motherId && pregnancyId ? (
                    <View className="bg-emerald-50/50 dark:bg-emerald-900/10 p-6 rounded-[32px] mb-8 border border-emerald-100 dark:border-emerald-800/50">
                        <View className="flex-row items-center gap-2 mb-4">
                            <MaterialCommunityIcons name="baby-carriage" size={20} color={isDark ? '#34d399' : '#00643B'} />
                            <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-emerald-800 dark:text-emerald-400 text-sm uppercase tracking-widest">Event Basics</Text>
                        </View>

                        <View className="gap-y-4">
                            <View>
                                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Drop Date</Text>
                                <TextInput 
                                    className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white font-outfit-medium shadow-sm"
                                    value={date}
                                    onChangeText={setDate}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                />
                            </View>

                            <View>
                                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Ease (Calving Type)</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {['Natural', 'Difficult', 'Abortion', 'Stillbirth'].map(opt => (
                                        <TouchableOpacity 
                                            key={opt}
                                            onPress={() => setCalvingEase(opt)}
                                            className={`px-4 py-2.5 rounded-xl border ${calvingEase === opt ? 'bg-emerald-600 border-emerald-600' : 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-slate-700'}`}
                                        >
                                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[11px] ${calvingEase === opt ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'}`}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View>
                                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Number of Calves</Text>
                                <View className="flex-row items-center gap-3">
                                    <TextInput 
                                        className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white font-outfit-black shadow-sm flex-1"
                                        value={numCalves.toString()}
                                        onChangeText={handleNumChange}
                                        keyboardType="numeric"
                                    />
                                    <Text className="text-slate-400 dark:text-slate-500 font-outfit-bold text-xs uppercase">Head</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : (
                    !initialMotherId && (
                        <View className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-6 rounded-3xl items-center mb-8">
                            <Info size={32} color={isDark ? '#60a5fa' : '#2563eb'} style={{ marginBottom: 8 }} />
                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-blue-900 dark:text-blue-300 text-sm text-center">
                                Select a farmer and a pregnant cow to unlock calving entry details.
                            </Text>
                        </View>
                    )
                )}

                {/* Offspring Details */}
                {motherId && pregnancyId && (
                    <>
                        <View className="flex-row justify-between items-end mb-4 px-1">
                            <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">Offspring Registry</Text>
                            <View className="flex-row items-center gap-1.5">
                                <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-bold text-[9px] uppercase">Auto-Registering</Text>
                            </View>
                        </View>

                        <View className="gap-y-4 mb-8">
                            {calves.map((calf, idx) => (
                                <View key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-sm">
                                    <View className="flex-row items-center gap-2 mb-4">
                                        <View className="w-6 h-6 bg-emerald-500 rounded-full items-center justify-center">
                                            <Text className="text-white text-[10px] font-outfit-black">{idx + 1}</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-800 dark:text-white text-sm">Calf Details</Text>
                                    </View>

                                    <View className="gap-y-4">
                                        <View className="flex-row gap-3">
                                            <View className="flex-1">
                                                <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Sex</Text>
                                                <View className="flex-row bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-slate-700">
                                                    <TouchableOpacity 
                                                        onPress={() => updateCalf(idx, 'sex', 'F')}
                                                        className={`flex-1 py-2 rounded-lg items-center ${calf.sex === 'F' ? 'bg-rose-100 dark:bg-rose-900/30' : ''}`}
                                                    >
                                                        <Text className={`text-[10px] font-outfit-black ${calf.sex === 'F' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>Female</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        onPress={() => updateCalf(idx, 'sex', 'M')}
                                                        className={`flex-1 py-2 rounded-lg items-center ${calf.sex === 'M' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                                                    >
                                                        <Text className={`text-[10px] font-outfit-black ${calf.sex === 'M' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>Male</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Weight (kg)</Text>
                                                <TextInput 
                                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-white font-outfit-bold text-xs"
                                                    placeholder="0.00"
                                                    placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                    value={calf.weight}
                                                    onChangeText={(v) => updateCalf(idx, 'weight', v)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>

                                        <View className="flex-row gap-3">
                                            <View className="flex-1">
                                                <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Color</Text>
                                                <TextInput 
                                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-white font-outfit-bold text-xs"
                                                    placeholder="White, Brown, Black..."
                                                    placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                    value={calf.color}
                                                    onChangeText={(v) => updateCalf(idx, 'color', v)}
                                                />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Brand Mark</Text>
                                                <TextInput 
                                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-white font-outfit-bold text-xs"
                                                    placeholder="Optional"
                                                    placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                    value={calf.brand}
                                                    onChangeText={(v) => updateCalf(idx, 'brand', v)}
                                                />
                                            </View>
                                        </View>

                                        <View>
                                            <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Ear Tag / ID No.</Text>
                                            <TextInput 
                                                className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white font-outfit-black text-xs uppercase"
                                                placeholder="CALF-XXXX"
                                                placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                value={calf.earTag}
                                                onChangeText={(v) => updateCalf(idx, 'earTag', v)}
                                            />
                                            <View className="mt-2 ml-1">
                                                <EarTagGenerator
                                                    farmerName={farmerName}
                                                    animalCount={farmerAnimalCount + idx}
                                                    onGenerate={(tag) => updateCalf(idx, 'earTag', tag)}
                                                    isDark={isDark}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">Technical Notes</Text>
                        <TextInput
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 h-32 text-slate-800 dark:text-white shadow-sm mb-10 font-outfit-medium"
                            multiline
                            textAlignVertical="top"
                            placeholder="Observations, complications, etc..."
                            placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
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
                 <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[85%]">
                    <View className="flex-row justify-between items-center mb-4">
                       <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: colors.textPrimary }}>Select Client</Text>
                       <TouchableOpacity onPress={() => setShowFarmerModal(false)} className="p-1 bg-slate-50 dark:bg-slate-800 rounded-full">
                          <X size={20} color={isDark ? '#94a3b8' : 'black'} />
                       </TouchableOpacity>
                    </View>

                    <View className="flex-row bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 mb-4 items-center">
                       <Search size={18} color={isDark ? '#6b7280' : '#94a3b8'} style={{ marginRight: 8 }} />
                       <TextInput 
                           placeholder="Search client by name..."
                           placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                           className="flex-1 font-outfit-medium text-slate-800 dark:text-white text-sm"
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
                              className="py-4 border-b border-slate-100 dark:border-slate-800 flex-row justify-between items-center"
                           >
                              <View>
                                 <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 dark:text-white text-base">{item.name}</Text>
                                 <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-xs text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                                   {item.address?.barangay || 'No Barangay'} • {item.address?.phoneNumber || 'No Phone'}
                                 </Text>
                              </View>
                              <ChevronDown size={14} color={isDark ? '#6b7280' : '#94a3b8'} style={{ transform: [{ rotate: '-90deg' }] }} />
                           </TouchableOpacity>
                       )}
                       ListEmptyComponent={
                           <View className="py-8 items-center">
                              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500">No clients found</Text>
                           </View>
                       }
                    />
                 </View>
              </View>
            </Modal>

            {/* ANIMAL SELECTION MODAL */}
            <Modal visible={showAnimalModal} animationType="slide" transparent>
              <View className="flex-1 bg-black/50 justify-end">
                 <View className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 pb-10 max-h-[85%]">
                    <View className="flex-row justify-between items-center mb-4">
                       <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: colors.textPrimary }}>Select Pregnant Cow</Text>
                       <TouchableOpacity onPress={() => setShowAnimalModal(false)} className="p-1 bg-slate-50 dark:bg-slate-800 rounded-full">
                          <X size={20} color={isDark ? '#94a3b8' : 'black'} />
                       </TouchableOpacity>
                    </View>

                    <View className="flex-row bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 mb-4 items-center">
                       <Search size={18} color={isDark ? '#6b7280' : '#94a3b8'} style={{ marginRight: 8 }} />
                       <TextInput 
                           placeholder="Search cow by tag or breed..."
                           placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                           className="flex-1 font-outfit-medium text-slate-800 dark:text-white text-sm"
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
                              className="py-4 border-b border-slate-100 dark:border-slate-800 flex-row justify-between items-center"
                           >
                              <View>
                                 <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 dark:text-white text-base">Ear Tag: #{item.earTag || 'N/A'}</Text>
                                 <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-xs text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                                   Breed: {item.breed || 'Unknown'} • Color: {item.color || 'N/A'}
                                 </Text>
                              </View>
                              <ChevronDown size={14} color={isDark ? '#6b7280' : '#94a3b8'} style={{ transform: [{ rotate: '-90deg' }] }} />
                           </TouchableOpacity>
                       )}
                       ListEmptyComponent={
                           <View className="py-8 items-center">
                              <Text className="font-outfit-bold text-slate-400 dark:text-slate-500">No pregnant cows found for this client</Text>
                           </View>
                       }
                    />
                 </View>
              </View>
            </Modal>
        </SafeAreaView>
    );
}
