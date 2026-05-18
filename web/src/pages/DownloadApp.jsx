import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Download, Apple, PlayCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { SignedIn, UserButton } from "@clerk/clerk-react";

const DownloadApp = () => {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* AMBIENT BACKGROUND ELEMENTS */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full -z-10" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[100px] rounded-full -z-10" />

            <div className="max-w-2xl w-full text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-20 h-20 bg-emerald-500 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/20"
                >
                    <Smartphone size={40} className="text-white" />
                </motion.div>

                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4"
                >
                    Welcome to <span className="text-emerald-500">BreedSmart</span>
                </motion.h1>

                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-400 text-lg mb-12 max-w-lg mx-auto leading-relaxed"
                >
                    Your account has been successfully verified. Download the mobile app to start tracking your livestock's health and breeding cycle.
                </motion.p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                    <motion.a
                        href="#"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="group relative bg-white h-20 rounded-3xl flex items-center px-6 gap-4 hover:scale-[1.02] transition-all shadow-xl"
                    >
                        <Apple size={32} className="text-slate-900" />
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Download on the</p>
                            <p className="text-xl font-black text-slate-900 leading-tight">App Store</p>
                        </div>
                        <ArrowRight size={20} className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    </motion.a>

                    <motion.a
                        href="#"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="group relative bg-slate-900 border border-slate-800 h-20 rounded-3xl flex items-center px-6 gap-4 hover:scale-[1.02] transition-all shadow-xl"
                    >
                        <PlayCircle size={32} className="text-emerald-500" />
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Get it on</p>
                            <p className="text-xl font-black text-white leading-tight">Google Play</p>
                        </div>
                        <ArrowRight size={20} className="ml-auto text-slate-700 group-hover:text-emerald-500 transition-colors" />
                    </motion.a>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center gap-6 pt-12 border-t border-slate-900"
                >
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                        <ShieldCheck size={18} className="text-emerald-500" />
                        Verified Account
                    </div>
                    <SignedIn>
                        <div className="h-6 w-px bg-slate-800" />
                        <div className="flex items-center gap-3">
                            <UserButton afterSignOutUrl="/" />
                            <span className="text-slate-400 text-sm font-medium">Account Settings</span>
                        </div>
                    </SignedIn>
                </motion.div>
            </div>

            {/* DECORATIVE MASCOT OR ILLUSTRATION WOULD GO HERE */}
            <div className="mt-20 opacity-20 grayscale brightness-200 pointer-events-none">
                <Smartphone size={300} className="text-emerald-500" />
            </div>
        </div>
    );
};

export default DownloadApp;
