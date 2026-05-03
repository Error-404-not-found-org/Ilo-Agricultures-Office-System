import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, User, Activity, Calendar, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';

const RegisterLivestockModal = ({ isOpen, onClose, onSuccess }) => {
    const queryClient = useQueryClient();
    const toast = useToast();
    
    const [isExistingFarmer, setIsExistingFarmer] = useState(true);
    const [selectedFarmerId, setSelectedFarmerId] = useState('');

    const [formData, setFormData] = useState({
        farmerName: '',
        earTag: '',
        species: 'Cattle / Cow',
        breed: '',
        color: '',
        sex: 'Female',
        dob: ''
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

    const mutation = useMutation({
        mutationFn: async (data) => {
            const res = await axiosInstance.post('/technician/walk-in-livestock', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Livestock profile registered successfully!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error("Failed to register livestock: " + (error.response?.data?.message || error.message));
        }
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        let submissionData = { ...formData };
        
        if (isExistingFarmer) {
            if (!selectedFarmerId) return toast.error("Please select a farmer.");
            const farmer = farmers.find(f => f._id === selectedFarmerId);
            submissionData.farmerName = farmer.name;
            // The backend handles the lookup by name or ID. 
            // Sending ID is safer.
            submissionData.farmerId = selectedFarmerId;
        } else {
            if (!formData.farmerName) return toast.error("Farmer reference is required.");
        }

        if (!formData.earTag) return toast.error("Ear Tag is required.");
        
        mutation.mutate(submissionData);
    };

    return (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white border-4 border-black w-full max-w-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden max-h-[95vh]"
            >
                {/* Header */}
                <div className="bg-[#074033] p-8 text-white relative border-b-4 border-black">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 transition-all border-2 border-transparent hover:border-white/20">
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 flex items-center justify-center border-2 border-white/20">
                            <Plus size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight uppercase leading-none">Register Animal</h2>
                            <p className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mt-2">Asset Registry · Field Operations</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    {/* Toggle Selector */}
                    <div className="flex border-4 border-black bg-slate-100 p-1">
                        <button 
                            onClick={() => setIsExistingFarmer(true)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isExistingFarmer ? 'bg-black text-white' : 'text-slate-500 hover:text-black'}`}
                        >
                            Existing Farmer
                        </button>
                        <button 
                            onClick={() => setIsExistingFarmer(false)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${!isExistingFarmer ? 'bg-black text-white' : 'text-slate-500 hover:text-black'}`}
                        >
                            New Entry
                        </button>
                    </div>

                    {/* Owner Reference */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                            <User size={18} className="text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-black">Ownership Context</h3>
                        </div>
                        
                        {isExistingFarmer ? (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Select Farmer</label>
                                <div className="relative">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select 
                                        value={selectedFarmerId}
                                        onChange={(e) => setSelectedFarmerId(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                                    >
                                        <option value="">Choose Farmer...</option>
                                        {farmers.map(f => (
                                            <option key={f._id} value={f._id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Farmer Name / System ID</label>
                                <input 
                                    type="text" 
                                    value={formData.farmerName}
                                    onChange={(e) => setFormData({...formData, farmerName: e.target.value})}
                                    placeholder="Start typing name or paste ID..."
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                        )}
                    </section>

                    {/* Animal Bio */}
                    <section className="space-y-5">
                        <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                            <Activity size={18} className="text-emerald-600" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-black">Biological Data</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Ear Tag No.</label>
                                <input 
                                    type="text" 
                                    value={formData.earTag}
                                    onChange={(e) => setFormData({...formData, earTag: e.target.value})}
                                    placeholder="e.g. 1042"
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Species</label>
                                <select 
                                    value={formData.species}
                                    onChange={(e) => setFormData({...formData, species: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                                >
                                    <option>Cattle / Cow</option>
                                    <option>Swine</option>
                                    <option>Carabao</option>
                                    <option>Goat</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Gender</label>
                                <select 
                                    value={formData.sex}
                                    onChange={(e) => setFormData({...formData, sex: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                                >
                                    <option>Female</option>
                                    <option>Male</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Date of Birth</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="date" 
                                        value={formData.dob}
                                        onChange={(e) => setFormData({...formData, dob: e.target.value})}
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 border-t-4 border-black">
                    <button 
                        disabled={mutation.isPending}
                        onClick={handleSubmit}
                        className="w-full h-14 bg-black hover:bg-[#074033] text-white font-black uppercase tracking-[0.2em] text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:translate-y-1 active:shadow-none"
                    >
                        {mutation.isPending && <span className="loading loading-spinner loading-xs"></span>}
                        {mutation.isPending ? 'INITIALIZING ASSET...' : 'COMPLETE REGISTRATION'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default RegisterLivestockModal;

