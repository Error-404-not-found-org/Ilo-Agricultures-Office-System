import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  HeartPulse,
  MapPin,
  User,
  CalendarDays,
  ClipboardPen,
  ShieldAlert,
  BadgeCheck,
  Stethoscope,
  Syringe,
  Loader2,
  Trash2,
  Calendar,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { toast } from "sonner";
import {
  SIRE_REGISTRY,
  getSireCodeByBreed,
} from "../../constants/sireRegistry";
import { CATTLE_BREEDS } from "../../constants/breeds";

const inputClass = `w-full h-11 bg-base-200/50 border border-base-200 rounded-none px-4 text-xs font-bold text-base-content placeholder:text-base-content/20 focus:border-emerald-500/30 focus:outline-none transition-all`;
const selectClass = `w-full h-11 bg-base-200/50 border border-base-200 rounded-none px-10 text-xs font-bold text-base-content focus:border-emerald-500/30 focus:outline-none transition-all appearance-none`;
const labelClass = `text-[9px] font-black text-base-content/30 uppercase tracking-[0.2em] ml-1`;
const sectionClass = `bg-base-200/20 border border-base-200 rounded-none p-6 space-y-5`;

const TaskActionModal = ({ isOpen, onClose, task: taskData, onSuccess }) => {
  const queryClient = useQueryClient();

  const [isConfirmingDecline, setIsConfirmingDecline] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [advice, setAdvice] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState("");
  const [estrus, setEstrus] = useState("Natural");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isHealth = taskData?.type === "health";
  const isUrgent = taskData?.urgent;

  const isPending = taskData?.status?.toLowerCase() === "pending";
  const isApproved = taskData?.status?.toLowerCase() === "approved";
  const isInProgress = taskData?.status?.toLowerCase() === "in-progress";

  const isCompleted = ["done", "resolved", "completed"].includes(
    taskData?.status?.toLowerCase(),
  );
  const isArchived = ["rejected", "cancelled"].includes(
    taskData?.status?.toLowerCase(),
  );
  const isReadOnly = isCompleted || isArchived;

  useEffect(() => {
    setIsConfirmingDecline(false);
    setIsSubmitting(false);

    if (taskData) {
      try {
        const dateVal =
          taskData.scheduledDate ||
          taskData.preferredDate ||
          taskData.displayDate ||
          new Date();
        const d = new Date(dateVal);

        setScheduledDate(
          isNaN(d.getTime())
            ? new Date().toISOString().slice(0, 16)
            : new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16),
        );
      } catch (e) {
        setScheduledDate(new Date().toISOString().slice(0, 16));
      }

      setNote(taskData.note || "");
      setDiagnosis(taskData.raw?.diagnosis || "");
      setTreatment(taskData.raw?.treatment || "");
      setAdvice(taskData.raw?.advice || "");
      setSireBreed(taskData.raw?.sireBreed || "");
      setSireCode(taskData.raw?.sireCode || "");
      setEstrus(taskData.raw?.estrus || "Natural");
    }
  }, [taskData, isOpen]);

  if (!isOpen || !taskData) return null;

  const animal = taskData.raw?.animalId || {};
  const preferredDateTime = taskData.preferredDate || taskData.displayDate;

  const handleRejectTask = () => {
    const status = taskData.type === "health" ? "cancelled" : "rejected";
    const endpoint =
      taskData.type === "health"
        ? `/health-request/${taskData.id}/status`
        : `/technician/inseminations/${taskData.id}/status`;

    setIsSubmitting(true);
    toast.promise(
      axiosInstance.patch(endpoint, {
        status,
        technicianNote: note || "Declined by technician.",
      }),
      {
        loading: "Processing decline...",
        success: () => {
          queryClient.invalidateQueries({
            queryKey: ["technician", "dashboard"],
          });
          if (onSuccess) onSuccess();
          onClose();
          return "Mission Declined";
        },
        error: (err) => {
          setIsSubmitting(false);
          return "Error: " + (err.response?.data?.message || err.message);
        },
      },
    );
  };

  const handleAction = () => {
    let status = "";
    if (isPending || isApproved) {
      status = "in-progress";
    } else {
      status = taskData.type === "health" ? "resolved" : "done";
    }

    const endpoint =
      taskData.type === "health"
        ? `/health-request/${taskData.id}/status`
        : `/technician/inseminations/${taskData.id}/status`;

    setIsSubmitting(true);
    toast.promise(
      axiosInstance.patch(endpoint, {
        status,
        technicianNote:
          note || `${isPending ? "Accepted" : "Updated"} by technician.`,
        diagnosis,
        treatment,
        advice,
        sireBreed,
        sireCode,
        estrus,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      }),
      {
        loading: "Updating mission status...",
        success: () => {
          queryClient.invalidateQueries({
            queryKey: ["technician", "dashboard"],
          });
          if (onSuccess) onSuccess();
          onClose();
          return "Mission Synchronized!";
        },
        error: (err) => {
          setIsSubmitting(false);
          return "Error: " + (err.response?.data?.message || err.message);
        },
      },
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          {/* BACKDROP */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
          />

          {/* MODAL CONTAINER */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-none border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-base-200 bg-base-200/30 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-emerald-500/5 border border-emerald-500/10 rounded-none flex items-center justify-center text-emerald-600 shadow-sm">
                  {isHealth ? <HeartPulse size={20} /> : <Syringe size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tighter text-base-content">
                    {isHealth
                      ? "Medical Diagnostic Protocol"
                      : "Artificial Insemination Protocol"}
                  </h3>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25">
                    Field Mission Operations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-none bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="overflow-y-auto flex-1 custom-scrollbar px-6 py-6 space-y-6">
              {/* SECTION 1: REGISTRY & ASSET PROFILE */}
              <section className={sectionClass}>
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-emerald-600" />
                  <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                    Registry Selection
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className={labelClass}>Farmer Record</label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="text"
                        readOnly
                        value={taskData.farmer || "Unknown Farmer"}
                        className={`${inputClass} pl-11 bg-base-200/30 cursor-not-allowed`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Animal Asset (Ear Tag)</label>
                    <div className="relative">
                      <HeartPulse
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                      />
                      <input
                        type="text"
                        readOnly
                        value={`Tag #${animal.earTag || "No Tag"} — ${animal.breed || "Unknown Breed"}`}
                        className={`${inputClass} pl-11 bg-base-200/30 cursor-not-allowed`}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-base-200/50">
                  <div className="space-y-2">
                    <label className={labelClass}>Mission Status</label>
                    <div className="relative flex items-center h-11 bg-base-200/30 border border-base-200 px-4">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest
                        ${isPending ? "text-amber-500" : isApproved ? "text-emerald-500" : "text-blue-500"}
                      `}
                      >
                        {taskData.status || "Unknown"}
                      </span>
                    </div>
                  </div>

                  {isPending && preferredDateTime && (
                    <div className="space-y-2">
                      <label className={labelClass}>
                        Farmer Preferred Time
                      </label>
                      <div className="relative flex items-center h-11 bg-amber-500/5 border border-amber-500/20 px-4 text-[10px] font-black uppercase tracking-widest text-amber-600 gap-2">
                        <Clock3 size={12} />
                        {new Date(preferredDateTime).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 2: SERVICE METRICS & PARAMETERS */}
              <section className={sectionClass}>
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardPen size={14} className="text-emerald-600" />
                  <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                    Service Metrics
                  </h4>
                </div>

                {/* AI SPECIFIC FIELDS */}
                {!isHealth && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <label className={labelClass}>Sire Breed</label>
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                        />
                        <select
                          disabled={isReadOnly}
                          value={sireBreed}
                          onChange={(e) => {
                            const breed = e.target.value;
                            setSireBreed(breed);
                            const code = getSireCodeByBreed(breed);
                            if (code) setSireCode(code);
                          }}
                          className={selectClass}
                        >
                          <option value="" disabled>
                            Select Sire Breed
                          </option>
                          {CATTLE_BREEDS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Sire Code</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={sireCode}
                        onChange={(e) => setSireCode(e.target.value)}
                        placeholder="e.g. 507HO12345"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Estrus Cycle</label>
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                        />
                        <select
                          disabled={isReadOnly}
                          value={estrus}
                          onChange={(e) => setEstrus(e.target.value)}
                          className={selectClass}
                        >
                          <option value="Natural">Natural</option>
                          <option value="Synchronized">Synchronized</option>
                          <option value="Induced">Induced</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* HEALTH SPECIFIC FIELDS */}
                {isHealth && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className={labelClass}>Medical Diagnosis</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="Enter diagnosis findings"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Prescribed Treatment</label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={treatment}
                        onChange={(e) => setTreatment(e.target.value)}
                        placeholder="e.g. Antibiotics, Deworming, Rest"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* SECTION 3: SCHEDULE & OBSERVATIONS */}
              <section className={sectionClass}>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays size={14} className="text-emerald-600" />
                  <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                    Schedule & Findings
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className={labelClass}>Scheduled Date & Time</label>
                    <div className="relative">
                      <Calendar
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                        size={16}
                      />
                      <input
                        type="datetime-local"
                        disabled={isReadOnly}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>
                      Technician Notes & Observations
                    </label>
                    <textarea
                      disabled={isReadOnly}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Enter technician observations or mission notes..."
                      className="w-full min-h-[44px] max-h-[120px] bg-base-200/50 border border-base-200 rounded-none p-3 text-xs font-bold text-base-content placeholder:text-base-content/20 focus:border-emerald-500/30 focus:outline-none transition-all resize-y"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* FOOTER */}
            <div className="bg-base-200/20 border-t border-base-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                onClick={handleRejectTask}
                disabled={isSubmitting || isReadOnly}
                className="flex items-center gap-2 px-6 py-3 rounded-none hover:bg-red-800 hover:text-white text-rose-500 bg-rose-500/10 transition-all text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
              >
                <Trash2 size={14} />
                Decline
              </button>

              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-none h-11 px-8 rounded-none bg-base-200 hover:bg-base-300 text-[9px] font-black uppercase tracking-widest transition-all text-base-content/40"
                >
                  Close
                </button>
                <button
                  onClick={handleAction}
                  disabled={isSubmitting || isReadOnly}
                  className="flex-1 sm:flex-none h-11 px-10 rounded-none text-white text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-emerald-950/20 bg-[#074033] hover:bg-[#0a5242]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Synchronizing...
                    </>
                  ) : (
                    <>
                      <BadgeCheck size={14} />
                      {isPending || isApproved
                        ? "Accept & Start"
                        : "Save Changes"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TaskActionModal;
