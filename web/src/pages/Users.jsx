import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';
import { 
    Search, UserPlus, Filter, MoreVertical, Edit2, 
    Trash2, Mail, Shield, Smartphone, MapPin, 
    CheckCircle2, AlertCircle, ChevronDown, UserCheck, 
    UserX, Loader2, RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import LoadingView from "../components/LoadingView";
import { OTON_BARANGAYS } from '../constants/barangays';

const ROLE_COLORS = {
    admin: 'bg-amber-100 text-amber-700 border-amber-200',
    technician: 'bg-blue-100 text-blue-700 border-blue-200',
    farmer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const STATUS_COLORS = {
    active: 'bg-green-100 text-green-700',
    'on-site': 'bg-blue-100 text-blue-700',
    'on-leave': 'bg-rose-100 text-rose-700',
};

const Users = () => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [barangayFilter, setBarangayFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: users = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const res = await axios.get('/admin/list-users');
            return Array.isArray(res.data) ? res.data : [];
        },
    });

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchesSearch = 
                user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                user.email?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const userBarangay = typeof user.address === 'string' ? '' : (user.address?.barangay || '');
            const matchesBarangay = barangayFilter === 'all' || userBarangay === barangayFilter;
            return matchesSearch && matchesRole && matchesBarangay;
        });
    }, [users, searchTerm, roleFilter, barangayFilter]);

    if (isLoading) return <LoadingView message="Synchronizing User Records..." />;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Users</h1>
                    <p className="text-slate-500 font-medium">Manage permissions and accounts for the entire ecosystem</p>
                </div>
                <button 
                    onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95"
                >
                    <UserPlus size={20} />
                    <span>Invite New User</span>
                </button>
            </div>

            {/* Controls Bar */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Search by name, email, or ID..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Filter size={18} className="text-slate-400 ml-2" />
                    <select 
                        className="bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[140px]"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Administrators</option>
                        <option value="technician">Technicians</option>
                        <option value="farmer">Farmers</option>
                    </select>
                    <select 
                        className="bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[140px]"
                        value={barangayFilter}
                        onChange={(e) => setBarangayFilter(e.target.value)}
                    >
                        <option value="all">All Barangays</option>
                        {OTON_BARANGAYS.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                    <button 
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
                    >
                        <RefreshCcw size={18} className={isRefetching ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-4xl shadow-xl shadow-slate-100/50 border border-slate-50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-bottom border-slate-100">
                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">User Identity</th>
                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Role & Status</th>
                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Contact Info</th>
                            <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        <AnimatePresence>
                            {filteredUsers.map((user) => (
                                <motion.tr 
                                    key={user._id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="hover:bg-slate-50/80 transition-colors group"
                                >
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                                                {user.imageUrl ? (
                                                    <img src={user.imageUrl} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-black text-slate-400">{user.name?.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-800">{user.name}</p>
                                                    {user.isVerified && <CheckCircle2 size={14} className="text-emerald-500" />}
                                                </div>
                                                <p className="text-xs font-mono text-slate-400">ID: {user.clerkId?.slice(-8) || 'OFFLINE'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-2">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border self-start ${ROLE_COLORS[user.role] || 'bg-slate-100'}`}>
                                                {user.role}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                <span className="text-xs font-bold text-slate-500 capitalize">{user.status || 'active'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Mail size={14} className="text-slate-400" />
                                                <span className="font-medium">{user.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500 text-xs">
                                                <MapPin size={12} className="text-slate-400" />
                                                <span>{typeof user.address === 'string' ? user.address : (user.address?.barangay || 'No address')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => { setSelectedUser(user); setIsModalOpen(true); }}
                                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
                {filteredUsers.length === 0 && (
                    <div className="py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">No users found</h3>
                        <p className="text-slate-400">Try adjusting your search or filters</p>
                    </div>
                )}
            </div>

            {/* Pagination Placeholder */}
            <div className="flex items-center justify-between text-sm text-slate-500 font-medium">
                <p>Showing {filteredUsers.length} users</p>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Previous</button>
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Next</button>
                </div>
            </div>

            {/* Invite/Edit User Modal (Simulated for brevity, can be expanded) */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-black text-slate-800">
                                        {selectedUser ? 'Update Profile' : 'Invite New User'}
                                    </h2>
                                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                        <AlertCircle size={24} className="text-slate-400" />
                                    </button>
                                </div>
                                
                                <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); toast.success("Operation Simulated"); }}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">First Name</label>
                                            <input type="text" defaultValue={selectedUser?.name?.split(' ')[0]} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Last Name</label>
                                            <input type="text" defaultValue={selectedUser?.name?.split(' ')[1]} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                                        <input type="email" defaultValue={selectedUser?.email} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Assign System Role</label>
                                        <select defaultValue={selectedUser?.role || 'farmer'} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-slate-600">
                                            <option value="admin">Administrator</option>
                                            <option value="technician">Technician</option>
                                            <option value="farmer">Farmer / Client</option>
                                        </select>
                                    </div>

                                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 active:scale-95 transition-all">
                                        {selectedUser ? 'Save Changes' : 'Send Invite'}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Users;
