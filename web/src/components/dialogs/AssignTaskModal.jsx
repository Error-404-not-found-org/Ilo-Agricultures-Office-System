import { useRef, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Users, HeartPulse } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';
import {
    invalidateAdminReassignmentQueries,
    reassignRequest,
} from '../../services/adminRequestsService';

const AssignTaskModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    const toast = useToast();
    const queryClient = useQueryClient();
    const technicianSelectRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: technicians = [] } = useQuery({
        queryKey: ['technicianList'],
        queryFn: async () => {
            const res = await axiosInstance.get('/user?role=technician');
            return Array.isArray(res.data) ? res.data : res.data?.users || [];
        },
        enabled: isOpen,
    });

    if (!isOpen || !taskData) return null;

    const request = taskData.raw || taskData;
    const requestId = taskData.id || taskData.rawId || request._id;
    const requestType = taskData.type || request.type;
    const isUrgent = (taskData.urgency || request.urgency) === 'high';

    const handleAssignTask = async () => {
        const selectedTech = technicianSelectRef.current?.value || '';
        if (!selectedTech) {
            toast.error('Please select a technician first.');
            return;
        }
        setIsSubmitting(true);
        try {
            await reassignRequest({
                type: requestType,
                requestId,
                technicianId: selectedTech,
            });
            await invalidateAdminReassignmentQueries(queryClient);
            toast.success('Request successfully reassigned.');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Failed to reassign request.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-base-100 border border-base-300 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className={`p-6 border-b border-base-300/80 flex items-center justify-between ${isUrgent ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl ${isUrgent ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                <HeartPulse size={24} />
                            </div>
                            <div>
                                <h3 className={`font-black text-xl leading-none uppercase tracking-tight text-base-content`}>
                                    Reassign Health Request
                                </h3>
                                <p className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                                    {isUrgent ? '🚨 URGENT PRIORITY' : 'Standard Priority'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose} 
                            aria-label="Close reassignment dialog"
                            className="p-2 rounded-full hover:bg-base-300/40 text-base-content/40 hover:text-base-content transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6">
                        <div>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-base-content/40 mb-2">Request Details</h4>
                            <div className="bg-base-200/40 p-5 rounded-2xl border border-base-300/60 space-y-3">
                                <p className="text-xs font-semibold text-base-content/60">
                                    <span className="font-black text-base-content uppercase tracking-wider block text-[9px] mb-0.5">Farmer</span> 
                                    {request.farmerId?.name || taskData.farmer || 'Not recorded'}
                                </p>
                                <p className="text-xs font-semibold text-base-content/60">
                                    <span className="font-black text-base-content uppercase tracking-wider block text-[9px] mb-0.5">Animal Tag</span> 
                                    <span className="inline-block bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-black uppercase mt-0.5">
                                        #{request.animalId?.earTag || taskData.animalTag || 'Not recorded'}
                                    </span>
                                </p>
                                <div className="w-full h-px bg-base-300/40 my-2"></div>
                                <p className="text-xs font-semibold text-base-content/60 leading-relaxed">
                                    <span className="font-black text-red-500 uppercase tracking-wider block text-[9px] mb-0.5">Symptoms</span>
                                    {request.symptoms || taskData.detail || 'None reported'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-base-content/40 mb-2">New attending Technician</h4>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/30">
                                    <Users size={18} />
                                </div>
                                <select
                                    aria-label="New attending Technician"
                                    className="select w-full h-11 pl-10 pr-4 bg-base-200/60 border-base-300 rounded-xl text-xs font-bold text-base-content focus:border-primary focus:outline-none cursor-pointer"
                                    ref={technicianSelectRef}
                                    defaultValue=""
                                >
                                    <option value="">-- Select a Technician --</option>
                                    {technicians.map((tech) => (
                                        <option key={tech._id} value={tech._id}>{tech.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-base-200/30 border-t border-base-300/80 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="btn px-6 text-xs uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAssignTask}
                            disabled={isSubmitting}
                            className="btn btn-primary px-8 text-xs uppercase tracking-widest"
                        >
                            <CheckCircle size={18} /> {isSubmitting ? 'Reassigning...' : 'Confirm Reassignment'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AssignTaskModal;
