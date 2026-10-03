import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, FlatList, Image, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, Save, Info, X, Camera, Image as ImageIcon, Calendar, CheckCircle2, Sparkles } from 'lucide-react-native';
import DateTimePicker from "@react-native-community/datetimepicker";
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import EarTagGenerator from '@/components/EarTagGenerator';
import { getEarTagValidationError } from '@/components/earTagSuggestion';
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
import {
    calculateEarliestLiveDeliveryDate,
    differenceInManilaCalendarDays,
    omitInapplicableCalvingEase,
    validateCalvingOutcomeVitality,
} from '@/features/breeding/utils/calvingUiSemantics';


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
    return differenceInManilaCalendarDays(laterValue, earlierValue);
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
                    const queriesToInvalidate: any[] = [
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
                    ];
                    if (taskId) {
                        queriesToInvalidate.push(tasksQueryKeys.details(taskId));
                    }
                    queriesToInvalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
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
    const [farmerEarTags, setFarmerEarTags] = useState<string[]>([]);
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
                        setFarmerEarTags(list.map((animal: any) => animal.earTag).filter(Boolean));
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
            setFarmerEarTags(list.map((animal: any) => animal.earTag).filter(Boolean));

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
    const isMixedInvalid =
        outcome === 'mixed' &&
        (calves.filter((c) => c.isLiving !== false).length < 1 ||
            calves.filter((c) => c.isLiving === false).length < 1);

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

    const aiDate = selectedPregnancy?.insemination?.inseminationDate;
    const diagnosisDate = selectedPregnancy?.pregnancyDiagnosis?.date;
    const expectedCalvingDate = selectedPregnancy?.targetCalvingDate || selectedAnimal?.expectedCalvingDate;
    const calvingReadiness = selectedPregnancy?.calvingReadiness;
    const selectedGestationDays = aiDate && date
        ? getCalendarDayDifference(date, aiDate)
        : (typeof calvingReadiness?.gestationDays === 'number' ? calvingReadiness.gestationDays : null);
    const minimumGestationDays = typeof calvingReadiness?.minimumDays === 'number'
        ? calvingReadiness.minimumDays
        : null;
    const averageGestationDays = typeof calvingReadiness?.averageGestationDays === 'number'
        ? calvingReadiness.averageGestationDays
        : null;
    const isDeliveryEligible = Boolean(
        minimumGestationDays !== null &&
        selectedGestationDays !== null &&
        selectedGestationDays >= minimumGestationDays
    );
    const daysRemaining = minimumGestationDays !== null && selectedGestationDays !== null
        ? Math.max(0, minimumGestationDays - selectedGestationDays)
        : (calvingReadiness?.daysRemaining ?? null);
    const earliestCalvingDate = calvingReadiness?.earliestEligibleDate;
    const earliestLiveDeliveryDateFormatted = (() => {
        const d = earliestCalvingDate
            ? new Date(earliestCalvingDate)
            : calculateEarliestLiveDeliveryDate(aiDate, minimumGestationDays);
        if (!d || Number.isNaN(d.getTime())) return null;
        return d.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    })();

    const expectedCalvingDateFormatted = (() => {
        const dateVal = calvingReadiness?.expectedCalvingDate || expectedCalvingDate;
        if (!dateVal) return null;
        const d = new Date(dateVal);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "Asia/Manila",
        });
    })();

    const initialOutcomeSetRef = useRef(false);

    useEffect(() => {
        if (!selectedPregnancy || initialOutcomeSetRef.current) return;
        if (minimumGestationDays !== null && selectedGestationDays !== null) {
            if (selectedGestationDays < minimumGestationDays) {
                setOutcome('abortion');
                setCalves([]);
            }
            initialOutcomeSetRef.current = true;
        }
    }, [selectedPregnancy, minimumGestationDays, selectedGestationDays]);

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

        const aiDateValue = selectedPregnancy?.insemination?.inseminationDate;
        if (aiDateValue && new Date(date).getTime() < new Date(aiDateValue).getTime()) {
            toast.error("Event date cannot be before the artificial insemination date.");
            return false;
        }
        const diagnosisDateValue = selectedPregnancy?.pregnancyDiagnosis?.date;
        if (diagnosisDateValue && new Date(date).getTime() < new Date(diagnosisDateValue).getTime()) {
            toast.error("Event date cannot be before the pregnancy diagnosis date.");
            return false;
        }

        if (outcome !== 'abortion') {
            const readiness = selectedPregnancy?.calvingReadiness;
            const gestationDays = aiDateValue
                ? getCalendarDayDifference(date, aiDateValue)
                : null;
            if (typeof readiness?.minimumDays !== 'number' || gestationDays === null) {
                toast.error('Calving readiness is unavailable. Refresh the selected animal before continuing.');
                return false;
            }
            if (gestationDays < readiness.minimumDays) {
                const availableDate = earliestLiveDeliveryDateFormatted || (readiness.earliestEligibleDate
                    ? new Date(readiness.earliestEligibleDate).toLocaleDateString()
                    : `Day ${readiness.minimumDays}`);
                toast.error(`Delivery recording is available from Day ${readiness.minimumDays} (${availableDate}). Currently at Day ${gestationDays}.`);
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

        const vitalityValidation = validateCalvingOutcomeVitality({
            outcome,
            calves: normalizedCalves,
        });
        if (!vitalityValidation.isValid && vitalityValidation.error) {
            toast.error(vitalityValidation.error);
            return false;
        }

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

        const overlongIndex = normalizedCalves.findIndex(
            (calf) => calf.isLiving !== false && Boolean(getEarTagValidationError(calf.earTag)),
        );
        if (overlongIndex >= 0) {
            toast.error(`Calf #${overlongIndex + 1}: ${getEarTagValidationError(normalizedCalves[overlongIndex].earTag)}`);
            return false;
        }

        const livingCalves = normalizedCalves.filter((calf) => calf.isLiving !== false);
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
            const payload = omitInapplicableCalvingEase({
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
            });

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

    const isLiveOutcomeTooEarly = outcome !== 'abortion' && !isDeliveryEligible;
    const calvingReadinessMessage = minimumGestationDays === null || selectedGestationDays === null
        ? 'Authoritative calving readiness is unavailable. Refresh the selected animal before recording a live-birth outcome.'
        : selectedGestationDays < minimumGestationDays
            ? `Selected date is Day ${selectedGestationDays}. Live-birth, mixed, and stillbirth records open on Day ${minimumGestationDays}${earliestLiveDeliveryDateFormatted ? ` (${earliestLiveDeliveryDateFormatted})` : ''}. Select Abortion only for a confirmed pregnancy loss.`
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
        return <RecordCalfDropSkeleton onBack={() => router.back()} motherTag={motherTag} />;
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

                {/* Informative Top Banner */}
                <TechnicianFormInfo icon={<Sparkles size={18} color={colors.primary} />}>
                    Record the birth or outcome of this pregnancy and register any newborn calves.
                </TechnicianFormInfo>

                {/* Standalone Selection Flow */}
                {!initialMotherId && (
                    <TechnicianFormSection
                        title="Owner and Pregnant Cow"
                        description="Select the owner and the confirmed pregnant cow."
                    >
                        {/* Farmer Selection */}
                        <Text className="font-outfit-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider mb-2 ml-1">Owner / Client</Text>
                        <View className="mb-4">
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
                                <Text className="font-outfit-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider mb-2 ml-1">Pregnant Mother (Cattle)</Text>
                                <View className="mb-2">
                                    <TechnicianAnimalSelector
                                        animal={selectedAnimal}
                                        placeholder="Select pregnant cow"
                                        onPress={() => setShowAnimalModal(true)}
                                    />
                                </View>
                            </>
                        )}
                    </TechnicianFormSection>
                )}

                {(!motherId || !pregnancyId) && !initialMotherId && (
                    <TechnicianFormInfo icon={<Info size={18} color={colors.primary} />}>
                        Select a farmer and a pregnant cow to unlock calving entry details.
                    </TechnicianFormInfo>
                )}

                {/* Event Basics & Calving Details */}
                {motherId && pregnancyId && (
                    <>
                        {/* Confirmed Pregnancy Reference Card */}
                        <View className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 mb-4">
                            {/* Top Row: Animal Tag, Breed & Owner */}
                            <View className="flex-row items-start justify-between pb-3 border-b border-blue-100/70 dark:border-blue-900/30">
                                <View className="flex-1 mr-2">
                                    <Text className="text-slate-900 dark:text-white font-outfit-bold text-base">
                                        Mother #{motherTag || selectedAnimal?.earTag || 'N/A'}
                                    </Text>
                                    <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs mt-0.5">
                                        Breed: {selectedAnimal?.breed || 'Unknown'}
                                    </Text>
                                </View>
                                {(farmerName || selectedFarmer?.name) && (
                                    <View className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-blue-200/60 dark:border-blue-800/40">
                                        <Text className="text-slate-600 dark:text-slate-300 font-outfit-medium text-xs">
                                            {farmerName || selectedFarmer?.name}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Timing & Dates Grid */}
                            <View className="mt-3 gap-y-1.5">
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs">
                                        Last Insemination
                                    </Text>
                                    <Text className="text-slate-800 dark:text-slate-200 font-outfit-semibold text-xs">
                                        {formatDate(aiDate)}
                                    </Text>
                                </View>
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs">
                                        Diagnosis
                                    </Text>
                                    <Text className="text-slate-800 dark:text-slate-200 font-outfit-semibold text-xs">
                                        {formatDate(diagnosisDate)}
                                    </Text>
                                </View>
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs">
                                        Expected calving:
                                    </Text>
                                    <Text className="text-slate-800 dark:text-slate-200 font-outfit-semibold text-xs">
                                        {expectedCalvingDateFormatted || formatDate(expectedCalvingDate)}
                                    </Text>
                                </View>
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-xs">
                                        Gestation Progress
                                    </Text>
                                    <Text className="text-slate-800 dark:text-slate-200 font-outfit-bold text-xs">
                                        Day {selectedGestationDays !== null ? selectedGestationDays : 'N/A'}{averageGestationDays ? ` of ~${averageGestationDays}` : ''}
                                    </Text>
                                </View>
                            </View>

                            {/* Readiness Status Badges */}
                            {isDeliveryEligible ? (
                                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-blue-100/70 dark:border-blue-900/30">
                                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40">
                                        <CheckCircle2 size={13} color={isDark ? '#34d399' : '#059669'} />
                                        <Text className="text-emerald-800 dark:text-emerald-300 font-outfit-bold text-xs">
                                            Delivery recording is available
                                        </Text>
                                    </View>
                                    <Text className="text-emerald-700 dark:text-emerald-400 font-outfit-semibold text-xs">
                                        {eventTiming}
                                    </Text>
                                </View>
                            ) : (
                                <View className="mt-3 pt-3 border-t border-blue-100/70 dark:border-blue-900/30">
                                    <View className="flex-row items-start gap-2 px-2.5 py-1.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40">
                                        <AlertTriangle size={14} color={isDark ? '#fbbf24' : '#d97706'} style={{ marginTop: 1 }} />
                                        <View className="flex-1">
                                            <Text className="text-amber-800 dark:text-amber-300 font-outfit-bold text-xs">
                                                Delivery recording available from Day {minimumGestationDays}
                                                {daysRemaining !== null ? ` · ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining` : ''}
                                            </Text>
                                            {earliestLiveDeliveryDateFormatted && (
                                                <Text className="text-amber-700 dark:text-amber-400 font-outfit-regular text-xs mt-0.5">
                                                    Available from: {earliestLiveDeliveryDateFormatted}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Readiness Warning (Gating Alert) */}
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
                                            color: colors.warningForeground,
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

                        {/* Retained policy diagnostics are intentionally not rendered in the standard field form. */}
                        {false && selectedPregnancy && selectedGestationDays !== null && minimumGestationDays !== null && averageGestationDays !== null ? (
                            <View
                                style={{
                                    padding: 14,
                                    marginBottom: 16,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: isDeliveryEligible
                                        ? (isDark ? '#065f46' : '#bbf7d0')
                                        : (isDark ? 'rgba(245, 158, 11, 0.3)' : '#fed7aa'),
                                    backgroundColor: isDeliveryEligible
                                        ? (isDark ? 'rgba(6, 78, 59, 0.2)' : '#f0fdf4')
                                        : (isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb'),
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text
                                        style={{
                                            fontSize: 10,
                                            fontFamily: 'Outfit_800ExtraBold',
                                            letterSpacing: 1.2,
                                            textTransform: 'uppercase',
                                            color: isDeliveryEligible
                                                ? (isDark ? '#34d399' : '#047857')
                                                : (isDark ? '#fbbf24' : '#b45309'),
                                        }}
                                    >
                                        PREGNANCY TIMING
                                    </Text>
                                    <View
                                        style={{
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 8,
                                            backgroundColor: isDeliveryEligible
                                                ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7')
                                                : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'),
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 10,
                                                fontFamily: 'Outfit_700Bold',
                                                color: isDeliveryEligible
                                                    ? (isDark ? '#34d399' : '#15803d')
                                                    : (isDark ? '#fbbf24' : '#b45309'),
                                            }}
                                        >
                                            {isDeliveryEligible ? 'Delivery Window Open' : 'Early Pregnancy'}
                                        </Text>
                                    </View>
                                </View>

                                {expectedCalvingDateFormatted ? (
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontFamily: 'Outfit_600SemiBold',
                                            color: colors.textSecondary,
                                            marginBottom: 2,
                                        }}
                                    >
                                        Expected calving: {expectedCalvingDateFormatted}
                                    </Text>
                                ) : null}

                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontFamily: 'Outfit_700Bold',
                                        color: colors.textPrimary,
                                        marginBottom: 4,
                                    }}
                                >
                                    Day {selectedGestationDays}{averageGestationDays ? ` of approximately ${averageGestationDays}` : ''}
                                </Text>

                                {!isDeliveryEligible ? (
                                    <View style={{ gap: 2 }}>
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontFamily: 'Outfit_600SemiBold',
                                                color: isDark ? '#fbbf24' : '#b45309',
                                            }}
                                        >
                                            Delivery recording available from Day {minimumGestationDays}
                                            {daysRemaining !== null ? ` · ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining` : ''}
                                        </Text>
                                        {earliestLiveDeliveryDateFormatted ? (
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    fontFamily: 'Outfit_400Regular',
                                                    color: colors.textSecondary,
                                                }}
                                            >
                                                Delivery recording available from: {earliestLiveDeliveryDateFormatted}. Abortion is not blocked by the delivery recording threshold.
                                            </Text>
                                        ) : null}
                                    </View>
                                ) : (
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontFamily: 'Outfit_500Medium',
                                            color: isDark ? '#34d399' : '#047857',
                                        }}
                                    >
                                        Delivery recording is available (Day {selectedGestationDays} ≥ {minimumGestationDays}). All delivery outcomes are available.
                                    </Text>
                                )}
                            </View>
                        ) : selectedPregnancy && minimumGestationDays === null ? (
                            <View
                                style={{
                                    padding: 12,
                                    marginBottom: 16,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontFamily: 'Outfit_500Medium',
                                        color: colors.textSecondary,
                                    }}
                                >
                                    Authoritative calving readiness is unavailable for this record. Refresh the animal or verify the delivery recording window before continuing.
                                </Text>
                            </View>
                        ) : null}

                        {/* Calving Details Section */}
                        <TechnicianFormSection
                            title="Calving Details"
                            description="Record the delivery date, outcome, and method."
                        >
                            {/* Calving Date */}
                            <View className="mb-4">
                                <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold mb-1.5 ml-1 uppercase tracking-wider">
                                    Calving Date
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setTempDate(date ? new Date(`${date}T00:00:00`) : new Date());
                                        setShowDatePicker(true);
                                    }}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex-row items-center justify-between"
                                >
                                    <View className="flex-row items-center gap-3">
                                        <Calendar size={18} color={colors.primary} />
                                        <Text className="text-slate-800 dark:text-white font-outfit-semibold text-sm">
                                            {date
                                                ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })
                                                : "Select date"}
                                        </Text>
                                    </View>
                                    <Text className="text-slate-400 font-outfit-medium text-xs">Change</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Outcome Selector */}
                            <View className="mb-4">
                                <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold mb-1.5 ml-1 uppercase tracking-wider">
                                    Delivery Outcome
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {[
                                        ['live_birth', 'Live Birth'],
                                        ['mixed', 'Mixed'],
                                        ['stillbirth', 'Stillbirth'],
                                        ['abortion', 'Abortion'],
                                    ].map(([value, label]) => {
                                        const isDelivery = value !== 'abortion';
                                        const isOptionDisabled = isDelivery && !isDeliveryEligible;
                                        const isSelected = outcome === value;

                                        let activeStyle = 'bg-emerald-600 border-emerald-600';
                                        if (value === 'mixed') activeStyle = 'bg-amber-600 border-amber-600';
                                        if (value === 'stillbirth') activeStyle = 'bg-slate-700 border-slate-700';
                                        if (value === 'abortion') activeStyle = 'bg-rose-600 border-rose-600';

                                        return (
                                            <TouchableOpacity
                                                key={value}
                                                disabled={isOptionDisabled}
                                                onPress={() => handleOutcomeSelect(value)}
                                                style={{
                                                    opacity: isOptionDisabled ? 0.45 : 1,
                                                }}
                                                className={`px-4 py-2.5 rounded-xl border ${
                                                    isSelected
                                                        ? activeStyle
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                <Text
                                                    className={`font-outfit-bold text-xs ${
                                                        isSelected
                                                            ? 'text-white'
                                                            : isOptionDisabled
                                                                ? 'text-slate-400 dark:text-slate-600'
                                                                : 'text-slate-700 dark:text-slate-200'
                                                    }`}
                                                >
                                                    {label}
                                                    {isOptionDisabled && minimumGestationDays ? ` (Day ${minimumGestationDays}+)` : ''}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {!isDeliveryEligible && (
                                    <View
                                        style={{
                                            marginTop: 10,
                                            marginBottom: 8,
                                            padding: 10,
                                            borderRadius: 10,
                                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
                                            borderWidth: 1,
                                            borderColor: isDark ? '#334155' : '#e2e8f0',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                fontFamily: 'Outfit_500Medium',
                                                color: colors.textSecondary,
                                                lineHeight: 16,
                                            }}
                                        >
                                            {minimumGestationDays !== null
                                                ? `Live Birth, Mixed, and Stillbirth are disabled until Day ${minimumGestationDays} (delivery recording is not available yet). Abortion is not blocked by the delivery recording threshold.`
                                                : 'Delivery outcomes are unavailable until canonical gestation timing is confirmed. Abortion is not blocked by delivery recording threshold timing.'}
                                        </Text>
                                    </View>
                                )}

                                {outcome !== 'abortion' && !isDeliveryEligible ? (
                                    <View
                                        style={{
                                            marginTop: 6,
                                            marginBottom: 8,
                                            padding: 10,
                                            borderRadius: 10,
                                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                                            borderWidth: 1,
                                            borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                fontFamily: 'Outfit_600SemiBold',
                                                color: colors.error || '#ef4444',
                                                lineHeight: 16,
                                            }}
                                        >
                                            The selected outcome cannot be submitted for this date because delivery recording is not available yet. Switch to Abortion or select a valid delivery date.
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* Delivery Method */}
                            {!isAbortion && (
                                <View className="mb-4">
                                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold mb-1.5 ml-1 uppercase tracking-wider">
                                        Delivery Method
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {['Natural', 'Normal', 'Difficult', 'Cesarean'].map(opt => (
                                            <TouchableOpacity
                                                key={opt}
                                                onPress={() => setCalvingEase(opt)}
                                                className={`px-3.5 py-2 rounded-xl border ${
                                                    calvingEase === opt
                                                        ? 'bg-emerald-600 border-emerald-600'
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                <Text className={`font-outfit-bold text-xs ${
                                                    calvingEase === opt ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                                                }`}>
                                                    {opt}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Calves Count Summary */}
                            {!isAbortion && (
                                <View>
                                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold mb-1.5 ml-1 uppercase tracking-wider">
                                        Number of calves born
                                    </Text>
                                    <View className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex-row items-center justify-between">
                                        <Text className="text-slate-800 dark:text-white font-outfit-bold text-sm">
                                            {calves.length} {calves.length === 1 ? 'Calf' : 'Calves'}
                                        </Text>
                                        <Text className="text-slate-400 font-outfit-medium text-xs">
                                            Determined by entries below
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </TechnicianFormSection>
                        {/* Offspring Details Section */}
                        <View className="flex-row justify-between items-center mb-2 px-1 mt-2">
                            <Text className="font-outfit-bold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                                {isAbortion ? 'Pregnancy Loss Details' : isLiveBirth ? 'Offspring Registry' : 'Stillborn Calf Details'}
                            </Text>
                            <View className="flex-row items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                <View className={`w-1.5 h-1.5 rounded-full ${isLiveBirth ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <Text className={`${isLiveBirth ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'} font-outfit-bold text-xs`}>
                                    {isLiveBirth ? 'Auto-Registering' : 'No livestock profile'}
                                </Text>
                            </View>
                        </View>

                        {isAbortion ? (
                            <View className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-4 rounded-2xl mb-4">
                                <View className="flex-row items-center gap-2 mb-1">
                                    <AlertTriangle size={16} color={isDark ? '#fbbf24' : '#d97706'} />
                                    <Text className="text-amber-900 dark:text-amber-200 font-outfit-bold text-sm">
                                        Pregnancy Loss / Abortion
                                    </Text>
                                </View>
                                <Text className="text-amber-800 dark:text-amber-300 font-outfit-regular text-xs leading-5">
                                    No living calf record will be created. Add clinical observations or notes regarding the loss in the Technical Notes section below.
                                </Text>
                            </View>
                        ) : (
                            <View className="gap-y-4 mb-4">
                                {calves.map((calf, idx) => (
                                    <View
                                        key={idx}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm"
                                    >
                                        {/* Card Header Row */}
                                        <View className="flex-row items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                                            <View className="flex-row items-center gap-2">
                                                <View className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                                                    <Text className="text-emerald-800 dark:text-emerald-300 font-outfit-bold text-xs">
                                                        Calf #{idx + 1}
                                                    </Text>
                                                </View>
                                                <Text className="text-slate-800 dark:text-white font-outfit-bold text-sm">
                                                    {calf.isLiving !== false ? 'Living Calf' : 'Stillborn'}
                                                </Text>
                                            </View>
                                            {calves.length > 1 && (
                                                <TouchableOpacity
                                                    onPress={() => removeCalf(idx)}
                                                    className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40"
                                                >
                                                    <X size={15} color={colors.error || '#e11d48'} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Mixed outcome: Living vs Stillborn toggle */}
                                        {outcome === 'mixed' && (
                                            <View className="mb-4">
                                                <Text className="text-slate-500 dark:text-slate-400 font-outfit-bold text-xs uppercase tracking-wider mb-1.5 ml-1">
                                                    Status / Vitality
                                                </Text>
                                                <View className="flex-row gap-2">
                                                    {([[true, 'Living'], [false, 'Stillborn']] as const).map(([val, label]) => {
                                                        const active = calf.isLiving !== false === val;
                                                        return (
                                                            <TouchableOpacity
                                                                key={String(val)}
                                                                onPress={() => updateCalf(idx, 'isLiving', val)}
                                                                className={`flex-1 py-2.5 rounded-xl items-center border ${
                                                                    active
                                                                        ? val
                                                                            ? 'bg-emerald-600 border-emerald-600'
                                                                            : 'bg-slate-700 border-slate-700'
                                                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                                }`}
                                                            >
                                                                <Text className={`font-outfit-bold text-xs ${active ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                    {label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        )}

                                        {/* Calf Details Form Controls */}
                                        <View className="gap-4">
                                            {/* Gender / Sex */}
                                            <View>
                                                <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold uppercase tracking-wider mb-1.5 ml-1">
                                                    Gender / Sex
                                                </Text>
                                                <View className="flex-row gap-2">
                                                    <TouchableOpacity
                                                        onPress={() => updateCalf(idx, 'sex', 'F')}
                                                        className={`flex-1 py-2.5 rounded-xl items-center border ${
                                                            calf.sex === 'F'
                                                                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-800'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <Text className={`text-xs font-outfit-bold ${
                                                            calf.sex === 'F' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                                                        }`}>
                                                            Female
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => updateCalf(idx, 'sex', 'M')}
                                                        className={`flex-1 py-2.5 rounded-xl items-center border ${
                                                            calf.sex === 'M'
                                                                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-800'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <Text className={`text-xs font-outfit-bold ${
                                                            calf.sex === 'M' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                                                        }`}>
                                                            Male
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Ear Tag & Brand Mark */}
                                            <View className="flex-row gap-3">
                                                <View className="flex-1">
                                                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold uppercase tracking-wider mb-1.5 ml-1">
                                                        Ear Tag / ID No.
                                                    </Text>
                                                    <View className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5">
                                                        <TextInput
                                                            className="text-slate-800 dark:text-white font-outfit-bold text-sm uppercase"
                                                            placeholder="CALF-XXXX"
                                                            placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                            value={calf.earTag}
                                                            onChangeText={(v) => updateCalf(idx, 'earTag', v)}
                                                        />
                                                    </View>
                                                    {calf.isLiving !== false && (
                                                        <View className="mt-1.5">
                                                            <EarTagGenerator
                                                                farmerName={farmerName}
                                                                existingEarTags={[
                                                                    ...farmerEarTags,
                                                                    ...calves.slice(0, idx).map((item) => item.earTag),
                                                                ]}
                                                                onGenerate={(tag) => updateCalf(idx, 'earTag', tag)}
                                                                isDark={isDark}
                                                            />
                                                        </View>
                                                    )}
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold uppercase tracking-wider mb-1.5 ml-1">
                                                        Brand Mark
                                                    </Text>
                                                    <View className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5">
                                                        <TextInput
                                                            className="text-slate-800 dark:text-white font-outfit-medium text-sm"
                                                            placeholder="Optional"
                                                            placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                            value={calf.brand}
                                                            onChangeText={(v) => updateCalf(idx, 'brand', v)}
                                                        />
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Calf Color */}
                                            <View>
                                                <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold uppercase tracking-wider mb-1.5 ml-1">
                                                    Calf Color
                                                </Text>
                                                <View className="flex-row flex-wrap gap-1.5 mb-2">
                                                    {CALF_COLOR_OPTIONS.map((c) => {
                                                        const isSelected = calf.color === c && !calf.isCustomColor;
                                                        return (
                                                            <TouchableOpacity
                                                                key={c}
                                                                onPress={() => {
                                                                    updateCalf(idx, 'color', c);
                                                                    updateCalf(idx, 'isCustomColor', false);
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg border ${
                                                                    isSelected
                                                                        ? 'bg-emerald-600 border-emerald-600'
                                                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                                }`}
                                                            >
                                                                <Text className={`font-outfit-semibold text-xs ${
                                                                    isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                                                                }`}>
                                                                    {c}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            updateCalf(idx, 'isCustomColor', true);
                                                            if (CALF_COLOR_OPTIONS.includes(calf.color)) {
                                                                updateCalf(idx, 'color', '');
                                                            }
                                                        }}
                                                        className={`px-3 py-1.5 rounded-lg border ${
                                                            calf.isCustomColor
                                                                ? 'bg-emerald-600 border-emerald-600'
                                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <Text className={`font-outfit-semibold text-xs ${
                                                            calf.isCustomColor ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                                                        }`}>
                                                            Other
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {calf.isCustomColor && (
                                                    <View className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5">
                                                        <TextInput
                                                            className="text-slate-800 dark:text-white font-outfit-medium text-xs"
                                                            value={calf.color}
                                                            onChangeText={(v) => updateCalf(idx, 'color', v)}
                                                            placeholder="Describe color..."
                                                            placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                                                        />
                                                    </View>
                                                )}
                                            </View>

                                            {/* Calf Photo */}
                                            {calf.isLiving !== false && (
                                                <View>
                                                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-outfit-bold uppercase tracking-wider mb-1.5 ml-1">
                                                        Calf Photo (Optional)
                                                    </Text>
                                                    {calf.imageUri ? (
                                                        <View
                                                            style={{
                                                                borderRadius: 12,
                                                                overflow: "hidden",
                                                                borderWidth: 1,
                                                                borderColor: isDark ? "#334155" : "#e2e8f0",
                                                                position: "relative",
                                                            }}
                                                        >
                                                            <Image
                                                                source={{ uri: calf.imageUri }}
                                                                style={{ width: "100%", height: 130 }}
                                                                resizeMode="cover"
                                                            />
                                                            <TouchableOpacity
                                                                onPress={() => removeCalfImage(idx)}
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 8,
                                                                    right: 8,
                                                                    padding: 6,
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
                                                                className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex-row justify-center items-center gap-1.5"
                                                            >
                                                                <Camera size={14} color={isDark ? '#34d399' : '#00643B'} />
                                                                <Text className="text-slate-700 dark:text-slate-300 font-outfit-semibold text-xs">Take Photo</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => handleSelectCalfPhoto(idx, "library")}
                                                                className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex-row justify-center items-center gap-1.5"
                                                            >
                                                                <ImageIcon size={14} color={isDark ? '#34d399' : '#00643B'} />
                                                                <Text className="text-slate-700 dark:text-slate-300 font-outfit-semibold text-xs">Gallery</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ))}

                                {calves.length < 5 && (
                                    <TouchableOpacity
                                        onPress={addCalf}
                                        className="border-2 border-dashed border-emerald-300 dark:border-emerald-800/60 rounded-xl p-3.5 items-center justify-center flex-row gap-2 bg-emerald-50/40 dark:bg-emerald-950/20"
                                    >
                                        <Text className="text-emerald-700 dark:text-emerald-400 font-outfit-bold text-sm">
                                            + Add Another Calf
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Technical Notes Section */}
                        <TechnicianFormSection
                            title="Technical Notes"
                            description="Add observations, delivery conditions, or clinical details."
                        >
                            <TextInput
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 h-28 text-slate-800 dark:text-white font-outfit-medium text-sm"
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
                                className="mb-3 rounded-xl border px-4 py-3"
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

                        {/* Real-time Mixed Delivery Validation Alert */}
                        {outcome === 'mixed' && isMixedInvalid && (
                            <View
                                className="mb-3 p-3 rounded-2xl border flex-row items-center gap-2.5"
                                style={{
                                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                                    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
                                }}
                            >
                                <AlertTriangle size={16} color={isDark ? '#fbbf24' : '#d97706'} />
                                <Text
                                    className="flex-1 text-xs font-outfit-bold"
                                    style={{ color: isDark ? '#fef3c7' : '#92400e' }}
                                >
                                    Mixed delivery must include at least one living and one stillborn calf.
                                </Text>
                            </View>
                        )}

                        {/* Save Button */}
                        <Button
                            size="lg"
                            className={`mb-4 ${isMixedInvalid ? 'opacity-60' : ''}`}
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

            {showDatePicker && (
                <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === "android") {
                            if (event.type === "set" && selectedDate) {
                                setShowDatePicker(false);
                                setTempDate(selectedDate);
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                                const day = String(selectedDate.getDate()).padStart(2, "0");
                                setDate(`${year}-${month}-${day}`);
                            } else if (event.type === "dismissed") {
                                setShowDatePicker(false);
                            }
                        } else if (Platform.OS === "ios" && selectedDate) {
                            setTempDate(selectedDate);
                            const year = selectedDate.getFullYear();
                            const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                            const day = String(selectedDate.getDate()).padStart(2, "0");
                            setDate(`${year}-${month}-${day}`);
                        }
                    }}
                />
            )}

            <ConfirmationModal
              visible={confirmSubmitVisible}
              onClose={() => setConfirmSubmitVisible(false)}
              onConfirm={submitCalvingRecord}
              title="Submit Calving Registry?"
              message={isLiveBirth
                ? `This will create ${calves.length} living offspring record${calves.length > 1 ? "s" : ""} for ${motherTag || "the selected mother"}.`
                : `This will record ${isAbortion ? "a pregnancy loss" : `a ${outcome.replaceAll("_", " ")}`} without creating living livestock profiles for ${motherTag || "the selected mother"}.`}
              confirmText="Submit"
              cancelText="Review"
              isDestructive={false}
            />
        </ScreenLayout>
    );
}

function RecordCalfDropSkeleton({ onBack, motherTag }: { onBack: () => void; motherTag?: string }) {
    const { colors } = useTheme();

    return (
        <ScreenLayout edges={[]}>
            <AppPageHeader
                title="Record Calving / Offspring"
                onBack={onBack}
                rightAction={motherTag ? (
                    <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: colors.textSecondary }}>
                        Mother #{motherTag}
                    </Text>
                ) : undefined}
            />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 14 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Top Info Banner Skeleton */}
                <View className="bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex-row items-center gap-3">
                    <Skeleton width={20} height={20} radius={10} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton width="88%" height={14} radius={4} />
                        <Skeleton width="55%" height={12} radius={4} />
                    </View>
                </View>

                {/* Confirmed Pregnancy Reference Card Skeleton */}
                <View className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
                    {/* Cow Header */}
                    <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <View style={{ gap: 6 }}>
                            <Skeleton width={130} height={18} radius={4} />
                            <Skeleton width={80} height={12} radius={4} />
                        </View>
                        <Skeleton width={74} height={24} radius={12} />
                    </View>
                    {/* Timing Rows */}
                    <View style={{ gap: 10, marginTop: 12 }}>
                        <View className="flex-row justify-between">
                            <Skeleton width={110} height={13} radius={4} />
                            <Skeleton width={80} height={13} radius={4} />
                        </View>
                        <View className="flex-row justify-between">
                            <Skeleton width={75} height={13} radius={4} />
                            <Skeleton width={80} height={13} radius={4} />
                        </View>
                        <View className="flex-row justify-between">
                            <Skeleton width={115} height={13} radius={4} />
                            <Skeleton width={90} height={13} radius={4} />
                        </View>
                        <View className="flex-row justify-between">
                            <Skeleton width={125} height={13} radius={4} />
                            <Skeleton width={70} height={13} radius={4} />
                        </View>
                    </View>
                    {/* Readiness Badge */}
                    <View className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <Skeleton width="100%" height={32} radius={8} />
                    </View>
                </View>

                {/* Calving Details Section Skeleton */}
                <View className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
                    <Skeleton width={110} height={16} radius={4} />
                    <Skeleton width={190} height={12} radius={4} style={{ marginTop: 6, marginBottom: 14 }} />

                    <Skeleton width={75} height={11} radius={4} style={{ marginBottom: 6 }} />
                    <Skeleton width="100%" height={46} radius={12} style={{ marginBottom: 14 }} />

                    <Skeleton width={95} height={11} radius={4} style={{ marginBottom: 6 }} />
                    <View className="flex-row flex-wrap gap-2 mb-4">
                        <Skeleton width="48%" height={56} radius={12} />
                        <Skeleton width="48%" height={56} radius={12} />
                        <Skeleton width="48%" height={56} radius={12} />
                        <Skeleton width="48%" height={56} radius={12} />
                    </View>

                    <Skeleton width={90} height={11} radius={4} style={{ marginBottom: 6 }} />
                    <View className="flex-row gap-2">
                        <Skeleton width={68} height={34} radius={12} />
                        <Skeleton width={68} height={34} radius={12} />
                        <Skeleton width={68} height={34} radius={12} />
                        <Skeleton width={68} height={34} radius={12} />
                    </View>
                </View>

                {/* Offspring Details Section Skeleton */}
                <View className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
                    <View className="flex-row justify-between items-center mb-4">
                        <Skeleton width={80} height={20} radius={6} />
                        <Skeleton width={22} height={22} radius={11} />
                    </View>
                    <Skeleton width={70} height={11} radius={4} style={{ marginBottom: 6 }} />
                    <View className="flex-row gap-2 mb-4">
                        <Skeleton width="48%" height={40} radius={12} />
                        <Skeleton width="48%" height={40} radius={12} />
                    </View>
                    <View className="flex-row gap-3">
                        <Skeleton width="48%" height={44} radius={12} />
                        <Skeleton width="48%" height={44} radius={12} />
                    </View>
                </View>
            </ScrollView>
        </ScreenLayout>
    );
}
