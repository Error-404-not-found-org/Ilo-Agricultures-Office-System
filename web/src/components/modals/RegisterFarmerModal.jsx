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
            <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="bg-white border-4 border-black w-full max-w-lg shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden"
                >
                    <div className="bg-[#074033] p-8 text-white relative border-b-4 border-black">
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 transition-all border-2 border-transparent hover:border-white/20">
                            <X size={24} />
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/10 flex items-center justify-center border-2 border-white/20">
                                <UserPlus size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight uppercase leading-none">Register Farmer</h2>
                                <p className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mt-2">New Identity · Field Command</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">First Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Juan" 
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Last Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Perez" 
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Phone Number</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="tel" 
                                    placeholder="0917 XXX XXXX" 
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Email (Optional)</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="email" 
                                    placeholder="juan@example.com" 
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                            <p className="text-[9px] font-bold text-slate-500 ml-1">If provided, an invitation will be sent for mobile app access.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Barangay / Address</label>
                            <div className="relative">
                                <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="e.g. San Jose" 
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                        </div>

                        <button 
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate(formData)}
                            className="w-full h-14 bg-black hover:bg-[#074033] text-white font-black uppercase tracking-[0.2em] text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-3 active:translate-y-1 active:shadow-none"
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
