import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Users, HeartPulse } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';

const AssignTaskModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    const toast = useToast();
    const [selectedTech, setSelectedTech] = useState('');

    const { data: technicians = [] } = useQuery({
        queryKey: ['technicianList'],
        queryFn: async () => {
            const res = await axiosInstance.get('/users?role=technician');
            return res.data;
        },
        enabled: isOpen,
    });

    if (!isOpen || !taskData) return null;

    const isUrgent = taskData.urgency === 'high';

    const handleAssignTask = async () => {
        if (!selectedTech) {
            toast.error('Please select a technician first.');
            return;
        }
        try {
            await axiosInstance.patch(`/health-request/${taskData._id}/status`, {
                status: 'in-progress',
                handledBy: selectedTech,
                technicianNote: 'Assigned by Administrator.'
            });
            toast.success('Task successfully assigned.');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to assign task", error);
            toast.error("Failed to assign task: " + (error.response?.data?.message || error.message));
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
                                    Assign Health Request
                                </h3>
                                <p className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                                    {isUrgent ? '🚨 URGENT PRIORITY' : 'Standard Priority'}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
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
                                    {taskData.farmerId?.name || 'Unknown'}
                                </p>
                                <p className="text-xs font-semibold text-base-content/60">
                                    <span className="font-black text-base-content uppercase tracking-wider block text-[9px] mb-0.5">Animal Tag</span> 
                                    <span className="inline-block bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-black uppercase mt-0.5">
                                        #{taskData.animalId?.earTag || 'Unknown'}
                                    </span>
                                </p>
                                <div className="w-full h-px bg-base-300/40 my-2"></div>
                                <p className="text-xs font-semibold text-base-content/60 leading-relaxed">
                                    <span className="font-black text-red-500 uppercase tracking-wider block text-[9px] mb-0.5">Symptoms</span>
                                    {taskData.symptoms || 'None reported'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-base-content/40 mb-2">Attending Officer assignment</h4>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/30">
                                    <Users size={18} />
                                </div>
                                <select 
                                    className="w-full h-11 pl-10 pr-4 bg-base-200/60 border border-base-300 rounded-xl text-xs font-bold text-base-content focus:border-emerald-500 focus:outline-none transition-all cursor-pointer"
                                    value={selectedTech}
                                    onChange={(e) => setSelectedTech(e.target.value)}
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
                            onClick={onClose}
                            className="py-3 px-6 bg-base-200 hover:bg-base-300 border border-base-300 rounded-xl text-base-content/70 hover:text-base-content font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleAssignTask}
                            className="py-3 px-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <CheckCircle size={18} /> Confirm Assignment
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AssignTaskModal;
