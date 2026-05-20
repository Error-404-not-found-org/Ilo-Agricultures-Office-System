import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';
import AssignTaskModal from '../components/modals/AssignTaskModal';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'sonner';
import LoadingView from "../components/LoadingView";
import { 
    Users, ClipboardCheck, Activity, ArrowUpRight, Filter, 
    TrendingUp, ShieldAlert, Calendar, ChevronRight, MapPin,
    Zap, Target, PieChart as PieChartIcon, Bell, Search, MoreVertical, Sparkles,
    BarChart3, LineChart, Map as MapIcon, RefreshCcw, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

const Dashboard = () => {
    const socket = useSocket();
    const queryClient = useQueryClient();
    const [activeUrgency, setActiveUrgency] = useState('all');

    useEffect(() => {
        if (!socket) return;
        socket.on("dashboardUpdate", (payload) => {
            queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
            toast.info(payload.message || "Dashboard updated in real-time");
        });
        return () => socket.off("dashboardUpdate");
    }, [socket, queryClient]);

    const { data, isLoading } = useQuery({
        queryKey: ['adminDashboard'],
        queryFn: async () => {
            const [statsRes, pendingRes, registryRes, analyticsRes, chartRes, techRes] = await Promise.all([
                axios.get('/admin/stats'),
                axios.get('/health-request?status=pending'),
                axios.get('/technician/dashboard-registry'),
                axios.get('/admin/analytics'),
                axios.get('/admin/chart-data'),
                axios.get('/admin/list-users?role=technician')
            ]);
            return {
                stats: statsRes.data,
                pendingRequests: pendingRes.data,
                registry: registryRes.data,
                analytics: analyticsRes.data,
                chartData: chartRes.data,
                technicians: techRes.data.users || []
            };
        }
    });

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Prepare chart data
    const areaChartData = useMemo(() => {
        if (!data?.chartData) return [];
        const { inseminations = [], healthRequests = [] } = data.chartData;
        const allDates = Array.from(new Set([
            ...inseminations.map(d => d._id),
            ...healthRequests.map(d => d._id)
        ])).sort();

        return allDates.map(date => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            ai: inseminations.find(d => d._id === date)?.count || 0,
            health: healthRequests.find(d => d._id === date)?.count || 0,
        }));
    }, [data?.chartData]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (isLoading) return <LoadingView message="Initializing Command Center..." />;

    // Use static Tailwind classes here so compiling colors works correctly
    const statsList = [
        { title: "Active Farmers", value: data?.stats?.farmers || 0, icon: Users, bgClass: "bg-blue-500/10 border-blue-500/20 text-blue-500", trend: "+12.4%" },
        { title: "Livestock Pop", value: data?.stats?.animals || 0, icon: Activity, bgClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500", trend: "+5.2%" },
        { title: "AI Success", value: data?.stats?.successRate || "84%", icon: Target, bgClass: "bg-rose-500/10 border-rose-500/20 text-rose-500", trend: "+2.1%" },
        { title: "Fleet Strength", value: data?.technicians?.length || 0, icon: Zap, bgClass: "bg-amber-500/10 border-amber-500/20 text-amber-500", trend: "Stable" },
    ];

    return (
        <div className="space-y-8 pb-20 max-w-[1600px] mx-auto px-4 sm:px-6">
            {/* --- PREMIUM HERO SECTION --- */}
            <div className="card bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="bg-linear-to-r from-[#074033] to-[#0d5948] px-6 py-6 md:py-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full backdrop-blur-md">
                            <Zap size={12} className="text-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 text-[8px] font-black uppercase tracking-widest">Live Operations Active</span>
                        </div>
                        <h1 className="text-white text-2xl md:text-3xl font-black tracking-tight leading-none uppercase">
                            Herd Command <span className="text-emerald-400">Center</span>
                        </h1>
                        <p className="text-emerald-200/60 text-xs font-semibold max-w-lg leading-relaxed uppercase tracking-wider">
                            Precision agriculture oversight for Oton's livestock productivity. Monitor, assign, and optimize field technician operations in real-time.
                        </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                        <button className="flex-1 lg:flex-none group bg-white/5 hover:bg-white/10 text-white px-5 h-11 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer">
                            <Calendar size={14} className="text-emerald-300 group-hover:text-white transition-colors" />
                            <span>Export Analytics</span>
                        </button>
                        <button 
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })}
                            className="flex-1 lg:flex-none bg-emerald-500 hover:bg-emerald-400 text-white px-5 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <RefreshCcw size={14} />
                            <span>Live Sync</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* --- CORE METRICS GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsList.map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.title}
                        className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                    >
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`p-4 rounded-2xl ${stat.bgClass} group-hover:scale-110 transition-transform duration-300`}>
                                    <stat.icon size={20} />
                                </div>
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                    <TrendingUp size={10} />
                                    {stat.trend}
                                </div>
                            </div>
                            <h3 className="text-base-content/40 font-black text-[10px] uppercase tracking-[0.2em] mb-1">{stat.title}</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-base-content tracking-tighter uppercase">{stat.value}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* --- ANALYTICS & VISUALIZATION --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Breeding Trends Chart */}
                <div className="lg:col-span-8 bg-base-100 rounded-3xl border border-base-300 shadow-sm p-6 sm:p-8 flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <div>
                            <h2 className="text-xl font-black text-base-content tracking-tight uppercase">System Throughput</h2>
                            <p className="text-base-content/40 font-bold text-[10px] uppercase tracking-widest mt-1">30-day Breeding & Health Request Volume</p>
                        </div>
                        <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-base-content/60">AI Volume</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-base-content/60">Health Cases</span>
                             </div>
                        </div>
                    </div>
                    
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={areaChartData} margin={{ left: -10, right: 10 }}>
                                <defs>
                                    <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-base-300/30" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 700 }}
                                    className="text-base-content/40"
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 700 }}
                                    className="text-base-content/40"
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-base-300)', backgroundColor: 'var(--color-base-100)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                    itemStyle={{ fontSize: '11px', fontWeight: 900, color: 'var(--color-base-content)' }}
                                />
                                <Area type="monotone" dataKey="ai" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAi)" />
                                <Area type="monotone" dataKey="health" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHealth)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Regional Distribution */}
                <div className="lg:col-span-4 bg-base-100 rounded-3xl border border-base-300 shadow-sm p-6 sm:p-8 flex flex-col">
                    <h2 className="text-xl font-black text-base-content tracking-tight mb-4 uppercase">District Density</h2>
                    <div className="h-[200px] w-full grow flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.analytics?.barangayStats || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={75}
                                    paddingAngle={4}
                                    dataKey="count"
                                    nameKey="_id"
                                >
                                    {(data?.analytics?.barangayStats || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-base-300)', backgroundColor: 'var(--color-base-100)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-3 mt-4 pt-4 border-t border-base-300/40">
                        {(data?.analytics?.barangayStats || []).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10px] font-black uppercase">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    <span className="text-base-content/60 tracking-wider">{item._id}</span>
                                </div>
                                <span className="text-base-content">{item.count} assets</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* --- PRIORITY DISPATCH CENTER --- */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-base-100 rounded-3xl border border-base-300 shadow-sm overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-base-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-600">
                                    <ShieldAlert size={18} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-base-content tracking-tight uppercase">Dispatch Queue</h2>
                                    <p className="text-base-content/40 font-bold text-[10px] uppercase tracking-widest mt-1">Real-time Field Service Management</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {['all', 'high'].map(u => (
                                    <button 
                                        key={u}
                                        onClick={() => setActiveUrgency(u)}
                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeUrgency === u ? 'bg-[#074033] text-white shadow-md' : 'bg-base-200 text-base-content/40 hover:bg-base-300'}`}
                                    >
                                        {u === 'high' ? 'Critical' : 'All Orders'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="table table-sm w-full">
                                <thead>
                                    <tr className="bg-base-200/30">
                                        <th className="px-8 py-5 text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">Origin</th>
                                        <th className="px-8 py-5 text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">Resource</th>
                                        <th className="px-8 py-5 text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">Urgency</th>
                                        <th className="px-8 py-5 text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] text-right">Dispatch</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base-200">
                                    <AnimatePresence mode="popLayout">
                                        {(data?.pendingRequests || [])
                                            .filter(r => activeUrgency === 'all' || r.urgency === activeUrgency)
                                            .slice(0, 6)
                                            .map((req) => (
                                                <motion.tr 
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    key={req._id} 
                                                    className="hover:bg-base-200/50 transition-all group"
                                                >
                                                    <td className="px-8 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-8 h-8 rounded-lg bg-base-200 border border-base-300 flex items-center justify-center text-base-content/40">
                                                                <User size={14} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-base-content uppercase">{req.farmerId?.name}</p>
                                                                <div className="flex items-center gap-1 text-base-content/40 text-[9px] font-bold mt-0.5 uppercase tracking-widest">
                                                                    <MapPin size={10} />
                                                                    <span>{req.farmerId?.address?.barangay || 'Oton'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4">
                                                        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 px-2.5 py-0.5 rounded-md">
                                                            <span className="text-[9px] font-black uppercase tracking-widest">#{req.animalId?.earTag || 'N/A'}</span>
                                                        </div>
                                                        <p className="text-[9px] text-base-content/40 font-bold mt-1 uppercase tracking-widest">{req.animalId?.species}</p>
                                                    </td>
                                                    <td className="px-8 py-4">
                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-md ${req.urgency === 'high' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600' : 'bg-base-200 border-base-300 text-base-content/60'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${req.urgency === 'high' ? 'bg-rose-500 animate-pulse' : 'bg-base-content/40'}`} />
                                                            <span className="text-[8px] font-black uppercase tracking-widest">{req.urgency}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4 text-right">
                                                        <button 
                                                            onClick={() => { setSelectedRequest(req); setIsAssignModalOpen(true); }}
                                                            className="btn btn-sm btn-square rounded-xl bg-base-200 hover:bg-emerald-500 hover:text-white border border-base-300 text-base-content/60 transition-all shadow-sm cursor-pointer"
                                                        >
                                                            <ArrowUpRight size={14} />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* --- SIDEBAR: LEADERBOARD & FLEET --- */}
                <div className="lg:col-span-4 space-y-8">
                    {/* FLEET STATUS */}
                    <div className="bg-base-100 rounded-3xl border border-base-300 shadow-sm p-6 sm:p-8 flex flex-col">
                        <h2 className="text-xl font-black text-base-content tracking-tight mb-6 uppercase">Active Fleet</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {data?.technicians?.slice(0, 4).map((tech, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-base-200/40 border border-base-300/60 flex flex-col items-center text-center group hover:border-emerald-500/30 transition-all cursor-pointer">
                                    <div className="relative mb-3">
                                        <div className="w-10 h-10 rounded-2xl bg-base-100 border border-base-300 flex items-center justify-center text-lg overflow-hidden">
                                            {tech.imageUrl ? <img src={tech.imageUrl} className="w-full h-full object-cover grayscale-[0.2] group-hover:scale-105 transition-transform duration-300" /> : '👨‍🔧'}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-base-100 rounded-full" />
                                    </div>
                                    <p className="text-[10px] font-black text-base-content uppercase truncate w-full tracking-wider">{tech.name?.split(' ')[0]}</p>
                                    <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-1 tracking-widest">Deployed</p>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-6 h-11 bg-base-200 hover:bg-base-300 rounded-xl border border-base-300 text-[9px] font-black uppercase tracking-widest text-base-content/60 transition-all cursor-pointer">
                            View All Assets
                        </button>
                    </div>

                    {/* TOP TECHNICIANS */}
                    <div className="bg-base-100 rounded-3xl border border-base-300 shadow-sm p-6 sm:p-8 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-black text-base-content tracking-tight text-[12px] uppercase">Yield Performance</h2>
                            <BarChart3 size={16} className="text-emerald-500" />
                        </div>
                        
                        <div className="space-y-6">
                            {(data?.analytics?.technicianStats || []).slice(0, 3).map((tech, i) => (
                                <div key={tech.name} className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-[10px] font-black text-base-content uppercase tracking-wider">{tech.name}</p>
                                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{Math.round(tech.successRate)}%</p>
                                        </div>
                                        <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden border border-base-300">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${tech.successRate}%` }}
                                                className="h-full bg-emerald-500 rounded-full" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MOOWIE AUDITOR */}
                    <div className="bg-[#074033] rounded-3xl border border-emerald-950 p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-linear-to-br from-emerald-400/5 to-transparent pointer-events-none" />
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400">
                                    <Sparkles size={14} />
                                </div>
                                <h3 className="text-white text-sm font-black tracking-widest uppercase">Moowie Insight</h3>
                            </div>
                            
                            <div className="bg-black/20 border border-white/5 rounded-2xl p-4 backdrop-blur-md">
                                <p className="text-emerald-400 text-[8px] font-black uppercase tracking-[0.3em] mb-1.5">Fleet Optimization</p>
                                <p className="text-emerald-50/80 text-[10px] font-bold leading-relaxed tracking-wider uppercase">
                                    {data?.pendingRequests?.length > 5 
                                        ? "Anomaly: Request density peaking. Deploy additional technicians to maintain response time."
                                        : "Status: Metrics within standard deviation. System efficiency +4.2% YoY."
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- RECENT REGISTRY ACTIVITY --- */}
            <div className="bg-base-100 rounded-3xl border border-base-300 shadow-sm p-6 sm:p-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-600">
                            <ClipboardCheck size={18} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-base-content tracking-tight uppercase">Registry Log</h2>
                            <p className="text-base-content/40 font-bold text-[10px] uppercase tracking-widest mt-1">Live Global Livestock Enrollment Activity</p>
                        </div>
                    </div>
                    <button className="h-11 bg-base-200 hover:bg-base-300 px-6 border border-base-300 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-base-content/60 cursor-pointer">
                        Full Inventory
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {(data?.registry || []).slice(0, 4).map((animal) => (
                        <div key={animal.id} className="p-5 rounded-2xl bg-base-200/30 border border-base-300 hover:border-emerald-500/30 transition-all hover:bg-base-200/50 hover:shadow-md group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-base-100 border border-base-300 flex items-center justify-center text-lg overflow-hidden shadow-sm">
                                        {animal.imageUrl ? <img src={animal.imageUrl} className="w-full h-full object-cover grayscale-[0.2]" /> : '🐄'}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] border font-black uppercase tracking-widest ${animal.status === 'Pregnant' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'}`}>
                                        {animal.status}
                                    </span>
                                </div>
                                <h4 className="text-xs font-black text-base-content uppercase">#{animal.id}</h4>
                                <p className="text-[9px] text-base-content/40 font-bold uppercase tracking-[0.2em]">{animal.breed}</p>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-base-300/60 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-md bg-base-300 flex items-center justify-center">
                                        <User size={10} className="text-base-content/40" />
                                    </div>
                                    <span className="text-[9px] font-black text-base-content/60 uppercase truncate max-w-[80px]">{animal.farmerName}</span>
                                </div>
                                <span className="text-[8px] font-bold text-base-content/30 uppercase tracking-widest">{new Date(animal.lastActionDate).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <AssignTaskModal 
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                taskData={selectedRequest}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })}
            />
        </div>
    );
};

export default Dashboard;
