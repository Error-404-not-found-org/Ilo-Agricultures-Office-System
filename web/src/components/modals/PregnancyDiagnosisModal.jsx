import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, HeartPulse, Sparkles, Calendar, History, ArrowRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const PregnancyDiagnosisModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    const queryClient = useQueryClient();
    const [result, setResult] = useState(''); // 'Pregnant' or 'Empty'
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !taskData) return null;

    const animal = taskData.animal || taskData.raw?.animalId || {};
    const animalId = animal._id || animal.id || (typeof animal === 'string' ? animal : null);
    const inseminationId = taskData.id;

    // Extract breeding history for the current animal
    const recentAIs = (animal.breedingRecords || [])
        .sort((a, b) => new Date(b.inseminationDate) - new Date(a.inseminationDate))
        .slice(0, 3); // Just show the last 3 attempts for context

    const handleSubmit = async () => {
        if (!result) {
            toast.error("Please select a diagnosis result");
            return;
        }

        if (!animalId) {
            toast.error("Critical Error: Animal ID not found.");
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

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/80"
                />
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-base-100 rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col md:flex-row border border-base-300"
                >
                    {/* LEFT SIDE: Breeding Context (Simplified History) */}
                    <div className="md:w-5/12 bg-base-200 p-6 border-r border-base-300">
                        <div className="flex items-center gap-2 mb-6">
                            <History size={16} className="text-emerald-600" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Breeding Context</h4>
                        </div>

                        <div className="space-y-4">
                            {recentAIs.length > 0 ? (
                                recentAIs.map((record, idx) => (
                                    <div key={idx} className="relative pl-6 pb-4 last:pb-0 border-l border-base-300">
                                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-base-300" />
                                        <p className="text-[9px] font-black text-base-content/40 uppercase tracking-tighter leading-none mb-1">
                                            Attempt #{record.attemptNumber || (recentAIs.length - idx)}
                                        </p>
                                        <p className="text-[13px] font-black text-base-content tracking-tight leading-none mb-1">
                                            {formatDate(record.inseminationDate)}
                                        </p>
                                        <p className="text-[10px] font-bold text-base-content/60">
                                            {record.sireBreed || 'Unknown Sire'}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[10px] font-bold text-base-content/20 uppercase tracking-widest italic">No prior AI records found</p>
                            )}

                            <div className="mt-6 pt-6 border-t border-base-300">
                                <div className="flex items-center gap-2 text-purple-600 mb-2">
                                    <Sparkles size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Today's Check</span>
                                </div>
                                <p className="text-[13px] font-black text-base-content tracking-tight">
                                    {taskData.daysSinceAI} Days Post-AI
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Diagnosis Input */}
                    <div className="md:w-7/12 p-6 bg-base-100">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-base-content leading-tight">Pregnancy Check</h3>
                                <p className="text-base-content/40 font-bold text-[10px] uppercase tracking-widest mt-1">
                                    Animal: #{animal.earTag || 'N/A'} • {animal.breed || 'Unknown'}
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-base-200 text-base-content/40 rounded-xl hover:bg-base-300 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Result Selection */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-base-content uppercase tracking-widest ml-1 block">
                                    Diagnosis Result
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setResult('Pregnant')}
                                        className={`flex flex-col items-center justify-center py-6 rounded-2xl border-2 transition-all gap-2 ${result === 'Pregnant' ? 'border-purple-600 bg-purple-500/10 text-purple-600' : 'border-base-200 bg-base-200 text-base-content/40 hover:border-base-300'}`}
                                    >
                                        <Sparkles size={24} className={result === 'Pregnant' ? 'text-purple-600' : 'text-base-content/20'} />
                                        <span className="font-black uppercase tracking-widest text-[10px]">Pregnant</span>
                                    </button>
                                    <button
                                        onClick={() => setResult('Empty')}
                                        className={`flex flex-col items-center justify-center py-6 rounded-2xl border-2 transition-all gap-2 ${result === 'Empty' ? 'border-rose-600 bg-rose-500/10 text-rose-600' : 'border-base-200 bg-base-200 text-base-content/40 hover:border-base-300'}`}
                                    >
                                        <AlertCircle size={24} className={result === 'Empty' ? 'text-rose-600' : 'text-base-content/20'} />
                                        <span className="font-black uppercase tracking-widest text-[10px]">Not Pregnant</span>
                                    </button>
                                </div>
                            </div>

                            {/* Note */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-base-content uppercase tracking-widest ml-1 block">Findings</label>
                                <textarea 
                                    placeholder="Optional notes..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full bg-base-200 border-2 border-transparent rounded-2xl p-4 text-[13px] font-bold text-base-content focus:bg-base-100 focus:border-purple-600 transition-all outline-none min-h-[80px] resize-none"
                                />
                            </div>

                            {result === 'Pregnant' && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-purple-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-xl shadow-purple-200"
                                >
                                    <div className="flex items-center gap-4">
                                        <Calendar size={20} className="opacity-60" />
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Est. Calf Drop Date</p>
                                            <p className="text-sm font-black tracking-tight">
                                                {new Date(Date.now() + 280 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <CheckCircle size={20} className="text-white" />
                                </motion.div>
                            )}
                        </div>

                        <div className="mt-8">
                            <button 
                                onClick={handleSubmit}
                                disabled={isSubmitting || !result}
                                className="w-full h-10 bg-[#074033] dark:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
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
