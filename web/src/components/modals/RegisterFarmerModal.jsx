import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Phone, Mail, MapPin } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';

const RegisterFarmerModal = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: '',
        address: ''
    });

    const mutation = useMutation({
        mutationFn: async (data) => {
            const res = await axiosInstance.post('/technician/register-farmer', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Farmer profile created successfully!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            onClose();
            // Reset form
            setFormData({ firstName: '', lastName: '', phoneNumber: '', email: '', address: '' });
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || "Registration failed.");
        }
    });

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-4xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden"
                >
                    <div className="bg-[#074033] p-8 text-white relative">
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-all">
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight uppercase">Register Farmer</h2>
                                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Technician Quick-Entry</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">First Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Juan" 
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-[#074033] transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Last Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Perez" 
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-[#074033] transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Phone Number</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input 
                                    type="tel" 
                                    placeholder="0917 XXX XXXX" 
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-none rounded-xl pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-[#074033] transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Email (Optional)</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input 
                                    type="email" 
                                    placeholder="juan@example.com" 
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-none rounded-xl pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-[#074033] transition-all"
                                />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 ml-1">If provided, an invitation will be sent for mobile app access.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Barangay / Address</label>
                            <div className="relative">
                                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input 
                                    type="text" 
                                    placeholder="e.g. San Jose" 
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-none rounded-xl pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-[#074033] transition-all"
                                />
                            </div>
                        </div>

                        <button 
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate(formData)}
                            className="w-full h-14 bg-[#074033] hover:scale-[1.02] active:scale-95 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#074033]/20 transition-all mt-4 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            {mutation.isPending && <span className="loading loading-spinner loading-xs"></span>}
                            {mutation.isPending ? 'CREATING PROFILE...' : 'SAVE FARMER PROFILE'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RegisterFarmerModal;
