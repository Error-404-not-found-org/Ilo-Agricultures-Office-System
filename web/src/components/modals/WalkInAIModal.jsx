import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Syringe, User, Activity, Calendar, Search, MapPin, Phone } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';

const WalkInAIModal = ({ isOpen, onClose, onSuccess }) => {
    const queryClient = useQueryClient();
    const toast = useToast();
    
    const [isExistingRecord, setIsExistingRecord] = useState(true);
    const [selectedFarmerId, setSelectedFarmerId] = useState('');
    const [selectedAnimalId, setSelectedAnimalId] = useState('');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: '',
        address: '',
        animalDetails: {
            earTag: '',
            species: 'Cattle / Cow',
            breed: ''
        },
        inseminationDetails: {
            inseminationDate: new Date().toISOString().split('T')[0],
            sireBreed: '',
            sireCode: '',
            estrus: 'Natural'
        }
    });

    // Fetch Farmers
    const { data: farmers = [] } = useQuery({
        queryKey: ["farmers", "list"],
        queryFn: async () => {
            const res = await axiosInstance.get('/user?role=farmer');
            return Array.isArray(res.data) ? res.data : (res.data.data || []);
        },
        enabled: isOpen
    });

    // Fetch Animals when farmer is selected
    const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
        queryKey: ["farmer-animals", selectedFarmerId],
        queryFn: async () => {
            const res = await axiosInstance.get(`/animals/farmer/${selectedFarmerId}`);
            return res.data;
        },
        enabled: !!selectedFarmerId && isExistingRecord
    });

    const mutation = useMutation({
        mutationFn: async (data) => {
            const res = await axiosInstance.post('/technician/walk-in-insemination', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("AI Transaction recorded successfully!");
            queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error("Failed to record AI: " + (error.response?.data?.message || error.message));
        }
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        let submissionData;

        if (isExistingRecord) {
            if (!selectedFarmerId || !selectedAnimalId) {
                return toast.error("Please select both a farmer and an animal.");
            }
            const farmer = farmers.find(f => f._id === selectedFarmerId);
            const animal = animals.find(a => a._id === selectedAnimalId);
            
            submissionData = {
                firstName: farmer.name.split(' ')[0],
                lastName: farmer.name.split(' ').slice(1).join(' '),
                phoneNumber: farmer.phoneNumber || '',
                email: farmer.email || '',
                address: typeof farmer.address === 'string' ? farmer.address : (farmer.address?.street || ''),
                animalDetails: {
                    earTag: animal.earTag,
                    species: animal.species,
                    breed: animal.breed
                },
                inseminationDetails: formData.inseminationDetails
            };
        } else {
            if (!formData.phoneNumber || !formData.animalDetails.earTag) {
                return toast.error("Farmer Phone and Animal Ear Tag are required.");
            }
            submissionData = formData;
        }
        
        mutation.mutate(submissionData);
    };

    return (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white border-4 border-black w-full max-w-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden max-h-[95vh]"
            >
                {/* Header */}
                <div className="bg-[#074033] p-8 text-white relative border-b-4 border-black">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 transition-all border-2 border-transparent hover:border-white/20">
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 flex items-center justify-center border-2 border-white/20">
                            <Syringe size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight uppercase leading-none">Insemination Hub</h2>
                            <p className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mt-2">Breeding Mission · Field Command</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                     {/* Toggle Selector */}
                     <div className="flex border-4 border-black bg-slate-100 p-1">
                        <button 
                            onClick={() => setIsExistingRecord(true)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isExistingRecord ? 'bg-black text-white' : 'text-slate-400 hover:text-black'}`}
                        >
                            Existing Record
                        </button>
                        <button 
                            onClick={() => setIsExistingRecord(false)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${!isExistingRecord ? 'bg-black text-white' : 'text-slate-500 hover:text-black'}`}
                        >
                            Full Registration
                        </button>
                    </div>

                    {isExistingRecord ? (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Farmer Reference</label>
                                <div className="relative">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select 
                                        value={selectedFarmerId}
                                        onChange={(e) => {
                                            setSelectedFarmerId(e.target.value);
                                            setSelectedAnimalId('');
                                        }}
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                                    >
                                        <option value="">Choose Farmer...</option>
                                        {farmers.map(f => (
                                            <option key={f._id} value={f._id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Target Animal</label>
                                <div className="relative">
                                    <Activity size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select 
                                        disabled={!selectedFarmerId || isLoadingAnimals}
                                        value={selectedAnimalId}
                                        onChange={(e) => setSelectedAnimalId(e.target.value)}
                                        className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none disabled:opacity-50"
                                    >
                                        <option value="">{isLoadingAnimals ? 'Loading Animals...' : 'Choose Animal...'}</option>
                                        {animals.map(a => (
                                            <option key={a._id} value={a._id}>Tag #{a.earTag} ({a.breed})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Farmer Section */}
                            <section className="space-y-5">
                                <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                                    <User size={18} className="text-blue-600" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-black">Farmer Identity</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">First Name</label>
                                        <input 
                                            type="text" 
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                                            placeholder="Juan"
                                            className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Last Name</label>
                                        <input 
                                            type="text" 
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                                            placeholder="Perez"
                                            className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Phone Number</label>
                                        <div className="relative">
                                            <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="tel" 
                                                value={formData.phoneNumber}
                                                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                                                placeholder="0917 XXX XXXX"
                                                className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Barangay</label>
                                        <div className="relative">
                                            <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="text" 
                                                value={formData.address}
                                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                                                placeholder="e.g. San Jose"
                                                className="w-full h-12 bg-slate-50 border-2 border-slate-300 pl-10 pr-4 text-sm font-bold focus:border-black transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Animal Section */}
                            <section className="space-y-5">
                                <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                                    <Activity size={18} className="text-emerald-600" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-black">Animal Profile</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5 col-span-1">
                                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Ear Tag</label>
                                        <input 
                                            type="text" 
                                            value={formData.animalDetails.earTag}
                                            onChange={(e) => setFormData({...formData, animalDetails: {...formData.animalDetails, earTag: e.target.value}})}
                                            placeholder="1042"
                                            className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5 col-span-1">
                                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Species</label>
                                        <select 
                                            value={formData.animalDetails.species}
                                            onChange={(e) => setFormData({...formData, animalDetails: {...formData.animalDetails, species: e.target.value}})}
                                            className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                                        >
                                            <option>Cattle / Cow</option>
                                            <option>Swine</option>
                                            <option>Carabao</option>
                                            <option>Goat</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 col-span-1">
                                        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Breed</label>
                                        <input 
                                            type="text" 
                                            value={formData.animalDetails.breed}
                                            onChange={(e) => setFormData({...formData, animalDetails: {...formData.animalDetails, breed: e.target.value}})}
                                            placeholder="Brahman"
                                            className="w-full h-12 bg-slate-50 border-2 border-slate-300 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                        />
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {/* AI Details Section */}
                    <section className="space-y-5">
                        <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                            <Calendar size={18} className="text-purple-600" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-black">Service Details</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Insemination Date</label>
                                <input 
                                    type="date" 
                                    value={formData.inseminationDetails.inseminationDate}
                                    onChange={(e) => setFormData({...formData, inseminationDetails: {...formData.inseminationDetails, inseminationDate: e.target.value}})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-200 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Estrus Type</label>
                                <select 
                                    value={formData.inseminationDetails.estrus}
                                    onChange={(e) => setFormData({...formData, inseminationDetails: {...formData.inseminationDetails, estrus: e.target.value}})}
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-200 px-4 text-sm font-bold focus:border-black transition-all outline-none appearance-none"
                                >
                                    <option>Natural</option>
                                    <option>Induced</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Sire Breed</label>
                                <input 
                                    type="text" 
                                    value={formData.inseminationDetails.sireBreed}
                                    onChange={(e) => setFormData({...formData, inseminationDetails: {...formData.inseminationDetails, sireBreed: e.target.value}})}
                                    placeholder="e.g. Angus"
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-200 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-1">Sire Code / Batch</label>
                                <input 
                                    type="text" 
                                    value={formData.inseminationDetails.sireCode}
                                    onChange={(e) => setFormData({...formData, inseminationDetails: {...formData.inseminationDetails, sireCode: e.target.value}})}
                                    placeholder="e.g. B-204"
                                    className="w-full h-12 bg-slate-50 border-2 border-slate-200 px-4 text-sm font-bold focus:border-black transition-all outline-none"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 border-t-4 border-black">
                    <button 
                        disabled={mutation.isPending}
                        onClick={handleSubmit}
                        className="w-full h-14 bg-black hover:bg-[#074033] text-white font-black uppercase tracking-[0.2em] text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:translate-y-1 active:shadow-none"
                    >
                        {mutation.isPending && <span className="loading loading-spinner loading-xs"></span>}
                        {mutation.isPending ? 'PROCESSING TRANSACTION...' : 'SUBMIT FIELD RECORD'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default WalkInAIModal;
