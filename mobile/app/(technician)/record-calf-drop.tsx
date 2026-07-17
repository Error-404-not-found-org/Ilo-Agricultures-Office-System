import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, FlatList, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Info, User, ChevronDown, Search, X, Camera, Image as ImageIcon } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import EarTagGenerator from '@/components/EarTagGenerator';
import * as ImagePicker from 'expo-image-picker';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { animalKeys, animalRecordKeys, breedingKeys, notificationKeys, technicianKeys } from '@/lib/queryKeys';
import { tasksQueryKeys } from '@/features/technician/hooks/useTechnicianTasks';
import { recordsQueryKeys } from '@/features/technician/hooks/useTechnicianRecords';
import { animalQueryKeys } from '@/features/technician/hooks/useTechnicianAnimal';

interface CalfEntry {
    sex: string;
    earTag: string;
    color: string;
    brand: string;
    imageUri?: string;
    imageBase64?: string;
    isLiving?: boolean;
}

const CALF_COLOR_OPTIONS = [
    'Black',
    'Brown',
    'White',
    'Red',
    'Gray',
    'Spotted',
    'Mixed',
];

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
    const taskId = params.taskId as string;

    const [motherId, setMotherId] = useState(initialMotherId || '');
    const [pregnancyId, setPregnancyId] = useState(initialPregnancyId || '');
    const [motherTag, setMotherTag] = useState(initialMotherTag || '');

    const [farmers, setFarmers] = useState<any[]>([]);
    const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
    const [showFarmerModal, setShowFarmerModal] = useState(false);
    const [searchFarmerQuery, setSearchFarmerQuery] = useState('');

    const [animals, setAnimals] = useState<any[]>([]);
    const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
    const [selectedPregnancy, setSelectedPregnancy] = useState<any>(null);
    const [showAnimalModal, setShowAnimalModal] = useState(false);
    const [searchAnimalQuery, setSearchAnimalQuery] = useState('');

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [calvingEase, setCalvingEase] = useState('Natural');
    const [outcome, setOutcome] = useState<'live_birth' | 'mixed' | 'stillbirth' | 'abortion'>('live_birth');
    const [numCalves, setNumCalves] = useState(1);
    const [numCalvesInput, setNumCalvesInput] = useState('1');
    const [calves, setCalves] = useState<CalfEntry[]>([
        { sex: 'F', earTag: '', color: '', brand: '' }
    ]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirmSubmitVisible, setConfirmSubmitVisible] = useState(false);
    const calvingMutation = useOfflineMutation(
        {
            url: '/technician/record-calving',
            method: 'POST',
            description: `Technician calving record for ${motherTag || 'mother animal'}`,
        },
        {
            onSuccess: (result) => {
                if (result.status === 'synced') {
                    toast.success("Calving recorded successfully!");
                    [
                        technicianKeys.dashboard(),
                        recordsQueryKeys.official,
                        tasksQueryKeys.all,
                        animalKeys.all,
                        animalQueryKeys.all,
                        animalKeys.detail(motherId),
                        animalKeys.timeline(motherId),
                        breedingKeys.tracker(motherId),
                        animalRecordKeys.records(motherId),
                        notificationKeys.all,
                    ].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
                    router.back();
                }
            },
            onError: (err: any) => {
                console.error(err);
                toast.error(err.response?.data?.message || "Failed to record calving event");
            },
        },
    );

    const [farmerName, setFarmerName] = useState('');
    const [farmerAnimalCount, setFarmerAnimalCount] = useState(0);

    const selectActivePregnancy = (history: any, requestedPregnancyId?: string) => {
        const calvedIds = new Set(
            (history.calvings || []).map((item: any) => String(item.pregnancyId?._id || item.pregnancyId)),
        );
        const eligible = (history.pregnancies || []).filter((item: any) =>
            item.pregnancyDiagnosis?.result === 'Pregnant' &&
            !['completed', 'lost'].includes(item.cycleStatus) &&
            !calvedIds.has(String(item._id || item.id)),
        );
        const pregnancy = requestedPregnancyId
            ? eligible.find((item: any) => String(item._id || item.id) === String(requestedPregnancyId))
            : eligible[0];
        if (!pregnancy) return null;
        const insemination = (history.inseminations || []).find(
            (item: any) => String(item._id || item.id) === String(pregnancy.inseminationId?._id || pregnancy.inseminationId),
        );
        return { ...pregnancy, insemination };
    };

    // Fetch mother details if initialMotherId is provided (to get farmer details for EarTagGenerator)
    useEffect(() => {
        const fetchDetailsForInitialMother = async () => {
            if (initialMotherId) {
                try {
                    const animalRes = await api.get(`/animals/${initialMotherId}`);
                    const animalData = animalRes.data;
                    if (animalData && animalData.farmerId) {
                        setFarmerName(animalData.farmerId.name || '');
                        setSelectedAnimal(animalData);
                        setMotherTag(animalData.earTag || animalData.animalId || '');
                        
                        // Fetch all animals for this farmer to get the count
                        const farmerId = animalData.farmerId._id || animalData.farmerId;
                        const farmerAnimalsRes = await api.get(`/animals/farmer/${farmerId}`);
                        const list = Array.isArray(farmerAnimalsRes.data) 
                            ? farmerAnimalsRes.data 
                            : (farmerAnimalsRes.data?.data || []);
                        setFarmerAnimalCount(list.length);
                        const historyRes = await api.get(`/technician/animal-history/${initialMotherId}`);
                        const activePregnancy = selectActivePregnancy(historyRes.data, initialPregnancyId);
                        if (!activePregnancy) {
                            setPregnancyId('');
                            toast.error('This animal has no active technician-confirmed pregnancy.');
                            return;
                        }
                        setPregnancyId(String(activePregnancy._id || activePregnancy.id));
                        setSelectedPregnancy(activePregnancy);
                    }
                } catch (err) {
                    console.error("Error fetching mother details:", err);
                }
            }
        };
        fetchDetailsForInitialMother();
    }, [initialMotherId, initialPregnancyId, api]);

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
        setSelectedPregnancy(null);
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
        try {
            // Load animal history and select only an uncalved, confirmed pregnancy.
            const res = await api.get(`/technician/animal-history/${animal._id}`);
            const history = res.data;
            const activePregnancy = selectActivePregnancy(history);
            if (activePregnancy) {
                setPregnancyId(activePregnancy._id || activePregnancy.id);
                setSelectedPregnancy(activePregnancy);
            } else {
                setPregnancyId('');
                setSelectedPregnancy(null);
                toast.error('No pregnancy record found for this animal');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load pregnancy details');
        }
    };

    const handleNumChange = (val: string) => {
        const cleaned = val.replace(/[^0-9]/g, '');
        setNumCalvesInput(cleaned);
        if (!cleaned) return;

        const count = Math.min(Math.max(parseInt(cleaned, 10), 1), 5);
        
        let newCalves = [...calves];
        if (count > newCalves.length) {
            for (let i = newCalves.length; i < count; i++) {
                newCalves.push({ sex: 'F', earTag: '', color: '', brand: '' });
            }
        } else {
            newCalves = newCalves.slice(0, count);
        }
        setNumCalves(count);
        setCalves(newCalves);
    };

    const handleNumBlur = () => {
        if (!numCalvesInput) {
            setNumCalvesInput(numCalves.toString());
        }
    };

    const isLiveBirth = outcome === 'live_birth';
    const isAbortion = outcome === 'abortion';
    const handleOutcomeSelect = (value: string) => {
        const nextOutcome = value as typeof outcome;
        setOutcome(nextOutcome);
        if (nextOutcome === 'abortion') {
            setNumCalves(0);
            setNumCalvesInput('0');
            setCalves([]);
        } else if (calves.length === 0) {
            setNumCalves(1);
            setNumCalvesInput('1');
            setCalves([{ sex: 'F', earTag: '', color: '', brand: '', isLiving: nextOutcome !== 'stillbirth' }]);
        } else {
            setCalves(calves.map((calf, index) => ({
                ...calf,
                isLiving: nextOutcome === 'live_birth' ? true : nextOutcome === 'stillbirth' ? false : index === 0,
            })));
        }
    };

    const updateCalf = (index: number, field: string, value: string) => {
        const newCalves = [...calves];
        (newCalves[index] as any)[field] = value;
        setCalves(newCalves);
    };

    const pickCalfImage = async (index: number) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });
        if (!result.canceled && result.assets?.length > 0) {
            const newCalves = [...calves];
            newCalves[index].imageUri = result.assets[0].uri;
            newCalves[index].imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setCalves(newCalves);
        }
    };

    const takeCalfPhoto = async (index: number) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            toast.error("Permission to access camera was denied");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets?.length > 0) {
            const newCalves = [...calves];
            newCalves[index].imageUri = result.assets[0].uri;
            newCalves[index].imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setCalves(newCalves);
        }
    };

    const removeCalfImage = (index: number) => {
        const newCalves = [...calves];
        newCalves[index].imageUri = undefined;
        newCalves[index].imageBase64 = undefined;
        setCalves(newCalves);
    };

    const validateCalvingForm = () => {
        toast.dismiss();
        if (!motherId || !pregnancyId) {
            toast.error("Please select a mother with an active pregnancy.");
            return false;
        }

        const parsedDate = new Date(date);
        if (!date || Number.isNaN(parsedDate.getTime())) {
            toast.error("Enter a valid calving date.");
            return false;
        }
        if (parsedDate.getTime() > Date.now()) {
            toast.error("Calving date cannot be in the future.");
            return false;
        }

        const normalizedCalves = calves.map((calf) => ({
            ...calf,
            sex: calf.sex?.trim(),
            earTag: calf.earTag?.trim(),
            color: calf.color?.trim(),
            brand: calf.brand?.trim(),
        }));

        if (numCalves !== normalizedCalves.length) {
            toast.error('The number of calves must match the entered calf rows.');
            return false;
        }

        if (isAbortion) return true;

        const incompleteIndex = normalizedCalves.findIndex((calf) =>
            calf.isLiving !== false
                ? !["F", "M"].includes(calf.sex) || !calf.earTag || !calf.color
                : calf.sex && !["F", "M"].includes(calf.sex),
        );

        if (incompleteIndex >= 0) {
            toast.error(isLiveBirth
                ? `Please complete sex, ear tag, and color for Calf #${incompleteIndex + 1}.`
                : `Please correct the sex for Stillborn Calf #${incompleteIndex + 1}.`);
            return false;
        }

        const livingCalves = normalizedCalves.filter((calf) => calf.isLiving !== false);
        if (outcome === 'mixed' && (livingCalves.length === 0 || livingCalves.length === normalizedCalves.length)) {
            toast.error('Mixed outcome requires at least one living and one stillborn calf.');
            return false;
        }
        const duplicateEarTag = livingCalves.find((calf, index) =>
            livingCalves.findIndex(
                (item) => item.earTag.toLowerCase() === calf.earTag.toLowerCase(),
            ) !== index,
        );

        if (duplicateEarTag) {
            toast.error(`Duplicate calf ear tag detected: ${duplicateEarTag.earTag}`);
            return false;
        }

        setCalves(normalizedCalves);
        return true;
    };

    const submitCalvingRecord = async () => {
        setSaving(true);
        try {
            const payload = {
                pregnancyId,
                animalId: motherId,
                date,
                calvingEase,
                outcome,
                numberOfCalves: numCalves,
                calves: calves.filter(c => c.isLiving !== false).map(c => ({
                    sex: c.sex,
                    earTag: c.earTag,
                    color: c.color,
                    brand: c.brand,
                    imageUrl: c.imageBase64 || ""
                })),
                nonLivingCalves: calves.filter(c => c.isLiving === false).map(c => ({
                    sex: c.sex, earTag: c.earTag, color: c.color, brand: c.brand,
                })),
                technicianNote: note,
                taskId: taskId || undefined,
            };

            await calvingMutation.mutateAsync(payload);
        } catch {
            // Handled by mutation callbacks.
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        if (saving || calvingMutation.isPending || !validateCalvingForm()) return;

        setConfirmSubmitVisible(true);
    };

    const filteredFarmers = farmers.filter(f => 
        f.name?.toLowerCase().includes(searchFarmerQuery.toLowerCase()) ||
        f.address?.phoneNumber?.includes(searchFarmerQuery)
    );

    const filteredAnimals = animals.filter(a => 
        a.earTag?.toLowerCase().includes(searchAnimalQuery.toLowerCase()) ||
        a.breed?.toLowerCase().includes(searchAnimalQuery.toLowerCase())
    );

    const aiDate = selectedPregnancy?.insemination?.inseminationDate;
    const diagnosisDate = selectedPregnancy?.pregnancyDiagnosis?.date;
    const expectedCalvingDate = selectedPregnancy?.targetCalvingDate || selectedAnimal?.expectedCalvingDate;
    const eventTiming = (() => {
        if (!expectedCalvingDate || !date) return 'Timing unavailable';
        const differenceDays = Math.round(
            (new Date(date).getTime() - new Date(expectedCalvingDate).getTime()) / 86400000,
        );
        if (differenceDays < -7) return `${Math.abs(differenceDays)} days early`;
        if (differenceDays > 7) return `${differenceDays} days overdue`;
        return 'Due window';
    })();
    const formatDate = (value: any) => value
        ? new Date(value).toLocaleDateString()
        : 'Not available';

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC] dark:bg-slate-950">
            {/* Header */}
            <View className="flex-row items-center px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm z-10">
                <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
                    <ArrowLeft size={20} color={isDark ? '#f8fafc' : '#1e2937'} />
                </TouchableOpacity>
                <View>
                    <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: colors.textPrimary }}>Record Calving / Offspring</Text>
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

                        <View className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-5 border border-emerald-100 dark:border-slate-700">
                            <Text className="text-slate-800 dark:text-white font-outfit-black text-sm">
                                Mother #{motherTag || selectedAnimal?.earTag || 'N/A'}
                            </Text>
                            <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs mt-1">
                                Breed: {selectedAnimal?.breed || 'Unknown'}
                            </Text>
                            <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs mt-3">AI date: {formatDate(aiDate)}</Text>
                            <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs mt-1">Diagnosis: {formatDate(diagnosisDate)}</Text>
                            <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs mt-1">Expected calving: {formatDate(expectedCalvingDate)}</Text>
                            <Text className="text-emerald-700 dark:text-emerald-400 font-outfit-bold text-xs mt-2">{eventTiming}</Text>
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
                                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Outcome</Text>
                                <View className="flex-row flex-wrap gap-2 mb-4">
                                    {[
                                        ['live_birth', 'Live Birth'], ['mixed', 'Mixed'],
                                        ['stillbirth', 'Stillbirth'], ['abortion', 'Abortion'],
                                    ].map(([value, label]) => (
                                        <TouchableOpacity key={value} onPress={() => handleOutcomeSelect(value)} className={`px-4 py-2.5 rounded-xl border ${outcome === value ? 'bg-emerald-600 border-emerald-600' : 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-slate-700'}`}>
                                            <Text className={`font-outfit-bold text-[11px] ${outcome === value ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'}`}>{label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {!isAbortion && <>
                                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Delivery Method</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {['Natural', 'Normal', 'Difficult', 'Cesarean'].map(opt => (
                                        <TouchableOpacity 
                                            key={opt}
                                            onPress={() => setCalvingEase(opt)}
                                            className={`px-4 py-2.5 rounded-xl border ${calvingEase === opt ? 'bg-emerald-600 border-emerald-600' : 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-slate-700'}`}
                                        >
                                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[11px] ${calvingEase === opt ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'}`}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                </>}
                            </View>

                            {!isAbortion && <View>
                                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Number of Calves</Text>
                                <View className="flex-row items-center gap-3">
                                    <TextInput 
                                        className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-white font-outfit-black shadow-sm flex-1"
                                        value={numCalvesInput}
                                        onChangeText={handleNumChange}
                                        onBlur={handleNumBlur}
                                        keyboardType="numeric"
                                        placeholder="1"
                                        placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                    />
                                    <Text className="text-slate-400 dark:text-slate-500 font-outfit-bold text-xs uppercase">Head</Text>
                                </View>
                            </View>}
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
                            <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">
                                {isAbortion ? 'Pregnancy Loss Details' : isLiveBirth ? 'Offspring Registry' : 'Stillborn Calf Details'}
                            </Text>
                            <View className="flex-row items-center gap-1.5">
                                <View className={`w-1.5 h-1.5 rounded-full ${isLiveBirth ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <Text className={`${isLiveBirth ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'} font-outfit-bold text-[9px] uppercase`}>
                                    {isLiveBirth ? 'Auto-Registering' : 'No livestock profile'}
                                </Text>
                            </View>
                        </View>

                        {isAbortion ? (
                            <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 p-5 rounded-3xl mb-8">
                                <Text className="text-amber-900 dark:text-amber-200 font-outfit-bold text-sm">
                                    No living calf record will be created. Add clinical observations in Technical Notes.
                                </Text>
                            </View>
                        ) : <View className="gap-y-4 mb-8">
                            {calves.map((calf, idx) => (
                                <View key={idx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-sm">
                                    <View className="flex-row items-center gap-2 mb-4">
                                        <View className="w-6 h-6 bg-emerald-500 rounded-full items-center justify-center">
                                            <Text className="text-white text-[10px] font-outfit-black">{idx + 1}</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-800 dark:text-white text-sm">
                                            {calf.isLiving !== false ? 'Living Calf Details' : 'Stillborn Calf Details'}
                                        </Text>
                                    </View>

                                    {outcome === 'mixed' && (
                                        <View className="flex-row gap-2 mb-4">
                                            {[[true, 'Living'], [false, 'Stillborn']].map(([value, label]) => (
                                                <TouchableOpacity key={String(value)} onPress={() => updateCalf(idx, 'isLiving', value as any)} className={`flex-1 py-2 rounded-xl items-center border ${calf.isLiving !== false === value ? 'bg-emerald-600 border-emerald-600' : 'border-slate-200 dark:border-slate-700'}`}>
                                                    <Text className={calf.isLiving !== false === value ? 'text-white font-outfit-bold' : 'text-slate-500 font-outfit-bold'}>{label as string}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    <View className="gap-y-4">
                                        <View>
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

                                        <View className="flex-row gap-3">
                                            <View className="flex-1">
                                                <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Color</Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    <View className="flex-row gap-2 pr-2">
                                                        {CALF_COLOR_OPTIONS.map((color) => (
                                                            <TouchableOpacity
                                                                key={color}
                                                                onPress={() => updateCalf(idx, 'color', color)}
                                                                className={`px-3 py-2 rounded-xl border ${
                                                                    calf.color === color
                                                                        ? 'bg-emerald-600 border-emerald-600'
                                                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                                                                }`}
                                                            >
                                                                <Text className={`font-outfit-black text-[10px] ${
                                                                    calf.color === color
                                                                        ? 'text-white'
                                                                        : 'text-slate-500 dark:text-slate-300'
                                                                }`}>
                                                                    {color}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </ScrollView>
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
                                            {calf.isLiving !== false && <View className="mt-2 ml-1">
                                                <EarTagGenerator
                                                    farmerName={farmerName}
                                                    animalCount={farmerAnimalCount + idx}
                                                    onGenerate={(tag) => updateCalf(idx, 'earTag', tag)}
                                                    isDark={isDark}
                                                />
                                            </View>}
                                        </View>

                                        {/* Calf Image Picker */}
                                        {calf.isLiving !== false && <View className="mt-2">
                                            <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Calf Image / Photo (Optional)</Text>
                                            {calf.imageUri ? (
                                                <View className="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm relative">
                                                    <Image source={{ uri: calf.imageUri }} className="w-full h-32" resizeMode="cover" />
                                                    <TouchableOpacity
                                                        onPress={() => removeCalfImage(idx)}
                                                        className="absolute top-2 right-2 p-2 bg-black/60 rounded-full"
                                                    >
                                                        <X size={14} color="white" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <View className="flex-row gap-2">
                                                    <TouchableOpacity
                                                        onPress={() => takeCalfPhoto(idx)}
                                                        className="flex-1 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex-row justify-center items-center gap-1.5 shadow-sm"
                                                    >
                                                        <Camera size={14} color={isDark ? '#34d399' : '#00643B'} />
                                                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-600 dark:text-slate-300 text-[10px]">Take Photo</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => pickCalfImage(idx)}
                                                        className="flex-1 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex-row justify-center items-center gap-1.5 shadow-sm"
                                                    >
                                                        <ImageIcon size={14} color={isDark ? '#34d399' : '#00643B'} />
                                                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-600 dark:text-slate-300 text-[10px]">Gallery</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>}
                                    </View>
                                </View>
                            ))}
                        </View>}

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
                            className={`py-5 rounded-[28px] flex-row justify-center items-center shadow-xl mb-20 ${saving || calvingMutation.isPending ? 'bg-slate-400' : 'bg-emerald-600'}`}
                            onPress={handleSave}
                            disabled={saving || calvingMutation.isPending}
                        >
                            {saving || calvingMutation.isPending ? <ActivityIndicator color="white" /> : (
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

            <ConfirmationModal
              visible={confirmSubmitVisible}
              onClose={() => setConfirmSubmitVisible(false)}
              onConfirm={submitCalvingRecord}
              title="Submit Calving Registry?"
              message={isLiveBirth
                ? `This will create ${numCalves} living offspring record${numCalves > 1 ? "s" : ""} for ${motherTag || "the selected mother"}.`
                : `This will record a ${calvingEase.toLowerCase()} without creating living livestock profiles for ${motherTag || "the selected mother"}.`}
              confirmText="Submit"
              cancelText="Review"
              isDestructive={false}
            />
        </SafeAreaView>
    );
}
