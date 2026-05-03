import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HeartPulse, User, Activity, ClipboardList, Search, PlusCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';

const WalkInHealthModal = ({ isOpen, onClose, onSuccess, prefillData }) => {
    const queryClient = useQueryClient();
    const toast = useToast();
    
    const [isExistingFarmer, setIsExistingFarmer] = useState(true);
    const [selectedFarmerId, setSelectedFarmerId] = useState('');
    const [selectedAnimalId, setSelectedAnimalId] = useState('');
    
    const [formData, setFormData] = useState({
        farmerName: '',
        earTag: '',
        diagnosis: '',
        urgency: 'low',
        autoResolve: true 
    });

    // Fetch Farmers
    const { data: farmers = [] } = useQuery({
        queryKey: ["farmers", "list"],
        queryFn: async () => {
            const res = await axiosInstance.get('/user?role=farmer');
            return Array.isArray(res.data) ? res.data : (res.data.data || []);
        },
        enabled: isOpen
    });

    // Fetch Animals when farmer is selected
    const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
        queryKey: ["farmer-animals", selectedFarmerId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
            return res.data;
        },
        enabled: !!selectedFarmerId && isExistingFarmer
    });

    useEffect(() => {
        if (isOpen && prefillData) {
            setFormData({
                ...formData,
                farmerName: prefillData.farmerName || '',
                earTag: prefillData.earTag || '',
            });
            setIsExistingFarmer(false); // Prefill usually means manual or specific context
        }
    }, [isOpen, prefillData]);

    const mutation = useMutation({
        mutationFn: async (data) => {
            const endpoint = isExistingFarmer ? '/health-request/walk-in' : '/health-request/walk-in';
            // The backend walkInHealthRequest currently finds by earTag. 
            // I should ensure it works if I send the IDs or the Tag.
            const res = await axiosInstance.post(endpoint, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Health record submitted and resolved!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error("Failed to submit health log: " + (error.response?.data?.message || error.message));
        }
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        let submissionData = { ...formData };
        
        if (isExistingFarmer) {
            if (!selectedFarmerId || !selectedAnimalId) {
                return toast.error("Please select both a farmer and an animal.");
            }
            const animal = animals.find(a => a._id === selectedAnimalId);
            submissionData.earTag = animal.earTag;
            submissionData.farmerName = farmers.find(f => f._id === selectedFarmerId)?.name;
        } else {
            if (!formData.earTag) return toast.error("Ear Tag is required.");
        }
        
        if (!submissionData.diagnosis) return toast.error("Please enter diagnosis details.");
        mutation.mutate(submissionData);
    };

    return (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white border-4 border-black w-full max-w-xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden max-h-[90vh]"
            >
                {/* Header */}
                <div className="bg-[#074033] p-8 text-white relative border-b-4 border-black">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 transition-all border-2 border-transparent hover:border-white/20">
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 flex items-center justify-center border-2 border-white/20">
                            <HeartPulse size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight uppercase leading-none">Walk-In Health Log</h2>
                            <p className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mt-2">Field Medicine · Database Sync</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {/* Toggle Selector */}
                    <div className="flex border-4 border-black bg-slate-100 p-1">
                        <button 
                            onClick={() => setIsExistingFarmer(true)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isExistingFarmer ? 'bg-black text-white' : 'text-slate-400 hover:text-black'}`}
                        >
                            Existing Record
                        </button>
                        <button 
                            onClick={() => setIsExistingFarmer(false)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${!isExistingFarmer ? 'bg-black text-white' : 'text-slate-500 hover:text-black'}`}
                        >
                            Manual Entry
                        </button>
                    </div>

                    {isExistingFarmer ? (
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Select Farmer</label>
                                <div className="relative">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select 
                                        value={selectedFarmerId}
                                        onChange={(e) => {
                                            setSelectedFarmerId(e.target.value);
                                            setSelectedAnimalId('');
                                        }}
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                                    >
                                        <option value="">Choose Farmer...</option>
                                        {farmers.map(f => (
                                            <option key={f._id} value={f._id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Select Animal</label>
                                <div className="relative">
                                    <Activity size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select 
                                        disabled={!selectedFarmerId || isLoadingAnimals}
                                        value={selectedAnimalId}
                                        onChange={(e) => setSelectedAnimalId(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none disabled:opacity-50"
                                    >
                                        <option value="">{isLoadingAnimals ? 'Loading Animals...' : 'Choose Animal...'}</option>
                                        {animals.map(a => (
                                            <option key={a._id} value={a._id}>Tag #{a.earTag} ({a.breed})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Farmer Contact Reference</label>
                                <div className="relative">
                                    <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={formData.farmerName}
                                        onChange={(e) => setFormData({...formData, farmerName: e.target.value})}
                                        placeholder="Farmer Name or ID"
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Ear Tag</label>
                                <div className="relative">
                                    <Activity size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={formData.earTag}
                                        onChange={(e) => setFormData({...formData, earTag: e.target.value})}
                                        placeholder="e.g. 1042"
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Urgency Level</label>
                        <select 
                            value={formData.urgency}
                            onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                            className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                        >
                            <option value="low">Low / Routine</option>
                            <option value="medium">Medium</option>
                            <option value="high">High / Emergency</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Diagnosis & Treatment Details</label>
                        <div className="relative">
                            <ClipboardList size={14} className="absolute left-4 top-4 text-slate-400" />
                            <textarea 
                                value={formData.diagnosis}
                                onChange={(e) => setFormData({...formData, diagnosis: e.target.value})}
                                placeholder="Describe symptoms, vaccine name, or medicine given..."
                                className="w-full h-32 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 py-3 text-sm font-bold focus:border-black transition-all outline-none resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 border-t-4 border-black">
                    <button 
                        disabled={mutation.isPending}
                        onClick={handleSubmit}
                        className="w-full h-14 bg-black hover:bg-[#074033] text-white font-black uppercase tracking-[0.2em] text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:translate-y-1 active:shadow-none"
                    >
                        {mutation.isPending && <span className="loading loading-spinner loading-xs"></span>}
                        {mutation.isPending ? 'LOGGING HEALTH EVENT...' : 'SAVE & RESOLVE LOG'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default WalkInHealthModal;
;
