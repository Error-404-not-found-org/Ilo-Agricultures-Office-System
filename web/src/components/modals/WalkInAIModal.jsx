import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import axiosInstance from '../../lib/axios';

const WalkInAIModal = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        address: { street: '', barangay: '', city: '', province: '', region: '', zipCode: '' },
        animalDetails: { earTag: '', species: 'Cattle / Cow', breed: '' },
        inseminationDetails: { inseminationDate: new Date().toISOString().split('T')[0], sireBreed: '', sireCode: '', estrus: 'Natural' }
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        try {
            setLoading(true);
            await axiosInstance.post('/technician/walk-in-insemination', formData);
            alert("Walk-in transaction officially recorded! Clerk invite sent if email was provided.");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to submit walk-in: " + (error.response?.data?.message || error.message));
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
                        {/* Farmer Details */}
                        <div>
                            <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Farmer Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">First Name</label>
                                    <input type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Last Name</label>
                                    <input type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Email (Optional - Sends Invite)</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Phone Number</label>
                                    <input type="text" value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* Animal Details */}
                        <div>
                            <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Animal Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Ear Tag No.</label>
                                    <input type="text" value={formData.animalDetails.earTag} onChange={(e) => setFormData({...formData, animalDetails: {...formData.animalDetails, earTag: e.target.value}})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Species</label>
                                    <select value={formData.animalDetails.species} onChange={(e) => setFormData({...formData, animalDetails: {...formData.animalDetails, species: e.target.value}})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none">
                                        <option>Cattle / Cow</option>
                                        <option>Swine</option>
                                        <option>Carabao</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Breed</label>
                                    <input type="text" value={formData.animalDetails.breed} onChange={(e) => setFormData({...formData, animalDetails: {...formData.animalDetails, breed: e.target.value}})} placeholder="e.g. Brahman" className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* Insemination Details */}
                        <div>
                            <h3 className="text-[#1e293b] font-bold text-[17px] border-b border-gray-800 pb-2 mb-5">Insemination Record</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Sire Breed</label>
                                    <input type="text" value={formData.inseminationDetails.sireBreed} onChange={(e) => setFormData({...formData, inseminationDetails: {...formData.inseminationDetails, sireBreed: e.target.value}})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Sire Code (Semen Tracking)</label>
                                    <input type="text" value={formData.inseminationDetails.sireCode} onChange={(e) => setFormData({...formData, inseminationDetails: {...formData.inseminationDetails, sireCode: e.target.value}})} placeholder="B-1002" className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-500 mb-1.5">Estrus Detection</label>
                                    <select value={formData.inseminationDetails.estrus} onChange={(e) => setFormData({...formData, inseminationDetails: {...formData.inseminationDetails, estrus: e.target.value}})} className="w-full h-[42px] bg-white border border-gray-300 rounded px-3 text-sm text-gray-700 outline-none">
                                        <option value="Natural">Natural</option>
                                        <option value="Synchronized">Synchronized</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={handleSubmit} disabled={loading} className="bg-[#0078d4] hover:bg-[#006cbd] text-white px-6 py-2.5 rounded font-bold text-sm transition-colors disabled:opacity-50">
                                {loading ? 'Processing...' : 'Submit Walk-in Transaction'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default WalkInAIModal;
