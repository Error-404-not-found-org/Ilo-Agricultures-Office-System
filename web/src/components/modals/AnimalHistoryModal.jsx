import React, { useState, useEffect } from "react";
import {
  X,
  Syringe,
  HeartPulse,
  CheckCircle2,
  FileText,
  Loader2,
  Calendar,
  User,
  MapPin,
  Info,
  History,
  ShieldCheck,
  Clock,
  Dna,
  BadgeCheck,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../lib/axios";

export default function AnimalHistoryModal({ isOpen, onClose, animalId }) {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (isOpen && animalId) {
      setLoading(true);
      const fetchHistory = async () => {
        try {
          const response = await axiosInstance.get(
            `/technician/animal-history/${animalId}`,
          );
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

  const formatDate = (date) => {
    if (!date) return "---";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const animal = historyData?.animal || {};
  const timeline = historyData?.timeline || [];

  const FieldItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-base-200/50 last:border-none">
      <div className="flex items-center gap-2.5 min-w-[110px]">
        <div className="flex h-7 w-7 items-center justify-center rounded-none bg-emerald-500/5 text-emerald-600">
          <Icon size={12} strokeWidth={2.5} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-base-content/30">
          {label}
        </span>
      </div>
      <div className="flex-1 text-right">
        <p className="text-[11px] font-bold text-base-content leading-tight truncate">
          {value || "---"}
        </p>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
        {/* BACKDROP */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        />

        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full max-w-lg overflow-hidden rounded-none border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-200 bg-base-200/30 px-5 py-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-base-content">
                Animal Registry <span className="text-emerald-500">& Timeline</span>
              </h3>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25">
                Technical Asset Ledger
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-none bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content"
            >
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 custom-scrollbar bg-base-100">
            {/* ANIMAL PROFILE STRIP */}
            <div className="flex items-center gap-4 bg-emerald-500/2 px-5 py-5 border-b border-base-200/50">
              <div className="h-14 w-14 overflow-hidden rounded-none border border-base-300 bg-white shadow-sm shrink-0">
                {animal.imageUrl ? (
                  <img
                    src={animal.imageUrl.replace("/upload/", "/upload/f_auto,q_auto,w_100,c_fill/")}
                    alt="Animal"
                    className="h-full w-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-base-200 text-emerald-600/20">
                    <span className="text-2xl">🐄</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-black tracking-tighter text-base-content truncate uppercase">
                    Tag #{animal.earTag || "---"}
                  </h2>
                  <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                    {animal.breed || "Crossbreed"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-base-content/40">
                   <span className="flex items-center gap-1">
                      <User size={10} className="text-emerald-500" />
                      {animal.farmerId?.name || "Unknown Owner"}
                   </span>
                   <span className="h-0.5 w-0.5 rounded-full bg-base-content/20"></span>
                   <span className="uppercase">{animal.reproductiveStatus || "Normal"}</span>
                </div>
              </div>
            </div>

            {/* STATUS ALERT SECTION */}
            <div className="p-5">
               {animal.reproductiveStatus && animal.reproductiveStatus !== "Normal" && (
                  <div className="flex gap-3 rounded-none border border-emerald-500/20 bg-emerald-500/3 p-4 mb-6">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-emerald-500 text-white shadow-lg shadow-emerald-500/10">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[11px] font-black uppercase tracking-tight text-base-content">
                        Current technical Standing
                      </h5>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-base-content/50 uppercase font-bold">
                        Asset is {animal.reproductiveStatus}. Ensure protocols are active.
                      </p>
                    </div>
                  </div>
               )}

               {/* TIMELINE SECTION */}
               <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <History size={14} className="text-emerald-500" />
                    <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-base-content/40">Chronological Ledger</h4>
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                      <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">Synchronizing records...</p>
                    </div>
                  ) : timeline.length > 0 ? (
                    <div className="space-y-4">
                      {timeline.map((event) => (
                        <div 
                          key={event._id}
                          className="rounded-none border border-base-200 bg-base-200/20 overflow-hidden"
                        >
                          <button 
                            onClick={() => setExpandedId(expandedId === event._id ? null : event._id)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-base-200/30 transition-all"
                          >
                            <div className="flex items-center gap-4">
                               <div className={`w-8 h-8 flex items-center justify-center text-white shadow-md ${
                                 event.status?.toLowerCase() === "done" ? "bg-emerald-500 shadow-emerald-500/20" : "bg-base-300 text-base-content/40"
                               }`}>
                                  {event.iconType === "Syringe" && <Syringe size={14} />}
                                  {event.iconType === "HeartPulse" && <HeartPulse size={14} />}
                                  {event.iconType === "CheckCircle2" && <CheckCircle2 size={14} />}
                                  {event.iconType === "FileText" && <FileText size={14} />}
                               </div>
                               <div>
                                  <h5 className="text-xs font-black text-base-content uppercase tracking-tight">{event.title}</h5>
                                  <p className="text-[9px] font-bold text-base-content/30 uppercase mt-0.5">{formatDate(event.date)}</p>
                               </div>
                            </div>
                            <X size={12} className={`text-base-content/20 transition-transform ${expandedId === event._id ? 'rotate-45' : 'rotate-0'}`} />
                          </button>

                          <AnimatePresence>
                            {expandedId === event._id && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                className="overflow-hidden bg-base-100/50"
                              >
                                <div className="p-4 border-t border-base-200/50">
                                   <div className="mb-4">
                                      <p className="text-[10px] italic leading-relaxed text-base-content/60">
                                        "{event.description}"
                                      </p>
                                   </div>

                                   <div className="grid grid-cols-1 gap-1">
                                      {event.type === "Insemination" && (
                                        <>
                                          <FieldItem icon={Dna} label="Sire Breed" value={event.details?.sireBreed} />
                                          <FieldItem icon={BadgeCheck} label="Sire Code" value={event.details?.sireCode} />
                                          <FieldItem icon={History} label="Attempt" value={`#${event.details?.attemptNumber}`} />
                                        </>
                                      )}
                                      {event.type === "Pregnancy Check" && (
                                        <>
                                          <FieldItem icon={Sparkles} label="Result" value={event.details?.result} />
                                          <FieldItem icon={Calendar} label="Expected" value={formatDate(event.details?.targetCalvingDate)} />
                                        </>
                                      )}
                                      {event.type === "Health" && (
                                        <>
                                          <FieldItem icon={Info} label="Findings" value={event.details?.diagnosis} />
                                          <FieldItem icon={Syringe} label="Treatment" value={event.details?.treatment} />
                                        </>
                                      )}
                                   </div>

                                   <div className="mt-4 pt-4 border-t border-base-200/50 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                         <User size={10} className="text-emerald-500" />
                                         <span className="text-[9px] font-black text-base-content/40 uppercase">{event.technicianName || "System Hub"}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                         <MapPin size={10} className="text-emerald-500" />
                                         <span className="text-[9px] font-black text-base-content/40 uppercase">{event.technicianLocation || "Oton hub"}</span>
                                      </div>
                                   </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-base-300">
                       <FileText size={24} className="text-base-content/10 mb-2" />
                       <p className="text-[9px] font-black uppercase tracking-widest text-base-content/20">Empty Registry</p>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-t border-base-200 bg-base-200/20 px-5 py-3 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#074033] hover:bg-[#0a5242] text-white text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-emerald-900/20"
            >
              Dismiss Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
