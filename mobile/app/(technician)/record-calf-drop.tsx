import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, FlatList, Image, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, Save, Info, X, Camera, Image as ImageIcon, Calendar } from 'lucide-react-native';
import DateTimePicker from "@react-native-community/datetimepicker";
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import EarTagGenerator from '@/components/EarTagGenerator';
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import {
    OfflineMutationLifecycleState,
    useOfflineMutation,
} from '@/hooks/useOfflineMutation';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { animalKeys, animalRecordKeys, breedingKeys, notificationKeys, technicianKeys } from '@/lib/queryKeys';
import { tasksQueryKeys } from '@/features/technician/hooks/useTechnicianTasks';
import { recordsQueryKeys } from '@/features/technician/hooks/useTechnicianRecords';
import { animalQueryKeys } from '@/features/technician/hooks/useTechnicianAnimal';
import { Skeleton } from "@/components/ui/Skeleton";
import { AppPageHeader } from '@/components/AppPageHeader';
import { ScreenLayout } from '@/components/ScreenLayout';
import { Button } from '@/components/ui/Button';
import {
    TechnicianAnimalSelector,
    TechnicianFarmerListItem,
    TechnicianFarmerSelector,
    TechnicianFormInfo,
    TechnicianFormSection,
    TechnicianPickerSearch,
    TechnicianPickerSheet,
} from '@/components/technician/TechnicianFormUI';
import { AnimalSummaryCard } from '@/features/farmer-ui/components/AnimalSummaryCard';

interface CalfEntry {
    sex: string;
    earTag: string;
    color: string;
    brand: string;
    imageUri?: string;
    imageBase64?: string;
    isLiving?: boolean;
    isCustomColor?: boolean;
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

const getCalendarDayDifference = (laterValue: string, earlierValue: string) => {
    const later = new Date(laterValue);
    const earlier = new Date(earlierValue);
    if (Number.isNaN(later.getTime()) || Number.isNaN(earlier.getTime())) return null;

    const laterDay = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
    const earlierDay = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
    return Math.floor((laterDay - earlierDay) / 86400000);
};

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
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [calvingEase, setCalvingEase] = useState('Natural');
    const [outcome, setOutcome] = useState<'live_birth' | 'mixed' | 'stillbirth' | 'abortion'>('live_birth');
    const [calves, setCalves] = useState<CalfEntry[]>([
        { sex: 'F', earTag: '', color: '', brand: '' }
    ]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [submissionState, setSubmissionState] =
        useState<OfflineMutationLifecycleState>('idle');
    const submitLockRef = useRef(false);
    const [confirmSubmitVisible, setConfirmSubmitVisible] = useState(false);
    const calvingMutation = useOfflineMutation(
        {
            url: '/technician/record-calving',
            method: 'POST',
            description: `Technician calving record for ${motherTag || 'mother animal'}`,
            reconcileOnTimeout: true,
        },
        {
            onLifecycleStateChange: setSubmissionState,
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
                submitLockRef.current = false;
                setSubmissionState('idle');
                console.error(err);
                toast.error(err.response?.data?.message || "Failed to record calving event");
            },
        },
    );

