import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Trash2, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const RescheduleCancelModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    const queryClient = useQueryClient();
    
    const [mode, setMode] = useState('select'); // 'select', 'reschedule', 'cancel'
    const [scheduledDate, setScheduledDate] = useState("");
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when modal opens
    React.useEffect(() => {
        if (isOpen && taskData) {
            setMode('select');
            const d = new Date(taskData.preferredDate || new Date());
            setScheduledDate(isNaN(d.getTime()) ? new Date().toISOString().slice(0, 16) : d.toISOString().slice(0, 16));
            setReason('');
            setIsSubmitting(false);
        }
    }, [isOpen, taskData]);

    if (!isOpen || !taskData) return null;

    const handleAction = async (type) => {
        setIsSubmitting(true);
        const status = type === 'cancel' 
            ? (taskData.type === 'health' ? 'cancelled' : 'rejected')
            : (taskData.type === 'health' ? 'in-progress' : 'approved');
        
        const payload = {
            status,
            technicianNote: reason || (type === 'cancel' ? 'Technician unavailable' : 'Rescheduled by technician'),
            ...(type === 'reschedule' ? { scheduledDate: new Date(scheduledDate) } : {})
        };

        const endpoint = taskData.type === 'health' ? `/health-request/${taskData.id}/status` : `/ai-request/${taskData.id}/status`;

        toast.promise(axiosInstance.patch(endpoint, payload), {
            loading: type === 'cancel' ? 'Cancelling request...' : 'Rescheduling request...',
            success: async () => {
                queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
                if (onSuccess) onSuccess();
                onClose();
                return type === 'cancel' ? 'Request Cancelled' : 'Request Rescheduled!';
            },
            error: (err) => {
                setIsSubmitting(false);
                return "Action failed: " + (err.response?.data?.message || err.message);
            },
        });
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-base-100 border border-base-300 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-base-300 bg-base-200/40 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-base-content uppercase leading-none">Manage Request</h3>
                            <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mt-1.5 leading-none">
                                {taskData.farmer} · {taskData.task}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-base-200 rounded-full text-base-content/40 hover:text-base-content transition-colors cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {mode === 'select' && (
                            <div className="space-y-4">
                                <p className="text-base-content/60 font-semibold text-center text-xs tracking-wider uppercase mb-2">
                                    Why can't you fulfill this request at the requested time?
                                </p>
                                
                                <button 
                                    onClick={() => setMode('reschedule')}
                                    className="w-full group p-5 rounded-2xl border border-base-300 bg-base-200/30 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all flex items-center gap-4 text-left cursor-pointer"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                                        <Calendar size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-base-content uppercase text-sm">Reschedule</h4>
                                        <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-tight mt-0.5">Suggest a better time for the farmer</p>
                                    </div>
                                    <ChevronRight size={18} className="text-base-content/30 group-hover:text-blue-500 transition-colors" />
                                </button>

                                <button 
                                    onClick={() => setMode('cancel')}
                                    className="w-full group p-5 rounded-2xl border border-base-300 bg-base-200/30 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all flex items-center gap-4 text-left cursor-pointer"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                                        <Trash2 size={22} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-base-content uppercase text-sm">Cancel Request</h4>
                                        <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-tight mt-0.5">Decline this service entirely</p>
                                    </div>
                                    <ChevronRight size={18} className="text-base-content/30 group-hover:text-rose-500 transition-colors" />
                                </button>
                            </div>
                        )}

                        {mode === 'reschedule' && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">New Proposed Time</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={18} />
                                        <input 
                                            type="datetime-local"
                                            value={scheduledDate}
                                            onChange={(e) => setScheduledDate(e.target.value)}
                                            className="w-full h-12 bg-base-200 border border-base-300 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-base-content focus:border-blue-500 focus:outline-none transition-all cursor-pointer"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Reason for Reschedule</label>
                                    <textarea 
                                        placeholder="e.g. Technician is attending another emergency..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full bg-base-200 border border-base-300 rounded-2xl p-4 text-xs font-bold text-base-content placeholder:text-base-content/30 focus:border-blue-500 focus:outline-none transition-all min-h-[100px] resize-none"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setMode('select')} className="flex-1 h-12 font-black text-base-content/50 hover:text-base-content uppercase tracking-widest text-[10px] bg-base-200 hover:bg-base-300 rounded-2xl transition-colors cursor-pointer">Back</button>
                                    <button 
                                        onClick={() => handleAction('reschedule')}
                                        disabled={isSubmitting}
                                        className="flex-2 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/10 cursor-pointer"
                                    >
                                        {isSubmitting ? 'Processing...' : 'Confirm Reschedule'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'cancel' && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest ml-1">Reason for Cancellation</label>
                                    <textarea 
                                        placeholder="e.g. Service not available in this area..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full bg-base-200 border border-base-300 rounded-2xl p-4 text-xs font-bold text-base-content placeholder:text-base-content/30 focus:border-rose-500 focus:outline-none transition-all min-h-[100px] resize-none"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setMode('select')} className="flex-1 h-12 font-black text-base-content/50 hover:text-base-content uppercase tracking-widest text-[10px] bg-base-200 hover:bg-base-300 rounded-2xl transition-colors cursor-pointer">Back</button>
                                    <button 
                                        onClick={() => handleAction('cancel')}
                                        disabled={isSubmitting}
                                        className="flex-2 bg-rose-600 hover:bg-rose-700 text-white h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/10 cursor-pointer"
                                    >
                                        {isSubmitting ? 'Processing...' : 'Yes, Cancel Request'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RescheduleCancelModal;
