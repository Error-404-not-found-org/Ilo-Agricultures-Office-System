import React, { useState, useEffect } from 'react';

import LoadingView from "../components/LoadingView";

const Users = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => setLoading(false), 800);
    }, []);

    if (loading) return <LoadingView message="Loading System Users..." />;
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Users</h1>
            <p>Manage system users here.</p>
        </div>
    );
};

export default Users;
