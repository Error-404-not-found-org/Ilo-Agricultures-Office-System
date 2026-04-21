import React, { useState, useEffect } from 'react';

const Users = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => setLoading(false), 800);
    }, []);

    if (loading) return (
        <div className="flex justify-center items-center flex-col min-h-[60vh] gap-4">
            <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
            <p className="text-[#074033] font-medium tracking-wide animate-pulse">Loading System Users...</p>
        </div>
    );
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Users</h1>
            <p>Manage system users here.</p>
        </div>
    );
};

export default Users;
