import React, { useState, useEffect } from 'react';

import LoadingView from "../components/LoadingView";

const Settings = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => setLoading(false), 800);
    }, []);

    if (loading) return <LoadingView message="Loading Settings..." />;
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Settings</h1>
            <p>Application settings.</p>
        </div>
    );
};

export default Settings;
