import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUser, SignInButton } from "@clerk/clerk-react";
import { Tractor, ShieldCheck, Sprout, ArrowRight, Menu } from 'lucide-react';

const Landing = () => {
    const { isSignedIn, isLoaded } = useUser();

    if (isLoaded && isSignedIn) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="font-['Outfit'] min-h-screen flex flex-col bg-[#F4F5F7]">
            {/* Navbar */}
            <nav className="navbar px-6 lg:px-20 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
                <div className="flex-1 flex items-center gap-3">
                    <img src="/logo.png" alt="BreedSmart Logo" className="w-12 h-12 object-contain" />
                    <span className="text-2xl font-bold tracking-tight text-[#074033]">BreedSmart</span>
                </div>
                <div className="flex-none">
                    <SignInButton mode="modal">
                        <button className="btn bg-[#074033] hover:bg-[#052e24] text-white border-none rounded-xl px-6 font-medium shadow-md transition-transform hover:scale-105">
                            Sign In
                        </button>
                    </SignInButton>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="flex-1 flex flex-col justify-center items-center text-center px-6 lg:px-20 py-20 lg:py-32 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
                     <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0 100 C 20 0 50 0 100 100 Z" fill="#074033" />
                     </svg>
                </div>
                
                <div className="max-w-4xl z-10">
                    <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-[#E6F0EE] text-[#074033] text-sm font-semibold tracking-wide border border-[#074033]/10">
                        🚀 Modernizing Agriculture Management
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-extrabold text-[#1A1A1A] mb-8 leading-tight">
                        Empowering <span className="text-[#074033]">Iloilo's</span> <br/>
                        Agricultural Future
                    </h1>
                    <p className="text-lg lg:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Streamline livestock tracking, manage technician assignments, and generate insightful reports with our comprehensive digital platform.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <SignInButton mode="modal">
                             <button className="btn btn-lg bg-[#074033] hover:bg-[#052e24] text-white border-none rounded-2xl px-8 shadow-xl hover:shadow-2xl transition-all">
                                Get Started <ArrowRight className="ml-2" />
                            </button>
                        </SignInButton>
                        <button className="btn btn-lg btn-outline border-[#074033] text-[#074033] hover:bg-[#074033] hover:text-white rounded-2xl px-8">
                            Learn More
                        </button>
                    </div>
                </div>
            </header>

            {/* Features Section */}
            <section className="px-6 lg:px-20 py-20 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {[
                        { 
                            icon: <Tractor size={32} />, 
                            title: "Livestock Tracking", 
                            desc: "Real-time monitoring of animal records, breeding history, and health status." 
                        },
                        { 
                            icon: <ShieldCheck size={32} />, 
                            title: "Technician Management", 
                            desc: "Efficiently assign tasks and track the performance of your field technicians." 
                        },
                        { 
                            icon: <Sprout size={32} />, 
                            title: "Growth Analytics", 
                            desc: "Data-driven insights to improve breeding success rates and farm productivity." 
                        }
                    ].map((feature, idx) => (
                        <div key={idx} className="p-8 rounded-3xl bg-[#F4F5F7] hover:bg-[#E6F0EE] transition-colors border border-transparent hover:border-[#074033]/10 group">
                            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-[#074033] shadow-sm mb-6 group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-[#1A1A1A] mb-3">{feature.title}</h3>
                            <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="px-6 lg:px-20 py-8 bg-[#F4F5F7] border-t border-gray-200 text-center text-gray-400 text-sm">
                <p>&copy; {new Date().getFullYear()} Iloilo Agricultures Office. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default Landing;
