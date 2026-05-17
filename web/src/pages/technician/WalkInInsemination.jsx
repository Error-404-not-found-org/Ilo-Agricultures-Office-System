import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Syringe, User, Binary, Info, CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoadingView from "../../components/LoadingView";

export default function WalkInInsemination() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  if (loading) return <LoadingView message="Initializing Field Protocol..." />;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-base-content/40 hover:text-emerald-500 font-black uppercase text-[10px] tracking-widest transition-all mb-4 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Console
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#074033] dark:bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Syringe className="text-white" size={28} />
            </div>
            <h1 className="text-4xl font-black text-base-content tracking-tighter uppercase leading-none">
              Walk-in Registration
            </h1>
          </div>
          <p className="text-base-content/40 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 mt-4">
            <Info size={14} className="text-emerald-500" />
            Field Protocol: Register new farmer, specimen, and procedure in one cycle.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Farmer Details */}
          <div className="bg-base-100 rounded-4xl p-8 shadow-xl border border-base-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
              <User size={120} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Farmer Identity
            </h2>
            <div className="grid grid-cols-2 gap-6 relative z-10">
              <div className="form-control col-span-1">
                <label className="label py-0 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30 ml-1">First Name</span>
                </label>
                <input type="text" placeholder="John" className="h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/10" />
              </div>
              <div className="form-control col-span-1">
                <label className="label py-0 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30 ml-1">Last Name</span>
                </label>
                <input type="text" placeholder="Doe" className="h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/10" />
              </div>
              <div className="form-control col-span-2">
                <label className="label py-0 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30 ml-1">Contact Number</span>
                </label>
                <input type="tel" placeholder="+63 9XX XXX XXXX" className="h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/10" />
              </div>
            </div>
          </div>

          {/* Animal Details */}
          <div className="bg-base-100 rounded-4xl p-8 shadow-xl border border-base-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
              <Binary size={120} />
            </div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-8 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Specimen Metadata
            </h2>
            <div className="grid grid-cols-2 gap-6 relative z-10">
              <div className="form-control">
                <label className="label py-0 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30 ml-1">Ear Tag ID</span>
                </label>
                <input type="text" placeholder="TAG-0000" className="h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/10" />
              </div>
              <div className="form-control">
                <label className="label py-0 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30 ml-1">Species</span>
                </label>
                <select className="h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content appearance-none">
                  <option value="cow">Cow / Cattle</option>
                  <option value="carabao">Carabao</option>
                  <option value="goat">Goat</option>
                  <option value="pig">Pig / Swine</option>
                </select>
              </div>
              <div className="form-control col-span-2">
                <label className="label py-0 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30 ml-1">Breed</span>
                </label>
                <input type="text" placeholder="Brahman / Holstein / etc." className="h-14 bg-base-200 border-none rounded-2xl px-6 font-black text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-base-content placeholder:text-base-content/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#074033] dark:bg-emerald-600 rounded-4xl p-8 shadow-2xl shadow-emerald-900/20 text-white relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Syringe size={160} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-8">AI Procedure</h3>
            <div className="space-y-6 relative z-10">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2 block">Sire Breed</label>
                <input type="text" placeholder="Angus" className="w-full h-12 bg-white/10 border-none rounded-xl px-5 font-black text-sm focus:ring-2 focus:ring-white/30 transition-all text-white placeholder:text-white/20 uppercase" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2 block">Sire Code</label>
                <input type="text" placeholder="S-0000" className="w-full h-12 bg-white/10 border-none rounded-xl px-5 font-black text-sm focus:ring-2 focus:ring-white/30 transition-all text-white placeholder:text-white/20 uppercase" />
              </div>
              <div className="h-px bg-white/10 my-4" />
              <button className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group">
                <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
                Commit Cycle
              </button>
            </div>
          </div>

          <div className="bg-base-100 rounded-4xl p-8 shadow-xl border border-base-300">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-4">Quick Guidance</h4>
            <ul className="space-y-4">
              {[
                "Verify farmer ID if existing",
                "Clean ear tag before entry",
                "Ensure sire compatibility",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-black text-base-content uppercase tracking-tighter opacity-60">
                  <div className="w-5 h-5 rounded-lg bg-base-200 flex items-center justify-center text-[10px] shrink-0 border border-base-300">{i+1}</div>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
