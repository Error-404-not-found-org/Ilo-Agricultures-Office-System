import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Users, HeartPulse } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';

const AssignTaskModal = ({ isOpen, onClose, taskData, onSuccess }) => {
    const [selectedTech, setSelectedTech] = useState('');

    const { data: technicians = [] } = useQuery({
        queryKey: ['technicianList'],
        queryFn: async () => {
            // Need a route to get techs. Assuming /admin/technicians or /user with role 'technician'
            const res = await axiosInstance.get('/users?role=technician');
            return res.data;
        },
        enabled: isOpen,
    });

    if (!isOpen || !taskData) return null;

    const isUrgent = taskData.urgency === 'high';

    const handleAssignTask = async () => {
        if (!selectedTech) {
            alert('Please select a technician first.');
            return;
        }
        try {
            // Patch request to assign: Assuming the controller sets handledBy if patched
            await axiosInstance.patch(`/health-request/${taskData._id}/status`, {
                status: 'in-progress',
                handledBy: selectedTech,
                technicianNote: 'Assigned by Administrator.'
            });
            alert('Task successfully assigned.');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to assign task", error);
            alert("Failed to assign task: " + (error.response?.data?.message || error.message));
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl max-w-lg w-full shadow-2xl relative overflow-hidden"
                >
                    <div className={`p-6 border-b ${isUrgent ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="absolute top-4 right-4 block">
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors">
                                <X size={20} className={isUrgent ? 'text-rose-600' : 'text-amber-600'} />
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${isUrgent ? 'bg-rose-200 text-rose-700' : 'bg-amber-200 text-amber-700'}`}>
                                <HeartPulse size={24} />
                            </div>
                            <div>
                                <h3 className={`font-black text-xl leading-none ${isUrgent ? 'text-rose-900' : 'text-amber-900'}`}>
                                    Assign Health Request
                                </h3>
                                <p className={`text-sm font-semibold mt-1 ${isUrgent ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {isUrgent ? '🚨 URGENT PRIORITY' : 'Standard Priority'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Request Details</h4>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                                <p className="text-sm font-medium text-gray-500">
                                    <span className="font-bold text-gray-900">Farmer:</span> {taskData.farmerId?.name || 'Unknown'}
                                </p>
                                <p className="text-sm font-medium text-gray-500">
                                    <span className="font-bold text-gray-900">Animal Tag:</span> {taskData.animalId?.earTag || 'Unknown'}
                                </p>
                                <div className="w-full h-px bg-gray-200 my-2"></div>
                                <p className="text-sm font-medium text-gray-500">
                                    <span className="font-bold text-rose-600">Symptoms:</span><br/>
                                    {taskData.symptoms || 'None reported'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">Assignment</h4>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Users size={18} className="text-gray-400" />
                                </div>
                                <select 
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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

                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-white border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleAssignTask}
                            className={`flex-2 py-3 px-8 text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 bg-[#074033] hover:bg-[#06352a]`}
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
