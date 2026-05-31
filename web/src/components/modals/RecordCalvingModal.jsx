import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Baby, Calendar, ClipboardCheck, Search, ChevronDown, User, AlertCircle, Info, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const inputClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all appearance-none`;
const labelClass = `text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] ml-1`;

const RecordCalfDropModal = ({ isOpen, onClose, pregnancyData, onSuccess }) => {
    const queryClient = useQueryClient();
    
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
        numberOfCalves: 1,
        calves: [
            { sex: 'F', earTag: '', weight: '', color: '', brand: '' }
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
        } else {
            setSelectedFarmerId('');
            setSearchFarmer('');
            setIsDropdownOpen(false);
            setSelectedAnimalId('');
            setFormData({
                pregnancyId: '',
                animalId: '',
                date: new Date().toISOString().split('T')[0],
                calvingEase: 'Natural',
                numberOfCalves: 1,
                calves: [
                    { sex: 'F', earTag: '', weight: '', color: '', brand: '' }
                ],
                technicianNote: ''
            });
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

    const pregnanciesList = animalHistory.pregnancies || [];
    const activePregnancy = pregnancyData || (pregnanciesList.length > 0 ? pregnanciesList[0] : null);

    // Sync active pregnancy details with form data
    useEffect(() => {
        if (activePregnancy) {
            setFormData(prev => ({
                ...prev,
                pregnancyId: activePregnancy._id || activePregnancy.id,
                animalId: activePregnancy.animalId?._id || activePregnancy.animalId || selectedAnimalId
            }));
        } else if (!pregnancyData) {
            setFormData(prev => ({
                ...prev,
                pregnancyId: '',
                animalId: ''
            }));
        }
    }, [activePregnancy, selectedAnimalId, isOpen]);

    const handleNumCalvesChange = (num) => {
        const count = parseInt(num);
        if (isNaN(count) || count < 1) return;
        
        let newCalves = [...formData.calves];
        if (count > newCalves.length) {
            for (let i = newCalves.length; i < count; i++) {
                newCalves.push({ sex: 'F', earTag: '', weight: '', color: '', brand: '' });
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

        mutation.mutate(formData);
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
                    className="bg-base-100 border border-base-300 rounded-3xl max-w-4xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-base-300 bg-base-200/40 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <Baby size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-base-content leading-none uppercase">Record Calf Drop</h2>
                                <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mt-1.5 leading-none">
                                    Registering offspring for Mother: #{motherEarTag}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-base-200 text-base-content/40 hover:text-base-content rounded-full transition-colors cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-base-100">
                        {/* Standalone selectors */}
                        {!pregnancyData && (
                            <div className="bg-base-200/20 border border-base-300 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Farmer Search */}
                                <div className="space-y-1.5 relative">
                                    <label className={labelClass}>Farmer Owner</label>
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

                                {/* Animal selector */}
                                <div className="space-y-1.5">
                                    <label className={labelClass}>Pregnant Cow</label>
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">Drop Date</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                                            <input 
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                                className="w-full h-11 bg-base-200 border border-base-300 rounded-xl pl-10 pr-4 text-xs font-bold text-base-content focus:outline-none transition-all cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">Calving Ease</label>
                                        <select 
                                            value={formData.calvingEase}
                                            onChange={(e) => setFormData({...formData, calvingEase: e.target.value})}
                                            className="w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus:outline-none transition-all cursor-pointer"
                                        >
                                            <option value="Natural">Natural</option>
                                            <option value="Difficult">Difficult</option>
                                            <option value="Abortion">Abortion</option>
                                            <option value="Stillbirth">Stillbirth</option>
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
                                                <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-md">
                                                    {index + 1}
                                                </div>
                                                
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
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
                                                        <div>
                                                            <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Birth Weight (kg)</label>
                                                            <input 
                                                                type="number"
                                                                value={calf.weight}
                                                                onChange={(e) => updateCalf(index, 'weight', e.target.value)}
                                                                placeholder="0.00"
                                                                className="w-full bg-base-100 border border-base-300 rounded-lg py-1 px-2.5 text-xs font-bold text-base-content outline-none focus:border-emerald-500 transition-all"
                                                            />
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

                                                    <div>
                                                        <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Calf's ID No. / Ear Tag</label>
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text"
                                                                value={calf.earTag}
                                                                onChange={(e) => updateCalf(index, 'earTag', e.target.value)}
                                                                placeholder="TAG-XXXXX"
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

                                {/* Notes Section */}
                                <div className="bg-base-200/40 rounded-2xl p-5 border border-base-300">
                                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block mb-2">Technical Observations</label>
                                    <textarea 
                                        placeholder="Describe any complications, vaccinations given at birth, or specific observations..."
                                        value={formData.technicianNote}
                                        onChange={(e) => setFormData({...formData, technicianNote: e.target.value})}
                                        className="w-full bg-base-100 border border-base-300 rounded-2xl py-3 px-4 text-xs font-bold text-base-content focus:border-emerald-500 transition-all outline-none min-h-[90px] resize-none"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-base-300 bg-base-200/20 flex gap-4">
                        <button 
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest text-base-content/50 hover:bg-base-200 transition-all cursor-pointer"
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
