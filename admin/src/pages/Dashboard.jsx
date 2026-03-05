import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../lib/axios';

const Dashboard = () => {
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
                         alert(`Sync Failed: ${syncErr.response?.status} - ${JSON.stringify(syncErr.response?.data)}`);
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

    const statsList = [
        { title: "Total Users", value: stats?.totalUsers || 0, desc: "System Users", color: "text-primary", bg: "bg-primary/10", icon: "👥" },
        { title: "Animals", value: stats?.animals || 0, desc: "Recorded Livestock", color: "text-secondary", bg: "bg-secondary/10", icon: "🐄" },
        { title: "Inseminations", value: stats?.inseminations || 0, desc: "Total Procedures", color: "text-accent", bg: "bg-accent/10", icon: "🧬" },
        { title: "Pregnancies", value: stats?.pregnancies || 0, desc: "Active Cases", color: "text-info", bg: "bg-info/10", icon: "🤰" },
    ];

    if (isLoading) return (
        <div className="flex justify-center items-center h-full">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );
    
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
                    <div key={index} className="card bg-base-100 shadow-xl border-b-4 border-primary hover:scale-105 transition-transform duration-300">
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
            
            {/* Quick Actions Placeholder for future expansion */}
            <div className="mt-12 bg-base-100 p-8 rounded-2xl shadow-xl">
                <h2 className="text-2xl font-bold mb-4 text-base-content/80">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button className="btn btn-outline btn-primary h-auto py-4 flex flex-col gap-2">
                        <span className="text-2xl">➕</span>
                        <span>Register Farmer</span>
                    </button>
                    <button className="btn btn-outline btn-secondary h-auto py-4 flex flex-col gap-2">
                        <span className="text-2xl">📝</span>
                        <span>Record Insemination</span>
                    </button>
                     <button className="btn btn-outline btn-accent h-auto py-4 flex flex-col gap-2">
                        <span className="text-2xl">📊</span>
                        <span>Generate Report</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
