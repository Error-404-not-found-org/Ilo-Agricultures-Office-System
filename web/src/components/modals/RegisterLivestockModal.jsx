import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import axiosInstance from '../../lib/axios';

const RegisterLivestockModal = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        farmerName: '',
        earTag: '',
        species: 'Cattle / Cow',
        breed: '',
        color: '',
        sex: 'Female',
        dob: ''
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        try {
            setLoading(true);
            await axiosInstance.post('/technician/walk-in-livestock', formData);
            alert("Livestock profile registered successfully!");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to register livestock: " + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
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
                                <label className="block text-sm text-gray-500 mb-1.5">Farmer Contact (Name / ID)</label>
                                <input type="text" value={formData.farmerName} onChange={(e) => setFormData({...formData, farmerName: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Animal Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Ear Tag No.</label>
                                    <input type="text" value={formData.earTag} onChange={(e) => setFormData({...formData, earTag: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Species</label>
                                    <select value={formData.species} onChange={(e) => setFormData({...formData, species: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none">
                                        <option>Cattle / Cow</option>
                                        <option>Swine</option>
                                        <option>Carabao</option>
                                        <option>Goat</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Breed</label>
                                    <input type="text" value={formData.breed} onChange={(e) => setFormData({...formData, breed: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Color / Markings</label>
                                    <input type="text" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Gender</label>
                                    <select value={formData.sex} onChange={(e) => setFormData({...formData, sex: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none">
                                        <option>Female</option>
                                        <option>Male</option>
                                        <option>Castrated</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Age / Date of Birth</label>
                                    <input type="date" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={handleSubmit} disabled={loading} className="bg-[#0078d4] hover:bg-[#006cbd] text-white px-6 py-2.5 rounded font-bold text-sm transition-colors disabled:opacity-50">
                                {loading ? 'Processing...' : 'Register Livestock'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RegisterLivestockModal;
