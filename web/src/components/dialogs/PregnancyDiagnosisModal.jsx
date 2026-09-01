import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Sparkles, Calendar, Search } from 'lucide-react';
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

const PregnancyDiagnosisModal = ({ isOpen, onClose, taskData, onSuccess, preSelectedFarmer, preSelectedAnimal, taskId }) => {
    const queryClient = useQueryClient();
    const queuedTask = taskData?.raw || taskData || {};
    const isVerificationTask = Boolean(
        taskData &&
        (queuedTask.taskType === "PD" ||
            taskData.type === "breeding_verification" ||
            taskData.type === "pregnancy_check"),
    );
    const resolvedTaskId = taskId || queuedTask._id || queuedTask.id || null;
    const {
        data: taskDetails,
        isLoading: isLoadingTaskDetails,
        isError: isTaskDetailsError,
    } = useQuery({
        queryKey: ["technician", "tasks", "detail", resolvedTaskId || ""],
        queryFn: async () => {
            const response = await axiosInstance.get(
                `/tasks/${encodeURIComponent(resolvedTaskId)}`,
            );
            return response.data || null;
        },
        enabled: Boolean(isOpen && isVerificationTask && resolvedTaskId),
    });
    const rawTask = taskDetails || queuedTask;
    const workflowStage = getWorkflowStage(rawTask);
    const isInitialDiagnosis = !taskData || workflowStage === PREGNANCY_WORKFLOW_STAGE.INITIAL;
    const isContinuation = workflowStage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION;
    const isDiagnosticFollowUp = workflowStage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP;
    const isContinuationFlow = isContinuation || isDiagnosticFollowUp;
    const pregnancyId = rawTask.pregnancy?._id || rawTask.metadata?.pregnancyId || rawTask.relatedRecordId?._id || rawTask.relatedRecordId;
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
    } = useQuery({
        queryKey: ["farmers", "list"],
        queryFn: async () => {
            const res = await axiosInstance.get("/user?role=farmer");
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: isOpen && !taskData,
    });

    const {
        data: animals = [],
        isError: isAnimalsError,
        isLoading: isLoadingAnimals,
    } = useQuery({
        queryKey: ["farmer-animals", selectedFarmerId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: !!selectedFarmerId && isOpen && !taskData,
    });

    const {
        data: animalHistory = {},
    } = useQuery({
        queryKey: ["animal-history", selectedAnimalId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/technician/animal-history/${selectedAnimalId}`);
            return res.data || {};
        },
        enabled: !!selectedAnimalId && isOpen && !taskData,
    });


    // Determine current animal & breeding attempt references
    const linkedInsemination = isVerificationTask ? rawTask.insemination || null : null;
    const animal = taskData
        ? (isVerificationTask
            ? (linkedInsemination?.animalId || rawTask.animalIds?.[0] || {})
            : (taskData.animal || taskData.raw?.animalId || {}))
        : (animals.find(a => a._id === selectedAnimalId) || {});

    const animalId = taskData
        ? (animal._id || animal.id || (typeof animal === 'string' ? animal : null))
        : selectedAnimalId;

    const inseminationId = taskData
        ? (isVerificationTask
            ? (linkedInsemination?._id || rawTask.metadata?.inseminationId || taskData.inseminationId)
            : taskData.id)
        : selectedInseminationId;

    const historyInseminations = taskData
        ? (isVerificationTask
            ? (linkedInsemination ? [linkedInsemination] : [])
            : (animal.breedingRecords || []))
        : (animalHistory.inseminations || []);

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

    const selectedInsemination = taskData
        ? (isVerificationTask ? linkedInsemination : null)
        : validInseminations.find(i => (i._id || i.id) === selectedInseminationId);
    const readiness = taskReadiness || selectedInsemination?.pregnancyReadiness;
    const methodsEligible = readiness ? readiness.isEligible : true;
    const diagnosticMethods = readiness?.policyMode === "method_based"
        ? readiness.methods || []
        : [
            { methodCode: "palpation", label: "Palpation", enabled: true, isEligible: methodsEligible },
            { methodCode: "ultrasound", label: "Ultrasound", enabled: true, isEligible: methodsEligible },
            { methodCode: "visual_observation", label: "Visual Observation", enabled: true, isEligible: methodsEligible },
            { methodCode: "farmer_interview", label: "Farmer Interview", enabled: true, isEligible: methodsEligible },
            { methodCode: "other", label: "Other", enabled: true, isEligible: methodsEligible },
        ];
    const isFinalizedVerification = Boolean(
        isVerificationTask &&
        (["completed", "cancelled", "rejected"].includes(String(rawTask.status || "").toLowerCase()) ||
            rawTask.pregnancy?.pregnancyDiagnosis?.result),
    );

    // Calculate days since AI
    let daysSinceAI = Number.isFinite(readiness?.daysPostAI)
        ? readiness.daysPostAI
        : 0;
    if (!daysSinceAI && taskData && !isVerificationTask) {
        daysSinceAI = taskData.daysSinceAI || 0;
    } else if (!daysSinceAI && selectedInsemination?.inseminationDate) {
        const diffTime = Math.abs(new Date() - new Date(selectedInsemination.inseminationDate));
        daysSinceAI = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // Estimate calving drop date
    const baseInseminationDate = selectedInsemination?.inseminationDate ||
        (taskData && !isVerificationTask ? taskData.inseminationDate : null) ||
        new Date();
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
        if (
            isInitialDiagnosis &&
            (isVerificationTask || readiness?.policyMode === "method_based") &&
            !diagnosticMethod
        ) {
            nextErrors.diagnosticMethod = "Select an available diagnostic method.";
        }
        const officialDiagnosis = isVerificationTask
            ? ["pregnant", "not_pregnant"].includes(result)
            : ["Pregnant", "Empty"].includes(result);
        if (isInitialDiagnosis && officialDiagnosis && readiness && !readiness.isEligible) {
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
        if (["follow_up_required", "needs_recheck"].includes(result)) {
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
            const checkedAt = new Date(`${diagnosisDate}T12:00:00.000Z`).toISOString();
            const request = isVerificationTask && !isContinuationFlow
                ? {
                    url: `/ai-request/${encodeURIComponent(inseminationId)}/verify-breeding-observation`,
                    payload: {
                        verificationResult: result,
                        checkMethod: diagnosticMethod,
                        checkedAt,
                        technicianNotes: note,
                        ...(result === "needs_recheck" && followUpDate
                            ? { nextCheckDate: new Date(`${followUpDate}T12:00:00.000Z`).toISOString() }
                            : {}),
                        ...(readiness?.policyVersion ? { policyVersion: readiness.policyVersion } : {}),
                        taskId: rawTask._id || resolvedTaskId,
                    },
                }
                : buildPregnancyActionRequest({
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
                    className="modal-box relative max-h-[90vh] w-11/12 max-w-xl flex flex-col p-0 overflow-hidden bg-base-100"
                >
                    {/* Header: Title & Close */}
                    <div className="flex items-center justify-between border-b border-base-300 bg-base-100 p-4 md:px-5 sticky top-0 z-10">
                        <h3 id="pregnancy-modal-title" className="text-lg font-bold text-base-content leading-tight">
                            {isContinuation ? "Record Continuation Recheck" : isDiagnosticFollowUp ? "Record Diagnostic Follow-up" : "Pregnancy Confirmation"}
                        </h3>
                        <button
                            type="button"
                            onClick={() => !isSubmitting && onClose()}
                            disabled={isSubmitting}
                            className="btn btn-ghost btn-sm btn-circle"
                            aria-label="Close pregnancy form"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-4 md:p-5 overflow-y-auto space-y-6 custom-scrollbar">
                        {/* Standalone selectors (only when not started from task) */}
                        {!taskData && (
                            <div className="space-y-4 mb-2">
                                {/* Farmer Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-base-content block" htmlFor="pregnancy-farmer-search">Farmer</label>
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
                                                className="input input-bordered w-full font-semibold pl-11"
                                            />
                                            <AnimatePresence>
                                                {isDropdownOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -5 }}
                                                        role="listbox"
                                                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl custom-scrollbar"
                                                    >
                                                        {isLoadingFarmers ? (
                                                            <div className="space-y-2 p-3">
                                                                <div className="skeleton h-10 w-full" />
                                                                <div className="skeleton h-10 w-full" />
                                                            </div>
                                                        ) : isFarmersError ? (
                                                            <div className="alert alert-error m-2 w-auto text-sm">
                                                                <span>{farmersError?.response?.data?.message || "Unable to load farmers."}</span>
                                                            </div>
                                                        ) : farmers.filter((f) => (f.name || "").toLowerCase().includes(searchFarmer.toLowerCase()) || (f.phoneNumber || "").toLowerCase().includes(searchFarmer.toLowerCase())).length > 0 ? (
                                                            farmers.filter((f) => (f.name || "").toLowerCase().includes(searchFarmer.toLowerCase()) || (f.phoneNumber || "").toLowerCase().includes(searchFarmer.toLowerCase())).map((farmer) => (
                                                                <button
                                                                    key={farmer._id}
                                                                    type="button"
                                                                    role="option"
                                                                    onClick={() => {
                                                                        setSelectedFarmerId(farmer._id);
                                                                        setSelectedAnimalId("");
                                                                        setSearchFarmer(farmer.name);
                                                                        setIsDropdownOpen(false);
                                                                        setFieldErrors((current) => ({ ...current, farmer: null, animal: null, insemination: null }));
                                                                    }}
                                                                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-base-200 cursor-pointer"
                                                                >
                                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                                        {(farmer.name || "Farmer").substring(0, 2).toUpperCase()}
                                                                    </span>
                                                                    <span className="min-w-0">
                                                                        <span className="block truncate text-sm font-bold text-base-content">{farmer.name}</span>
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
                                    <label className="text-sm font-bold text-base-content block" htmlFor="pregnancy-animal">Animal</label>
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
                                            className="select select-bordered w-full font-semibold cursor-pointer disabled:opacity-50"
                                        >
                                            <option value="">{isLoadingAnimals ? "Synchronizing..." : "Select female cow..."}</option>
                                            {animals.map((a) => (
                                                <option key={a._id} value={a._id} disabled={a.gender === "Male" || a.reproductiveStatus === "Pregnant"}>
                                                    Tag #{a.earTag} ({a.breed}) - {a.reproductiveStatus || "Normal"}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {fieldErrors.animal && <p role="alert" className="text-sm text-error">{fieldErrors.animal}</p>}
                                </div>

                                {/* Breeding attempt selector */}
                                {selectedAnimalId && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-base-content block" htmlFor="pregnancy-insemination">Completed breeding attempt</label>
                                        <select
                                            id="pregnancy-insemination"
                                            value={selectedInseminationId}
                                            onChange={(e) => {
                                                setSelectedInseminationId(e.target.value);
                                                setDiagnosticMethod("");
                                                setFieldErrors((current) => ({ ...current, insemination: null, diagnosticMethod: null }));
                                            }}
                                            className="select select-bordered w-full font-semibold cursor-pointer"
                                        >
                                            <option value="" disabled>Select breeding attempt...</option>
                                            {validInseminations.map((item) => (
                                                <option key={item._id || item.id} value={item._id || item.id}>
                                                    Attempt #{item.attemptNumber || 1} - {formatDate(item.inseminationDate)}
                                                </option>
                                            ))}
                                        </select>
                                        {fieldErrors.insemination && <p role="alert" className="text-sm text-error">{fieldErrors.insemination}</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Section 1 & 2: Context & Readiness */}
                        {(isVerificationTask && isLoadingTaskDetails) ? (
                            <div className="skeleton h-24 w-full rounded-xl" />
                        ) : taskData || selectedInseminationId ? (
                            <div className="card bg-base-200 border border-base-300 rounded-xl">
                                <div className="card-body p-4 gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-base-content text-sm">
                                                {animal.name || animal.earTag || animal.animalId || 'Not recorded'}
                                            </p>
                                            <p className="text-xs text-base-content/65 font-medium mt-0.5">
                                                {[animal.earTag && `Tag ${animal.earTag}`, animal.species, animal.breed].filter(Boolean).join(" • ") || 'Breed not recorded'}
                                            </p>
                                        </div>
                                    </div>

                                    {isVerificationTask && selectedInsemination && (
                                        <div className="rounded-lg border border-base-300/50 bg-base-100 p-3">
                                            <p className="text-xs font-bold text-base-content">Breeding Reference</p>
                                            <div className="mt-2 grid gap-1 text-xs text-base-content/70 sm:grid-cols-3">
                                                <p>AI Date: <span className="font-semibold text-base-content">{formatDate(selectedInsemination.inseminationDate)}</span></p>
                                                <p>Attempt <span className="font-semibold text-base-content">#{selectedInsemination.attemptNumber ?? 'Not recorded'}</span></p>
                                                <p>Sire: <span className="font-semibold text-base-content">{selectedInsemination.sireCode || selectedInsemination.sireBreed || 'Not recorded'}{selectedInsemination.sireCode && selectedInsemination.sireBreed ? ` · ${selectedInsemination.sireBreed}` : ''}</span></p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-base-100 rounded-lg p-3 border border-base-300/50 mt-1">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">
                                                <Sparkles size={16} className={readiness?.isEligible !== false ? "text-primary" : "text-amber-500"} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-base-content">
                                                    {isInitialDiagnosis ? "Pregnancy Confirmation" : getWorkflowStageLabel(rawTask)}
                                                    {daysSinceAI > 0 && <span className="ml-1 text-base-content/60 font-medium">• {daysSinceAI} days since AI</span>}
                                                </p>
                                                <p className="text-[11px] font-medium text-base-content/70 mt-1">
                                                    Confirmation status: {readiness?.policyMode === "method_based" ? "Method Based" : "Default"}
                                                </p>
                                                <p className={`text-[11px] font-bold mt-1 ${readiness?.isEligible !== false ? 'text-success' : 'text-amber-600'}`}>
                                                    {readiness?.isEligible !== false ? "Available now" : (readiness?.reason || "Not available yet")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedInsemination?.farmerOutcomeReport && (
                                        <div className="bg-info/10 rounded-lg p-3 border border-info/20 mt-1">
                                            <p className="text-xs font-bold text-info-content">Farmer Follow-up: <span className="capitalize">{String(selectedInsemination.farmerOutcomeReport).replaceAll("_", " ")}</span></p>
                                            {selectedInsemination.farmerObservationNotes && (
                                                <p className="text-[11px] font-medium text-info-content/80 mt-1">{selectedInsemination.farmerObservationNotes}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {fieldErrors.form && (
                            <div className="alert alert-error" role="alert">
                                <AlertCircle size={18} />
                                <span>{fieldErrors.form}</span>
                            </div>
                        )}

                        {isFinalizedVerification && (
                            <div className="alert alert-info" role="status">
                                <span>This pregnancy diagnosis has already been finalized. Review it from the official record.</span>
                            </div>
                        )}

                        {/* Main Diagnosis Form */}
                        {(taskData || selectedInseminationId) && !isLoadingTaskDetails && !isTaskDetailsError && !isFinalizedVerification && (
                            <div className="space-y-6">
                                {/* Section 3: Outcome Selector */}
                                <fieldset className="space-y-3">
                                    <legend className="text-sm font-bold text-base-content">
                                        Diagnosis Result
                                    </legend>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            aria-pressed={result === (isContinuationFlow ? 'continuing' : isVerificationTask ? 'pregnant' : 'Pregnant')}
                                            onClick={() => {
                                                setResult(isContinuationFlow ? 'continuing' : isVerificationTask ? 'pregnant' : 'Pregnant');
                                                setFieldErrors((current) => ({ ...current, result: null, followUpDate: null }));
                                            }}
                                            className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                                                result === (isContinuationFlow ? 'continuing' : isVerificationTask ? 'pregnant' : 'Pregnant')
                                                ? 'border-success bg-success/10 text-success'
                                                : 'border-base-300 bg-base-100 hover:border-base-content/20'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <CheckCircle size={18} />
                                                <span className="font-bold text-sm">{isContinuationFlow ? "Continuing" : "Pregnant"}</span>
                                            </div>
                                            <span className="text-[11px] font-medium opacity-80">Confirmed pregnancy</span>
                                        </button>

                                        <button
                                            type="button"
                                            aria-pressed={result === (isContinuationFlow ? 'loss_detected' : isVerificationTask ? 'not_pregnant' : 'Empty')}
                                            onClick={() => {
                                                setResult(isContinuationFlow ? 'loss_detected' : isVerificationTask ? 'not_pregnant' : 'Empty');
                                                setFieldErrors((current) => ({ ...current, result: null, followUpDate: null }));
                                            }}
                                            className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                                                result === (isContinuationFlow ? 'loss_detected' : isVerificationTask ? 'not_pregnant' : 'Empty')
                                                ? 'border-error bg-error/10 text-error'
                                                : 'border-base-300 bg-base-100 hover:border-base-content/20'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <AlertCircle size={18} />
                                                <span className="font-bold text-sm">{isContinuationFlow ? "Loss Detected" : "Empty"}</span>
                                            </div>
                                            <span className="text-[11px] font-medium opacity-80">Not pregnant</span>
                                        </button>

                                        {isVerificationTask && !isContinuationFlow && (
                                            <>
                                                <button
                                                    type="button"
                                                    aria-pressed={result === 'return_to_heat'}
                                                    onClick={() => { setResult('return_to_heat'); setFieldErrors((current) => ({ ...current, result: null, followUpDate: null })); }}
                                                    className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                                                        result === 'return_to_heat'
                                                        ? 'border-warning bg-warning/10 text-warning-content'
                                                        : 'border-base-300 bg-base-100 hover:border-base-content/20'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles size={18} />
                                                        <span className="font-bold text-sm">Re-heat</span>
                                                    </div>
                                                    <span className="text-[11px] font-medium opacity-80">Returned to heat</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-pressed={result === 'needs_recheck'}
                                                    onClick={() => { setResult('needs_recheck'); setFieldErrors((current) => ({ ...current, result: null })); }}
                                                    className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                                                        result === 'needs_recheck'
                                                        ? 'border-info bg-info/10 text-info-content'
                                                        : 'border-base-300 bg-base-100 hover:border-base-content/20'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={18} />
                                                        <span className="font-bold text-sm">Recheck</span>
                                                    </div>
                                                    <span className="text-[11px] font-medium opacity-80">Needs further check</span>
                                                </button>
                                            </>
                                        )}
                                        {isContinuationFlow && (
                                            <button type="button" aria-pressed={result === 'follow_up_required'} onClick={() => { setResult('follow_up_required'); setFieldErrors((current) => ({ ...current, result: null })); }} className={`col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${result === 'follow_up_required' ? 'border-warning bg-warning/10 text-warning-content font-bold' : 'border-base-300 bg-base-100 hover:border-base-content/20 font-semibold'}`}>
                                                Additional follow-up required
                                            </button>
                                        )}
                                    </div>
                                    {fieldErrors.result && <p role="alert" className="text-sm text-error mt-1">{fieldErrors.result}</p>}
                                </fieldset>

                                {/* Section 4: Diagnostic Method */}
                                {isInitialDiagnosis && (isVerificationTask || readiness?.policyMode === "method_based") && (
                                    <fieldset className="space-y-3">
                                        <legend className="text-sm font-bold text-base-content">Diagnostic Method</legend>
                                        <div className="flex flex-wrap gap-2">
                                            {diagnosticMethods.map((method) => (
                                                <button
                                                    key={method.methodCode}
                                                    type="button"
                                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                                                        diagnosticMethod === method.methodCode
                                                        ? "bg-primary text-primary-content border-primary"
                                                        : "bg-base-100 text-base-content/70 border-base-300 hover:border-base-content/30"
                                                    } ${(!method.enabled || !method.isEligible) ? "opacity-50 cursor-not-allowed" : ""}`}
                                                    disabled={!method.enabled || !method.isEligible}
                                                    aria-pressed={diagnosticMethod === method.methodCode}
                                                    onClick={() => { setDiagnosticMethod(method.methodCode); setFieldErrors((current) => ({ ...current, diagnosticMethod: null })); }}
                                                    title={method.reason}
                                                >
                                                    {method.label}
                                                </button>
                                            ))}
                                        </div>
                                        {fieldErrors.diagnosticMethod && <p role="alert" className="text-sm text-error mt-1">{fieldErrors.diagnosticMethod}</p>}
                                    </fieldset>
                                )}

                                {/* Section 5: Date + Notes */}
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label htmlFor="pregnancy-diagnosis-date" className="text-sm font-bold text-base-content block">
                                            Checked At
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
                                            className="input input-bordered w-full font-semibold"
                                        />
                                        {fieldErrors.diagnosisDate && <p role="alert" className="text-sm text-error">{fieldErrors.diagnosisDate}</p>}
                                    </div>

                                    {((isContinuationFlow && result === "follow_up_required") || (isVerificationTask && result === "needs_recheck")) && (
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-base-content block" htmlFor="pregnancy-follow-up-date">{isVerificationTask ? "Next Recheck Date" : "Follow-up Date"}</label>
                                            <input id="pregnancy-follow-up-date" type="date" min={minimumFollowUpDate} value={followUpDate} onChange={(event) => { setFollowUpDate(event.target.value); setFieldErrors((current) => ({ ...current, followUpDate: null })); }} className="input input-bordered w-full font-semibold" required />
                                            {fieldErrors.followUpDate && <p role="alert" className="text-sm text-error">{fieldErrors.followUpDate}</p>}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-base-content block" htmlFor="pregnancy-findings">Technician Notes</label>
                                    <textarea
                                        id="pregnancy-findings"
                                        placeholder="Add diagnosis details, health notes, or recommendations..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="textarea textarea-bordered min-h-24 w-full resize-none"
                                    />
                                </div>

                                {(result === 'Pregnant' || result === 'pregnant') && (
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

                    {/* Section 6: Actions */}
                    {(!isFinalizedVerification && !isTaskDetailsError && (!isVerificationTask || !isLoadingTaskDetails)) && (
                        <div className="border-t border-base-300 p-4 md:px-5 bg-base-100 flex justify-end gap-3 sticky bottom-0">
                            <button type="button" className="btn btn-ghost" onClick={() => !isSubmitting && onClose()} disabled={isSubmitting}>Cancel</button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting || (isInitialDiagnosis && ["pregnant", "not_pregnant", "Pregnant", "Empty"].includes(result) && readiness && !readiness.isEligible)}
                                className="btn btn-primary min-w-32"
                            >
                                {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : isContinuationFlow ? 'Save Follow-up' : 'Finalize Diagnosis'}
                            </button>
                        </div>
                    )}
                </motion.div>
                <button type="button" className="modal-backdrop" onClick={() => !isSubmitting && onClose()} aria-label="Close pregnancy form" />
            </div>
        </AnimatePresence>
    );
};

export default PregnancyDiagnosisModal;
