import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Baby, Calendar, ClipboardCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const RecordCalfDropModal = ({ isOpen, onClose, pregnancyData, onSuccess }) => {
    const queryClient = useQueryClient();
    
    const [formData, setFormData] = useState({
        pregnancyId: '',
        animalId: '',
        date: new Date().toISOString().split('T')[0],
        calvingEase: 'Natural',
        numberOfCalves: 1,
        calves: [
            { sex: 'F', earTag: '', weight: '' }
        ],
        technicianNote: ''
    });

    useEffect(() => {
        if (pregnancyData) {
            setFormData(prev => ({
                ...prev,
                pregnancyId: pregnancyData._id || pregnancyData.id,
                animalId: pregnancyData.animalId?._id || pregnancyData.animalId
            }));
        }
    }, [pregnancyData, isOpen]);

    const handleNumCalvesChange = (num) => {
        const count = parseInt(num);
        if (isNaN(count) || count < 1) return;
        
        let newCalves = [...formData.calves];
        if (count > newCalves.length) {
            for (let i = newCalves.length; i < count; i++) {
                newCalves.push({ sex: 'F', earTag: '', weight: '' });
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

    const mutation = useMutation({
        mutationFn: async (data) => {
            const res = await axiosInstance.post('/technician/record-calving', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Calf Drop and offspring successfully recorded!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error("Failed to record Calf Drop: " + (error.response?.data?.message || error.message));
        }
    });

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                
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
                                    Registering offspring for {pregnancyData?.animalId?.earTag || "Selected Animal"}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-base-200 text-base-content/40 hover:text-base-content rounded-full transition-colors cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-base-100">
                        {/* Basic Info Section */}
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
                                <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">Calving Ease (CD)</label>
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
                                <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1 block">No. of Calving</label>
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
                                    Each calf registered below will automatically be added to the municipality's animal registry and linked to mother 
                                    <span className="font-black mx-1 underline">#{pregnancyData?.animalId?.earTag || "---"}</span>.
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
                                            <div>
                                                <label className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mb-1.5 block">Calf's ID No.</label>
                                                <input 
                                                    type="text"
                                                    value={calf.earTag}
                                                    onChange={(e) => updateCalf(index, 'earTag', e.target.value)}
                                                    placeholder="TAG-XXXXX"
                                                    className="w-full bg-base-100 border border-base-300 rounded-lg py-1 px-2.5 text-xs font-black text-base-content outline-none focus:border-emerald-500 transition-all uppercase"
                                                />
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
                            onClick={() => mutation.mutate(formData)}
                            disabled={mutation.isPending}
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
