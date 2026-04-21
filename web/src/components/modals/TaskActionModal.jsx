import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Clock, HeartPulse, MapPin } from 'lucide-react';
import axiosInstance from '../../lib/axios';

const TaskActionModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    if (!isOpen || !taskData) return null;

    const isHealth = taskData.type === 'health';
    const isUrgent = taskData.urgent;

    const [scheduledDate, setScheduledDate] = React.useState(() => {
        try {
            // Priority: existing schedule > preferred date > current time
            const dateVal = taskData.displayDate || taskData.scheduledDate || taskData.preferredDate || new Date();
            const d = new Date(dateVal);
            // If date is invalid (NaN), fallback to present
            return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 16) : d.toISOString().slice(0, 16);
        } catch (e) {
            console.error("Date initialization error:", e);
            return new Date().toISOString().slice(0, 16);
        }
    });
    const [note, setNote] = React.useState('');
    const isPending = taskData.status === 'pending';

    const handleRejectTask = async () => {
        if (!window.confirm("Are you sure you want to decline this request?")) return;
        try {
            const status = taskData.type === 'health' ? 'cancelled' : 'rejected';
            const endpoint = taskData.type === 'health' ? `/health-request/${taskData.id}/status` : 
                             taskData.type === 'ai-request' ? `/ai-request/${taskData.id}/status` :
                             `/technician/inseminations/${taskData.id}/status`;
            
            await axiosInstance.patch(endpoint, { 
                status, 
                technicianNote: note || 'Declined by technician.' 
            });
            
            alert('Request successfully declined.');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to decline task", error);
            alert("Error: " + (error.response?.data?.message || error.message));
        }
    };

    const handleAction = async () => {
        try {
            let status = 'approved';
            let successMsg = 'Task accepted and scheduled.';

            if (isPending) {
                status = taskData.type === 'health' ? 'in-progress' : 'approved';
            } else {
                status = taskData.type === 'health' ? 'resolved' : 'done';
                successMsg = 'Task successfully marked as completed.';
            }

            const payload = {
                status,
                technicianNote: note || `${isPending ? 'Accepted' : 'Completed'} by technician.`,
                scheduledDate: new Date(scheduledDate)
            };

            const endpoint = taskData.type === 'health' ? `/health-request/${taskData.id}/status` : 
                             taskData.type === 'ai-request' ? `/ai-request/${taskData.id}/status` :
                             `/technician/inseminations/${taskData.id}/status`;

            await axiosInstance.patch(endpoint, payload);
            alert(successMsg);
            
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to update task", error);
            alert("Failed to update task: " + (error.response?.data?.message || error.message));
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className={`p-6 border-b ${isUrgent ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="absolute top-4 right-4 block">
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors">
                                <X size={20} className={isUrgent ? 'text-rose-600' : 'text-blue-600'} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${isUrgent ? 'bg-rose-200 text-rose-700' : 'bg-blue-200 text-blue-700'}`}>
                                {isHealth ? <HeartPulse size={24} /> : <AlertCircle size={24} />}
                            </div>
                            <div>
                                <h3 className={`font-black text-xl leading-none ${isUrgent ? 'text-rose-900' : 'text-blue-900'}`}>
                                    {isHealth ? 'Health Service' : 'AI Service'}
                                </h3>
                                <p className={`text-sm font-semibold mt-1 ${isUrgent ? 'text-rose-600' : 'text-blue-600'}`}>
                                    {isPending ? 'PENDING REQUEST' : 'SCHEDULED TASK'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Farmer Info</h4>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 h-full">
                                    <p className="text-base font-bold text-gray-900 leading-snug">{taskData.farmer}</p>
                                    <p className="text-xs font-medium text-gray-500 mt-1 flex items-center gap-1.5 line-clamp-2">
                                        <MapPin size={12} /> {taskData.location}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Details</h4>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 h-full">
                                    <p className="text-sm font-bold text-gray-900">{taskData.task}</p>
                                    <p className="text-[10px] font-black uppercase text-gray-400 mt-1">Status: {taskData.status}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">{isPending ? 'Set Schedule' : 'Update Schedule'}</h4>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    <input 
                                        type="datetime-local"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Findings/Notes</h4>
                                <textarea 
                                    placeholder="Add any technical notes here..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none min-h-[48px] placeholder:text-gray-300"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                        <button 
                            onClick={handleRejectTask}
                            className="flex-1 py-3 px-4 bg-white border border-gray-300 rounded-xl text-rose-600 font-bold hover:bg-rose-50 transition-colors"
                        >
                            Cancel Task
                        </button>
                        <button 
                            onClick={handleAction}
                            className={`flex-2 py-3 px-8 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2
                                ${isUrgent ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} `}
                        >
                            <CheckCircle size={18} /> {isPending ? 'Accept & Schedule' : 'Mark as Done'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TaskActionModal;
