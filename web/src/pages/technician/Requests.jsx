import React, { useState } from 'react';
import { 
    ClipboardList, 
    Search, 
    CheckCircle2, 
    XCircle, 
    MapPin, 
    Eye,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Play,
    CheckCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { useToast } from '../../contexts/ToastContext';
import TaskActionModal from '../../components/modals/TaskActionModal';

const Requests = () => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedTaskForModal, setSelectedTaskForModal] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const itemsPerPage = 12;

    // Fetch Requests
    const { data, isLoading } = useQuery({
        queryKey: ['technician', 'requests'],
        queryFn: async () => {
            const res = await axiosInstance.get('/technician/dashboard-data');
            return res.data.pendingRequests || [];
        }
    });

    // Mutation for status update
    const updateMutation = useMutation({
        mutationFn: async ({ id, type, status }) => {
            const endpoint = type === 'insemination' 
                ? `/technician/inseminations/${id}/status`
                : `/health-request/${id}/status`;
            
            return await axiosInstance.patch(endpoint, { status });
        },
        onSuccess: (_, variables) => {
            let statusLabel = variables.status.replace('-', ' ').toUpperCase();
            toast.success(`Mission Updated: ${statusLabel}`);
            queryClient.invalidateQueries({ queryKey: ['technician', 'requests'] });
        },
        onError: () => {
            toast.error('Failed to update status');
        }
    });

    const filteredRequests = data?.filter(req => {
        const matchesSearch = 
            req.farmer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.task?.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (statusFilter === 'all') return matchesSearch;
        return matchesSearch && req.status === statusFilter;
    }) || [];

    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const paginatedRequests = filteredRequests.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === paginatedRequests.length && paginatedRequests.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(paginatedRequests.map(r => r.id));
        }
    };

    const handleOpenModal = (req) => {
        setSelectedTaskForModal(req);
        setIsModalOpen(true);
    };

    return (
        <div className="animate-fade-in space-y-6 pb-16">
            {/* PAGE HEADER */}
            <div className="card bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-linear-to-r from-[#074033] to-emerald-800 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                <ClipboardList size={14} className="text-emerald-300" />
                            </div>
                            <span className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">
                                Operational Inbox
                            </span>
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Farmer Task Requests</h1>
                        <p className="text-emerald-200/70 text-xs mt-0.5">Triage and accept field service missions from registered livestock owners</p>
                    </div>
                    <div className="flex gap-4 shrink-0 bg-black/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-emerald-300/40 uppercase tracking-widest mb-0.5 text-left">Active Queue</p>
                            <p className="text-2xl font-black text-white text-left leading-none">{data?.length || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <div className="join border border-base-300 rounded-xl overflow-hidden shrink-0">
                    {['pending', 'in-progress', 'all'].map(status => (
                        <button key={status} onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                            className={`join-item btn btn-sm px-6 ${statusFilter === status ? "btn-neutral" : "bg-base-100 border-none text-base-content/60"}`}>
                            {status.toUpperCase()}
                        </button>
                    ))}
                </div>

                <label className="input input-sm bg-base-100 border-base-300 flex items-center gap-2 grow rounded-xl h-9 shadow-sm">
                    <Search size={14} className="text-base-content/40" />
                    <input type="text" placeholder="Search by farmer, tag or task..." className="grow text-xs font-bold"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    {searchQuery && <button onClick={() => setSearchQuery("")} className="text-base-content/40 hover:text-error transition-colors">✕</button>}
                </label>
                
                <span className="text-xs text-base-content/40 font-semibold shrink-0">{filteredRequests.length} tasks found</span>
            </div>

            {/* TABLE */}
            <div className="card bg-base-100 border border-base-300 shadow-sm rounded-2xl overflow-visible">
                <div className="overflow-x-auto min-h-[450px]">
                    <table className="table table-zebra table-sm w-full">
                        <thead>
                            <tr className="bg-base-200/80 text-base-content/60">
                                <th className="w-10">
                                    <input type="checkbox" className="checkbox checkbox-sm"
                                        checked={selectedIds.length === paginatedRequests.length && paginatedRequests.length > 0}
                                        onChange={toggleSelectAll} />
                                </th>
                                <th className="font-bold uppercase text-[10px] tracking-wider">Identifier</th>
                                <th className="font-bold uppercase text-[10px] tracking-wider">Farmer / Location</th>
                                <th className="font-bold uppercase text-[10px] tracking-wider">Service Scope</th>
                                <th className="font-bold uppercase text-[10px] tracking-wider">Timeline</th>
                                <th className="font-bold uppercase text-[10px] tracking-wider text-center">Status</th>
                                <th className="font-bold uppercase text-[10px] tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {[...Array(7)].map((_, j) => <td key={j}><div className="h-4 bg-base-300 rounded w-full" /></td>)}
                                    </tr>
                                ))
                            ) : paginatedRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-base-content/30">
                                        <ClipboardList size={40} strokeWidth={1} className="mx-auto mb-3" />
                                        <p className="text-xs font-black uppercase tracking-widest">Queue Empty</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRequests.map((req, idx) => (
                                    <tr key={req.id} className="hover cursor-pointer" onClick={() => handleOpenModal(req)}>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" className="checkbox checkbox-sm"
                                                checked={selectedIds.includes(req.id)} onChange={() => toggleSelect(req.id)} />
                                        </td>
                                        <td>
                                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-500">
                                                #REQ-{req.id.toString().substring(0, 5).toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center font-black text-[10px]">
                                                    {req.farmer?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xs leading-tight">{req.farmer}</p>
                                                    <p className="text-[10px] text-base-content/40 flex items-center gap-1">
                                                        <MapPin size={9} /> {req.location}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-bold leading-tight">{req.type === 'insemination' ? 'Artificial Insemination' : 'Medical Diagnostics'}</p>
                                                <p className="text-[10px] text-base-content/50 font-medium uppercase tracking-tighter">{req.task}</p>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Calendar size={12} className="text-base-content/30" />
                                                <span className="text-[11px] font-bold text-base-content/60">
                                                    {new Date(req.displayDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <span className={`badge badge-sm border font-black text-[9px] uppercase tracking-widest ${
                                                req.status === 'pending' ? 'badge-warning badge-outline' : 'bg-info/10 text-info border-info/20'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                <div className="tooltip tooltip-left" data-tip="View Details">
                                                    <button onClick={() => handleOpenModal(req)} className="btn btn-ghost btn-xs btn-square text-info hover:bg-info/10">
                                                        <Eye size={15} />
                                                    </button>
                                                </div>
                                                {req.status === 'pending' && (
                                                    <>
                                                        <div className="tooltip tooltip-left" data-tip="Accept">
                                                            <button onClick={() => updateMutation.mutate({ id: req.id, type: req.type, status: 'in-progress' })}
                                                                className="btn btn-ghost btn-xs btn-square text-success hover:bg-success/10">
                                                                <CheckCircle size={15} />
                                                            </button>
                                                        </div>
                                                        <div className="tooltip tooltip-left" data-tip="Decline">
                                                            <button onClick={() => updateMutation.mutate({ id: req.id, type: req.type, status: req.type === 'insemination' ? 'rejected' : 'cancelled' })}
                                                                className="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10">
                                                                <XCircle size={15} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                                {req.status === 'in-progress' && (
                                                    <div className="tooltip tooltip-left" data-tip="Finish">
                                                        <button onClick={() => updateMutation.mutate({ id: req.id, type: req.type, status: req.type === 'insemination' ? 'done' : 'resolved' })}
                                                            className="btn btn-ghost btn-xs btn-square text-primary hover:bg-primary/10">
                                                            <Play size={15} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 bg-base-200/40 border-t border-base-300">
                    <span className="text-xs text-base-content/50">
                        {filteredRequests.length === 0 ? "No records" : <>Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong>—<strong>{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</strong> of <strong>{filteredRequests.length}</strong></>}
                    </span>
                    <div className="join">
                        <button className="join-item btn btn-sm btn-ghost" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                            <ChevronLeft size={15} />
                        </button>
                        {[...Array(Math.min(5, totalPages))].map((_, i) => (
                            <button key={i} className={`join-item btn btn-sm ${currentPage === i + 1 ? "btn-neutral" : "btn-ghost"}`} onClick={() => setCurrentPage(i + 1)}>
                                {i + 1}
                            </button>
                        ))}
                        <button className="join-item btn btn-sm btn-ghost" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage((p) => p + 1)}>
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            </div>

            <TaskActionModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                task={selectedTaskForModal}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['technician', 'requests'] })}
            />
        </div>
    );
};

export default Requests;
