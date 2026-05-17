import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, BadgeCheck, Info, Stethoscope, Syringe, FileText } from "lucide-react";
import axios from "../lib/axios";
import { useToast } from "../contexts/ToastContext";

// Helper to format date for input field (YYYY-MM-DDTHH:mm)
const formatDateForInput = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
};

const EditHealthModal = ({ isOpen, onClose, health }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = useState({
    scheduledDate: "",
    status: "pending",
    diagnosis: "",
    treatment: "",
    technicianNote: "",
  });

  useEffect(() => {
    if (health) {
      setFormData({
        scheduledDate: formatDateForInput(health.scheduledDate || health.preferredDate || health.updatedAt),
        status: health.status || "pending",
        diagnosis: health.diagnosis || "",
        treatment: health.treatment || health.medicine || "",
        technicianNote: health.technicianNote || health.comment || "",
      });
    }
  }, [health]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (updatedData) => {
      // Using the status patch endpoint which also accepts diagnosis/treatment
      const response = await axios.patch(
        `/health-request/${health._id}/status`,
        updatedData,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", "breeding-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      toast.success("Health record updated successfully");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update record");
    }
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutate({
      ...formData,
      scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : new Date(),
    });
  };

  if (!isOpen || !health) return null;

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
              <h3 className="text-sm font-black uppercase tracking-tighter text-blue-600">
                Edit Health Record
              </h3>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25">
                Clinical Data Correction — #{health.requestType}
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
          <div className="overflow-y-auto flex-1 custom-scrollbar p-6">
            <form id="edit-health-form" onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-none text-rose-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                  <Info size={14} />
                  {error?.response?.data?.message || "Failed to update record"}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                {/* DATE FIELD */}
                <fieldset className="fieldset col-span-1">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Treatment Date</legend>
                  <div className="relative w-full">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                    <input
                      type="datetime-local"
                      name="scheduledDate"
                      value={formData.scheduledDate}
                      onChange={handleChange}
                      className="input input-bordered w-full h-11 pl-10 rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-blue-500/50"
                      required
                    />
                  </div>
                </fieldset>

                {/* STATUS FIELD */}
                <fieldset className="fieldset col-span-1">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Service Status</legend>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="select select-bordered w-full h-11 min-h-[44px] rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-blue-500/50 cursor-pointer"
                  >
                    <option value="pending" className="bg-base-100">Pending</option>
                    <option value="in-progress" className="bg-base-100">In Progress</option>
                    <option value="cancelled" className="bg-base-100">Cancelled</option>
                    <option value="resolved" className="bg-base-100">Resolved</option>
                  </select>
                </fieldset>

                {/* DIAGNOSIS FIELD */}
                <fieldset className="fieldset col-span-2">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Diagnosis</legend>
                  <div className="relative w-full">
                    <Stethoscope size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                    <input
                      type="text"
                      name="diagnosis"
                      placeholder="Medical diagnosis"
                      value={formData.diagnosis}
                      onChange={handleChange}
                      className="input input-bordered w-full h-11 pl-10 rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </fieldset>

                {/* TREATMENT FIELD */}
                <fieldset className="fieldset col-span-2">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Treatment / Medicine</legend>
                  <div className="relative w-full">
                    <Syringe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                    <input
                      type="text"
                      name="treatment"
                      placeholder="Medication or care provided"
                      value={formData.treatment}
                      onChange={handleChange}
                      className="input input-bordered w-full h-11 pl-10 rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </fieldset>

                {/* TECHNICIAN NOTE FIELD */}
                <fieldset className="fieldset col-span-2">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Technician Note</legend>
                  <div className="relative w-full">
                    <FileText size={14} className="absolute left-3 top-4 text-base-content/30" />
                    <textarea
                      name="technicianNote"
                      placeholder="Additional field observations"
                      value={formData.technicianNote}
                      onChange={handleChange}
                      className="textarea textarea-bordered w-full min-h-[80px] pl-10 pt-3 rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-blue-500/50 resize-none"
                    />
                  </div>
                </fieldset>
              </div>
            </form>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="border-t border-base-200 bg-base-200/20 px-5 py-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-base-300 text-base-content/60 text-[10px] font-black uppercase tracking-widest hover:bg-base-400 hover:text-base-content transition-all"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              form="edit-health-form"
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10"
              disabled={isPending}
            >
              {isPending ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <>
                  <BadgeCheck size={14} />
                  Update Record
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditHealthModal;
