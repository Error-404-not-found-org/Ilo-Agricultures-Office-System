import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Mail,
  Phone,
  ArrowLeft,
  Tractor,
  Info,
  ShieldCheck,
  Database,
  Activity,
  History,
  ArrowUpRight,
  ClipboardList,
  User,
  HeartPulse,
  ExternalLink
} from "lucide-react";
import axiosInstance from "../../lib/axios";

export default function FarmerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFarmerData = async () => {
      try {
        const response = await axiosInstance.get(`/user/${id}`);
        setFarmer(response.data);
      } catch (error) {
        console.error("Failed to fetch farmer profile", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFarmerData();
  }, [id]);

  const formatAddress = (addr) => {
    if (!addr) return "NO LOCATION DATA";
    if (typeof addr === "string") return addr.toUpperCase();
    return (
      [addr.barangay, addr.city]
        .filter(Boolean)
        .join(", ")
        .toUpperCase() || "NO LOCATION DATA"
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-8 animate-fade-in">
        <div className="relative flex items-center justify-center">
          <span className="loading loading-ring loading-lg text-[#074033] scale-[3.5] opacity-20"></span>
          <span className="loading loading-ring loading-lg text-[#074033] scale-[2.5] absolute"></span>
        </div>
        <p className="text-[#074033] font-black tracking-[0.4em] uppercase text-[10px] animate-pulse">
          Retrieving Profile...
        </p>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-black uppercase tracking-widest text-base-content/20">Farmer Record Not Found</h2>
        <button className="btn btn-ghost mt-4 font-black uppercase tracking-widest text-xs" onClick={() => navigate(-1)}>
          Return to Registry
        </button>
      </div>
    );
  }

  const animals = farmer.stats?.animals || [];

  return (
    <div className="animate-fade-in space-y-6 pb-16">
      {/* ACTION BAR */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate("/technician/farmers")}
          className="btn btn-ghost btn-sm gap-2 text-base-content/40 hover:text-[#074033] font-black uppercase tracking-widest text-[10px]"
        >
          <ArrowLeft size={14} /> Back to Registry
        </button>
        <div className="flex gap-2">
           <button className="btn btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest text-base-content/30 hover:text-info">
             <ExternalLink size={14} /> Export Report
           </button>
        </div>
      </div>

      {/* MODERNISED HEADER */}
      <div className="card bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-linear-to-r from-[#074033] to-emerald-800 px-8 py-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left w-full md:w-auto">
            <div className="avatar">
              <div className="w-24 h-24 rounded-2xl ring-4 ring-white/10 shadow-2xl bg-white/5 overflow-hidden">
                <img
                  src={farmer.imageUrl || `https://ui-avatars.com/api/?name=${farmer.name}&background=074033&color=fff`}
                  alt={farmer.name}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                <span className="bg-white/10 text-white text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase border border-white/5">
                  Official Partner
                </span>
                {farmer.isVerified && (
                  <span className="bg-emerald-400 text-[#074033] text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase flex items-center gap-1">
                    <ShieldCheck size={10} /> Verified
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                {farmer.name}
              </h1>
              <p className="text-emerald-200/50 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2 justify-center md:justify-start">
                <MapPin size={12} /> {formatAddress(farmer.address)}
              </p>
            </div>
          </div>

          <div className="flex gap-4 shrink-0 bg-black/10 backdrop-blur-md px-8 py-5 rounded-2xl border border-white/5 w-full md:w-auto">
            <div className="text-center border-r border-white/10 pr-6">
              <p className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest mb-1">Assets</p>
              <p className="text-2xl font-black text-white leading-none">{animals.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest mb-1">Success Rate</p>
              <p className="text-2xl font-black text-white leading-none">
                {farmer.stats?.totalInseminations > 0 
                  ? Math.round((farmer.stats?.successfulInseminations || 0) / farmer.stats.totalInseminations * 100) 
                  : "0"}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SIDEBAR: TECHNICAL PROFILE */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card bg-base-100 border border-base-300 rounded-2xl p-6 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-6 flex items-center gap-2">
              <User size={14} /> Official Partner Profile
            </h3>
            
            <div className="space-y-4">
              <fieldset className="fieldset p-0 m-0 border-none">
                <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/30 mb-1">Contact Information</legend>
                <div className="bg-base-200 px-4 py-3 rounded-xl border border-base-300 flex items-center gap-3">
                  <Phone size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-base-content/80">{farmer.phoneNumber || "UNAVAILABLE"}</span>
                </div>
              </fieldset>

              <fieldset className="fieldset p-0 m-0 border-none">
                <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/30 mb-1">Digital Address</legend>
                <div className="bg-base-200 px-4 py-3 rounded-xl border border-base-300 flex items-center gap-3">
                  <Mail size={14} className="text-blue-500" />
                  <span className="text-xs font-bold text-base-content/80 truncate">{farmer.email || "NO DIGITAL ADDRESS"}</span>
                </div>
              </fieldset>

              <fieldset className="fieldset p-0 m-0 border-none">
                <legend className="fieldset-legend text-[9px] font-black uppercase tracking-widest text-base-content/30 mb-1">Registry Status</legend>
                <div className="bg-base-200 px-4 py-3 rounded-xl border border-base-300 flex items-center justify-between">
                  <span className="text-[10px] font-black text-base-content/60 uppercase">System Active</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50"></div>
                </div>
              </fieldset>
            </div>

            <div className="mt-8 pt-6 border-t border-base-200">
               <button onClick={() => navigate("/technician/farmers")} className="btn btn-neutral w-full bg-[#074033] hover:bg-emerald-800 border-none text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                 Update Profile
               </button>
            </div>
          </div>

          <div className="card bg-linear-to-br from-indigo-600/5 to-blue-600/5 border border-blue-500/10 rounded-2xl p-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
              <Activity size={14} /> Service metrics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-[9px] font-black uppercase text-base-content/40">Total Services</p>
                <p className="text-xl font-black text-base-content leading-none">{farmer.stats?.totalInseminations || 0}</p>
              </div>
              <div className="flex justify-between items-end">
                <p className="text-[9px] font-black uppercase text-base-content/40">Active Pregnancies</p>
                <p className="text-xl font-black text-emerald-600 leading-none">{farmer.stats?.activePregnancies || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT: ASSET LEDGER */}
        <div className="lg:col-span-3">
          <div className="card bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-visible h-full flex flex-col">
            <div className="px-8 py-6 border-b border-base-300 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-base-content uppercase tracking-tight flex items-center gap-3">
                  <Database className="text-[#074033]" size={20} /> Registered Assets
                </h2>
                <p className="text-base-content/40 text-[10px] font-black uppercase mt-0.5 tracking-widest">
                  Official Registry of Assets
                </p>
              </div>
              <div className="badge badge-neutral bg-[#074033] text-white font-black text-[9px] uppercase tracking-widest px-3 py-3 border-none">
                {animals.length} Heads Registered
              </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="table table-zebra table-sm w-full">
                <thead>
                  <tr className="bg-base-200/80 text-base-content/60">
                    <th className="font-black uppercase text-[10px] tracking-wider pl-8 py-3">Asset Identity</th>
                    <th className="font-black uppercase text-[10px] tracking-wider">Genetics</th>
                    <th className="font-black uppercase text-[10px] tracking-wider text-center">Health Status</th>
                    <th className="font-black uppercase text-[10px] tracking-wider text-right pr-8">Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {animals.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-base-content/20">
                        <Tractor size={40} strokeWidth={1} className="mx-auto mb-3" />
                        <p className="text-xs font-black uppercase tracking-widest">No Assets Registered</p>
                      </td>
                    </tr>
                  ) : (
                    animals.map((animal) => (
                      <tr key={animal._id} className="hover group">
                        <td className="pl-8 py-4">
                          <div className="flex items-center gap-4">
                            <div className="avatar">
                              <div className="w-12 h-12 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center overflow-hidden">
                                {animal.imageUrl ? (
                                  <img src={animal.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_100,c_fill/')} alt="Animal" />
                                ) : (
                                  <span className="font-black text-xs text-base-content/20">AN</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="font-black text-sm text-base-content leading-none">#{animal.earTag}</p>
                              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1.5">{animal.species}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="text-xs font-bold text-base-content/80 leading-tight">{animal.breed || "Standard"}</p>
                          <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest mt-0.5">
                             {animal.totalCalves || 0} Offspring
                          </p>
                        </td>
                        <td className="text-center">
                          <div className={`badge badge-sm border font-black text-[9px] uppercase tracking-widest ${
                            animal.reproductiveStatus === 'Normal' || !animal.reproductiveStatus
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}>
                            {animal.reproductiveStatus || "Healthy"}
                          </div>
                        </td>
                        <td className="text-right pr-8">
                          <div className="flex justify-end gap-1">
                            <div className="tooltip tooltip-left" data-tip="Medical History">
                               <button className="btn btn-ghost btn-xs btn-square text-info hover:bg-info/10">
                                 <History size={15} />
                               </button>
                            </div>
                            <div className="tooltip tooltip-left" data-tip="Full Profile">
                              <Link to={`/technician/animals/${animal._id}`} className="btn btn-ghost btn-xs btn-square text-neutral hover:bg-neutral/10">
                                <ArrowUpRight size={15} />
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-base-200 bg-base-200/20">
               <div className="bg-base-100 rounded-xl p-4 border border-base-300 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-lg bg-[#074033]/5 flex items-center justify-center text-[#074033]">
                   <Info size={20} />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-base-content uppercase tracking-tight">Security Note</p>
                   <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest mt-0.5">Records are immutable and synchronized with the central agricultural database.</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
