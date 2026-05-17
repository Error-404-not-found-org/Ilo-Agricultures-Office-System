import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../lib/axios';
import { 
    Activity, ShieldAlert, Calendar, ChevronRight, MapPin,
    Zap, Target, Bell, Search, Sparkles, Syringe, Stethoscope, 
    Baby, Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingView from "../components/LoadingView";

const FarmerDashboard = () => {
    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ['user', 'me'],
        queryFn: async () => {
            const res = await axios.get('/user/me');
            return res.data;
        }
    });

    const { data: milestones, isLoading: loadingMilestones } = useQuery({
        queryKey: ['user', 'milestones'],
        queryFn: async () => {
            const res = await axios.get('/user/milestones');
            return res.data;
        }
    });

    const { data: animals, isLoading: loadingAnimals } = useQuery({
        queryKey: ['animals', 'my'],
        queryFn: async () => {
            const res = await axios.get('/animals/my');
            return res.data.data;
        }
    });

    const { data: activity, isLoading: loadingActivity } = useQuery({
        queryKey: ['user', 'activity'],
        queryFn: async () => {
            const res = await axios.get('/user/activity');
            return res.data;
        }
    });

    if (loadingProfile) return <LoadingView message="Waking up Moowie..." />;

    const stats = profile?.stats || {};
    const statsList = [
        { title: "Total Herd", value: stats.totalAnimals || 0, icon: Activity, color: "blue" },
        { title: "Active Pregnancies", value: stats.activePregnancies || 0, icon: Baby, color: "purple" },
        { title: "Upcoming Calf Drops", value: stats.upcomingCalvings || 0, icon: Target, color: "rose" },
        { title: "Waiting Results", value: stats.pendingResults || 0, icon: ShieldAlert, color: "amber" },
    ];

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            {/* --- FARMER HERO SECTION --- */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-emerald-900 p-8 md:p-12 shadow-2xl">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded-full backdrop-blur-md">
                            <Sparkles size={14} className="text-emerald-300" />
                            <span className="text-emerald-300 text-[10px] font-black uppercase tracking-widest">My Farm Dashboard</span>
                        </div>
                        <h1 className="text-white text-4xl md:text-6xl font-black tracking-tight leading-none">
                            Hello, <span className="text-emerald-400">{profile?.name?.split(' ')[0]}!</span>
                        </h1>
                        <p className="text-emerald-100/70 text-lg font-medium max-w-xl leading-relaxed">
                            Monitor your livestock, track breeding milestones, and manage your herd's health from your central portal.
                        </p>
                    </div>
                    
                    <div className="hidden lg:block">
                        <img 
                            src="https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png" 
                            className="w-48 grayscale invert brightness-200 opacity-20"
                            alt="Moowie"
                        />
                    </div>
                </div>
                
                {/* Visual Backdrop */}
                <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/30 rounded-full blur-[120px]" />
                </div>
            </div>

            {/* --- QUICK STATS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsList.map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.title}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all group"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`p-4 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <h3 className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-1">{stat.title}</h3>
                        <span className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</span>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* --- BREEDING MILESTONES & ALERTS --- */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Breeding Milestones</h2>
                                <p className="text-slate-400 font-bold text-xs mt-1">Automatic lifecycle tracking & heat alerts</p>
                            </div>
                            <Calendar size={24} className="text-emerald-500" />
                        </div>
                        
                        <div className="p-8">
                            {milestones && milestones.length > 0 ? (
                                <div className="space-y-4">
                                    {milestones.map((m) => (
                                        <div key={`${m.type}-${m.animal?._id}`} className={`flex items-center gap-6 p-6 rounded-3xl border transition-all ${m.type === 'calving' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${m.type === 'calving' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                {m.type === 'calving' ? <Baby size={28} /> : <Zap size={28} />}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`text-lg font-black ${m.type === 'calving' ? 'text-rose-900' : 'text-emerald-900'}`}>{m.type === 'calving' ? 'Calf Drop' : m.title} — {m.animal?.earTag || 'Animal'}</h4>
                                                <p className={`${m.type === 'calving' ? 'text-rose-700' : 'text-emerald-700'} font-bold text-sm`}>
                                                    {m.daysLeft > 0 ? `In ${m.daysLeft} days` : 'Today'} • {new Date(m.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${m.priority === 'high' ? 'bg-rose-500 text-white animate-pulse' : 'bg-white text-slate-900'}`}>
                                                {m.priority} Priority
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                    <Info className="mx-auto text-slate-300 mb-4" size={48} />
                                    <p className="text-slate-500 font-bold">No upcoming breeding milestones yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MY ANIMALS LIST */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
                        <div className="flex justify-between items-center mb-8 px-2">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">My Livestock</h2>
                            <span className="text-slate-400 font-bold text-xs">Total: {animals?.length || 0}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {animals?.map((animal) => (
                                <div key={animal._id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-50 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group">
                                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shadow-sm">
                                        {animal.imageUrl ? <img src={animal.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🐄</div>}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-black text-slate-800">#{animal.animalId.split('-').pop()} — {animal.earTag || 'No Tag'}</h4>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{animal.breed}</p>
                                        <div className={`mt-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${animal.reproductiveStatus === 'Pregnant' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {animal.reproductiveStatus || 'Healthy'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- SIDEBAR: ACTIVITY & MOOWIE --- */}
                <div className="lg:col-span-4 space-y-8">
                    {/* RECENT ACTIVITY */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight mb-8">Recent Activity</h2>
                        <div className="space-y-6">
                            {activity?.map((item) => (
                                <div key={item.id} className="flex gap-4 group">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                                        {item.type === 'ai' ? <Syringe size={18} /> : item.type === 'health' ? <Stethoscope size={18} /> : <Baby size={18} />}
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <p className="text-sm font-bold text-slate-800 leading-tight">{item.title}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ASK MOOWIE CTA */}
                    <div className="bg-emerald-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group cursor-pointer">
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-400 rounded-2xl flex items-center justify-center text-emerald-900">
                                    <Sparkles size={20} />
                                </div>
                                <h3 className="text-white text-lg font-black tracking-tight">Ask Moowie</h3>
                            </div>
                            <p className="text-emerald-100/70 text-sm font-medium leading-relaxed">
                                Get instant answers about cattle breeding, nutrition, or health symptoms from your AI assistant.
                            </p>
                            <button className="w-full py-4 bg-emerald-400 hover:bg-emerald-300 text-emerald-900 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                                Open Chat
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FarmerDashboard;
