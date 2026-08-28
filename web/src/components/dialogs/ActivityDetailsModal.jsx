import { useEffect, useRef } from "react";
import {
  X, 
  Syringe, 
  HeartPulse, 
  CheckCircle2, 
  FileText, 
  User, 
  MapPin, 
  Info,
  Clock,
  ShieldCheck,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { statusBadgeClass } from "../ui/uiClasses";

export default function ActivityDetailsModal({ isOpen, onClose, activity, onOpenSource }) {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        )];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !activity) return null;

  const details = activity.details || {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-details-title"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-base-100 border border-base-300 rounded-box w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative"
        >
          {/* HEADER */}
          <div className="px-6 py-5 border-b border-base-300 bg-base-200/40 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-neutral text-neutral-content shadow-md">
                {activity.iconType === "Syringe" && <Syringe size={20} />}
                {activity.iconType === "HeartPulse" && <HeartPulse size={20} />}
                {activity.iconType === "CheckCircle2" && <CheckCircle2 size={20} />}
                {activity.iconType === "FileText" && <FileText size={20} />}
              </div>
              <div>
                <h2 id="activity-details-title" className="text-xl font-black text-base-content uppercase tracking-tighter leading-none">
                  Activity <span className="text-primary">Audit</span>
                </h2>
                <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mt-1.5 leading-none">
                  Technical Service Record
                </p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              aria-label="Close activity details"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center text-base-content/40 hover:text-base-content hover:bg-base-200 rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* PRIMARY INFO CARD */}
            <div className="bg-base-200/30 border border-base-300 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-base-content uppercase tracking-tighter leading-tight">
                    {activity.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`badge badge-sm font-black uppercase tracking-widest ${statusBadgeClass(activity.status)}`}>
                      {activity.status}
                    </span>
                    <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock size={11} />
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-base-200 border border-base-300/50 rounded-xl">
                <p className="text-xs text-base-content/60 font-medium leading-relaxed italic">
                  "{activity.description}"
                </p>
              </div>
            </div>

            {/* TECHNICAL SPECS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={15} className="text-primary" />
                <h4 className="text-[10px] font-black text-base-content/40 uppercase tracking-[0.2em]">Technical Metadata</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {activity.type === "Insemination" && (
                  <>
                    <DetailItem label="Sire Breed" value={details.sireBreed} icon={<ShieldCheck size={13} />} />
                    <DetailItem label="Sire Code" value={details.sireCode} icon={<FileText size={13} />} />
                    <DetailItem label="Attempt" value={`#${details.attemptNumber}`} icon={<Activity size={13} />} />
                    <DetailItem label="Estrus" value={details.estrus} icon={<Info size={13} />} />
                  </>
                )}

                {activity.type === "Pregnancy Check" && (
                  <>
                    <DetailItem label="PD Result" value={details.result} color={details.result === 'Pregnant' ? 'text-success' : 'text-neutral'} />
                    <DetailItem label="Expected Calving" value={details.targetCalvingDate ? new Date(details.targetCalvingDate).toLocaleDateString() : 'N/A'} />
                  </>
                )}

                {activity.type === "Health" && (
                  <div className="col-span-2 space-y-4">
                    <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
                      <p className="text-[9px] font-black text-warning uppercase tracking-widest mb-1">Diagnosis</p>
                      <p className="text-sm font-black text-base-content uppercase leading-tight">{details.diagnosis || "General Checkup"}</p>
                    </div>
                    <DetailItem label="Treatment" value={details.treatment || "None Specified"} color="text-primary" fullWidth />
                  </div>
                )}

                {activity.type === "Calving" && (
                  <>
                    <DetailItem label="Offspring Count" value={details.numberOfCalves} />
                    <DetailItem label="Calving Ease" value={details.calvingEase} color="text-info" />
                  </>
                )}
              </div>
            </div>

            {/* OFFICER FOOTER */}
            <div className="pt-6 border-t border-base-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center text-base-content/40 border border-base-300">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest">Attending Officer</p>
                  <p className="text-xs font-black text-base-content uppercase">{activity.technicianName || "Municipal Staff"}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest">Facility</p>
                <div className="flex items-center justify-end gap-1 text-xs font-black text-base-content uppercase">
                  <MapPin size={12} />
                  {activity.technicianLocation || "OTON HUB"}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-base-200/30 border-t border-base-300/80">
            {activity.originId && onOpenSource && (
              <button
                type="button"
                onClick={() => onOpenSource(activity)}
                className="btn btn-outline btn-primary w-full mb-3"
              >
                Open {activity.originLabel || "source request"}
              </button>
            )}
            <button
              onClick={onClose}
              className="btn btn-ghost w-full uppercase tracking-widest"
            >
              Dismiss Audit
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function DetailItem({ label, value, icon, color = "text-base-content", fullWidth = false }) {
  return (
    <div className={`${fullWidth ? 'col-span-2' : ''} space-y-1.5`}>
      <p className="text-[9px] font-black text-base-content/40 uppercase tracking-widest flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div className="bg-base-200/50 border border-base-300 rounded-xl px-4 py-2.5">
        <p className={`text-xs font-black uppercase tracking-tight ${color}`}>{value || "Not Specified"}</p>
      </div>
    </div>
  );
}