    const [farmerName, setFarmerName] = useState('');
    const [farmerAnimalCount, setFarmerAnimalCount] = useState(0);
    const [loadingDetails, setLoadingDetails] = useState(!!initialMotherId);

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
                setLoadingDetails(true);
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
                } finally {
                    setLoadingDetails(false);
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

    const addCalf = () => {
        if (calves.length >= 5) {
            return toast.error("Maximum 5 calves per event");
        }
        setCalves([...calves, { sex: 'F', earTag: '', color: '', brand: '', isLiving: outcome !== 'stillbirth' }]);
    };

    const removeCalf = (index: number) => {
        if (calves.length === 1) return;
        const newCalves = [...calves];
        newCalves.splice(index, 1);
        setCalves(newCalves);
    };

    const isLiveBirth = outcome === 'live_birth';
    const isAbortion = outcome === 'abortion';
    const handleOutcomeSelect = (value: string) => {
        const nextOutcome = value as typeof outcome;
        setOutcome(nextOutcome);
        if (nextOutcome === 'abortion') {
            setCalves([]);
        } else if (calves.length === 0) {
            setCalves([{ sex: 'F', earTag: '', color: '', brand: '', isLiving: nextOutcome !== 'stillbirth' }]);
        } else {
            setCalves(calves.map((calf, index) => ({
                ...calf,
                isLiving: nextOutcome === 'live_birth' ? true : nextOutcome === 'stillbirth' ? false : index === 0,
            })));
        }
    };

    const updateCalf = (index: number, field: keyof CalfEntry, value: any) => {
        const newCalves = [...calves];
        (newCalves[index] as any)[field] = value;
        setCalves(newCalves);
    };

    const handleSelectCalfPhoto = async (index: number, source: "camera" | "library") => {
        const result = await pickImageFromSource(source, { aspect: [4, 3] });
        if (result) {
            const newCalves = [...calves];
            newCalves[index].imageUri = result.uri;
            newCalves[index].imageBase64 = result.base64;
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

        if (outcome !== 'abortion') {
            const readiness = selectedPregnancy?.calvingReadiness;
            const aiDateValue = selectedPregnancy?.insemination?.inseminationDate;
            const gestationDays = aiDateValue
                ? getCalendarDayDifference(date, aiDateValue)
                : null;
            if (typeof readiness?.minimumDays !== 'number' || gestationDays === null) {
                toast.error('Calving readiness is unavailable. Refresh the selected animal before continuing.');
                return false;
            }
            if (gestationDays < readiness.minimumDays) {
                const availableDate = readiness.earliestEligibleDate
                    ? new Date(readiness.earliestEligibleDate).toLocaleDateString()
                    : `Day ${readiness.minimumDays}`;
                toast.error(`Live-birth recording is too early at Day ${gestationDays}. It becomes available ${availableDate}.`);
                return false;
            }
        }

        const normalizedCalves = calves.map((calf) => ({
            ...calf,
            sex: calf.sex?.trim(),
            earTag: calf.earTag?.trim(),
            color: calf.color?.trim(),
            brand: calf.brand?.trim(),
        }));

        if (outcome !== 'abortion' && calves.length !== normalizedCalves.length) {
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
        if (submitLockRef.current) return;
        submitLockRef.current = true;
        setSaving(true);
        try {
            const payload = {
                pregnancyId,
                animalId: motherId,
                date,
                calvingEase,
                outcome,
                numberOfCalves: isAbortion ? 0 : calves.length,
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
        if (submitLockRef.current || saving || calvingMutation.isPending || !validateCalvingForm()) return;

        setConfirmSubmitVisible(true);
    };

    const submissionLocked =
        submitLockRef.current ||
        saving ||
        calvingMutation.isPending ||
        ['submitting', 'reconciling', 'replaying', 'queued'].includes(submissionState);
    const submissionStatusMessage = submissionState === 'queued'
        ? 'Submission saved safely and queued. It will continue with the same operation ID.'
        : ['reconciling', 'replaying'].includes(submissionState)
            ? 'Checking submission status…'
            : submissionState === 'submitting'
                ? 'Submitting calving record…'
                : null;

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
    const calvingReadiness = selectedPregnancy?.calvingReadiness;
    const selectedGestationDays = aiDate && date
        ? getCalendarDayDifference(date, aiDate)
        : null;
    const minimumGestationDays = typeof calvingReadiness?.minimumDays === 'number'
        ? calvingReadiness.minimumDays
        : null;
    const isLiveOutcomeTooEarly = outcome !== 'abortion' && (
        minimumGestationDays === null ||
        selectedGestationDays === null ||
        selectedGestationDays < minimumGestationDays
    );
    const earliestCalvingDate = calvingReadiness?.earliestEligibleDate;
    const calvingReadinessMessage = minimumGestationDays === null || selectedGestationDays === null
        ? 'Authoritative calving readiness is unavailable. Refresh the selected animal before recording a live-birth outcome.'
        : selectedGestationDays < minimumGestationDays
            ? `Selected date is Day ${selectedGestationDays}. Live-birth, mixed, and stillbirth records open on Day ${minimumGestationDays}${earliestCalvingDate ? ` (${new Date(earliestCalvingDate).toLocaleDateString()})` : ''}. Select Abortion only for a confirmed pregnancy loss.`
            : `Calving window is open at Day ${selectedGestationDays}.`;
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

    if (loadingDetails) {
        return <RecordCalfDropSkeleton onBack={() => router.back()} />;
    }

    return (
        <ScreenLayout edges={[]}>
            <AppPageHeader
                title="Record Calving / Offspring"
                onBack={() => router.back()}
                rightAction={motherTag ? (
                    <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                        Mother #{motherTag}
                    </Text>
                ) : undefined}
            />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 14 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >

                {/* Standalone Selection Flow */}
                {!initialMotherId && (
                    <>
                        {/* Farmer Selection */}
                        <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">Owner / Client</Text>
                        <View className="mb-6">
                            <TechnicianFarmerSelector
                                farmer={selectedFarmer}
                                secondaryText={selectedFarmer
                                    ? [selectedFarmer.address?.barangay, selectedFarmer.address?.city]
                                        .filter(Boolean)
                                        .join(', ') || selectedFarmer.phoneNumber
                                    : undefined}
                                onPress={() => setShowFarmerModal(true)}
                            />
                        </View>

                        {/* Mother selection */}
                        {selectedFarmer && (
                            <>
                                <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">Pregnant Mother (Cattle)</Text>
                                <View className="mb-6">
                                    <TechnicianAnimalSelector
                                        animal={selectedAnimal}
                                        placeholder="Select pregnant cow"
                                        onPress={() => setShowAnimalModal(true)}
                                    />
                                </View>
                            </>
                        )}
                    </>
                )}

                {/* Event Basics Card */}
                {motherId && pregnancyId ? (
                    <TechnicianFormSection
                        title="Calving Details"
                        description="Record the delivery, outcome, and offspring count for this pregnancy."
                    >

                        <View className="bg-slate-50 dark:bg-slate-800 rounded-[14px] p-4 mb-5 border border-slate-200 dark:border-slate-700">
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

                        {isLiveOutcomeTooEarly ? (
                            <View
                                accessibilityRole="alert"
                                style={{
                                    flexDirection: 'row',
                                    gap: 10,
                                    padding: 12,
                                    marginBottom: 16,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.warningBorder,
                                    backgroundColor: colors.warningContainer,
                                }}
                            >
                                <AlertTriangle size={18} color={colors.warningForeground} />
                                <View style={{ flex: 1, gap: 3 }}>
                                    <Text
                                        style={{
                                            color: colors.warningForeground,
                                            fontFamily: 'Outfit_700Bold',
                                            fontSize: 13,
                                        }}
                                    >
                                        Live-birth window not open
                                    </Text>
                                    <Text
                                        style={{
                                            color: colors.textSecondary,
                                            fontFamily: 'Outfit_400Regular',
                                            fontSize: 12,
                                            lineHeight: 18,
                                        }}
                                    >
                                        {calvingReadinessMessage}
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        <View className="gap-y-4">
                            <View>
                                <Text className="text-slate-600 dark:text-slate-300 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Calving Date</Text>
                                <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-outfit-medium mb-2 ml-1">Date the calf was born or the calving occurred.</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setTempDate(date ? new Date(`${date}T00:00:00`) : new Date());
                                        setShowDatePicker(true);
                                    }}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[14px] px-4 py-3.5 flex-row items-center"
                                >
                                    <Calendar size={18} color={colors.primary} />
                                    <Text className="ml-3 flex-1 text-slate-800 dark:text-white font-outfit-medium text-[13px]">
                                        {date
                                            ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : "Select date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View>
                                <Text className="text-slate-600 dark:text-slate-300 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Outcome</Text>
                                <View className="flex-row flex-wrap gap-2 mb-4">
                                    {[
                                        ['live_birth', 'Live Birth'], ['mixed', 'Mixed'],
                                        ['stillbirth', 'Stillbirth'], ['abortion', 'Abortion'],
                                    ].map(([value, label]) => (
                                        <TouchableOpacity key={value} onPress={() => handleOutcomeSelect(value)} className={`px-4 py-2.5 rounded-xl border ${outcome === value ? 'bg-emerald-600 border-emerald-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
                                            <Text className={`font-outfit-bold text-[11px] ${outcome === value ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {!isAbortion && <>
                                <Text className="text-slate-600 dark:text-slate-300 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Delivery Method</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {['Natural', 'Normal', 'Difficult', 'Cesarean'].map(opt => (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => setCalvingEase(opt)}
                                            className={`px-4 py-2.5 rounded-xl border ${calvingEase === opt ? 'bg-emerald-600 border-emerald-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                                        >
                                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[11px] ${calvingEase === opt ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                </>}
                            </View>

                            {!isAbortion && <View>
                                <Text className="text-slate-600 dark:text-slate-300 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Number of calves born</Text>
                                <View className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex-row items-center justify-between">
                                    <Text className="text-slate-700 dark:text-slate-300 font-outfit-bold">{calves.length} {calves.length === 1 ? 'Calf' : 'Calves'}</Text>
                                    <Text className="text-slate-400 font-outfit-medium text-[10px] uppercase">Determined by entries below</Text>
                                </View>
                            </View>}
                        </View>
                    </TechnicianFormSection>
                ) : (
                    !initialMotherId && (
                        <TechnicianFormInfo icon={<Info size={18} color={colors.primary} />}>
                            Select a farmer and a pregnant cow to unlock calving entry details.
                        </TechnicianFormInfo>
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
                                <View key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-6 relative shadow-sm">
                                    <View className="absolute -top-3 -left-2 w-8 h-8 rounded-full bg-emerald-500 items-center justify-center shadow-md z-10">
                                        <Text className="text-white text-[10px] font-outfit-black">{idx + 1}</Text>
                                    </View>
                                    <View className="flex-row items-center justify-between mb-4 mt-2">
                                        <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-slate-800 dark:text-white text-sm">
                                            {calf.isLiving !== false ? 'Living Calf Details' : 'Stillborn Calf Details'}
                                        </Text>
                                        {calves.length > 1 && (
                                            <TouchableOpacity onPress={() => removeCalf(idx)} className="w-8 h-8 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/20">
                                                <X size={16} color={colors.error || '#e11d48'} />
                                            </TouchableOpacity>
                                        )}
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

                                    <View className="gap-5">
                                        <View>
                                            <Text className="text-[9px] font-outfit-black uppercase tracking-widest mb-2 ml-1 text-slate-500 dark:text-slate-400">Gender / Sex</Text>
                                            <View className="flex-row gap-2">
                                                <TouchableOpacity
                                                    onPress={() => updateCalf(idx, 'sex', 'F')}
                                                    className={`flex-1 py-3 rounded-xl items-center border ${calf.sex === 'F' ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent'}`}
                                                >
                                                    <Text className={`text-[10px] font-outfit-black ${calf.sex === 'F' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>Female</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => updateCalf(idx, 'sex', 'M')}
                                                    className={`flex-1 py-3 rounded-xl items-center border ${calf.sex === 'M' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500' : 'bg-slate-50 dark:bg-slate-800 border-transparent'}`}
                                                >
                                                    <Text className={`text-[10px] font-outfit-black ${calf.sex === 'M' ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>Male</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View>
                                            <Text className="text-[9px] font-outfit-black uppercase tracking-widest mb-2 ml-1 text-slate-500 dark:text-slate-400">Calf Color</Text>
                                            <View className="flex-row flex-wrap gap-2 mb-2">
                                                {CALF_COLOR_OPTIONS.map((color) => (
                                                    <TouchableOpacity
                                                        key={color}
                                                        onPress={() => {
                                                            updateCalf(idx, 'color', color);
                                                            updateCalf(idx, 'isCustomColor', false);
                                                        }}
                                                        className={`px-3 py-2 rounded-xl border ${
                                                            calf.color === color && !calf.isCustomColor
                                                                ? 'bg-emerald-600 border-transparent'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <Text className={`font-outfit-black text-[10px] ${
                                                            calf.color === color && !calf.isCustomColor
                                                                ? 'text-white'
                                                                : 'text-slate-500 dark:text-slate-400'
                                                        }`}>
                                                            {color}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        updateCalf(idx, 'isCustomColor', true);
                                                        if (CALF_COLOR_OPTIONS.includes(calf.color)) {
                                                            updateCalf(idx, 'color', '');
                                                        }
                                                    }}
                                                    className={`px-3 py-2 rounded-xl border ${
                                                        calf.isCustomColor
                                                            ? 'bg-emerald-600 border-transparent'
                                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <Text className={`font-outfit-black text-[10px] ${
                                                        calf.isCustomColor ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                        Other
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                            {calf.isCustomColor && (
                                                <View className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex-row items-center">
                                                    <TextInput
                                                        className="text-slate-800 dark:text-white font-outfit-medium text-[13px] flex-1"
                                                        value={calf.color}
                                                        onChangeText={(v) => updateCalf(idx, 'color', v)}
                                                        placeholder="Describe color..."
                                                        placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                    />
                                                </View>
                                            )}
                                        </View>

                                        <View className="flex-row gap-4">
                                            <View className="flex-1">
                                                <Text className="text-[9px] font-outfit-black uppercase tracking-widest mb-2 ml-1 text-slate-500 dark:text-slate-400">Ear Tag / ID No.</Text>
                                                <View className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex-row items-center">
                                                    <TextInput
                                                        className="text-slate-800 dark:text-white font-outfit-black text-[13px] uppercase flex-1"
                                                        placeholder="CALF-XXXX"
                                                        placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                        value={calf.earTag}
                                                        onChangeText={(v) => updateCalf(idx, 'earTag', v)}
                                                    />
                                                </View>
                                                {calf.isLiving !== false && <View className="mt-2 ml-1">
                                                    <EarTagGenerator
                                                        farmerName={farmerName}
                                                        animalCount={farmerAnimalCount + idx}
                                                        onGenerate={(tag) => updateCalf(idx, 'earTag', tag)}
                                                        isDark={isDark}
                                                    />
                                                </View>}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-[9px] font-outfit-black uppercase tracking-widest mb-2 ml-1 text-slate-500 dark:text-slate-400">Brand Mark</Text>
                                                <View className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex-row items-center">
                                                    <TextInput
                                                        className="text-slate-800 dark:text-white font-outfit-bold text-[13px] flex-1"
                                                        placeholder="Optional"
                                                        placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                        value={calf.brand}
                                                        onChangeText={(v) => updateCalf(idx, 'brand', v)}
                                                    />
                                                </View>
                                            </View>
                                        </View>

                                        {/* Calf Image Picker */}
                                        {calf.isLiving !== false && <View className="mt-2">
                                            <Text className="text-slate-500 dark:text-slate-400 text-[9px] font-outfit-bold mb-1.5 ml-1 uppercase">Calf Image / Photo (Optional)</Text>
                                            {calf.imageUri ? (
                                                <View
                                                    style={{
                                                        borderRadius: 12,
                                                        overflow: "hidden",
                                                        borderWidth: 1,
                                                        borderColor: isDark ? "#334155" : "#f1f5f9",
                                                        position: "relative",
                                                    }}
                                                >
                                                    <Image
                                                        source={{ uri: calf.imageUri }}
                                                        style={{ width: "100%", height: 128 }}
                                                        resizeMode="cover"
                                                    />
                                                    <TouchableOpacity
                                                        onPress={() => removeCalfImage(idx)}
                                                        style={{
                                                            position: "absolute",
                                                            top: 8,
                                                            right: 8,
                                                            padding: 8,
                                                            backgroundColor: "rgba(0,0,0,0.6)",
                                                            borderRadius: 999,
                                                        }}
                                                    >
                                                        <X size={14} color="white" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <View className="flex-row gap-2">
                                                    <TouchableOpacity
                                                        onPress={() => handleSelectCalfPhoto(idx, "camera")}
                                                        className="flex-1 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex-row justify-center items-center gap-1.5 shadow-sm"
                                                    >
                                                        <Camera size={14} color={isDark ? '#34d399' : '#00643B'} />
                                                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-600 dark:text-slate-300 text-[10px]">Take Photo</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleSelectCalfPhoto(idx, "library")}
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
                            {calves.length < 5 && (
                                <TouchableOpacity
                                    onPress={addCalf}
                                    className="bg-white dark:bg-slate-900 border-2 border-dashed border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 items-center justify-center flex-row gap-2"
                                >
                                    <View className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 items-center justify-center">
                                        <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-black text-lg">+</Text>
                                    </View>
                                    <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-bold text-sm">Add Another Calf</Text>
                                </TouchableOpacity>
                            )}
                        </View>}

                        <TechnicianFormSection title="Technical Notes">
                            <TextInput
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[14px] px-4 py-3.5 h-32 text-slate-800 dark:text-white font-outfit-medium"
                                multiline
                                textAlignVertical="top"
                                placeholder="Observations, complications, etc..."
                                placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                value={note}
                                onChangeText={setNote}
                            />
                        </TechnicianFormSection>

                        {submissionStatusMessage ? (
                            <View
                                className="mb-3 rounded-2xl border px-4 py-3"
                                style={{ backgroundColor: isDark ? colors.background : '#eff6ff', borderColor: colors.border }}
                            >
                                <Text
                                    className="text-center text-xs font-outfit-bold"
                                    style={{ color: colors.textPrimary }}
                                >
                                    {submissionStatusMessage}
                                </Text>
                            </View>
                        ) : null}

                        <Button
                            size="lg"
                            className="mb-4"
                            onPress={handleSave}
                            loading={submissionLocked}
                            disabled={submissionLocked || isLiveOutcomeTooEarly}
                        >
                            <Save size={19} color="white" style={{ marginRight: 9 }} />
                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white text-sm">Submit Calving Registry</Text>
                        </Button>
                    </>
                )}
            </ScrollView>

            {/* FARMER SELECTION MODAL */}
            <TechnicianPickerSheet
              visible={showFarmerModal}
              title="Select Farmer"
              subtitle="Choose the owner of the pregnant cow"
              onClose={() => setShowFarmerModal(false)}
            >
              <TechnicianPickerSearch
                value={searchFarmerQuery}
                onChangeText={setSearchFarmerQuery}
                placeholder="Search name or phone"
              />
              <FlatList
                data={filteredFarmers}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: 'Outfit_500Medium',
                      fontSize: 13,
                      textAlign: 'center',
                      paddingVertical: 40,
                    }}
                  >
                    No farmers match this search.
                  </Text>
                }
                renderItem={({ item }) => (
                  <TechnicianFarmerListItem
                    farmer={item}
                    selected={selectedFarmer?._id === item._id}
                    secondaryText={`${
                      [item.address?.barangay, item.address?.city]
                        .filter(Boolean)
                        .join(', ') || 'No address provided'
                    } · ${item.phoneNumber || item.address?.phoneNumber || 'No phone'}`}
                    onPress={() => handleFarmerSelect(item)}
                  />
                )}
              />
            </TechnicianPickerSheet>

            {/* ANIMAL SELECTION MODAL */}
            <TechnicianPickerSheet
              visible={showAnimalModal}
              title="Select Pregnant Cow"
              subtitle="Active confirmed pregnancies; timing is checked after selection"
              onClose={() => setShowAnimalModal(false)}
            >
              <TechnicianPickerSearch
                value={searchAnimalQuery}
                onChangeText={setSearchAnimalQuery}
                placeholder="Search ear tag or breed"
              />
              <FlatList
                data={filteredAnimals}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: 'Outfit_500Medium',
                      fontSize: 13,
                      textAlign: 'center',
                      paddingVertical: 40,
                    }}
                  >
                    No pregnant cows found for this farmer.
                  </Text>
                }
                renderItem={({ item }) => (
                  <AnimalSummaryCard
                    animal={item}
                    onPress={() => handleAnimalSelect(item)}
                    alert={selectedAnimal?._id === item._id ? 'Currently selected' : undefined}
                  />
                )}
              />
            </TechnicianPickerSheet>

            <ConfirmationModal
              visible={confirmSubmitVisible}
              onClose={() => setConfirmSubmitVisible(false)}
              onConfirm={submitCalvingRecord}
              title="Submit Calving Registry?"
              message={isLiveBirth
                ? `This will create ${calves.length} living offspring record${calves.length > 1 ? "s" : ""} for ${motherTag || "the selected mother"}.`
                : `This will record a ${calvingEase.toLowerCase()} without creating living livestock profiles for ${motherTag || "the selected mother"}.`}
              confirmText="Submit"
              cancelText="Review"
              isDestructive={false}
            />
        </ScreenLayout>
    );
}

function RecordCalfDropSkeleton({ onBack }: { onBack: () => void }) {
    const { isDark } = useTheme();

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC] dark:bg-slate-950">
            <View className="flex-row items-center px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm z-10">
                <TouchableOpacity onPress={onBack} className="mr-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
                    <ArrowLeft size={20} color={isDark ? '#f8fafc' : '#1e2937'} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Skeleton width="60%" height={20} radius={6} />
                    <Skeleton width="35%" height={12} radius={4} style={{ marginTop: 6 }} />
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
                <View className="bg-emerald-50/50 dark:bg-emerald-900/10 p-6 rounded-[32px] mb-8 border border-emerald-100 dark:border-emerald-800/50">
                    <Skeleton width="40%" height={16} radius={6} style={{ marginBottom: 16 }} />
                    <View className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-5 border border-emerald-100 dark:border-slate-700">
                        <Skeleton width="50%" height={16} radius={4} />
                        <Skeleton width="35%" height={12} radius={4} style={{ marginTop: 8 }} />
                        <Skeleton width="70%" height={12} radius={4} style={{ marginTop: 12 }} />
                        <Skeleton width="65%" height={12} radius={4} style={{ marginTop: 6 }} />
                        <Skeleton width="75%" height={12} radius={4} style={{ marginTop: 6 }} />
                    </View>
                    <Skeleton width="30%" height={12} radius={4} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={48} radius={16} style={{ marginBottom: 16 }} />
                    <Skeleton width="30%" height={12} radius={4} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={48} radius={16} />
                </View>

                <View className="bg-white dark:bg-slate-900 p-6 rounded-[32px] mb-8 border border-slate-100 dark:border-slate-800">
                    <Skeleton width="50%" height={18} radius={6} style={{ marginBottom: 16 }} />
                    <Skeleton width="100%" height={140} radius={20} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
