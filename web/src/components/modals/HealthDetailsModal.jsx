import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Syringe,
  User,
  MapPin,
  Info,
  BadgeCheck,
  Clock,
  HeartPulse,
  StickyNote,
  AlertCircle,
} from "lucide-react";

const HealthDetailsModal = ({ isOpen, onClose, task }) => {
  if (!isOpen || !task) return null;

  const animal = task.animal || {};
  const raw = task.raw || {};

  const formatDate = (date) => {
    if (!date) return "---";

    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    if (!date) return "---";

    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const FieldItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-base-200/50 last:border-none">
      <div className="flex items-center gap-2.5 min-w-[110px]">
        <div className="flex h-7 w-7 items-center justify-center rounded-none bg-blue-500/5 text-blue-600">
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
      <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
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
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-lg overflow-hidden rounded-none border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[85vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-200 bg-base-200/30 px-5 py-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-base-content">
                Health Consultation Details
              </h3>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25">
                Clinical Service Record
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-none bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content"
            >
              <X size={14} />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {/* PROFILE HEADER */}
            <div className="flex items-center gap-4 bg-blue-500/2 px-5 py-5 border-b border-base-200/50">
              <div className="h-14 w-14 overflow-hidden rounded-none border border-base-300 bg-white shadow-sm shrink-0">
                {animal.imageUrl ? (
                  <img
                    src={animal.imageUrl}
                    alt="Animal"
                    className="h-full w-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-base-100 text-blue-600/20">
                    <HeartPulse size={20} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-black tracking-tighter text-base-content truncate">
                    {task.label || "Health Check"}
                  </h2>
                  <span
                    className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest border
                    ${
                      task.status === "Completed" || task.status === "done" || task.status === "resolved"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold text-base-content/40">
                  <span className="flex items-center gap-1">
                    <BadgeCheck size={10} className="text-blue-500" />
                    TAG #{animal.earTag || "N/A"}
                  </span>
                  <span className="h-0.5 w-0.5 rounded-full bg-base-content/20"></span>
                  <span>{formatDate(task.date || task.eventDate)}</span>
                </div>
              </div>
            </div>

            {/* CONTENT GRID */}
            <div className="p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* METRICS DATA */}
                <div className="rounded-none border border-base-200 bg-base-200/20 p-4">
                  <h4 className="mb-3 text-[9px] font-black uppercase tracking-[0.25em] text-blue-600/70 border-b border-blue-500/10 pb-2">
                    Clinical Metrics
                  </h4>
                  <div className="space-y-0.5">
                    <FieldItem icon={HeartPulse} label="Req Type" value={raw.requestType} />
                    <FieldItem icon={Info} label="Diagnosis" value={raw.diagnosis} />
                    <FieldItem icon={Syringe} label="Treatment" value={raw.treatment || raw.medicine} />
                    <FieldItem icon={BadgeCheck} label="Symptoms" value={raw.symptoms} />
                  </div>
                </div>

                {/* LOGISTICS DATA */}
                <div className="rounded-none border border-base-200 bg-base-200/20 p-4">
                  <h4 className="mb-3 text-[9px] font-black uppercase tracking-[0.25em] text-blue-600/70 border-b border-blue-500/10 pb-2">
                    Service Context
                  </h4>
                  <div className="space-y-0.5">
                    <FieldItem icon={User} label="Owner" value={task.farmer} />
                    <FieldItem icon={MapPin} label="Zone" value={task.location} />
                    <FieldItem icon={AlertCircle} label="Priority" value={task.urgency || raw.urgency} />
                    <FieldItem icon={Clock} label="T-Time" value={formatTime(task.date || task.eventDate)} />
                  </div>
                </div>
              </div>

              {/* REPORTING SECTION */}
              <div className="mt-4 space-y-3">
                {(raw.technicianNote || raw.comment) && (
                  <div className="flex gap-3 rounded-none border border-base-200 bg-base-200/30 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-base-200 text-base-content/30">
                      <StickyNote size={14} />
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[11px] font-black uppercase tracking-tight text-base-content">
                        Field Observations
                      </h5>
                      <p className="mt-1 text-[11px] italic leading-relaxed text-base-content/60">
                        "{raw.technicianNote || raw.comment}"
                      </p>
                    </div>
                  </div>
                )}

                {!raw.technicianNote && !raw.comment && (
                  <div className="flex flex-col items-center justify-center rounded-none border border-dashed border-base-200 py-8 text-base-content/15">
                    <Info size={24} strokeWidth={1} />
                    <p className="mt-2 text-[8px] font-black uppercase tracking-[0.2em]">
                      No additional technical logs
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER ACTION */}
          <div className="border-t border-base-200 bg-base-200/20 px-5 py-3 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-colors"
            >
              Dismiss Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default HealthDetailsModal;
