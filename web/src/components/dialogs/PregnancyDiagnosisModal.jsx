import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Sparkles, Calendar, History, Search } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';
import { calculateTargetCalvingDate } from "../../utils/cattleCore";
import {
    PREGNANCY_WORKFLOW_STAGE,
    getWorkflowStage,
    getWorkflowStageLabel,
} from "../../constants/technicianWorkflow";
import { buildPregnancyActionRequest } from "../../utils/taskNavigation";

const inputClass = `input input-bordered w-full font-semibold`;
const selectClass = `select select-bordered w-full font-semibold`;
const labelClass = `label-text text-xs font-bold text-base-content/85 py-1 block`;


const PregnancyDiagnosisModal = ({ isOpen, onClose, taskData, onSuccess, preSelectedFarmer, preSelectedAnimal, taskId }) => {
    const queryClient = useQueryClient();
    const isVerificationTask = taskData && (taskData.raw?.taskType === "PD" || taskData.type === "breeding_verification" || taskData.type === "pregnancy_check");
    const rawTask = taskData?.raw || taskData || {};
    const workflowStage = getWorkflowStage(rawTask);
    const isInitialDiagnosis = !taskData || workflowStage === PREGNANCY_WORKFLOW_STAGE.INITIAL;
    const isContinuation = workflowStage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION;
    const isDiagnosticFollowUp = workflowStage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP;
    const isContinuationFlow = isContinuation || isDiagnosticFollowUp;
    const pregnancyId = rawTask.metadata?.pregnancyId || rawTask.relatedRecordId?._id || rawTask.relatedRecordId;
    const taskReadiness = rawTask.pregnancyReadiness;
    
    // Form & UI state
    const [result, setResult] = useState(''); // 'Pregnant' or 'Empty'
    const [note, setNote] = useState('');
    const [diagnosisDate, setDiagnosisDate] = useState(new Date().toISOString().slice(0, 10));
    const [followUpDate, setFollowUpDate] = useState("");
    const [diagnosticMethod, setDiagnosticMethod] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [minimumFollowUpDate] = useState(
        () => new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Standalone selectors state (used when taskData is not provided)
    const [selectedFarmerId, setSelectedFarmerId] = useState("");
    const [searchFarmer, setSearchFarmer] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedAnimalId, setSelectedAnimalId] = useState("");
    const [selectedInseminationId, setSelectedInseminationId] = useState("");

    // Reset state and handle Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            Promise.resolve().then(() => {
                if (preSelectedFarmer) {
                    setSelectedFarmerId(preSelectedFarmer._id);
                    setSearchFarmer(preSelectedFarmer.name || '');
                }
                if (preSelectedAnimal) {
                    setSelectedAnimalId(preSelectedAnimal._id);
                } else if (isVerificationTask) {
                    const animalObj = taskData.raw?.animalIds?.[0] || taskData.animalId;
                    if (animalObj) {
                        setSelectedAnimalId(animalObj._id || animalObj);
                    }
                    const farmerObj = taskData.raw?.farmerId || taskData.farmerId;
                    if (farmerObj) {
                        setSelectedFarmerId(farmerObj._id || farmerObj);
                    }
                }
            });
        } else {
            Promise.resolve().then(() => {
                setResult('');
                setNote('');
                setDiagnosisDate(new Date().toISOString().slice(0, 10));
                setFollowUpDate('');
                setDiagnosticMethod('');
                setSelectedFarmerId('');
                setSearchFarmer('');
                setIsDropdownOpen(false);
                setSelectedAnimalId('');
                setSelectedInseminationId('');
                setFieldErrors({});
            });
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, preSelectedFarmer, preSelectedAnimal, taskData, isVerificationTask]);

    // Queries for standalone mode
    const {
        data: farmers = [],
        error: farmersError,
        isError: isFarmersError,
        isLoading: isLoadingFarmers,
        refetch: refetchFarmers,
    } = useQuery({
        queryKey: ["farmers", "list"],
        queryFn: async () => {
            const res = await axiosInstance.get("/user?role=farmer");
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: isOpen && (!taskData || isVerificationTask),
    });

    const {
        data: animals = [],
        error: animalsError,
        isError: isAnimalsError,
        isLoading: isLoadingAnimals,
        refetch: refetchAnimals,
    } = useQuery({
        queryKey: ["farmer-animals", selectedFarmerId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: !!selectedFarmerId && isOpen && (!taskData || isVerificationTask),
    });

    const {
        data: animalHistory = {},
        error: historyError,
        isError: isHistoryError,
        isLoading: isLoadingHistory,
        refetch: refetchHistory,
    } = useQuery({
        queryKey: ["animal-history", selectedAnimalId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/technician/animal-history/${selectedAnimalId}`);
            return res.data || {};
        },
        enabled: !!selectedAnimalId && isOpen && (!taskData || isVerificationTask),
    });


    // Determine current animal & breeding attempt references
    const animal = taskData
        ? (isVerificationTask ? (taskData.raw?.animalIds?.[0] || {}) : (taskData.animal || taskData.raw?.animalId || {}))
        : (animals.find(a => a._id === selectedAnimalId) || {});

    const animalId = taskData
        ? (animal._id || animal.id || (typeof animal === 'string' ? animal : null))
        : selectedAnimalId;

    const inseminationId = taskData
        ? (isVerificationTask ? (taskData.raw?.metadata?.inseminationId || taskData.inseminationId) : taskData.id)
        : selectedInseminationId;

    const historyInseminations = taskData && !isVerificationTask
        ? (animal.breedingRecords || [])
        : (animalHistory.inseminations || []);

    const recentAIs = [...historyInseminations]
        .sort((a, b) => new Date(b.inseminationDate) - new Date(a.inseminationDate))
        .slice(0, 3);

    const validInseminations = taskData && !isVerificationTask
        ? []
        : historyInseminations.filter(
            (item) =>
                ["done", "resolved", "completed"].includes(String(item.status || "").trim().toLowerCase()) &&
                (!item.outcome || item.outcome === "Pending")
        );

    // Auto-select latest pending insemination for standalone mode
    useEffect(() => {
        if (!taskData && animalHistory && animalHistory.inseminations) {
            const historyInsem = animalHistory.inseminations || [];
            const valid = historyInsem.filter(
                (item) =>
                    ["done", "resolved", "completed"].includes(String(item.status || "").trim().toLowerCase()) &&
                    (!item.outcome || item.outcome === "Pending")
            );
            if (valid.length > 0) {
                const sorted = [...valid].sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0));
                Promise.resolve().then(() => {
                    setSelectedInseminationId(sorted[0]._id || sorted[0].id);
                });
            } else {
                Promise.resolve().then(() => {
                    setSelectedInseminationId("");
                });
            }
        } else if (!taskData) {
            Promise.resolve().then(() => {
                setSelectedInseminationId("");
            });
        }
    }, [animalHistory, taskData]);

    const selectedInsemination = taskData && !isVerificationTask
        ? null
        : (isVerificationTask
            ? (animalHistory.inseminations || []).find(i => (i._id || i.id) === (taskData.raw?.metadata?.inseminationId || taskData.inseminationId))
            : validInseminations.find(i => (i._id || i.id) === selectedInseminationId));
    const readiness = taskReadiness || selectedInsemination?.pregnancyReadiness;

    // Calculate days since AI
    let daysSinceAI = 0;
    if (taskData && !isVerificationTask) {
        daysSinceAI = taskData.daysSinceAI || 0;
    } else if (selectedInsemination) {
        const diffTime = Math.abs(new Date() - new Date(selectedInsemination.inseminationDate));
        daysSinceAI = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // Estimate calving drop date
    const baseInseminationDate = taskData && !isVerificationTask
        ? (taskData.inseminationDate || new Date())
        : (selectedInsemination ? new Date(selectedInsemination.inseminationDate) : new Date());
    const estCalvingDate = calculateTargetCalvingDate(
        baseInseminationDate,
        animal?.species || "Cattle",
        undefined,
        animal?.breed
    ).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const handleSubmit = async () => {
        if (isSubmitting) return;
        const nextErrors = {};
        if (!taskData && !selectedFarmerId) {
            nextErrors.farmer = "Select a farmer.";
        }
        if (!animalId) {
            nextErrors.animal = "Select a valid female animal.";
        }
        if (!isContinuationFlow && !inseminationId) {
            nextErrors.insemination = "Select a completed breeding attempt.";
        }
        if (isContinuationFlow && !pregnancyId) {
            nextErrors.form = "The related pregnancy record is missing from this task.";
        }
        if (!result) {
            nextErrors.result = "Select a diagnosis result.";
        }
        if (isInitialDiagnosis && readiness?.policyMode === "method_based" && !diagnosticMethod) {
            nextErrors.diagnosticMethod = "Select an available diagnostic method.";
        }
        if (isInitialDiagnosis && readiness && !readiness.isEligible) {
            nextErrors.form = readiness.reason || "Pregnancy diagnosis is not available yet.";
        }
        const diagnosisTimestamp = new Date(diagnosisDate).getTime();
        if (!diagnosisDate || Number.isNaN(diagnosisTimestamp)) {
            nextErrors.diagnosisDate = "Enter a valid diagnosis date.";
        } else if (diagnosisTimestamp > new Date().getTime()) {
            nextErrors.diagnosisDate = "Diagnosis date cannot be in the future.";
        } else if (
            selectedInsemination?.inseminationDate &&
            diagnosisTimestamp < new Date(selectedInsemination.inseminationDate).setUTCHours(0, 0, 0, 0)
        ) {
            nextErrors.diagnosisDate = "Diagnosis date cannot be earlier than the AI service date.";
        }
        if (result === "follow_up_required") {
            const followUpTimestamp = new Date(followUpDate).getTime();
            if (!followUpDate || Number.isNaN(followUpTimestamp) || followUpTimestamp <= diagnosisTimestamp) {
                nextErrors.followUpDate = "Choose a follow-up date after the diagnosis date.";
            }
        }
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            return;
        }

        setFieldErrors({});
        setIsSubmitting(true);
        try {
            const request = buildPregnancyActionRequest({
                task: { ...rawTask, pregnancyReadiness: readiness },
                animalId,
                inseminationId,
                result,
                note,
                diagnosisDate,
                taskId: taskId || taskData?.id,
                followUpDate,
                diagnosticMethod,
            });
            await axiosInstance.post(request.url, request.payload);

            toast.success(isContinuationFlow ? "Pregnancy follow-up recorded." : `Diagnosis recorded: ${result}`);
            await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ["technician"] }),
                queryClient.invalidateQueries({ queryKey: ["farmer-animals"] }),
                queryClient.invalidateQueries({ queryKey: ["animal-history"] }),
                queryClient.invalidateQueries({ queryKey: ["animal", animalId] }),
            ]);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to record diagnosis");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="pregnancy-modal-title">
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="modal-box relative flex max-h-[86vh] w-11/12 max-w-3xl flex-col overflow-hidden border border-base-300 p-0 md:flex-row"
                >
                    {/* LEFT SIDE: Breeding Context */}
                    <div className="md:w-5/12 bg-base-200 p-5 border-r border-base-300 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <History size={16} className="text-emerald-600 dark:text-emerald-400" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Breeding History</h4>
                            </div>

                            <div className="space-y-4">
                                {recentAIs.length > 0 ? (
                                    recentAIs.map((record, idx) => (
                                        <div key={idx} className="relative pl-6 pb-4 last:pb-0 border-l border-base-300">
                                            <div className="absolute -left-1.25 top-1 w-2.5 h-2.5 rounded-full bg-base-300" />
                                            <p className="text-[9px] font-black text-base-content/40 uppercase tracking-tighter leading-none mb-1">
                                                Attempt #{record.attemptNumber || (recentAIs.length - idx)}
                                            </p>
                                            <p className="text-[12px] font-black text-base-content tracking-tight leading-none mb-1">
                                                {formatDate(record.inseminationDate)}
                                            </p>
                                            <p className="text-[10px] font-bold text-base-content/60">
                                                {record.sireBreed || 'Unknown Sire'} ({record.sireCode || 'No Code'})
                                            </p>
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md mt-1.5 inline-block ${
                                                record.outcome === 'Pregnant' ? 'bg-purple-500/10 text-purple-600' :
                                                record.outcome?.startsWith('Failed') ? 'bg-rose-500/10 text-rose-600' :
                                                'bg-blue-500/10 text-blue-600'
                                            }`}>
                                                {record.outcome || 'Pending'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[10px] font-bold text-base-content/20 uppercase tracking-widest italic">No prior AI records found</p>
                                )}
                            </div>
                        </div>

                        {daysSinceAI > 0 && (
                            <div className="mt-6 pt-6 border-t border-base-300">
                                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                                    <Sparkles size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Selected Check Window</span>
                                </div>
                                <p className="text-sm font-black text-base-content tracking-tight">
                                    {daysSinceAI} Days Post-AI
                                </p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE: Diagnosis Input */}
                    <div className="md:w-7/12 p-6 bg-base-100 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 id="pregnancy-modal-title" className="text-xl font-extrabold text-base-content leading-tight">
                                        {isContinuation ? "Record Continuation Recheck" : isDiagnosticFollowUp ? "Record Diagnostic Follow-up" : "Record Pregnancy Diagnosis"}
                                    </h3>
                                    <p className="text-base-content/40 font-bold text-[9px] uppercase tracking-widest mt-1.5 leading-none">
                                        {taskData ? `Animal: #${animal.earTag || 'Not recorded'} • ${animal.breed || 'Breed not recorded'}` : 'Select a farmer, animal, and related AI service'}
                                        {animal.animalId && <span className="sr-only"> Full animal identifier: {animal.animalId}.</span>}
                                    </p>
                                </div>
                                 <button
                                    type="button"
                                    onClick={() => !isSubmitting && onClose()}
                                    disabled={isSubmitting}
                                    className="btn btn-ghost btn-circle min-h-11 min-w-11"
                                    aria-label="Close pregnancy form"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Standalone selectors */}
                            {!taskData && (
                                <div className="space-y-4 mb-6">
                                    {/* Farmer Selector */}
                                    <div className="space-y-1.5">
                                        <label className={labelClass} htmlFor="pregnancy-farmer-search">Farmer</label>
                                        {preSelectedFarmer ? (
                                            <div className="flex items-center gap-3 h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                                                <span className="truncate">{preSelectedFarmer.name}</span>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                                                <input
                                                    id="pregnancy-farmer-search"
                                                    value={searchFarmer}
                                                    onChange={(e) => {
                                                        setSearchFarmer(e.target.value);
                                                        setSelectedFarmerId("");
                                                        setSelectedAnimalId("");
                                                        setSelectedInseminationId("");
                                                        setFieldErrors((current) => ({ ...current, farmer: null, animal: null, insemination: null }));
                                                        setIsDropdownOpen(true);
                                                    }}
                                                    onFocus={() => setIsDropdownOpen(true)}
                                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                                    placeholder="Type farmer name..."
                                                    className={`${inputClass} pl-11`}
                                                />
                                                <AnimatePresence>
                                                    {isDropdownOpen && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -5 }}
                                                            role="listbox"
                                                            aria-label="Matching farmers"
                                                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl custom-scrollbar"
                                                        >
                                                            {isLoadingFarmers ? (
                                                                <div className="space-y-2 p-3" role="status" aria-label="Loading farmers">
                                                                    <div className="skeleton h-10 w-full" />
                                                                    <div className="skeleton h-10 w-full" />
                                                                </div>
                                                            ) : isFarmersError ? (
                                                                <div className="alert alert-error m-2 w-auto text-sm" role="alert">
                                                                    <span>{farmersError?.response?.data?.message || "Unable to load farmers."}</span>
                                                                    <button type="button" className="btn btn-ghost btn-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => refetchFarmers()}>Try again</button>
                                                                </div>
                                                            ) : farmers.filter((f) =>
                                                                (f.name || "").toLowerCase().includes(searchFarmer.toLowerCase()) ||
                                                                (f.phoneNumber || "").toLowerCase().includes(searchFarmer.toLowerCase()) ||
                                                                (typeof f.address === "string" ? f.address : f.address?.barangay || "").toLowerCase().includes(searchFarmer.toLowerCase())
                                                            ).length > 0 ? (
                                                                farmers
                                                                    .filter((f) =>
                                                                        (f.name || "").toLowerCase().includes(searchFarmer.toLowerCase()) ||
                                                                        (f.phoneNumber || "").toLowerCase().includes(searchFarmer.toLowerCase()) ||
                                                                        (typeof f.address === "string" ? f.address : f.address?.barangay || "").toLowerCase().includes(searchFarmer.toLowerCase())
                                                                    )
                                                                    .map((farmer) => (
                                                                        <button
                                                                            key={farmer._id}
                                                                            type="button"
                                                                            role="option"
                                                                            aria-selected={selectedFarmerId === farmer._id}
                                                                            onClick={() => {
                                                                                setSelectedFarmerId(farmer._id);
                                                                                setSelectedAnimalId("");
                                                                                setSearchFarmer(farmer.name);
                                                                                setIsDropdownOpen(false);
                                                                                setFieldErrors((current) => ({ ...current, farmer: null, animal: null, insemination: null }));
                                                                            }}
                                                                            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary cursor-pointer"
                                                                        >
                                                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                                                {(farmer.name || "Farmer").substring(0, 2).toUpperCase()}
                                                                            </span>
                                                                            <span className="min-w-0">
                                                                                <span className="block truncate text-sm font-bold text-base-content">{farmer.name}</span>
                                                                                <span className="block text-xs font-medium text-base-content/60">
                                                                                    {farmer.phoneNumber || "No Contact"} • {typeof farmer.address === "string" ? farmer.address : (farmer.address?.barangay || "No Barangay")}
                                                                                </span>
                                                                            </span>
                                                                        </button>
                                                                    ))
                                                            ) : (
                                                                <p className="px-4 py-8 text-center text-sm font-medium text-base-content/60">No farmers found</p>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                        {fieldErrors.farmer && <p role="alert" className="text-sm text-error">{fieldErrors.farmer}</p>}
                                    </div>

                                    {/* Animal Selector */}
                                    <div className="space-y-1.5">
                                        <label className={labelClass} htmlFor="pregnancy-animal">Animal</label>
                                        {preSelectedAnimal ? (
                                            <div className="flex items-center gap-3 h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                                                <span className="truncate">Tag #{preSelectedAnimal.earTag} ({preSelectedAnimal.breed || "Crossbreed"})</span>
                                            </div>
                                        ) : (
                                            <select
                                                id="pregnancy-animal"
                                                disabled={!selectedFarmerId || isLoadingAnimals || isAnimalsError}
                                                value={selectedAnimalId}
                                                onChange={(e) => {
                                                    setSelectedAnimalId(e.target.value);
                                                    setSelectedInseminationId("");
                                                    setFieldErrors((current) => ({ ...current, animal: null, insemination: null }));
                                                }}
                                                className={`${selectClass} cursor-pointer disabled:opacity-50`}
                                            >
                                                <option value="">{isLoadingAnimals ? "Synchronizing..." : "Select female cow..."}</option>
                                                {animals.map((a) => (
                                                    <option key={a._id} value={a._id} disabled={a.gender === "Male" || a.reproductiveStatus === "Pregnant"}>
                                                        Tag #{a.earTag} ({a.breed}) - {a.reproductiveStatus || "Normal"}{a.gender === "Male" ? " (Male - Restricted)" : ""}{a.reproductiveStatus === "Pregnant" ? " (Already Pregnant)" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        {selectedFarmerId && isAnimalsError && (
                                            <div className="alert alert-error text-sm" role="alert">
                                                <span>{animalsError?.response?.data?.message || "Unable to load this farmer's animals."}</span>
                                                <button type="button" className="btn btn-ghost btn-xs" onClick={() => refetchAnimals()}>Try again</button>
                                            </div>
                                        )}
                                        {selectedFarmerId && !isLoadingAnimals && !isAnimalsError && animals.length === 0 && (
                                            <p className="text-sm text-base-content/60">No registered animals found for this farmer.</p>
                                        )}
                                        {fieldErrors.animal && <p role="alert" className="text-sm text-error">{fieldErrors.animal}</p>}
                                    </div>

                                    {/* Breeding attempt selector */}
                                    {selectedAnimalId && (
                                        <div className="space-y-1.5">
                                            <label className={labelClass} htmlFor="pregnancy-insemination">Completed breeding attempt</label>
                                            {isLoadingHistory ? (
                                                <div className="skeleton h-11 w-full" role="status" aria-label="Loading breeding attempts" />
                                            ) : isHistoryError ? (
                                                <div className="alert alert-error text-sm" role="alert">
                                                    <span>{historyError?.response?.data?.message || "Unable to load breeding history."}</span>
                                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => refetchHistory()}>Try again</button>
                                                </div>
                                            ) : validInseminations.length > 0 ? (
                                                <select
                                                    id="pregnancy-insemination"
                                                    value={selectedInseminationId}
                                                    onChange={(e) => {
                                                        setSelectedInseminationId(e.target.value);
                                                        setDiagnosticMethod("");
                                                        setFieldErrors((current) => ({ ...current, insemination: null, diagnosticMethod: null }));
                                                    }}
                                                    className={`${selectClass} cursor-pointer`}
                                                >
                                                    <option value="" disabled>Select breeding attempt...</option>
                                                    {validInseminations.map((item) => (
                                                        <option key={item._id || item.id} value={item._id || item.id}>
                                                            Attempt #{item.attemptNumber || 1} - {formatDate(item.inseminationDate)} (Sire: {item.sireCode})
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                                                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">No breeding records</h5>
                                                        <p className="text-[9px] font-bold text-base-content/40 uppercase mt-1 leading-tight">
                                                            Only performed inseminations with pending outcome are available.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {fieldErrors.insemination && <p role="alert" className="text-sm text-error">{fieldErrors.insemination}</p>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {taskData && (
                                <div className="alert mb-5 border border-base-300 bg-base-200 text-sm" role="status">
                                    <div className="space-y-1">
                                        <p className="font-bold">{getWorkflowStageLabel(rawTask)}</p>
                                        <p className="text-base-content/70">
                                            {isContinuation
                                                ? "This recheck updates the existing pregnancy record."
                                                : isDiagnosticFollowUp
                                                    ? "Additional follow-up is required. Review the previous diagnosis before continuing."
                                                    : readiness?.reason || `${readiness?.daysPostAI ?? daysSinceAI} days after AI.`}
                                        </p>
                                        {pregnancyId && <p className="text-xs text-base-content/60">Pregnancy reference: {pregnancyId}</p>}
                                    </div>
                                </div>
                            )}

                            {isInitialDiagnosis && readiness && !readiness.isEligible && (
                                <div className="alert alert-warning mb-5" role="alert">
                                    <AlertCircle size={18} />
                                    <span>{readiness.reason || "Pregnancy diagnosis is not available yet."}</span>
                                </div>
                            )}
                            {fieldErrors.form && (
                                <div className="alert alert-error mb-5" role="alert">
                                    <AlertCircle size={18} />
                                    <span>{fieldErrors.form}</span>
                                </div>
                            )}

                            {/* Result & Diagnosis details */}
                            {(taskData || selectedInseminationId) && (
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <label htmlFor="pregnancy-diagnosis-date" className={labelClass}>
                                            Diagnosis Date
                                        </label>
                                        <input
                                            id="pregnancy-diagnosis-date"
                                            type="date"
                                            value={diagnosisDate}
                                            max={new Date().toISOString().slice(0, 10)}
                                            onChange={(event) => {
                                                setDiagnosisDate(event.target.value);
                                                setFieldErrors((current) => ({ ...current, diagnosisDate: null }));
                                            }}
                                            className={inputClass}
                                        />
                                        <p className="text-[10px] text-base-content/50 ml-1">
                                            Use the actual examination date when entering a past result.
                                        </p>
                                        {fieldErrors.diagnosisDate && <p role="alert" className="text-sm text-error">{fieldErrors.diagnosisDate}</p>}
                                    </div>
                                    {/* Result Selection */}
                                    <fieldset className="space-y-2.5">
                                        <legend className={labelClass}>
                                            Diagnosis Result
                                        </legend>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                aria-pressed={result === (isContinuationFlow ? 'continuing' : 'Pregnant')}
                                                onClick={() => {
                                                    setResult(isContinuationFlow ? 'continuing' : 'Pregnant');
                                                    setFieldErrors((current) => ({ ...current, result: null, followUpDate: null }));
                                                }}
                                                className={`btn min-h-20 h-auto flex-col ${result === (isContinuationFlow ? 'continuing' : 'Pregnant') ? 'btn-success' : 'btn-outline'}`}
                                            >
                                                <Sparkles size={22} />
                                                <span>{isContinuationFlow ? "Pregnancy continuing" : "Pregnant"}</span>
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={result === (isContinuationFlow ? 'loss_detected' : 'Empty')}
                                                onClick={() => {
                                                    setResult(isContinuationFlow ? 'loss_detected' : 'Empty');
                                                    setFieldErrors((current) => ({ ...current, result: null, followUpDate: null }));
                                                }}
                                                className={`btn min-h-20 h-auto flex-col ${result === (isContinuationFlow ? 'loss_detected' : 'Empty') ? 'btn-error' : 'btn-outline'}`}
                                            >
                                                <AlertCircle size={22} />
                                                <span>{isContinuationFlow ? "Pregnancy loss detected" : "Not pregnant"}</span>
                                            </button>
                                            {isContinuationFlow && (
                                                <button type="button" aria-pressed={result === 'follow_up_required'} onClick={() => { setResult('follow_up_required'); setFieldErrors((current) => ({ ...current, result: null })); }} className={`btn col-span-2 min-h-14 ${result === 'follow_up_required' ? 'btn-warning' : 'btn-outline'}`}>
                                                    Additional follow-up required
                                                </button>
                                            )}
                                        </div>
                                        {fieldErrors.result && <p role="alert" className="text-sm text-error">{fieldErrors.result}</p>}
                                    </fieldset>

                                    {isContinuationFlow && result === "follow_up_required" && (
                                        <div className="space-y-1.5">
                                            <label className={labelClass} htmlFor="pregnancy-follow-up-date">Follow-up date</label>
                                            <input id="pregnancy-follow-up-date" type="date" min={minimumFollowUpDate} value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); setFieldErrors((current) => ({ ...current, followUpDate: null })); }} className={inputClass} required />
                                            {fieldErrors.followUpDate && <p role="alert" className="text-sm text-error">{fieldErrors.followUpDate}</p>}
                                        </div>
                                    )}

                                    {isInitialDiagnosis && readiness?.policyMode === "method_based" && (
                                        <fieldset className="space-y-2">
                                            <legend className={labelClass}>Diagnostic method</legend>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {(readiness.methods || []).map((method) => (
                                                    <button
                                                        key={method.methodCode}
                                                        type="button"
                                                        className={`btn min-h-14 h-auto justify-start text-left ${diagnosticMethod === method.methodCode ? "btn-primary" : "btn-outline"}`}
                                                        disabled={!method.enabled || !method.isEligible}
                                                        aria-pressed={diagnosticMethod === method.methodCode}
                                                        onClick={() => { setDiagnosticMethod(method.methodCode); setFieldErrors((current) => ({ ...current, diagnosticMethod: null })); }}
                                                        title={method.reason}
                                                    >
                                                        <span><span className="block">{method.label}</span><span className="block text-xs font-normal opacity-75">{method.isEligible ? "Available now" : method.availableDateLabel || method.reason}</span></span>
                                                    </button>
                                                ))}
                                            </div>
                                            {fieldErrors.diagnosticMethod && <p role="alert" className="text-sm text-error">{fieldErrors.diagnosticMethod}</p>}
                                        </fieldset>
                                    )}

                                    {/* Note */}
                                    <div className="space-y-1.5">
                                        <label className={labelClass} htmlFor="pregnancy-findings">Findings (optional)</label>
                                        <textarea
                                            id="pregnancy-findings"
                                            placeholder="Add examination findings"
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            className="textarea textarea-bordered min-h-24 w-full resize-none"
                                        />
                                    </div>

                                    {result === 'Pregnant' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="alert alert-info flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Calendar size={18} className="opacity-60" />
                                                <div>
                                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Est. Calf Drop Date</p>
                                                    <p className="text-xs font-black tracking-tight">
                                                        {estCalvingDate}
                                                    </p>
                                                </div>
                                            </div>
                                            <CheckCircle size={18} />
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting || (isInitialDiagnosis && readiness && !readiness.isEligible)}
                                className="btn btn-primary min-h-11 w-full"
                            >
                                {isSubmitting ? <span className="loading loading-spinner loading-xs"></span> : isContinuationFlow ? 'Save follow-up result' : 'Finalize diagnosis'}
                            </button>
                        </div>
                    </div>
                </motion.div>
                <button type="button" className="modal-backdrop" onClick={() => !isSubmitting && onClose()} aria-label="Close pregnancy form" />
            </div>
        </AnimatePresence>
    );
};

export default PregnancyDiagnosisModal;
