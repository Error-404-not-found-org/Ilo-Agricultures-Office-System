import React, { useState, useEffect } from "react";
import { X, Syringe, HeartPulse, CheckCircle2, FileText, Loader2, Calendar, User, MapPin, Phone, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../lib/axios";

export default function AnimalHistoryModal({ isOpen, onClose, animalId }) {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);

  useEffect(() => {
    if (isOpen && animalId) {
      setLoading(true);
      const fetchHistory = async () => {
        try {
          const response = await axiosInstance.get(`/technician/animal-history/${animalId}`);
          setHistoryData(response.data);
        } catch (error) {
          console.error("Error fetching animal history", error);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, animalId]);

  if (!isOpen) return null;

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase() || "";
    if (s === "done" || s === "resolved" || s === "approved") 
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s === "pending" || s === "in-progress") 
      return "bg-amber-50 text-amber-700 border-amber-100";
    if (s === "rejected" || s === "cancelled") 
      return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-gray-50 text-gray-600 border-gray-100";
  };

  const animal = historyData?.animal || {};
  const timeline = historyData?.timeline || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={onClose}
           className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative"
        >
          {/* TOP HEADER BANNER */}
          <div className="bg-[#074033] p-8 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
               <div className="w-24 h-24 rounded-3xl bg-white/10 border border-white/20 overflow-hidden shrink-0 flex items-center justify-center shadow-2xl">
                  {animal.imageUrl ? (
                      <img src={animal.imageUrl} className="w-full h-full object-cover" alt="Animal" />
                  ) : (
                      <span className="text-4xl text-white/40 font-black">🐄</span>
                  )}
               </div>

               <div className="flex-1 space-y-2">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                     <h2 className="text-3xl font-black tracking-tighter">Tag #{animal.earTag || "---"}</h2>
                     <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                        {animal.breed || "Crossbreed"}
                     </span>
                  </div>
                  
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-white/60 font-bold text-xs">
                     <div className="flex items-center gap-1.5"><Info size={14} /> {animal.species || "Cattle"}</div>
                     <div className="flex items-center gap-1.5"><Calendar size={14} /> Added {animal.createdAt ? new Date(animal.createdAt).toLocaleDateString() : "---"}</div>
                  </div>
               </div>
            </div>
          </div>

          {/* OWNER INFORMATION STRIP */}
          <div className="bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between px-8 py-4 gap-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                   <User size={20} />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Registered Owner</p>
                   <p className="text-sm font-bold text-slate-900 leading-none">{animal.farmerId?.name || "Unknown Owner"}</p>
                </div>
             </div>

             {animal.farmerId?.phoneNumber && (
                <a href={`tel:${animal.farmerId.phoneNumber}`} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 px-4 py-2 rounded-xl text-xs font-black text-slate-600 hover:text-emerald-700 transition-all shadow-sm">
                   <Phone size={14} /> {animal.farmerId.phoneNumber}
                </a>
             )}
          </div>

          {/* EVENTS AREA */}
          <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
            <div className="mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Timeline of Activity</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Medical & breeding records</p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="animate-spin text-[#074033]" size={32} />
                <p className="text-sm font-bold text-slate-400 italic">Accessing database history...</p>
              </div>
            ) : timeline.length > 0 ? (
              <div className="space-y-4">
                {timeline.map((event, idx) => (
                  <div key={event._id || idx} className="bg-white border-2 border-slate-50 rounded-3xl p-5 hover:border-blue-100 transition-all group flex gap-4">
                    <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-xl shadow-sm ${
                      event.status?.toLowerCase() === 'done' || event.status?.toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                        {event.iconType === "Syringe" && <Syringe size={20} />}
                        {event.iconType === "HeartPulse" && <HeartPulse size={20} />}
                        {event.iconType === "CheckCircle2" && <CheckCircle2 size={20} />}
                        {event.iconType === "FileText" && <FileText size={20} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-start">
                          <div>
                             <h4 className="font-black text-slate-900 text-sm leading-tight">{event.title}</h4>
                             <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                {new Date(event.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                             </p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-tighter ${getStatusStyle(event.status)}`}>
                             {event.status}
                          </span>
                       </div>
                       
                       <p className="text-[13px] text-slate-600 font-medium mt-3 leading-relaxed">
                          {event.description}
                       </p>

                       <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                             <MapPin size={12} className="text-slate-300" />
                             {event.technicianLocation || "Office Facility"}
                          </div>
                          <p className="text-[11px] font-black text-slate-400">By: <span className="text-slate-600">{event.technicianName || "System"}</span></p>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <FileText size={64} className="text-slate-300 mb-4" />
                <h3 className="text-slate-900 font-black">No Historical Events</h3>
                <p className="text-sm font-bold text-slate-400">This animal is clean. No treatment or AI records detected.</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
             <button
               onClick={onClose}
               className="w-full h-14 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"
             >
               Dismiss Records
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
