import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { X, Baby, Calendar, ClipboardCheck, Search, AlertCircle, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const inputClass = `input input-bordered w-full font-semibold`;
const selectClass = `select select-bordered w-full font-semibold`;
const labelClass = `label-text text-xs font-bold text-base-content/85 py-1 block`;

const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
};

const RecordCalfDropModal = ({ isOpen, onClose, pregnancyData, onSuccess, preSelectedFarmer, preSelectedAnimal, taskId }) => {
    const queryClient = useQueryClient();
    
    const toTitleCase = (str) => {
        if (!str) return "";
        return str
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    // Standalone selectors state (used when pregnancyData is not provided)
    const [selectedFarmerId, setSelectedFarmerId] = useState("");
    const [searchFarmer, setSearchFarmer] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedAnimalId, setSelectedAnimalId] = useState("");

    const [formData, setFormData] = useState({
        pregnancyId: '',
        animalId: '',
        date: new Date().toISOString().split('T')[0],
        calvingEase: 'Natural',
        outcome: 'live_birth',
        numberOfCalves: 1,
        calves: [
            { sex: 'F', earTag: '', color: '', brand: '', imageUrl: '', isLiving: true }
        ],
        technicianNote: ''
    });

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
                    setSelectedFarmerId(preSelectedFarmer._id || preSelectedFarmer);
                    setSearchFarmer(preSelectedFarmer.name || '');
                }
                if (preSelectedAnimal) {
                    setSelectedAnimalId(preSelectedAnimal._id || preSelectedAnimal);
                }
            });
        } else {
            Promise.resolve().then(() => {
                setSelectedFarmerId('');
                setSearchFarmer('');
                setIsDropdownOpen(false);
                setSelectedAnimalId('');
                setFieldErrors({});
                setFormData({
                    pregnancyId: '',
                    animalId: '',
                    date: new Date().toISOString().split('T')[0],
                    calvingEase: 'Natural',
        outcome: 'live_birth',
                    numberOfCalves: 1,
                    calves: [
                        { sex: 'F', earTag: '', color: '', brand: '', imageUrl: '', isLiving: true }
                    ],
                    technicianNote: ''
                });
            });
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, preSelectedFarmer, preSelectedAnimal]);

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
        enabled: isOpen && !pregnancyData,
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
        enabled: !!selectedFarmerId && isOpen && !pregnancyData,
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
        enabled: !!selectedAnimalId && isOpen && !pregnancyData,
    });

    // Filter to pregnant cows for calving selection
    const pregnantAnimals = pregnancyData 
        ? [] 
        : animals.filter(a => a.reproductiveStatus === "Pregnant");

    const activePregnancy = useMemo(
        () => {
            const calvedPregnancyIds = new Set(
                (animalHistory.calvings || []).map((item) => String(item.pregnancyId?._id || item.pregnancyId)),
            );
            const activePregnancyRecord = (animalHistory.pregnancies || []).find((item) =>
                item.pregnancyDiagnosis?.result === "Pregnant" &&
                !["lost", "completed"].includes(item.cycleStatus) &&
                !calvedPregnancyIds.has(String(item._id || item.id)),
            );
            return pregnancyData || activePregnancyRecord || null;
        },
        [animalHistory.calvings, animalHistory.pregnancies, pregnancyData]
    );

    // Sync active pregnancy details with form data
    useEffect(() => {
        if (activePregnancy) {
            Promise.resolve().then(() => {
                setFormData(prev => ({
                    ...prev,
                    pregnancyId: activePregnancy._id || activePregnancy.id,
                    animalId: activePregnancy.animalId?._id || activePregnancy.animalId || selectedAnimalId
                }));
            });
        } else if (!pregnancyData) {
            Promise.resolve().then(() => {
                setFormData(prev => ({
                    ...prev,
                    pregnancyId: '',
                    animalId: ''
                }));
            });
        }
    }, [activePregnancy, selectedAnimalId, isOpen, pregnancyData]);

    const handleNumCalvesChange = (num) => {
        const count = parseInt(num);
        if (isNaN(count) || count < 1) return;
        
        let newCalves = [...formData.calves];
        if (count > newCalves.length) {
            for (let i = newCalves.length; i < count; i++) {
                newCalves.push({ sex: 'F', earTag: '', color: '', brand: '', imageUrl: '', isLiving: true });
            }
        } else {
            newCalves = newCalves.slice(0, count);
        }
        
        setFormData({ ...formData, numberOfCalves: count, calves: newCalves });
    };

    const handleOutcomeChange = (outcome) => {
        if (outcome === "abortion") {
            setFormData((current) => ({
                ...current,
                outcome,
                numberOfCalves: 0,
                calves: [],
            }));
            return;
        }

        setFormData((current) => {
            let calves = current.calves.length
                ? current.calves
                : [{ sex: "F", earTag: "", color: "", brand: "", imageUrl: "", isLiving: true }];
            if (outcome === "mixed" && calves.length < 2) {
                calves = [
                    { ...calves[0], isLiving: true },
                    { sex: "F", earTag: "", color: "", brand: "", imageUrl: "", isLiving: false },
                ];
            } else {
                calves = calves.map((calf, index) => ({
                    ...calf,
                    isLiving:
                        outcome === "live_birth"
                            ? true
                            : outcome === "stillbirth"
                              ? false
                              : index === 0,
                }));
            }
            return {
                ...current,
                outcome,
                numberOfCalves: calves.length,
                calves,
            };
        });
    };

    const updateCalf = (index, field, value) => {
        const newCalves = [...formData.calves];
        newCalves[index][field] = value;
        setFormData({ ...formData, calves: newCalves });
    };

    const handleImageUpload = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Select a valid image file.");
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image size must be less than 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            updateCalf(index, 'imageUrl', reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleAutoGenerateTag = (index) => {
        const generated = `CF-${Date.now().toString().slice(-4)}-${index + 1}`;
        updateCalf(index, 'earTag', generated);
    };

    const mutation = useMutation({
        mutationFn: async (data) => {
            const res = await axiosInstance.post('/technician/record-calving', data);
            return res.data;
        },
        onSuccess: async (result) => {
            toast.success("Calf Drop and offspring successfully recorded!");
            await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ["technician"] }),
                queryClient.invalidateQueries({ queryKey: ["farmer-animals"] }),
                queryClient.invalidateQueries({ queryKey: ["animal-history"] }),
                queryClient.invalidateQueries({ queryKey: ["animal", formData.animalId] }),
            ]);
            if (onSuccess) onSuccess(result);
            onClose();
        },
        onError: (error) => {
            toast.error("Failed to record Calf Drop: " + (error.response?.data?.message || error.message));
        }
    });

    const handleSave = () => {
        if (!formData.animalId || !formData.pregnancyId) {
            toast.error("Please select a mother with an active pregnancy record.");
            return;
        }

        const livingCalves = formData.outcome === "mixed"
            ? formData.calves.filter((calf) => calf.isLiving)
            : formData.outcome === "live_birth" ? formData.calves : [];
        const nonLivingCalves = formData.outcome === "mixed"
            ? formData.calves.filter((calf) => !calf.isLiving)
            : formData.outcome === "stillbirth" ? formData.calves : [];

        if (formData.outcome === "mixed" && (livingCalves.length === 0 || nonLivingCalves.length === 0)) {
            toast.error("A mixed outcome requires at least one living and one non-living calf.");
            return;
        }

        // Living offspring become registered animals and require unique identifiers.
        for (let i = 0; i < livingCalves.length; i++) {
            if (!livingCalves[i].earTag.trim()) {
                toast.error(`Please provide an Ear Tag ID for Calf #${i + 1}`);
                return;
            }
        }
        const normalizedLivingTags = livingCalves.map((calf) => calf.earTag.trim().toLowerCase());
        if (new Set(normalizedLivingTags).size !== normalizedLivingTags.length) {
            toast.error("Living calf ear tags must be unique within this record.");
            return;
        }

        let payload = { ...formData, taskId };
        
        // Handle Mixed outcome logic
        if (formData.outcome === 'mixed') {
            payload.calves = livingCalves;
            payload.nonLivingCalves = nonLivingCalves;
        } else if (formData.outcome === 'stillbirth') {
            payload.nonLivingCalves = formData.calves;
            payload.calves = [];
        } else if (formData.outcome === 'abortion') {
            payload.numberOfCalves = 0;
            payload.nonLivingCalves = [];
            payload.calves = [];
        }

        mutation.mutate(payload);
    };

    if (!isOpen) return null;

    const motherEarTag = pregnancyData?.animalId?.earTag || 
        (animals.find(a => a._id === selectedAnimalId)?.earTag || "Selected Animal");

    return (
        <AnimatePresence>
            <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="record-calving-title">
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="modal-box relative flex max-h-[86vh] w-11/12 max-w-3xl flex-col overflow-hidden border border-base-300 p-0"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-base-300 bg-base-200/40 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Baby size={20} />
                            </div>
                            <div>
                                <h2 id="record-calving-title" className="text-lg font-bold text-base-content">Record Calving</h2>
                                <p className="mt-1 text-sm text-base-content/65">
                                    Link birth details and offspring to Mother #{motherEarTag}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => !mutation.isPending && onClose()}
                            disabled={mutation.isPending}
                            className="btn btn-ghost btn-sm btn-square"
                            aria-label="Close calving form"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 pb-32 pt-6 space-y-6 custom-scrollbar bg-base-100">
                        {/* Standalone selectors */}
                        {!pregnancyData && (
                            <div className="bg-base-200/20 border border-base-300 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Farmer Search */}
                                <div className="space-y-1.5 relative">
                                    <label className={labelClass}>Farmer Owner</label>
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
                                                    setSelectedFarmerId("");
                                                    setSelectedAnimalId("");
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
                                                                        }}
                                                                        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-base-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary cursor-pointer"
                                                                    >
                                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                                            {(farmer.name || "Farmer").substring(0, 2).toUpperCase()}
                                                                        </span>
                                                                        <span className="min-w-0">
                                                                            <span className="block truncate text-sm font-bold text-base-content">{farmer.name}</span>
                                                                            <span className="block text-xs font-medium text-base-content/60">
                                                                                {farmer.phoneNumber || "No Contact"} • {typeof farmer.address === "string" ? toTitleCase(farmer.address) : (farmer.address?.barangay ? toTitleCase(farmer.address.barangay) : "No Barangay")}
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
                                </div>

                                {/* Animal selector */}
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Pregnant Cow</label>
                                    {preSelectedAnimal ? (
                                        <div className="flex items-center gap-3 h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content/65 select-none">
                                            <span className="truncate">Tag #{preSelectedAnimal.earTag} ({preSelectedAnimal.breed || "Crossbreed"})</span>
                                        </div>
                                    ) : (
                                        <select
                                            disabled={!selectedFarmerId || isLoadingAnimals || isAnimalsError}
                                            value={selectedAnimalId}
                                            onChange={(e) => setSelectedAnimalId(e.target.value)}
                                            className={`${selectClass} cursor-pointer disabled:opacity-50`}
                                        >
                                            <option value="">{isLoadingAnimals ? "Synchronizing..." : "Select pregnant cow..."}</option>
                                            {pregnantAnimals.map((a) => (
                                                <option key={a._id} value={a._id}>
                                                    Tag #{a.earTag} ({a.breed}) - {a.reproductiveStatus || "Normal"}
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
                                    {selectedFarmerId && !isLoadingAnimals && !isAnimalsError && pregnantAnimals.length === 0 && (
                                        <p className="text-sm text-base-content/60">No pregnant cows are available for this farmer.</p>
                                    )}
                                </div>

                                {/* Insemination/pregnancy check info */}
                                {selectedAnimalId && (
                                    <div className="col-span-2">
                                        {isLoadingHistory ? (
                                            <div className="skeleton h-16 w-full" role="status" aria-label="Loading pregnancy references" />
                                        ) : isHistoryError ? (
                                            <div className="alert alert-error text-sm" role="alert">
                                                <span>{historyError?.response?.data?.message || "Unable to load pregnancy records."}</span>
                                                <button type="button" className="btn btn-ghost btn-xs" onClick={() => refetchHistory()}>Try again</button>
                                            </div>
                                        ) : activePregnancy ? (
                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                                                <Sparkles size={16} className="text-emerald-500" />
                                                <div>
                                                    <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Active Pregnancy Connected</h5>
                                                    <p className="text-[9px] font-bold text-base-content/40 uppercase mt-1 leading-tight">
                                                        Diagnosis Date: {formatDate(activePregnancy.pregnancyDiagnosis?.date || activePregnancy.createdAt)} • Expected calving: {formatDate(activePregnancy.targetCalvingDate)}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                                                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">No active pregnancy found</h5>
                                                    <p className="text-[9px] font-bold text-base-content/40 uppercase mt-1 leading-tight">
                                                        A calving record requires a confirmed pregnancy check record for this animal.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Basic Info Section (Visible if pregnancy record is resolved) */}
                        {(pregnancyData || activePregnancy) && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">Drop Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                                            <input 
                                                type="date"
                                                max={new Date().toISOString().slice(0, 10)}
                                                value={formData.date}
                                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                                className="w-full h-11 bg-base-200 border border-base-300 rounded-xl pl-10 pr-4 text-xs font-bold text-base-content focus:outline-none transition-all cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">Outcome</label>
                                        <select 
                                            value={formData.outcome}
                                            onChange={(e) => handleOutcomeChange(e.target.value)}
                                            className="w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:outline-none transition-all cursor-pointer"
                                        >
                                            <option value="live_birth">Live Birth</option>
                                            <option value="mixed">Mixed Vitality</option>
                                            <option value="stillbirth">Stillbirth</option>
                                            <option value="abortion">Abortion (Pregnancy Loss)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">Delivery Method</label>
                                        <select 
                                            value={formData.calvingEase}
                                            onChange={(e) => setFormData({...formData, calvingEase: e.target.value})}
                                            className="w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:outline-none transition-all cursor-pointer"
                                        >
                                            <option value="Natural">Natural</option>
                                            <option value="Normal">Normal</option>
                                            <option value="Difficult">Difficult</option>
                                            <option value="Cesarean">Cesarean</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">No. of Calves</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number"
                                                min="1"
                                                max="5"
                                                value={formData.numberOfCalves}
                                                onChange={(e) => handleNumCalvesChange(e.target.value)}
                                                className="w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:outline-none transition-all"
                                            />
                                            <span className="text-[10px] font-black text-base-content/40 uppercase">Head</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Offspring Details Section */}
                                {formData.outcome === 'abortion' ? (
                                    <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 flex items-start gap-3 mt-4">
                                        <AlertCircle size={20} className="text-rose-500 shrink-0" />
                                        <div>
                                            <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest">Pregnancy Loss</h4>
                                            <p className="text-[10px] font-bold text-base-content/60 leading-relaxed mt-1">
                                                An abortion will be recorded for this pregnancy. The mother's reproductive cycle will be reset to post-partum and the breeding history preserved. No calf records will be generated.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[10px] font-black text-base-content/50 uppercase tracking-widest pl-2 border-l-4 border-emerald-500 py-0.5">Offspring Registry</h3>
                                        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                            <span className="text-[8px] font-black uppercase tracking-widest leading-none">Auto-creating Animal Records</span>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10">
                                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-relaxed">
                                            Each calf registered below will automatically be added to the municipality's animal registry and linked to Mother 
                                            <span className="font-black mx-1 underline">#{motherEarTag}</span>.
                                        </p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {formData.calves.map((calf, index) => (
                                            <motion.div 
                                                key={index}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="bg-base-200/40 border border-base-300 rounded-2xl p-5 relative group hover:border-emerald-500/30 transition-all"
                                            >
                                                <div className={`absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-black shadow-md ${!calf.isLiving ? 'bg-slate-400' : 'bg-emerald-500'}`}>
                                                    {index + 1}
                                                </div>
                                                {formData.outcome === 'mixed' && (
                                                    <div className="absolute top-4 right-4 flex items-center gap-2">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-base-content/50">Living</span>
                                                        <input 
                                                            type="checkbox" 
                                                            className="toggle toggle-sm toggle-success" 
                                                            checked={calf.isLiving} 
                                                            onChange={(e) => updateCalf(index, 'isLiving', e.target.checked)} 
                                                        />
                                                    </div>
                                                )}
                                                
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Sex</label>
                                                        <div className="flex p-0.5 bg-base-100 rounded-lg border border-base-300">
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateCalf(index, 'sex', 'F')}
                                                                className={`flex-1 py-1 rounded text-[9px] font-black transition-all cursor-pointer ${calf.sex === 'F' ? 'bg-rose-500/15 text-rose-600' : 'text-base-content/40 hover:bg-base-200'}`}
                                                            >
                                                                Female
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => updateCalf(index, 'sex', 'M')}
                                                                className={`flex-1 py-1 rounded text-[9px] font-black transition-all cursor-pointer ${calf.sex === 'M' ? 'bg-blue-500/15 text-blue-600' : 'text-base-content/40 hover:bg-base-200'}`}
                                                            >
                                                                Male
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Color</label>
                                                            <input 
                                                                type="text"
                                                                value={calf.color || ''}
                                                                onChange={(e) => updateCalf(index, 'color', e.target.value)}
                                                                placeholder="e.g. Red, Black"
                                                                className="w-full bg-base-100 border border-base-300 rounded-lg py-1 px-2.5 text-xs font-bold text-base-content outline-none focus:border-emerald-500 transition-all"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Brand Mark (Optional)</label>
                                                            <input 
                                                                type="text"
                                                                value={calf.brand || ''}
                                                                onChange={(e) => updateCalf(index, 'brand', e.target.value)}
                                                                placeholder="e.g. Left Hip"
                                                                className="w-full bg-base-100 border border-base-300 rounded-lg py-1 px-2.5 text-xs font-bold text-base-content outline-none focus:border-emerald-500 transition-all"
                                                            />
                                                        </div>
                                                    </div>

                                                    {calf.isLiving && (
                                                        <div>
                                                            <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Calf Image (Optional)</label>
                                                            <div className="flex gap-2 items-center">
                                                                {calf.imageUrl ? (
                                                                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/30 shrink-0">
                                                                        <img src={calf.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                                        <button type="button" onClick={() => updateCalf(index, 'imageUrl', '')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                                            <X size={14} className="text-white" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <label className="w-10 h-10 rounded-lg border border-dashed border-base-300 flex items-center justify-center bg-base-100 cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5 transition-all shrink-0">
                                                                        <span className="text-xl leading-none font-light text-base-content/30">+</span>
                                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(index, e)} />
                                                                    </label>
                                                                )}
                                                                <div className="flex-1 text-[9px] font-medium text-base-content/50 leading-tight">
                                                                    Upload a photo of the calf. Max 5MB.
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Calf's ID No. / Ear Tag</label>
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text"
                                                                value={calf.earTag}
                                                                onChange={(e) => updateCalf(index, 'earTag', e.target.value)}
                                                                placeholder="e.g. 104"
                                                                className="flex-1 bg-base-100 border border-base-300 rounded-lg py-1 px-2.5 text-xs font-black text-base-content outline-none focus:border-emerald-500 transition-all uppercase"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAutoGenerateTag(index)}
                                                                className="px-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer"
                                                            >
                                                                Auto-Generate
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                                )}
                                {/* Notes Section */}
                                <div className="bg-base-200/40 rounded-2xl p-5 border border-base-300">
                                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block mb-2">Technical Observations</label>
                                    <textarea 
                                        placeholder="Describe any complications, vaccinations given at birth, or specific observations..."
                                        value={formData.technicianNote}
                                        onChange={(e) => setFormData({...formData, technicianNote: e.target.value})}
                                        className="w-full bg-base-100 border border-base-300 rounded-2xl py-3 px-4 text-xs font-bold text-base-content focus:border-emerald-500 transition-all outline-none min-h-22.5 resize-none"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-base-300 bg-base-200/20 flex gap-4">
                        <button 
                            type="button"
                            onClick={() => !mutation.isPending && onClose()}
                            disabled={mutation.isPending}
                            className="btn btn-ghost flex-1"
                        >
                            Discard
                        </button>
                        <button 
                            type="button"
                            onClick={handleSave}
                            disabled={mutation.isPending || (!pregnancyData && !activePregnancy)}
                            className="btn btn-primary flex-2"
                        >
                            {mutation.isPending ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <>
                                    <ClipboardCheck size={16} />
                                    <span>Save calving record</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
                <button type="button" className="modal-backdrop" onClick={() => !mutation.isPending && onClose()} aria-label="Close calving form" />
            </div>
        </AnimatePresence>
    );
};

export default RecordCalfDropModal;
