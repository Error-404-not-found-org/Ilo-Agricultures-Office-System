import React from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Download,
  Apple,
  PlayCircle,
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { SignedIn, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function DownloadApp() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans antialiased">
      {/* AMBIENT GLOW SYSTEM */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[100px] rounded-full -z-10" />

      {/* FLOATING ACTION OVERLAYS */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => navigate(-1)}
          className="btn btn-sm btn-ghost gap-1 text-slate-400 hover:text-emerald-400 font-bold uppercase text-[9px] tracking-wider rounded-xl hover:bg-slate-900 border border-slate-900"
        >
          <ChevronLeft size={12} /> Go Back
        </button>
      </div>

      <div className="max-w-2xl w-full text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="w-20 h-20 bg-linear-to-tr from-emerald-500 to-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/20"
        >
          <Smartphone size={38} className="text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4 uppercase"
        >
          Welcome to <span className="text-emerald-400 bg-clip-text">BreedSmart</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-slate-400 text-sm md:text-base mb-12 max-w-md mx-auto leading-relaxed font-medium uppercase tracking-wider text-[11px]"
        >
          Your account is verified. Install the mobile agricultural app suite to track livestock diagnostics and field insemination progress.
        </motion.p>

        {/* STORES DOWNLOAD MATRIX */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 max-w-lg mx-auto">
          <motion.a
            href="#"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="group relative bg-white h-20 rounded-2xl flex items-center px-6 gap-4 hover:scale-[1.02] hover:shadow-lg transition-all duration-300 border border-slate-200"
          >
            <Apple size={30} className="text-slate-950" />
            <div className="text-left">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Download on the
              </p>
              <p className="text-lg font-black text-slate-950 leading-tight tracking-tight mt-0.5">
                App Store
              </p>
            </div>
            <ArrowRight
              size={18}
              className="ml-auto text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all"
            />
          </motion.a>

          <motion.a
            href="#"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="group relative bg-slate-900 border border-slate-800 h-20 rounded-2xl flex items-center px-6 gap-4 hover:scale-[1.02] hover:shadow-lg transition-all duration-300"
          >
            <PlayCircle size={30} className="text-emerald-400" />
            <div className="text-left">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                Get it on
              </p>
              <p className="text-lg font-black text-white leading-tight tracking-tight mt-0.5">
                Google Play
              </p>
            </div>
            <ArrowRight
              size={18}
              className="ml-auto text-slate-700 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all"
            />
          </motion.a>
        </div>

        {/* SECURITY & CLERK METADATA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-6 pt-8 border-t border-slate-900 max-w-md mx-auto"
        >
          <div className="flex items-center gap-2 text-slate-500 text-xs font-black uppercase tracking-wider">
            <ShieldCheck size={16} className="text-emerald-400" />
            Verified Account
          </div>
          
          <SignedIn>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span className="text-slate-400 text-xs font-black uppercase tracking-wider">
                Account Settings
              </span>
            </div>
          </SignedIn>
        </motion.div>
      </div>

      {/* BACKGROUND BRANDING LOGO OVERLAY */}
      <div className="absolute -bottom-20 opacity-[0.03] select-none pointer-events-none">
        <Smartphone size={450} className="text-emerald-500" />
      </div>
    </div>
  );
}
