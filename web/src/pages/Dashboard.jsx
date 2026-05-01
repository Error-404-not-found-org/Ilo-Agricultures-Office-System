import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';
import AssignTaskModal from '../components/modals/AssignTaskModal';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'sonner';
import LoadingView from "../components/LoadingView";
import { 
    Users, 
    ClipboardCheck, 
    Activity, 
    ArrowUpRight, 
    Filter, 
    MoreHorizontal,
    TrendingUp,
    ShieldAlert,
    Calendar,
    ChevronRight,
    Search,
    MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard = () => {
    const socket = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket) return;
        socket.on("dashboardUpdate", (payload) => {
            queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
        });
        return () => socket.off("dashboardUpdate");
    }, [socket, queryClient]);

    const { data, isLoading } = useQuery({
        queryKey: ['adminDashboard'],
        queryFn: async () => {
            const [statsRes, pendingRes, registryRes, analyticsRes] = await Promise.all([
                axios.get('/admin/stats'),
                axios.get('/health-request?status=pending'),
                axios.get('/technician/dashboard-registry'),
                axios.get('/admin/analytics')
            ]);
            return {
                stats: statsRes.data,
                pendingRequests: pendingRes.data,
                registry: registryRes.data,
                analytics: analyticsRes.data
            };
        }
    });

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    if (isLoading) return <LoadingView message="Loading Command Center..." />;

    const statsList = [
        { title: "Total Users", value: data?.stats?.totalUsers || 0, change: "+12%", desc: "Active in Platform", color: "text-emerald-600", bg: "bg-emerald-500/10", icon: <Users size={20} /> },
        { title: "Livestock Registry", value: data?.stats?.animals || 0, change: "+5.4%", desc: "Tracked Head", color: "text-blue-600", bg: "bg-blue-500/10", icon: <Activity size={20} /> },
        { title: "AI Success Rate", value: data?.stats?.successRate || "84%", change: "+2.1%", desc: "Pregnancy Ratio", color: "text-rose-600", bg: "bg-rose-500/10", icon: <TrendingUp size={20} /> },
        { title: "Pending Tasks", value: data?.pendingRequests?.length || 0, change: "-4%", desc: "Requires Attention", color: "text-amber-600", bg: "bg-amber-500/10", icon: <ShieldAlert size={20} /> },
    ];

    return (
        <div className="animate-fade-in pb-12">
            {/* Header Banner */}
            <div className="relative bg-[#074033] rounded-[32px] p-8 md:p-12 overflow-hidden mb-10">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-white text-4xl md:text-5xl font-black tracking-tight mb-3">Admin Hub</h1>
                        <p className="text-emerald-100/70 text-lg font-medium max-w-md leading-relaxed">
                            Overseeing the regional livestock productivity and technician fleet operations.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 backdrop-blur-md">
                            <Calendar size={18} />
                            Generate Report
                        </button>
                        <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2">
                            <ArrowUpRight size={18} />
                            System Audit
                        </button>
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-emerald-400/10 rounded-full blur-[100px]" />
            </div>

            {/* High-Density Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {statsList.map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl transition-transform group-hover:scale-110`}>
                                {stat.icon}
                            </div>
                            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg">
                                <TrendingUp size={12} />
                                {stat.change}
                            </div>
                        </div>
                        <h3 className="text-slate-400 font-black text-[11px] uppercase tracking-widest mb-1">{stat.title}</h3>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
                        <p className="text-[11px] text-slate-400 font-bold mt-1">{stat.desc}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Pending Health Requests Ledger */}
                <div className="xl:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Priority Health Alerts</h2>
                            <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1">Pending Technician Assignment</p>
                        </div>
                        <button className="text-blue-600 font-black text-[11px] uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                            View Full Queue <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Farmer & Location</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Animal Details</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Urgency</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data?.pendingRequests?.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold italic">No pending health alerts found.</td>
                                    </tr>
                                ) : (
                                    data?.pendingRequests?.slice(0, 5).map((req) => (
                                        <tr key={req._id} className="hover:bg-slate-50/50 transition-all group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase">
                                                        {(req.farmerId?.name || 'U').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-black text-slate-900">{req.farmerId?.name || 'Unknown'}</p>
                                                        <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                                                            <MapPin size={10} /> {req.farmerId?.address?.barangay || 'Iloilo'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-[13px] font-black text-blue-600">#{req.animalId?.earTag || 'N/A'}</p>
                                                <p className="text-[11px] text-slate-400 font-bold">{req.animalId?.breed || 'Livestock'}</p>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                                    req.urgency === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {req.urgency || 'Normal'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button 
                                                    onClick={() => { setSelectedRequest(req); setIsAssignModalOpen(true); }}
                                                    className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200"
                                                >
                                                    Assign Task
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Technician Fleet & Inventory Grid */}
                <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Technician Performance */}
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Technician Fleet</h2>
                                <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1">Monthly Success Rate</p>
                            </div>
                            <MoreHorizontal className="text-slate-300" />
                        </div>
                        <div className="space-y-6">
                            {data?.analytics?.technicianStats?.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 font-bold italic">No technician activity recorded yet.</p>
                            ) : (
                                data?.analytics?.technicianStats?.map((tech, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-sm font-black text-slate-700">{tech.name}</p>
                                            <p className="text-xs font-black text-emerald-600">{tech.count} Tasks</p>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min((tech.count / 50) * 100, 100)}%` }}
                                                className="h-full bg-emerald-500 rounded-full"
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Semen & Supply Inventory */}
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Supply Inventory</h2>
                                <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1">Resource Stock Levels</p>
                            </div>
                            <button className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">Manage</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {data?.analytics?.inventory?.length === 0 ? (
                                <div className="col-span-2 text-center py-10 text-slate-400 font-bold italic">Stock is empty.</div>
                            ) : (
                                data?.analytics?.inventory?.slice(0, 4).map((item, i) => (
                                    <div key={i} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.itemName}</p>
                                        <div className="flex items-end gap-1">
                                            <p className={`text-2xl font-black ${item.currentStock <= item.lowStockThreshold ? 'text-rose-600' : 'text-slate-900'}`}>
                                                {item.currentStock}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 mb-1.5">{item.unit || 'pcs'}</p>
                                        </div>
                                        {item.currentStock <= item.lowStockThreshold && (
                                            <div className="mt-2 flex items-center gap-1 text-[9px] font-black text-rose-500 uppercase">
                                                <ShieldAlert size={10} /> Low Stock
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Registry Side Ledger */}
                <div className="xl:col-span-3 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <ClipboardCheck size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Recent Activity</h2>
                            <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1">Global Livestock Feed</p>
                        </div>
                    </div>
                    <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {data?.registry?.map((animal, i) => (
                            <div key={i} className="p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                            {animal.imageUrl ? (
                                                <img src={animal.imageUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-lg">🐄</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900">{animal.id}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{animal.breed}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                        animal.status === 'Pregnant' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                        {animal.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100/50">
                                    <p className="text-[10px] font-black text-slate-400 flex items-center gap-1">
                                        <Users size={10} /> {animal.farmerName}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-300 italic">
                                        {new Date(animal.lastActionDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="w-full py-4 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-all border-t border-slate-100">
                        View Complete Registry
                    </button>
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
