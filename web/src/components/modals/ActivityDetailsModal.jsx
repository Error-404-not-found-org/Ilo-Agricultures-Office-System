import React from "react";
import { 
  X, 
  Syringe, 
  HeartPulse, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  User, 
  MapPin, 
  Info,
  Clock,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ActivityDetailsModal({ isOpen, onClose, activity }) {
  if (!isOpen || !activity) return null;

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase() || "";
    if (s === "done" || s === "resolved" || s === "approved")
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (s === "pending" || s === "in-progress")
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  };

  const details = activity.details || {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-[#0A1015] rounded-none w-full max-w-lg shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh] overflow-hidden relative border border-slate-200 dark:border-white/5"
        >
          {/* HEADER */}
          <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/2">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-none flex items-center justify-center text-white shadow-lg ${
                activity.iconType === "Syringe" ? "bg-blue-600" : "bg-emerald-600"
              }`}>
                {activity.iconType === "Syringe" && <Syringe size={24} />}
                {activity.iconType === "HeartPulse" && <HeartPulse size={24} />}
                {activity.iconType === "CheckCircle2" && <CheckCircle2 size={24} />}
                {activity.iconType === "FileText" && <FileText size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">
                  Activity <span className="text-emerald-500">Audit</span>
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 leading-none">
                  Technical Service Record
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-none transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {/* PRIMARY INFO CARD */}
            <div className="bg-white dark:bg-white/3 border border-slate-100 dark:border-white/5 rounded-none p-8 mb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-tight">
                    {activity.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-none border uppercase tracking-widest shadow-sm ${getStatusStyle(activity.status)}`}>
                      {activity.status}
                    </span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock size={12} />
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-none border border-slate-100 dark:border-white/5">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic">
                  "{activity.description}"
                </p>
              </div>
            </div>

            {/* TECHNICAL SPECS */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-emerald-500" />
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Technical Metadata</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {activity.type === "Insemination" && (
                  <>
                    <DetailItem label="Sire Breed" value={details.sireBreed} icon={<ShieldCheck size={14} />} color="text-blue-500" />
                    <DetailItem label="Sire Code" value={details.sireCode} icon={<FileText size={14} />} />
                    <DetailItem label="Attempt" value={`#${details.attemptNumber}`} icon={<Activity size={14} />} />
                    <DetailItem label="Estrus" value={details.estrus} icon={<Info size={14} />} />
                  </>
                )}

                {activity.type === "Pregnancy Check" && (
                  <>
                    <DetailItem label="PD Result" value={details.result} color={details.result === 'Pregnant' ? 'text-emerald-500' : 'text-rose-500'} />
                    <DetailItem label="Expected Calving" value={details.targetCalvingDate ? new Date(details.targetCalvingDate).toLocaleDateString() : 'N/A'} />
                  </>
                )}

                {activity.type === "Health" && (
                  <div className="col-span-2 space-y-4">
                    <div className="bg-amber-500/3 border border-amber-500/10 rounded-none p-4">
                      <p className="text-[9px] font-black text-amber-500/50 uppercase tracking-widest mb-1">Diagnosis</p>
                      <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-tight">{details.diagnosis || "General Checkup"}</p>
                    </div>
                    <DetailItem label="Treatment" value={details.treatment || "None Specified"} color="text-emerald-500" fullWidth />
                  </div>
                )}

                {activity.type === "Calving" && (
                  <>
                    <DetailItem label="Offspring Count" value={details.numberOfCalves} />
                    <DetailItem label="Calving Ease" value={details.calvingEase} color="text-blue-500" />
                  </>
                )}
              </div>
            </div>

            {/* OFFICER FOOTER */}
            <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-white/10">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attending Officer</p>
                  <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{activity.technicianName || "Municipal Staff"}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Facility</p>
                <div className="flex items-center justify-end gap-1 text-xs font-black text-slate-600 dark:text-slate-400 uppercase">
                  <MapPin size={12} />
                  {activity.technicianLocation || "OTON HUB"}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50/50 dark:bg-white/2 border-t border-slate-100 dark:border-white/5">
            <button
              onClick={onClose}
              className="w-full h-14 bg-[#074033] hover:bg-[#0a5242] text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-none transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
            >
              Dismiss Audit
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function DetailItem({ label, value, icon, color = "text-slate-800 dark:text-white", fullWidth = false }) {
  return (
    <div className={`${fullWidth ? 'col-span-2' : ''} space-y-1.5`}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-none px-4 py-3">
        <p className={`text-xs font-black uppercase tracking-tight ${color}`}>{value || "Not Specified"}</p>
      </div>
    </div>
  );
}
