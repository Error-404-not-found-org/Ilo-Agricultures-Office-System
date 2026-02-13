import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser, SignInButton, SignOutButton } from "@clerk/clerk-react";
import { ShieldCheck, Smartphone, Download, ArrowRight, LayoutDashboard } from 'lucide-react';

const Landing = () => {
    const { isSignedIn, isLoaded, user } = useUser();

    if (isLoaded && isSignedIn) {
        // Only redirect to dashboard if the user has the admin role
        if (user?.publicMetadata?.role === 'admin') {
            return <Navigate to="/dashboard" replace />;
        }
        // If logged in but not admin, we stay on Landing but show a specific UI or let them sign out.
        // The SignInButton below will handle the "You are already signed in" state effectively by Clerk's modal,
        // but we can also show a friendly message.
    }

    return (
        <div className="font-['Outfit'] min-h-screen flex flex-col bg-[#F4F5F7]">
            {/* Navbar */}
            <nav className="navbar px-6 lg:px-20 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-gray-100">
                <div className="flex-1 flex items-center gap-3">
                    <img src="/logo.png" alt="BreedSmart Logo" className="w-10 h-10 object-contain" />
                    <span className="text-xl font-bold tracking-tight text-[#074033]">BreedSmart Portal</span>
                </div>
            </nav>

            {/* Main Content - Split Layout */}
            <header className="flex-1 flex items-center justify-center px-6 lg:px-20 py-12 lg:py-0">
                <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    
                    {/* Left Column: Admin Login */}
                    <div className="flex flex-col items-start text-left order-2 lg:order-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#E6F0EE] text-[#074033] text-sm font-semibold tracking-wide border border-[#074033]/10">
                            <ShieldCheck size={16} /> Admin Access Only
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-extrabold text-[#1A1A1A] mb-6 leading-tight">
                            Iloilo Agriculture <br/>
                            <span className="text-[#074033]">Office Portal</span>
                        </h1>
                        <p className="text-lg text-gray-500 mb-8 max-w-lg leading-relaxed">
                            Authorized personnel only. Manage technician assignments, monitor livestock records, and generate reports from this centralized dashboard.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            {isSignedIn && user?.publicMetadata?.role !== 'admin' ? (
                                <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex flex-col gap-2">
                                    <p className="font-semibold text-sm">⛔ Access Restricted</p>
                                    <p className="text-xs opacity-80">You are logged in as a <strong>{String(user?.publicMetadata?.role || 'User')}</strong>. This portal is for Admins only.</p>
                                    <SignOutButton>
                                        <button className="btn btn-sm btn-outline text-red-700 hover:bg-red-100 border-red-200 mt-2">
                                            Sign Out & Switch Account
                                        </button>
                                    </SignOutButton>
                                </div>
                            ) : (
                                <SignInButton mode="modal">
                                     <button className="btn btn-lg bg-[#074033] hover:bg-[#052e24] text-white border-none rounded-2xl px-8 shadow-xl hover:shadow-2xl transition-all flex items-center gap-3">
                                        <LayoutDashboard size={20} />
                                        Access Dashboard
                                    </button>
                                </SignInButton>
                            )}
                        </div>

                        <div className="mt-12 pt-8 border-t border-gray-200 w-full">
                            <p className="text-sm text-gray-400 mb-4 font-medium">System Modules</p>
                            <div className="flex gap-6 text-gray-500">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Livestock
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Technical
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500"></span> Reports
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Mobile App Download */}
                    <div className="relative order-1 lg:order-2 flex justify-center lg:justify-end">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-[#E6F0EE] rounded-bl-full -mr-16 -mt-16 transition-all group-hover:bg-[#d1e7e2]"></div>
                           
                           <div className="relative z-10">
                                <div className="w-12 h-12 bg-[#074033]/10 rounded-xl flex items-center justify-center text-[#074033] mb-6">
                                    <Smartphone size={24} />
                                </div>
                                
                                <h3 className="text-2xl font-bold text-[#1A1A1A] mb-2">Farmer's Mobile App</h3>
                                <p className="text-gray-500 mb-8">
                                    Download the mobile application to register livestock, request services, and track progress.
                                </p>

                                <div className="flex items-center gap-6 bg-[#F8FAFC] p-4 rounded-2xl border border-gray-100">
                                    {/* Placeholder QR Code */}
                                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm shrink-0">
                                        <img 
                                            src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://expo.dev/artifacts/eas/..." 
                                            alt="Download QR" 
                                            className="w-24 h-24 object-contain"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <p className="text-xs font-semibold text-gray-400 uppercase">Scan to Download</p>
                                        <button className="btn btn-sm btn-outline border-gray-300 text-gray-600 hover:bg-[#074033] hover:border-[#074033] hover:text-white normal-case font-medium">
                                            <Download size={16} className="mr-1" /> APK File
                                        </button>
                                    </div>
                                </div>
                           </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Footer */}
            <footer className="px-6 lg:px-20 py-6 bg-white border-t border-gray-100 text-center text-gray-400 text-sm">
                <p>&copy; {new Date().getFullYear()} Iloilo Agricultures Office. Restricted Access.</p>
            </footer>
        </div>
    );
};

export default Landing;
