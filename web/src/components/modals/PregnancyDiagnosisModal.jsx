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

const inputClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-sm font-semibold text-base-content placeholder:text-base-content/55 focus:border-primary focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-sm font-semibold text-base-content focus:border-primary focus:outline-none transition-all appearance-none`;
const labelClass = `text-[11px] font-bold text-base-content/70 tracking-wide ml-1`;


const PregnancyDiagnosisModal = ({ isOpen, onClose, taskData, onSuccess, preSelectedFarmer, preSelectedAnimal, taskId }) => {
    const queryClient = useQueryClient();
    const isVerificationTask = taskData && (taskData.raw?.taskType === "PD" || taskData.type === "breeding_verification" || taskData.type === "pregnancy_check");
    const rawTask = taskData?.raw || taskData || {};
    const workflowStage = getWorkflowStage(rawTask);
    const isInitialDiagnosis = workflowStage === PREGNANCY_WORKFLOW_STAGE.INITIAL;
    const isContinuation = workflowStage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION;
    const isDiagnosticFollowUp = workflowStage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP;
    const isContinuationFlow = isContinuation || isDiagnosticFollowUp;
    const pregnancyId = rawTask.metadata?.pregnancyId || rawTask.relatedRecordId?._id || rawTask.relatedRecordId;
    const readiness = rawTask.pregnancyReadiness;
    
    // Form & UI state
    const [result, setResult] = useState(''); // 'Pregnant' or 'Empty'
    const [note, setNote] = useState('');
    const [diagnosisDate, setDiagnosisDate] = useState(new Date().toISOString().slice(0, 10));
    const [followUpDate, setFollowUpDate] = useState("");
    const [diagnosticMethod, setDiagnosticMethod] = useState("");
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
            });
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, preSelectedFarmer, preSelectedAnimal, taskData, isVerificationTask]);

    // Queries for standalone mode
    const { data: farmers = [] } = useQuery({
        queryKey: ["farmers", "list"],
        queryFn: async () => {
            const res = await axiosInstance.get("/user?role=farmer");
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: isOpen && (!taskData || isVerificationTask),
    });

    const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
        queryKey: ["farmer-animals", selectedFarmerId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: !!selectedFarmerId && isOpen && (!taskData || isVerificationTask),
    });

    const { data: animalHistory = {}, isLoading: isLoadingHistory } = useQuery({
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
                (item.status === "done" || item.status === "completed" || item.status === "in-progress" || item.status === "approved") &&
                (!item.outcome || item.outcome === "Pending")
        );

    // Auto-select latest pending insemination for standalone mode
    useEffect(() => {
        if (!taskData && animalHistory && animalHistory.inseminations) {
            const historyInsem = animalHistory.inseminations || [];
            const valid = historyInsem.filter(
                (item) =>
                    (item.status === "done" || item.status === "completed" || item.status === "in-progress" || item.status === "approved") &&
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
        if (!animalId) {
            toast.error("Please select a valid cow record.");
            return;
        }
        if (!isContinuationFlow && !inseminationId) {
            toast.error("No active breeding attempt referenced.");
            return;
        }
        if (isContinuationFlow && !pregnancyId) {
            toast.error("The related pregnancy record is missing from this task.");
            return;
        }
        if (!result) {
            toast.error("Please select a diagnosis result.");
            return;
        }
        if (isInitialDiagnosis && readiness?.policyMode === "method_based" && !diagnosticMethod) {
            toast.error("Select an available diagnostic method.");
            return;
        }

        setIsSubmitting(true);
        try {
            const request = buildPregnancyActionRequest({
                task: rawTask,
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
            queryClient.invalidateQueries({ queryKey: ["technician"] });
            queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
            queryClient.invalidateQueries({ queryKey: ["animal-history"] });
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
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-neutral/45" role="dialog" aria-modal="true" aria-labelledby="pregnancy-modal-title">
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-base-100 rounded-2xl max-w-3xl w-full shadow-2xl relative overflow-hidden flex flex-col md:flex-row border border-base-300 max-h-[86vh]"
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
                                            <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-base-300" />
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
                                        <label className={labelClass}>Farmer Client</label>
                                        {preSelectedFarmer ? (
                                            <div className="flex items-center gap-3 h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                                                <span className="truncate">{preSelectedFarmer.name}</span>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20" />
                                                <input
                                                    value={searchFarmer}
                                                    onChange={(e) => {
                                                        setSearchFarmer(e.target.value);
                                                        setIsDropdownOpen(true);
                                                    }}
                                                    placeholder="Search field records for owner..."
                                                    className={`${inputClass} pl-11`}
                                                />
                                                <AnimatePresence>
                                                    {isDropdownOpen && searchFarmer && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -5 }}
                                                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-base-300 bg-base-100 shadow-xl rounded-xl custom-scrollbar"
                                                        >
                                                            {farmers.filter((f) =>
                                                                f.name.toLowerCase().includes(searchFarmer.toLowerCase())
                                                            ).length > 0 ? (
                                                                farmers
                                                                    .filter((f) => f.name.toLowerCase().includes(searchFarmer.toLowerCase()))
                                                                    .map((farmer) => (
                                                                        <button
                                                                            key={farmer._id}
                                                                            onClick={() => {
                                                                                setSelectedFarmerId(farmer._id);
                                                                                setSelectedAnimalId("");
                                                                                setSearchFarmer(farmer.name);
                                                                                setIsDropdownOpen(false);
                                                                            }}
                                                                            className="w-full px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 flex flex-col gap-1 border-b border-base-200/50 last:border-0 cursor-pointer"
                                                                        >
                                                                            <span className="text-xs font-bold text-base-content block">{farmer.name}</span>
                                                                            <span className="text-[9px] font-black tracking-widest text-base-content/40 uppercase mt-0.5">
                                                                                {farmer.phoneNumber || "No Contact"} • {farmer.address?.barangay || "No Barangay"}
                                                                            </span>
                                                                        </button>
                                                                    ))
                                                            ) : (
                                                                <div className="py-10 text-center text-[10px] font-black text-base-content/20 uppercase tracking-widest">No clients found</div>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>

                                    {/* Animal Selector */}
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Livestock Cow</label>
                                        {preSelectedAnimal ? (
                                            <div className="flex items-center gap-3 h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                                                <span className="truncate">Tag #{preSelectedAnimal.earTag} ({preSelectedAnimal.breed || "Crossbreed"})</span>
                                            </div>
                                        ) : (
                                            <select
                                                disabled={!selectedFarmerId || isLoadingAnimals}
                                                value={selectedAnimalId}
                                                onChange={(e) => setSelectedAnimalId(e.target.value)}
                                                className={`${selectClass} cursor-pointer disabled:opacity-50`}
                                            >
                                                <option value="">{isLoadingAnimals ? "Synchronizing..." : "Select female cow..."}</option>
                                                {animals.map((a) => (
                                                    <option key={a._id} value={a._id} disabled={a.gender === "Male" || a.reproductiveStatus === "Pregnant"}>
                                                        Tag #{a.earTag} ({a.breed}) — {a.reproductiveStatus || "Normal"}{a.gender === "Male" ? " (Male - Restricted)" : ""}{a.reproductiveStatus === "Pregnant" ? " (Already Pregnant)" : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Breeding attempt selector */}
                                    {selectedAnimalId && (
                                        <div className="space-y-1.5">
                                            <label className={labelClass}>Breeding Attempt Reference</label>
                                            {isLoadingHistory ? (
                                                <div className="text-xs font-bold text-slate-400">Loading attempts...</div>
                                            ) : validInseminations.length > 0 ? (
                                                <select
                                                    value={selectedInseminationId}
                                                    onChange={(e) => setSelectedInseminationId(e.target.value)}
                                                    className={`${selectClass} cursor-pointer`}
                                                >
                                                    <option value="" disabled>Select breeding attempt...</option>
                                                    {validInseminations.map((item) => (
                                                        <option key={item._id || item.id} value={item._id || item.id}>
                                                            Attempt #{item.attemptNumber || 1} — {formatDate(item.inseminationDate)} (Sire: {item.sireCode})
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

                            {/* Result & Diagnosis details */}
                            {(taskData || selectedInseminationId) && (
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">
                                            Diagnosis Date
                                        </label>
                                        <input
                                            type="date"
                                            value={diagnosisDate}
                                            max={new Date().toISOString().slice(0, 10)}
                                            onChange={(event) => setDiagnosisDate(event.target.value)}
                                            className={inputClass}
                                        />
                                        <p className="text-[10px] text-base-content/50 ml-1">
                                            Use the actual examination date when entering a past result.
                                        </p>
                                    </div>
                                    {/* Result Selection */}
                                    <div className="space-y-2.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">
                                            Diagnosis Result
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setResult(isContinuationFlow ? 'continuing' : 'Pregnant')}
                                                className={`btn min-h-20 h-auto flex-col ${result === (isContinuationFlow ? 'continuing' : 'Pregnant') ? 'btn-success' : 'btn-outline'}`}
                                            >
                                                <Sparkles size={22} />
                                                <span>{isContinuationFlow ? "Pregnancy continuing" : "Pregnant"}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setResult(isContinuationFlow ? 'loss_detected' : 'Empty')}
                                                className={`btn min-h-20 h-auto flex-col ${result === (isContinuationFlow ? 'loss_detected' : 'Empty') ? 'btn-error' : 'btn-outline'}`}
                                            >
                                                <AlertCircle size={22} />
                                                <span>{isContinuationFlow ? "Pregnancy loss detected" : "Not pregnant"}</span>
                                            </button>
                                            {isContinuationFlow && (
                                                <button type="button" onClick={() => setResult('follow_up_required')} className={`btn col-span-2 min-h-14 ${result === 'follow_up_required' ? 'btn-warning' : 'btn-outline'}`}>
                                                    Additional follow-up required
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isContinuationFlow && result === "follow_up_required" && (
                                        <div className="space-y-1.5">
                                            <label className={labelClass} htmlFor="pregnancy-follow-up-date">Follow-up date</label>
                                            <input id="pregnancy-follow-up-date" type="date" min={minimumFollowUpDate} value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className={inputClass} required />
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
                                                        onClick={() => setDiagnosticMethod(method.methodCode)}
                                                        title={method.reason}
                                                    >
                                                        <span><span className="block">{method.label}</span><span className="block text-xs font-normal opacity-75">{method.isEligible ? "Available now" : method.availableDateLabel || method.reason}</span></span>
                                                    </button>
                                                ))}
                                            </div>
                                        </fieldset>
                                    )}

                                    {/* Note */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">Findings</label>
                                        <textarea
                                            placeholder="Optional notes..."
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            className="w-full bg-base-200 border border-base-300 rounded-2xl p-4 text-xs font-bold text-base-content placeholder:text-base-content/30 focus:border-purple-600 focus:outline-none transition-all min-h-[80px] resize-none"
                                        />
                                    </div>

                                    {result === 'Pregnant' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-purple-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-md shadow-purple-900/25"
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
                                            <CheckCircle size={18} className="text-white" />
                                        </motion.div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !result || (!taskData && !selectedInseminationId) || (isInitialDiagnosis && readiness && !readiness.isEligible) || (isInitialDiagnosis && readiness?.policyMode === "method_based" && !diagnosticMethod) || (result === "follow_up_required" && !followUpDate)}
                                className="btn btn-primary min-h-11 w-full"
                            >
                                {isSubmitting ? <span className="loading loading-spinner loading-xs"></span> : isContinuationFlow ? 'Save follow-up result' : 'Finalize diagnosis'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PregnancyDiagnosisModal;
