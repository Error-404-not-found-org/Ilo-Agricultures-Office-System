import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  History,
  Syringe,
  HeartPulse,
  ChevronRight,
  MapPin,
  Activity,
  AlertCircle
} from "lucide-react";
import axiosInstance from "../../lib/axios";

const AnimalHistoryDrawer = ({ isOpen, onClose, animalId }) => {
  const [animal, setAnimal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && animalId) {
      fetchAnimalHistory();
    }
  }, [isOpen, animalId]);

  const fetchAnimalHistory = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/animals/${animalId}`);
      setAnimal(res.data.animal);
    } catch (error) {
      console.error("Failed to fetch animal history", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(new Date(dateString));
  };

  const timelineEvents = animal ? [
    ...(animal.breedingRecords || []).map(r => ({
      type: 'breeding',
      date: new Date(r.inseminationDate),
      title: r.attemptNumber > 1 ? `Re-Insemination (#${r.attemptNumber})` : 'Initial AI Procedure',
      desc: `Technician: ${r.technicianId?.name || 'N/A'}`,
      status: r.status,
      icon: Syringe,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    })),
    ...(animal.healthRecords || []).map(r => ({
      type: 'health',
      date: new Date(r.createdAt),
      title: r.requestType === 'vaccination' ? 'Vaccination' : 
             r.requestType === 'deworming' ? 'Deworming' :
             r.requestType === 'injury' ? 'Injury Treatment' :
             r.requestType === 'medicine' ? 'Medicine Request' :
             'Health Checkup',
      desc: r.symptoms || r.technicianNote || 'Routine inspection',
      status: r.status,
      icon: HeartPulse,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10'
    })),
    ...(animal.pregnancyCheck || []).map(r => ({
      type: 'diagnosis',
      date: new Date(r.checkDate),
      title: 'Pregnancy Diagnosis',
      desc: `Result: ${r.status} - ${r.notes || ''}`,
      status: r.status,
      icon: Activity,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    }))
  ].sort((a, b) => b.date - a.date) : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-99"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-screen w-full max-w-md bg-base-100 shadow-2xl z-100 flex flex-col border-l border-base-300"
          >
            <div className="p-6 bg-linear-to-r from-[#074033] to-[#0d5948] text-white">
              <div className="flex justify-between items-start mb-4">
                <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <History size={22} />
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <h2 className="text-xl font-black tracking-tighter uppercase mb-1">
                Activity Timeline
              </h2>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">
                {animal ? `Specimen #${animal.earTag} • History` : 'Syncing History...'}
              </p>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-base-200/20">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                  <span className="loading loading-infinity loading-lg text-emerald-600"></span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-base-content/20">Accessing Records...</p>
                </div>
              ) : !animal ? (
                <div className="text-center py-20">
                  <AlertCircle size={48} className="mx-auto text-base-content/10 mb-4" />
                  <p className="text-sm font-black text-base-content/20 uppercase">Data Unavailable</p>
                </div>
              ) : (
                <div className="space-y-6">
                   {/* Animal Summary Card */}
                   <div className="bg-base-100 rounded-2xl p-5 border border-base-300 shadow-sm">
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-base-content/30 mb-1">Registration</p>
                            <p className="text-xs font-black text-base-content">{formatDate(animal.registrationDate)}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-base-content/30 mb-1">Current Age</p>
                            <p className="text-xs font-black text-base-content">{animal.age || 'N/A'}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-base-content/30 mb-1">Species</p>
                            <p className="text-xs font-black text-base-content uppercase">{animal.species}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-base-content/30 mb-1">Sex</p>
                            <p className="text-xs font-black text-base-content uppercase">{animal.gender}</p>
                         </div>
                      </div>
                   </div>

                   {/* Timeline */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2">
                         <Activity size={16} className="text-emerald-500" />
                         <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/60">Event Timeline</h3>
                      </div>

                      <div className="relative pl-6 space-y-6">
                         {/* Vertical Line */}
                         <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-base-300" />

                         {timelineEvents.length > 0 ? (
                           timelineEvents.map((event, i) => (
                             <motion.div 
                               initial={{ opacity: 0, x: 10 }}
                               animate={{ opacity: 1, x: 0 }}
                               transition={{ delay: i * 0.05 }}
                               key={i} 
                               className="relative"
                             >
                               {/* Timeline Dot */}
                               <div className={`absolute left-[-21px] w-4 h-4 rounded-full border-4 border-base-100 ${event.bg} ring-2 ring-base-300 z-10`} />
                               
                               <div className="bg-base-100 rounded-2xl p-5 border border-base-300 shadow-sm hover:border-emerald-500/30 transition-all">
                                  <div className="flex justify-between items-start mb-3">
                                     <div className={`p-2 rounded-xl ${event.bg} ${event.color}`}>
                                        <event.icon size={16} />
                                     </div>
                                     <span className="text-[9px] font-black text-base-content/20 uppercase">
                                        {formatDate(event.date)}
                                     </span>
                                  </div>
                                  <h4 className="text-sm font-black text-base-content tracking-tighter mb-1 uppercase">
                                     {event.title}
                                  </h4>
                                  <p className="text-[10px] font-bold text-base-content/40 leading-relaxed">
                                     {event.desc}
                                  </p>
                                  {event.status && (
                                    <div className="mt-3 pt-3 border-t border-base-200 flex justify-between items-center">
                                       <span className="text-[8px] font-black uppercase tracking-widest text-base-content/20">Status</span>
                                       <span className={`text-[9px] font-black uppercase tracking-widest ${event.status === 'Positive' || event.status === 'done' || event.status === 'resolved' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                          {event.status}
                                       </span>
                                    </div>
                                  )}
                               </div>
                             </motion.div>
                           ))
                         ) : (
                           <div className="text-center py-10 opacity-20">
                              <p className="text-[9px] font-black uppercase tracking-[0.2em]">No historical data found</p>
                           </div>
                         )}
                      </div>
                   </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-base-200/50 border-t border-base-300">
               <button 
                 onClick={onClose}
                 className="w-full h-12 bg-base-200 hover:bg-base-300 border border-base-300 text-base-content/70 hover:text-base-content font-black rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer"
               >
                 Dismiss History
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AnimalHistoryDrawer;
