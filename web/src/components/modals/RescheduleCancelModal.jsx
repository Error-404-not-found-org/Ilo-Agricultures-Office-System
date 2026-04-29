import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, AlertCircle, Clock, Trash2, ChevronRight } from 'lucide-react';
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
                // Wait for the data to actually refresh
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
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white rounded-[32px] max-w-lg w-full shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-slate-800">Manage Request</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {taskData.farmer} · {taskData.task}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="p-8">
                        {mode === 'select' && (
                            <div className="space-y-4">
                                <p className="text-slate-500 font-medium text-center mb-6">
                                    Why can't you fulfill this request at the requested time?
                                </p>
                                
                                <button 
                                    onClick={() => setMode('reschedule')}
                                    className="w-full group p-6 rounded-3xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all flex items-center gap-4 text-left"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Calendar size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-slate-800">Reschedule</h4>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Suggest a better time for the farmer</p>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500" />
                                </button>

                                <button 
                                    onClick={() => setMode('cancel')}
                                    className="w-full group p-6 rounded-3xl border-2 border-slate-100 hover:border-rose-500 hover:bg-rose-50/50 transition-all flex items-center gap-4 text-left"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                                        <Trash2 size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-slate-800">Cancel Request</h4>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Decline this service entirely</p>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-rose-500" />
                                </button>
                            </div>
                        )}

                        {mode === 'reschedule' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Proposed Time</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="datetime-local"
                                            value={scheduledDate}
                                            onChange={(e) => setScheduledDate(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:border-blue-500 focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Reschedule</label>
                                    <textarea 
                                        placeholder="e.g. Technician is attending another emergency..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-blue-500 focus:bg-white transition-all outline-none min-h-[100px] resize-none"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setMode('select')} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-xs hover:bg-slate-100 rounded-2xl transition-colors">Back</button>
                                    <button 
                                        onClick={() => handleAction('reschedule')}
                                        disabled={isSubmitting}
                                        className="flex-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200"
                                    >
                                        {isSubmitting ? 'Processing...' : 'Confirm Reschedule'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'cancel' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Cancellation</label>
                                    <textarea 
                                        placeholder="e.g. Service not available in this area..."
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium focus:border-rose-500 focus:bg-white transition-all outline-none min-h-[100px] resize-none"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setMode('select')} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-xs hover:bg-slate-100 rounded-2xl transition-colors">Back</button>
                                    <button 
                                        onClick={() => handleAction('cancel')}
                                        disabled={isSubmitting}
                                        className="flex-2 bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-200"
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
