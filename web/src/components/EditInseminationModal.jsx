import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, ChevronDown, BadgeCheck, Syringe, Info, Check, Sparkles } from "lucide-react";
import axios from "../lib/axios";
import { CATTLE_BREEDS } from "../constants/breeds";
import { getSireCodeByBreed } from "../constants/sireRegistry";
import { useToast } from "../contexts/ToastContext";

// Helper to format date for input field (YYYY-MM-DD)
const formatDateForInput = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
};

const EditInseminationModal = ({ isOpen, onClose, insemination, animalId }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formData, setFormData] = useState({
    inseminationDate: "",
    sireBreed: "",
    sireCode: "",
    estrus: "Natural",
    status: "pending",
  });

  useEffect(() => {
    if (insemination) {
      setFormData({
        inseminationDate: formatDateForInput(insemination.inseminationDate),
        sireBreed: insemination.sireBreed || "",
        sireCode: insemination.sireCode || "",
        estrus: insemination.estrus || "Natural",
        status: insemination.status || "pending",
      });
    }
  }, [insemination]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (updatedData) => {
      const response = await axios.put(
        `/insemination/${insemination._id}`,
        updatedData,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal", animalId] });
      queryClient.invalidateQueries({ queryKey: ["technician", "breeding-ledger"] });
      toast.success("AI record updated successfully");
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update record");
    }
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBreedChange = (e) => {
    const breed = e.target.value;
    const code = getSireCodeByBreed(breed);
    setFormData({
      ...formData,
      sireBreed: breed,
      sireCode: code || formData.sireCode
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutate(formData);
  };

  if (!isOpen || !insemination) return null;

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
                Edit AI Record
              </h3>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/25">
                Technical Data Correction — Attempt #{insemination.attemptNumber}
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
            <form id="edit-ai-form" onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-none text-rose-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                  <Info size={14} />
                  {error?.response?.data?.message || "Failed to update record"}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                {/* DATE FIELD */}
                <fieldset className="fieldset col-span-1">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Insemination Date</legend>
                  <div className="relative w-full">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                    <input
                      type="date"
                      name="inseminationDate"
                      value={formData.inseminationDate}
                      onChange={handleChange}
                      className="input input-bordered w-full h-11 pl-10 rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                  </div>
                </fieldset>

                {/* STATUS FIELD */}
                <fieldset className="fieldset col-span-1">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Acceptance Status</legend>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="select select-bordered w-full h-11 min-h-[44px] rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="pending" className="bg-base-100">Pending Acceptance</option>
                    <option value="approved" className="bg-base-100">Approved / Accepted</option>
                    <option value="rejected" className="bg-base-100">Rejected / Cancelled</option>
                    <option value="done" className="bg-base-100">Procedure Done</option>
                  </select>
                </fieldset>

                {/* BREED FIELD */}
                <fieldset className="fieldset col-span-2">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Sire Breed Mapping</legend>
                  <select
                    name="sireBreed"
                    value={formData.sireBreed}
                    onChange={handleBreedChange}
                    className="select select-bordered w-full h-11 min-h-[44px] rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="" className="bg-base-100">Choose Breed...</option>
                    {CATTLE_BREEDS.map((breed) => (
                      <option key={breed} value={breed} className="bg-base-100">{breed}</option>
                    ))}
                  </select>
                </fieldset>

                {/* SIRE CODE (READ ONLY) */}
                <fieldset className="fieldset col-span-2 md:col-span-1">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Authorized Sire Code</legend>
                  <div className="h-11 w-full bg-base-300 border border-base-200 flex items-center px-4 text-base-content/60 select-none">
                    <BadgeCheck size={14} className="mr-2 text-emerald-500/50" />
                    <span className="text-[10px] font-black tracking-widest uppercase italic">
                      {formData.sireCode || "--- --- ---"}
                    </span>
                  </div>
                </fieldset>

                {/* ESTRUS FIELD */}
                <fieldset className="fieldset col-span-2 md:col-span-1">
                  <legend className="fieldset-legend text-[9px] font-black uppercase tracking-[0.2em] text-base-content/40">Estrus Presentation</legend>
                  <select
                    name="estrus"
                    value={formData.estrus}
                    onChange={handleChange}
                    className="select select-bordered w-full h-11 min-h-[44px] rounded-none text-xs font-bold bg-base-200 text-base-content focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="Natural" className="bg-base-100">Natural Estrus</option>
                    <option value="Synchronized" className="bg-base-100">Synchronized Cycle</option>
                  </select>
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
              form="edit-ai-form"
              type="submit"
              className="px-6 py-2 bg-[#074033] text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-800 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10"
              disabled={isPending}
            >
              {isPending ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <>
                  <BadgeCheck size={14} />
                  Commit Changes
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditInseminationModal;
