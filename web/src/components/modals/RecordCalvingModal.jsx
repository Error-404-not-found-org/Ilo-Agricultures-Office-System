import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Baby, Plus, Trash2, Calendar, ClipboardCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const RecordCalvingModal = ({ isOpen, onClose, pregnancyData, onSuccess }) => {
    const queryClient = useQueryClient();
    
    const [formData, setFormData] = useState({
        pregnancyId: '',
        animalId: '',
        date: new Date().toISOString().split('T')[0],
        calvingEase: 'Normal',
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
            toast.success("Calving event and offspring successfully recorded!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error("Failed to record calving: " + (error.response?.data?.message || error.message));
        }
    });

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white rounded-4xl max-w-4xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-8 pb-4 flex justify-between items-start border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                                <Baby size={24} className="text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">Record Calving</h2>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                                    Registering offspring for {pregnancyData?.animalId?.earTag || "Selected Animal"}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {/* Basic Info Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Calving Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 pl-12 pr-4 text-[13px] font-black text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Calving Ease</label>
                                <select 
                                    value={formData.calvingEase}
                                    onChange={(e) => setFormData({...formData, calvingEase: e.target.value})}
                                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 px-5 text-[13px] font-black text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none appearance-none"
                                >
                                    <option value="Normal">Normal Delivery</option>
                                    <option value="Difficult">Difficult / Assisted</option>
                                    <option value="Abortion">Abortion</option>
                                    <option value="Stillbirth">Stillbirth</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Number of Calves</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={formData.numberOfCalves}
                                        onChange={(e) => handleNumCalvesChange(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3 px-5 text-[13px] font-black text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                                    />
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Head</span>
                                </div>
                            </div>
                        </div>

                        {/* Offspring Details Section */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-emerald-500 pl-4 py-1">Offspring Registry</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {formData.calves.map((calf, index) => (
                                    <motion.div 
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-slate-50 border border-slate-100 rounded-3xl p-6 relative group hover:border-emerald-200 transition-all"
                                    >
                                        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-lg">
                                            {index + 1}
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Sex</label>
                                                    <div className="flex p-1 bg-white rounded-xl border border-slate-200">
                                                        <button 
                                                            type="button"
                                                            onClick={() => updateCalf(index, 'sex', 'F')}
                                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${calf.sex === 'F' ? 'bg-rose-100 text-rose-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                                        >
                                                            Female
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => updateCalf(index, 'sex', 'M')}
                                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${calf.sex === 'M' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                                        >
                                                            Male
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Birth Weight (kg)</label>
                                                    <input 
                                                        type="number"
                                                        value={calf.weight}
                                                        onChange={(e) => updateCalf(index, 'weight', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Official Ear Tag</label>
                                                <input 
                                                    type="text"
                                                    value={calf.earTag}
                                                    onChange={(e) => updateCalf(index, 'earTag', e.target.value)}
                                                    placeholder="TAG-XXXXX"
                                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-slate-900 outline-none focus:border-emerald-500 transition-all uppercase"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Notes Section */}
                        <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100">
                            <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1 block mb-2">Technical Observations</label>
                            <textarea 
                                placeholder="Describe any complications, vaccinations given at birth, or specific observations..."
                                value={formData.technicianNote}
                                onChange={(e) => setFormData({...formData, technicianNote: e.target.value})}
                                className="w-full bg-white border-2 border-transparent rounded-2xl py-4 px-5 text-[13px] font-bold text-slate-900 focus:border-blue-400 transition-all outline-none min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
                        <button 
                            onClick={onClose}
                            className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={() => mutation.mutate(formData)}
                            disabled={mutation.isPending}
                            className="flex-2 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {mutation.isPending ? (
                                <span className="loading loading-spinner loading-md"></span>
                            ) : (
                                <>
                                    <ClipboardCheck size={20} />
                                    <span>Register Offspring & Update Records</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RecordCalvingModal;
