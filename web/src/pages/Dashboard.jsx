import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';
import AssignTaskModal from '../components/modals/AssignTaskModal';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';

import LoadingView from "../components/LoadingView";

const Dashboard = () => {
    const socket = useSocket();
    const queryClient = useQueryClient();
    const toast = useToast();

    useEffect(() => {
        if (!socket) return;

        socket.on("dashboardUpdate", (payload) => {
            console.log("[Socket] Admin Dashboard Refresh Triggered:", payload);
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['pendingRequests'] });
        });

        return () => {
            socket.off("dashboardUpdate");
        };
    }, [socket, queryClient]);

    const { data: stats, isLoading, error } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: async () => {
            try {
                const response = await axios.get('/admin/stats');
                return response.data;
            } catch (err) {
                if (err.response?.status === 401) {
                    // Try to sync user if 401 (User not found)
                    console.log("User not found, attempting sync...");
                    try {
                        await axios.post('/user/sync-manual');
                    } catch (syncErr) {
                         console.error("Sync failed:", syncErr);
                         toast.error(`Sync Failed: ${syncErr.response?.status}`);
                         throw syncErr; // Stop retry if sync fails
                    }
                    // Retry stats fetch
                    const response = await axios.get('/admin/stats');
                    return response.data;
                }
                throw err;
            }
        }
    });

    const { data: pendingRequests = [], refetch: refetchRequests } = useQuery({
        queryKey: ['pendingRequests'],
        queryFn: async () => {
            const res = await axios.get('/health-request?status=pending');
            return res.data;
        }
    });

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    const statsList = [
        { title: "Total Users", value: stats?.totalUsers || 0, desc: "System Users", color: "text-primary", bg: "bg-primary/10", icon: "👥" },
        { title: "Animals", value: stats?.animals || 0, desc: "Recorded Livestock", color: "text-secondary", bg: "bg-secondary/10", icon: "🐄" },
        { title: "Inseminations", value: stats?.inseminations || 0, desc: "Total Procedures", color: "text-accent", bg: "bg-accent/10", icon: "🧬" },
        { title: "Pregnancies", value: stats?.pregnancies || 0, desc: "Active Cases", color: "text-info", bg: "bg-info/10", icon: "🤰" },
    ];

    if (isLoading) return <LoadingView message="Synchronizing Data..." />;
    
    if (error) return (
        <div className="alert alert-error shadow-lg">
            <span>Error loading stats: {error.message}</span>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-extrabold text-base-content/70 mb-2 lg:hidden">Dashboard</h1>
            <p className="text-lg text-base-content/60 mb-8">Welcome back! Here's an overview of your farm data.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsList.map((stat, index) => (
                    <div key={index} className={`card bg-base-100 shadow-xl border-b-4 ${stat.color.replace('text-', 'border-')} hover:scale-105 transition-transform duration-300`}>
                        <div className="card-body">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="card-title text-base-content/60 text-lg">{stat.title}</h2>
                                    <p className={`text-4xl font-black ${stat.color} mt-2`}>{stat.value}</p>
                                    <p className="text-sm text-base-content/40 mt-1">{stat.desc}</p>
                                </div>
                                <div className={`p-3 rounded-full ${stat.bg} text-2xl`}>
                                    {stat.icon}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Technician Tables Grid */}
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Client Management Table */}
                <div className="card bg-base-100 shadow-xl col-span-1 xl:col-span-2">
                    <div className="card-body overflow-x-auto p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <h2 className="card-title text-2xl font-bold text-base-content/80">Client Management Table</h2>
                            <select className="select select-bordered select-sm w-full sm:w-auto bg-base-200/50">
                                <option>All Clients</option>
                                <option>Active Requests</option>
                                <option>Recent Visits</option>
                            </select>
                        </div>
                        <table className="table table-zebra w-full">
                            <thead className="bg-[#074033] text-white">
                                <tr>
                                    <th className="rounded-tl-lg">Farmer Name</th>
                                    <th>Barangay/Location</th>
                                    <th>Total Animals</th>
                                    <th>Reliability Rating</th>
                                    <th className="rounded-tr-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: "Alex Rivera", location: "Barangay Lokaan", animals: 28, rating: 5, bg: "bg-blue-100 text-blue-700" },
                                    { name: "Manina Furrana", location: "Iloilo, Barangay", animals: 10, rating: 4, bg: "bg-purple-100 text-purple-700" },
                                    { name: "Sampa Rewan", location: "Iloilo, Polana", animals: 26, rating: 5, bg: "bg-orange-100 text-orange-700" },
                                    { name: "Latto Srieeno", location: "Barangay Jiwn", animals: 42, rating: 3, bg: "bg-emerald-100 text-emerald-700" },
                                ].map((client, i) => (
                                    <tr key={i} className="hover">
                                        <td className="font-semibold flex items-center gap-4">
                                            <div className="avatar placeholder">
                                              <div className={`${client.bg} w-10 h-10 rounded-full font-bold text-sm`}>
                                                <span>{client.name.charAt(0)}</span>
                                              </div>
                                            </div>
                                            {client.name}
                                        </td>
                                        <td className="text-base-content/70">{client.location}</td>
                                        <td className="font-medium">{client.animals} Head</td>
                                        <td className="text-secondary text-lg">
                                            {"★".repeat(client.rating)}{"☆".repeat(5-client.rating)}
                                        </td>
                                        <td>
                                            <button className="btn btn-sm btn-outline btn-primary rounded-full px-5 shadow-sm">View Herd</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pending Health Requests Ledger */}
                <div className="card bg-base-100 shadow-xl col-span-1 xl:col-span-2">
                    <div className="card-body overflow-x-auto p-6 md:p-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <h2 className="card-title text-2xl font-bold text-base-content/80">Pending Health Requests</h2>
                            <button className="btn btn-sm btn-ghost text-primary">View Full Ledger →</button>
                        </div>
                        <table className="table table-zebra w-full">
                            <thead className="bg-[#074033] text-white">
                                <tr>
                                    <th className="rounded-tl-lg">Farmer / Location</th>
                                    <th>Animal ID</th>
                                    <th>Urgency</th>
                                    <th className="rounded-tr-lg">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-6 text-gray-500 font-medium">No pending requests right now.</td>
                                    </tr>
                                ) : (
                                    pendingRequests.map((req, i) => (
                                        <tr key={req._id} className="hover">
                                            <td className="font-semibold text-base-content/80">{req.farmerId?.name || 'Unknown'}</td>
                                            <td className="text-base-content/70 font-mono font-bold">#{req.animalId?.earTag || 'Unknown'}</td>
                                            <td>
                                                <span className={`badge ${
                                                    req.urgency === 'high' ? 'badge-error bg-rose-500 border-rose-500 text-white' :
                                                    'badge-warning bg-amber-500 border-amber-500 text-white'
                                                } font-bold badge-sm py-3 px-4 shadow-sm`}>
                                                    {req.urgency === 'high' ? 'High' : 'Standard'}
                                                </span>
                                            </td>
                                            <td>
                                                <button 
                                                    className="btn btn-sm btn-outline btn-primary rounded-full px-5 shadow-sm"
                                                    onClick={() => {
                                                        setSelectedRequest(req);
                                                        setIsAssignModalOpen(true);
                                                    }}
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
            </div>

            <AssignTaskModal 
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                taskData={selectedRequest}
                onSuccess={() => refetchRequests()}
            />
        </div>
    );
};

export default Dashboard;
