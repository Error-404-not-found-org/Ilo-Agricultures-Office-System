import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Sparkles, Calendar, History } from 'lucide-react';
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
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-base-100 rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col md:flex-row border border-base-300"
                >
                    {/* LEFT SIDE: Breeding Context */}
                    <div className="md:w-5/12 bg-base-200 p-6 border-r border-base-300 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <History size={16} className="text-emerald-600 dark:text-emerald-400" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Breeding Context</h4>
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
                                                {record.sireBreed || 'Unknown Sire'}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[10px] font-bold text-base-content/20 uppercase tracking-widest italic">No prior AI records found</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-base-300">
                            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                                <Sparkles size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Today's Check</span>
                            </div>
                            <p className="text-sm font-black text-base-content tracking-tight">
                                {taskData.daysSinceAI} Days Post-AI
                            </p>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Diagnosis Input */}
                    <div className="md:w-7/12 p-6 bg-base-100 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-base-content leading-tight uppercase">Pregnancy Check</h3>
                                    <p className="text-base-content/40 font-bold text-[9px] uppercase tracking-widest mt-1.5 leading-none">
                                        Animal: #{animal.earTag || 'N/A'} • {animal.breed || 'Unknown'}
                                    </p>
                                </div>
                                <button onClick={onClose} className="p-2 bg-base-200 text-base-content/40 rounded-full hover:bg-base-300 transition-all cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

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
                                                    {new Date(Date.now() + 280 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        <CheckCircle size={18} className="text-white" />
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <button 
                                onClick={handleSubmit}
                                disabled={isSubmitting || !result}
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
