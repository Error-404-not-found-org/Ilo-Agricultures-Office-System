import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Sparkles, Calendar, History, Search, ChevronDown, User } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const inputClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all appearance-none`;
const labelClass = `text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] ml-1`;
const sectionClass = `bg-base-200/20 border border-base-300 rounded-2xl p-6 space-y-5`;

const PregnancyDiagnosisModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    const queryClient = useQueryClient();
    
    // Form & UI state
    const [result, setResult] = useState(''); // 'Pregnant' or 'Empty'
    const [note, setNote] = useState('');
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
        } else {
            setResult('');
            setNote('');
            setSelectedFarmerId('');
            setSearchFarmer('');
            setIsDropdownOpen(false);
            setSelectedAnimalId('');
            setSelectedInseminationId('');
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    // Queries for standalone mode
    const { data: farmers = [] } = useQuery({
        queryKey: ["farmers", "list"],
        queryFn: async () => {
            const res = await axiosInstance.get("/user?role=farmer");
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: isOpen && !taskData,
    });

    const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
        queryKey: ["farmer-animals", selectedFarmerId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: !!selectedFarmerId && isOpen && !taskData,
    });

    const { data: animalHistory = {}, isLoading: isLoadingHistory } = useQuery({
        queryKey: ["animal-history", selectedAnimalId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/technician/animal-history/${selectedAnimalId}`);
            return res.data || {};
        },
        enabled: !!selectedAnimalId && isOpen && !taskData,
    });


    // Determine current animal & breeding attempt references
    const animal = taskData
        ? (taskData.animal || taskData.raw?.animalId || {})
        : (animals.find(a => a._id === selectedAnimalId) || {});

    const animalId = taskData
        ? (animal._id || animal.id || (typeof animal === 'string' ? animal : null))
        : selectedAnimalId;

    const inseminationId = taskData
        ? taskData.id
        : selectedInseminationId;

    const historyInseminations = taskData
        ? (animal.breedingRecords || [])
        : (animalHistory.inseminations || []);

    const recentAIs = [...historyInseminations]
        .sort((a, b) => new Date(b.inseminationDate) - new Date(a.inseminationDate))
        .slice(0, 3);

    const validInseminations = taskData
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
                setSelectedInseminationId(sorted[0]._id || sorted[0].id);
            } else {
                setSelectedInseminationId("");
            }
        } else if (!taskData) {
            setSelectedInseminationId("");
        }
    }, [animalHistory, taskData]);

    const selectedInsemination = taskData
        ? null
        : validInseminations.find(i => (i._id || i.id) === selectedInseminationId);

    // Calculate days since AI
    let daysSinceAI = 0;
    if (taskData) {
        daysSinceAI = taskData.daysSinceAI || 0;
    } else if (selectedInsemination) {
        const diffTime = Math.abs(new Date() - new Date(selectedInsemination.inseminationDate));
        daysSinceAI = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // Estimate calving drop date
    const baseInseminationDate = taskData
        ? (taskData.inseminationDate || new Date())
        : (selectedInsemination ? new Date(selectedInsemination.inseminationDate) : new Date());
    const estCalvingDate = new Date(new Date(baseInseminationDate).getTime() + 280 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const handleSubmit = async () => {
        if (!animalId) {
            toast.error("Please select a valid cow record.");
            return;
        }
        if (!inseminationId) {
            toast.error("No active breeding attempt referenced.");
            return;
        }
        if (!result) {
            toast.error("Please select a diagnosis result.");
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosInstance.post('/technician/pregnancy-check', {
                animalId,
                inseminationId,
                result,
                technicianNote: note
            });

            toast.success(`Diagnosis recorded: ${result}`);
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
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-base-100 rounded-3xl max-w-4xl w-full shadow-2xl relative overflow-hidden flex flex-col md:flex-row border border-base-300 max-h-[90vh]"
                >
                    {/* LEFT SIDE: Breeding Context */}
                    <div className="md:w-5/12 bg-base-200 p-6 border-r border-base-300 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <History size={16} className="text-emerald-600 dark:text-emerald-400" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Breeding History</h4>
                            </div>

                            <div className="space-y-4">
                                {recentAIs.length > 0 ? (
                                    recentAIs.map((record, idx) => (
                                        <div key={idx} className="relative pl-6 pb-4 last:pb-0 border-l border-base-300">
                                            <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-base-300" />
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
                                    <h3 className="text-xl font-black text-base-content leading-tight uppercase">Pregnancy Check</h3>
                                    <p className="text-base-content/40 font-bold text-[9px] uppercase tracking-widest mt-1.5 leading-none">
                                        {taskData ? `Animal: #${animal.earTag || 'N/A'} • ${animal.breed || 'Unknown'}` : 'Standalone Hub Registry'}
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-2 bg-base-200 text-base-content/40 rounded-full hover:bg-base-300 transition-all cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Standalone selectors */}
                            {!taskData && (
                                <div className="space-y-4 mb-6">
                                    {/* Farmer Selector */}
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Farmer Client</label>
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
                                    </div>

                                    {/* Animal Selector */}
                                    <div className="space-y-1.5">
                                        <label className={labelClass}>Livestock Cow</label>
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

                            {/* Result & Diagnosis details */}
                            {(taskData || selectedInseminationId) && (
                                <div className="space-y-6">
                                    {/* Result Selection */}
                                    <div className="space-y-2.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">
                                            Diagnosis Result
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setResult('Pregnant')}
                                                className={`flex flex-col items-center justify-center py-5 rounded-2xl border-2 transition-all gap-2 cursor-pointer ${result === 'Pregnant' ? 'border-purple-600 bg-purple-500/10 text-purple-600' : 'border-base-300 bg-base-200 text-base-content/40 hover:border-base-300'}`}
                                            >
                                                <Sparkles size={22} className={result === 'Pregnant' ? 'text-purple-600' : 'text-base-content/20'} />
                                                <span className="font-black uppercase tracking-widest text-[9px]">Pregnant</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setResult('Empty')}
                                                className={`flex flex-col items-center justify-center py-5 rounded-2xl border-2 transition-all gap-2 cursor-pointer ${result === 'Empty' ? 'border-rose-600 bg-rose-500/10 text-rose-600' : 'border-base-300 bg-base-200 text-base-content/40 hover:border-base-300'}`}
                                            >
                                                <AlertCircle size={22} className={result === 'Empty' ? 'text-rose-600' : 'text-base-content/20'} />
                                                <span className="font-black uppercase tracking-widest text-[9px]">Not Pregnant</span>
                                            </button>
                                        </div>
                                    </div>

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
                                disabled={isSubmitting || !result || (!taskData && !selectedInseminationId)}
                                className="w-full h-11 bg-[#074033] hover:bg-[#0d5948] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isSubmitting ? <span className="loading loading-spinner loading-xs"></span> : 'Finalize Diagnosis'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PregnancyDiagnosisModal;
