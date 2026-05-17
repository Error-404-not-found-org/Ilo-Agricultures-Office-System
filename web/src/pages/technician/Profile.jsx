import React from "react";
import { useUser } from "@clerk/clerk-react";
import { 
  User, 
  Mail, 
  ShieldCheck, 
  BadgeCheck, 
  Camera, 
  Calendar, 
  Fingerprint,
  Activity,
  Award,
  Globe
} from "lucide-react";
import { motion } from "framer-motion";

const infoBoxClass = `bg-base-200/20 border border-base-200 p-6 rounded-none space-y-1`;
const labelClass = `text-[9px] font-black text-base-content/30 uppercase tracking-[0.2em]`;
const valueClass = `text-xs font-bold text-base-content uppercase tracking-tight`;

export default function TechnicianProfile() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-8 animate-fade-in">
        <div className="relative flex items-center justify-center">
          <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[3.5] opacity-20"></span>
          <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[2.5] absolute"></span>
          <div className="absolute inset-0 blur-2xl bg-emerald-500/10 rounded-none animate-pulse"></div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-[#074033] dark:text-emerald-500 font-black tracking-[0.4em] uppercase text-[10px] animate-pulse">
            Establishing Link...
          </p>
          <p className="text-base-content/20 font-black uppercase tracking-[0.2em] text-[8px]">
            Personal Profile Protocol
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 pb-16">
      {/* HEADER SECTION */}
      <div className="relative overflow-hidden bg-base-100 border border-base-300 rounded-none shadow-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#074033]"></div>
        <div className="px-8 py-10 flex flex-col md:flex-row items-center gap-10">
          {/* AVATAR */}
          <div className="relative shrink-0">
             <div className="w-44 h-44 rounded-none border-4 border-base-200 bg-base-200 overflow-hidden shadow-2xl relative group">
                <img
                  src={user?.imageUrl || "https://ui-avatars.com/api/?name=Tech"}
                  alt="Profile"
                  className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none" />
             </div>
             <button className="absolute -bottom-3 -right-3 w-10 h-10 bg-[#074033] text-white flex items-center justify-center rounded-none shadow-xl hover:bg-emerald-800 transition-all">
                <Camera size={16} />
             </button>
          </div>

          {/* NAME & PRIMARY INFO */}
          <div className="flex-1 text-center md:text-left space-y-4">
             <div>
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                   <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <ShieldCheck size={10} /> Certified Personnel
                   </div>
                   <div className="px-3 py-1 bg-base-200 border border-base-200 text-base-content/40 text-[8px] font-black uppercase tracking-[0.2em]">
                      Municipal ID: {user?.id?.slice(-8).toUpperCase()}
                   </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-base-content tracking-tighter uppercase leading-none">
                  {user?.fullName || "Technician Name"}
                </h1>
                <p className="text-base-content/40 font-bold uppercase tracking-[0.3em] text-[10px] mt-3">
                  Agricultural Field Operations Specialist
                </p>
             </div>

             <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4">
                <div className="flex items-center gap-2 text-base-content/60">
                   <Mail size={14} className="text-emerald-500" />
                   <span className="text-xs font-bold">{user?.primaryEmailAddress?.emailAddress}</span>
                </div>
                <div className="flex items-center gap-2 text-base-content/60 border-l border-base-300 pl-4">
                   <Award size={14} className="text-emerald-500" />
                   <span className="text-xs font-bold">Tier 1 Technician</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* TECHNICAL DATA GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PERSONAL INTEL */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-base-100 border border-base-300 rounded-none p-8">
              <div className="flex items-center gap-3 mb-8 border-b border-base-200 pb-4">
                 <User size={18} className="text-[#074033]" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-base-content">Identity Profile</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className={infoBoxClass}>
                    <p className={labelClass}>First Name</p>
                    <p className={valueClass}>{user?.firstName || "N/A"}</p>
                 </div>
                 <div className={infoBoxClass}>
                    <p className={labelClass}>Last Name</p>
                    <p className={valueClass}>{user?.lastName || "N/A"}</p>
                 </div>
                 <div className={infoBoxClass}>
                    <p className={labelClass}>Technical Rank</p>
                    <p className={valueClass}>Field Supervisor</p>
                 </div>
                 <div className={infoBoxClass}>
                    <p className={labelClass}>Deployment Area</p>
                    <p className={valueClass}>Oton, Iloilo Sector 7</p>
                 </div>
              </div>
           </div>

           <div className="bg-base-100 border border-base-300 rounded-none p-8">
              <div className="flex items-center gap-3 mb-8 border-b border-base-200 pb-4">
                 <Activity size={18} className="text-[#074033]" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-base-content">System Authorization</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className={infoBoxClass}>
                    <p className={labelClass}>Security Role</p>
                    <p className={valueClass}>{user?.publicMetadata?.role || "Technician"}</p>
                 </div>
                 <div className={infoBoxClass}>
                    <p className={labelClass}>Account Status</p>
                    <div className="flex items-center gap-2 mt-1">
                       <div className="w-1.5 h-1.5 bg-emerald-500 rounded-none"></div>
                       <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Protocol Active</p>
                    </div>
                 </div>
                 <div className={infoBoxClass}>
                    <p className={labelClass}>Registry Clearance</p>
                    <p className={valueClass}>Level 4 (Full Audit)</p>
                 </div>
                 <div className={infoBoxClass}>
                    <p className={labelClass}>Last Sync</p>
                    <p className={valueClass}>{new Date().toLocaleDateString()} - 22:40 PM</p>
                 </div>
              </div>
           </div>
        </div>

        {/* SIDE BAR INFO */}
        <div className="space-y-6">
           <div className="bg-[#074033] text-white p-8 rounded-none shadow-2xl shadow-emerald-950/20 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                 <Fingerprint size={24} className="text-emerald-400" />
                 <h3 className="text-xs font-black uppercase tracking-[0.2em]">Personnel Security</h3>
              </div>
              <p className="text-[11px] font-bold text-emerald-100/60 uppercase leading-relaxed tracking-wider">
                This account is biometric verified and linked to municipal field operations data. All registry entries are digitally signed.
              </p>
              <div className="pt-4 border-t border-white/10 space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-400 uppercase">2FA Active</span>
                    <BadgeCheck size={14} className="text-emerald-400" />
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-400 uppercase">Encrypted Sessions</span>
                    <BadgeCheck size={14} className="text-emerald-400" />
                 </div>
              </div>
           </div>

           <div className="bg-base-100 border border-base-300 rounded-none p-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 mb-6 flex items-center gap-2">
                 <Globe size={14} /> Language & Region
              </h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between py-2 border-b border-base-200">
                    <span className="text-[11px] font-black uppercase text-base-content">Interface</span>
                    <span className="text-[11px] font-bold text-base-content/40">English (US)</span>
                 </div>
                 <div className="flex items-center justify-between py-2 border-b border-base-200">
                    <span className="text-[11px] font-black uppercase text-base-content">Timezone</span>
                    <span className="text-[11px] font-bold text-base-content/40">GMT+8 PHT</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
