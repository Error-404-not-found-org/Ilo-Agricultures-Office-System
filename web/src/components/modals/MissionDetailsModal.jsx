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
  Dna,
  HeartPulse,
  Sparkles,
  StickyNote,
  Timer,
} from "lucide-react";
import { calculateTargetCalvingDate } from "../../utils/cattleCore";

const MissionDetailsModal = ({ isOpen, onClose, task }) => {
  if (!isOpen || !task) return null;

  const animal = task.animal || {};
  const raw = task.raw || {};
  const pregnancy = task.pregnancyCheck || task.pdRecord;
  const calving = task.cdRecord;

  const expectedCalving = task.status === "Pregnant" && raw.inseminationDate && animal.species
    ? calculateTargetCalvingDate(raw.inseminationDate, animal.species, undefined, animal.breed)
    : null;

  const getCycleLabel = () => {
    if (task.status === "Pregnant") return "Gestation Day";
    if (task.status === "Calf Dropped") return "Calf Age";
    return "AI Cycle";
  };

  const getCycleValue = () => {
    if (task.status === "Calf Dropped" && task.cdRecord?.date) {
      const days = Math.floor((new Date() - new Date(task.cdRecord.date)) / (1000 * 60 * 60 * 24));
      return `${days} Days Old`;
    }
    if (raw.inseminationDate) {
      const days = Math.floor((new Date() - new Date(raw.inseminationDate)) / (1000 * 60 * 60 * 24));
      return `Day ${days}`;
    }
    return task.daysSinceAI ? `Day ${task.daysSinceAI}` : "---";
  };

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
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-base-200/50 last:border-none">
      <div className="flex items-center gap-2.5 min-w-[110px]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
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
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        
        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[85vh]"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-base-300 bg-base-200/40 px-6 py-5">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-base-content leading-none">
                Service Details
              </h3>
              <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25 leading-none">
                Technical Service Record
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6 custom-scrollbar">
            {/* PROFILE HEADER */}
            <div className="flex items-center gap-4 bg-base-200/30 p-5 rounded-2xl border border-base-300/80">
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-base-300 bg-base-200 shadow-sm shrink-0">
                {animal.imageUrl ? (
                  <img
                    src={animal.imageUrl}
                    alt="Animal"
                    className="h-full w-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-base-100 text-emerald-600/20">
                    <Syringe size={20} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-black tracking-tighter text-base-content truncate">
                    {task.label}
                  </h2>
                  <span
                    className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded-md
                    ${
                      task.status === "done" || task.status === "resolved"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold text-base-content/40">
                  <span className="flex items-center gap-1">
                    <BadgeCheck size={10} className="text-emerald-500" />
                    TAG #{animal.earTag || "N/A"}
                  </span>
                  <span className="h-0.5 w-0.5 rounded-full bg-base-content/20"></span>
                  <span>{formatDate(task.date)}</span>
                </div>
              </div>
            </div>

            {/* CONTENT GRID */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* GENETIC DATA */}
              <div className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
                <h4 className="mb-3 text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600/70 border-b border-base-300 pb-2">
                  Biological Metrics
                </h4>
                <div className="space-y-0.5">
                  <FieldItem icon={Dna} label="Breed" value={animal.breed} />
                  <FieldItem icon={HeartPulse} label="Estrus" value={raw.estrus} />
                  <FieldItem icon={Syringe} label="Sire" value={raw.sireBreed} />
                  <FieldItem icon={BadgeCheck} label="Sire ID" value={raw.sireCode} />
                  {expectedCalving && (
                    <FieldItem icon={Timer} label="Est. Calving" value={formatDate(expectedCalving)} />
                  )}
                </div>
              </div>

              {/* LOGISTICS DATA */}
              <div className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
                <h4 className="mb-3 text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600/70 border-b border-base-300 pb-2">
                  Service Context
                </h4>
                <div className="space-y-0.5">
                  <FieldItem icon={User} label="Owner" value={task.farmer} />
                  <FieldItem icon={MapPin} label="Zone" value={task.location} />
                  <FieldItem icon={Timer} label={getCycleLabel()} value={getCycleValue()} />
                  <FieldItem icon={Clock} label="T-Time" value={formatTime(task.eventDate || task.date || raw.inseminationDate)} />
                </div>
              </div>
            </div>

            {/* REPORTING SECTION */}
            <div className="space-y-3">
              {pregnancy && (
                <div className="flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/10">
                    <Sparkles size={14} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-black uppercase tracking-tight text-base-content">
                      Pregnancy Diagnosis
                    </h5>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-base-content/50">
                      Result: <span className="font-black text-emerald-600 dark:text-emerald-400">{pregnancy.result || pregnancy.pregnancyDiagnosis?.result || pregnancy.status}</span> on {formatDate(pregnancy.date || pregnancy.pregnancyDiagnosis?.date)}.
                    </p>
                  </div>
                </div>
              )}

              {calving && (
                <div className="flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/10">
                    <Sparkles size={14} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-[11px] font-black uppercase tracking-tight text-base-content">
                      Calving Result
                    </h5>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-base-content/50">
                      Date: <span className="font-black text-emerald-600 dark:text-emerald-400">{formatDate(calving.date)}</span>
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        {calving.numberOfCalves || (calving.calves?.length > 0 ? calving.calves.length : 1)} Calf Born
                      </span>
                      <span className="inline-flex items-center rounded-md bg-base-200/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-base-content/60">
                        Ease: {calving.calvingEase || "Natural"}
                      </span>
                      {calving.calves && calving.calves.length > 0 && (
                        <span className="inline-flex items-center rounded-md bg-base-200/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-base-content/60">
                          Sex: {calving.calves.map(c => c.sex === 'M' ? 'Male' : 'Female').join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(raw.technicianNote || raw.comment) && (
                <div className="flex gap-3 rounded-2xl border border-base-300 bg-base-200/30 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/30">
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

              {!pregnancy && !calving && !raw.technicianNote && !raw.comment && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 py-8 text-base-content/15">
                  <Info size={24} strokeWidth={1} />
                  <p className="mt-2 text-[8px] font-black uppercase tracking-[0.2em]">
                    No additional technical logs
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* FOOTER ACTION */}
          <div className="border-t border-base-300 bg-base-200/20 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
            >
              Dismiss Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MissionDetailsModal;
