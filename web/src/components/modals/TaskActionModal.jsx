import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Clock, HeartPulse, MapPin, User } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const TaskActionModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    const queryClient = useQueryClient();
    
    const [isConfirmingDecline, setIsConfirmingDecline] = useState(false);
    const [scheduledDate, setScheduledDate] = useState("");
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isHealth = taskData?.type === 'health';
    const isUrgent = taskData?.urgent;
    const isPending = taskData?.status === 'pending';

    // Initialize state when taskData changes
    useEffect(() => {
        setIsConfirmingDecline(false);
        setIsSubmitting(false);
        if (taskData) {
            try {
                const dateVal = taskData.displayDate || taskData.scheduledDate || taskData.preferredDate || new Date();
                const d = new Date(dateVal);
                setScheduledDate(isNaN(d.getTime()) ? new Date().toISOString().slice(0, 16) : d.toISOString().slice(0, 16));
            } catch (e) {
                setScheduledDate(new Date().toISOString().slice(0, 16));
            }
            setNote('');
        }
    }, [taskData, isOpen]);

    if (!isOpen || !taskData) return null;

    const animal = taskData.raw?.animalId || {};
    const preferredDateTime = taskData.displayDate || taskData.preferredDate;

    const handleRejectTask = () => {
        if (!isConfirmingDecline) {
            setIsConfirmingDecline(true);
            setTimeout(() => setIsConfirmingDecline(false), 3000);
            return;
        }

        const status = taskData.type === 'health' ? 'cancelled' : 'rejected';
        const endpoint = taskData.type === 'health' ? `/health-request/${taskData.id}/status` : 
                         taskData.type === 'ai-request' ? `/ai-request/${taskData.id}/status` :
                         `/technician/inseminations/${taskData.id}/status`;
        
        setIsSubmitting(true);
        toast.promise(axiosInstance.patch(endpoint, { status, technicianNote: note || 'Declined by technician.' }), {
            loading: 'Cancelling task...',
            success: async () => {
                queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
                if (onSuccess) onSuccess();
                onClose();
                return 'Task Cancelled';
            },
            error: (err) => {
                setIsSubmitting(false);
                return "Error: " + (err.response?.data?.message || err.message);
            }
        });
    };

    const handleAction = () => {
        let status = isPending ? (taskData.type === 'health' ? 'in-progress' : 'approved') : (taskData.type === 'health' ? 'resolved' : 'done');
        const endpoint = taskData.type === 'health' ? `/health-request/${taskData.id}/status` : 
                         taskData.type === 'ai-request' ? `/ai-request/${taskData.id}/status` :
                         `/technician/inseminations/${taskData.id}/status`;

        setIsSubmitting(true);
        toast.promise(axiosInstance.patch(endpoint, {
            status,
            technicianNote: note || `${isPending ? 'Accepted' : 'Completed'} by technician.`,
            scheduledDate: new Date(scheduledDate)
        }), {
            loading: isPending ? 'Scheduling task...' : 'Completing task...',
            success: async () => {
                queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
                if (onSuccess) onSuccess();
                onClose();
                return isPending ? 'Task Scheduled!' : 'Task Completed!';
            },
            error: (err) => {
                setIsSubmitting(false);
                return "Error: " + (err.response?.data?.message || err.message);
            }
        });
    };

    const closeModal = () => {
        if (isSubmitting) return;
        setIsConfirmingDecline(false);
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={closeModal}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                />
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    className="bg-white rounded-4xl max-w-4xl w-full shadow-2xl relative overflow-hidden flex flex-col md:flex-row min-h-[500px]"
                >
                    {/* LEFT PANEL: ANIMAL PROFILE */}
                    <div className="md:w-5/12 bg-slate-50 border-r border-slate-100 flex flex-col">
                        <div className="relative h-64 md:h-full overflow-hidden">
                            {animal.imageUrl ? (
                                <img src={animal.imageUrl} className="w-full h-full object-cover" alt="Animal Profile" />
                            ) : (
                                <div className="w-full h-full bg-slate-200 flex flex-col items-center justify-center gap-4">
                                    <div className="w-20 h-20 rounded-full bg-slate-300 flex items-center justify-center">
                                        <MapPin size={40} className="text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">No Photo Available</p>
                                </div>
                            )}
                            <div className="absolute top-6 left-6">
                                <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-white/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Tag Number</p>
                                    <p className="text-lg font-black text-slate-800 leading-none">#{animal.earTag || "---"}</p>
                                </div>
                            </div>
                            {isUrgent && (
                                <div className="absolute top-6 right-6">
                                    <div className="bg-rose-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 animate-pulse">
                                        Urgent Priority
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 p-8 bg-linear-to-t from-slate-900 via-slate-900/20 to-transparent">
                                <h2 className="text-white text-3xl font-black">{animal.breed || "Crossbreed"}</h2>
                                <p className="text-slate-300 font-bold uppercase text-xs tracking-widest mt-1">Species: {animal.species || "Cattle"}</p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: ACTIONS */}
                    <div className="md:w-7/12 flex flex-col bg-white">
                        <div className="p-8 pb-4 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 leading-tight">Service Details</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isHealth ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {isHealth ? 'Veterinary Care' : 'Breeding Service'}
                                    </span>
                                    <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">#{taskData.id.toString().substring(0,8)}</span>
                                </div>
                            </div>
                            <button onClick={closeModal} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 px-8 py-4 overflow-y-auto space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 items-center justify-center flex shrink-0">
                                    <User size={24} className="text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Requested By</p>
                                    <p className="text-lg font-bold text-slate-900">{taskData.farmer}</p>
                                    <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                                        <MapPin size={14} className="text-slate-400" /> {taskData.location}
                                    </p>
                                </div>
                            </div>

                            {isPending && (
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-3xl flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                                        <Clock size={20} className="text-amber-700" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Farmer's Preferred Slot</p>
                                        <p className="text-sm font-bold text-amber-900">{new Date(preferredDateTime).toLocaleString('en-US', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">
                                            {isPending ? 'Your Schedule' : 'Update Visit Time'}
                                        </label>
                                        <div className="relative group">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input 
                                                type="datetime-local"
                                                value={scheduledDate}
                                                onChange={(e) => setScheduledDate(e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 text-[13px] font-black text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">Technical Note</label>
                                        <textarea 
                                            placeholder="Add instructions or findings..."
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-3.5 px-5 text-[13px] font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none min-h-[56px] resize-none placeholder:text-slate-300"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 pt-4 flex gap-4">
                            <button 
                                onClick={handleRejectTask}
                                disabled={isSubmitting}
                                className={`h-14 flex-1 flex items-center justify-center rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 ${isConfirmingDecline ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}
                            >
                                {isConfirmingDecline ? 'Click to Confirm' : 'Cancel Task'}
                            </button>
                            <button 
                                onClick={handleAction}
                                disabled={isSubmitting}
                                className={`h-14 flex-[1.5] rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-200/50 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50
                                    ${isUrgent ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'} `}
                            >
                                {isSubmitting ? (
                                    <span className="loading loading-spinner loading-md"></span>
                                ) : (
                                    <>
                                        <CheckCircle size={20} />
                                        <span>{isPending ? 'Accept & Schedule' : 'Mark as Completed'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TaskActionModal;
