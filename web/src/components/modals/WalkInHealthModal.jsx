import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';

const WalkInHealthModal = ({ isOpen, onClose, onSuccess, prefillData }) => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [formData, setFormData] = useState({
        farmerName: '',
        earTag: '',
        diagnosis: '',
        urgency: 'low',
        autoResolve: true // Checkbox to mark as resolved instantly
    });

    React.useEffect(() => {
        if (isOpen && prefillData) {
            setFormData({
                ...formData,
                farmerName: prefillData.farmerName || '',
                earTag: prefillData.earTag || '',
            });
        } else if (isOpen && !prefillData) {
            // Reset if no prefill
            setFormData({
                farmerName: '',
                earTag: '',
                diagnosis: '',
                urgency: 'low',
                autoResolve: true
            });
        }
    }, [isOpen, prefillData]);

    const mutation = useMutation({
        mutationFn: async (data) => {
            const res = await axiosInstance.post('/health-request/walk-in', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Health record submitted and resolved!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error("Failed to submit health log: " + (error.response?.data?.message || error.message));
        }
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        mutation.mutate(formData);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm shadow-2xl">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded p-8 md:p-10 max-w-3xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
                >
                    <div className="absolute top-4 right-4">
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-8 mt-2">
                        <div>
                            <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Farmer Details</h3>
                            <div>
                                <label className="block text-sm text-gray-500 mb-1.5">Farmer Name / ID</label>
                                <input type="text" value={formData.farmerName} onChange={(e) => setFormData({...formData, farmerName: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Animal Details</h3>
                            <div>
                                <label className="block text-sm text-gray-500 mb-1.5">Ear Tag No.</label>
                                <input type="text" value={formData.earTag} onChange={(e) => setFormData({...formData, earTag: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Health & Vaccination Record</h3>
                            <div>
                                <label className="block text-sm text-gray-500 mb-1.5">Diagnosis / Vaccine Given</label>
                                <textarea value={formData.diagnosis} onChange={(e) => setFormData({...formData, diagnosis: e.target.value})} className="w-full h-[80px] bg-white border border-gray-300 rounded p-3 text-sm text-gray-700 outline-none focus:border-blue-500 transition-colors resize-none"></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleSubmit} 
                                disabled={mutation.isPending} 
                                className="bg-[#0078d4] hover:bg-[#006cbd] text-white px-6 py-2.5 rounded font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {mutation.isPending && <span className="loading loading-spinner loading-xs"></span>}
                                {mutation.isPending ? 'Processing...' : 'Submit Walk-in Transaction'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default WalkInHealthModal;
