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
    const { data: farmers = [] } = useQuery({
        queryKey: ["farmers", "list"],
        queryFn: async () => {
            const res = await axiosInstance.get("/user?role=farmer");
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: isOpen && !pregnancyData,
    });

    const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
        queryKey: ["farmer-animals", selectedFarmerId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
            return Array.isArray(res.data) ? res.data : res.data.data || [];
        },
        enabled: !!selectedFarmerId && isOpen && !pregnancyData,
    });

    const { data: animalHistory = {}, isLoading: isLoadingHistory } = useQuery({
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
            const pregnanciesList = animalHistory.pregnancies || [];
            return pregnancyData || (pregnanciesList.length > 0 ? pregnanciesList[0] : null);
        },
        [animalHistory.pregnancies, pregnancyData]
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

    const updateCalf = (index, field, value) => {
        const newCalves = [...formData.calves];
        newCalves[index][field] = value;
        setFormData({ ...formData, calves: newCalves });
    };

    const handleImageUpload = (index, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
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
        onSuccess: () => {
            toast.success("Calf Drop and offspring successfully recorded!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
            queryClient.invalidateQueries({ queryKey: ["technician", "schedule"] });
            queryClient.invalidateQueries({ queryKey: ["farmer-animals"] });
            queryClient.invalidateQueries({ queryKey: ["animal-history"] });
            if (onSuccess) onSuccess();
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

        // Validate calf tags
        for (let i = 0; i < formData.calves.length; i++) {
            if (!formData.calves[i].earTag.trim()) {
                toast.error(`Please provide an Ear Tag ID for Calf #${i + 1}`);
                return;
            }
        }

        let payload = { ...formData, taskId };
        
        // Handle Mixed outcome logic
        if (formData.outcome === 'mixed') {
            const living = formData.calves.filter(c => c.isLiving);
            const nonLiving = formData.calves.filter(c => !c.isLiving);
            payload.calves = living;
            payload.nonLivingCalves = nonLiving;
        } else if (formData.outcome === 'stillbirth' || formData.outcome === 'abortion') {
            // Backend handles this differently but web just sends them normally, though abortion ignores calves
            payload.nonLivingCalves = formData.calves;
            payload.calves = [];
        }

        mutation.mutate(payload);
    };

    if (!isOpen) return null;

    const motherEarTag = pregnancyData?.animalId?.earTag || 
        (animals.find(a => a._id === selectedAnimalId)?.earTag || "Selected Animal");

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-base-100 border border-base-300 rounded-2xl max-w-3xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[86vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-base-300 bg-base-200/40 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <Baby size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-base-content leading-none uppercase">Record Calving</h2>
                                <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mt-1.5 leading-none">
                                    Link birth details and offspring to Mother #{motherEarTag}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => !mutation.isPending && onClose()}
                            disabled={mutation.isPending}
                            className="p-2 bg-base-200 text-base-content/40 hover:text-base-content rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                                                        {farmers.filter((f) =>
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
                                            disabled={!selectedFarmerId || isLoadingAnimals}
                                            value={selectedAnimalId}
                                            onChange={(e) => setSelectedAnimalId(e.target.value)}
                                            className={`${selectClass} cursor-pointer disabled:opacity-50`}
                                        >
                                            <option value="">{isLoadingAnimals ? "Synchronizing..." : "Select pregnant cow..."}</option>
                                            {pregnantAnimals.map((a) => (
                                                <option key={a._id} value={a._id}>
                                                    Tag #{a.earTag} ({a.breed}) — {a.reproductiveStatus || "Normal"}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Insemination/pregnancy check info */}
                                {selectedAnimalId && (
                                    <div className="col-span-2">
                                        {isLoadingHistory ? (
                                            <div className="text-xs font-bold text-slate-400">Loading pregnancy references...</div>
                                        ) : activePregnancy ? (
                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                                                <Sparkles size={16} className="text-emerald-500" />
                                                <div>
                                                    <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Active Pregnancy Connected</h5>
                                                    <p className="text-[9px] font-bold text-base-content/40 uppercase mt-1 leading-tight">
                                                        Diagnosis Date: {formatDate(activePregnancy.pregnancyDiagnosis?.date || activePregnancy.createdAt)} • Expected calving: {new Date(activePregnancy.targetCalvingDate).toLocaleDateString()}
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
                                            onChange={(e) => setFormData({...formData, outcome: e.target.value})}
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
                            onClick={() => !mutation.isPending && onClose()}
                            disabled={mutation.isPending}
                            className="flex-1 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest text-base-content/50 hover:bg-base-200 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={mutation.isPending || (!pregnancyData && !activePregnancy)}
                            className="flex-2 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {mutation.isPending ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <>
                                    <ClipboardCheck size={16} />
                                    <span>Register Offspring & Update Ledger</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RecordCalfDropModal;
