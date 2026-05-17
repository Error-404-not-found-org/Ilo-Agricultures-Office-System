import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  X,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  User,
  ShieldCheck,
  Loader2,
  ChevronDown,
  BadgeCheck,
  Info,
  Search,
} from "lucide-react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { OTON_BARANGAYS } from "../../constants/barangays";

const inputClass = `w-full h-11 bg-base-200/50 border border-base-200 rounded-none px-4 pl-11 text-xs font-bold text-base-content placeholder:text-base-content/20 focus:border-emerald-500/30 focus:outline-none transition-all`;
const labelClass = `text-[9px] font-black text-base-content/30 uppercase tracking-[0.2em] ml-1`;
const sectionClass = `bg-base-200/20 border border-base-200 rounded-none p-6 space-y-5`;

const RegisterFarmerModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",

    barangay: "",
    city: "Oton",
    province: "Iloilo",
  });

  // REGISTER
  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post("/technician/register-farmer", {
        ...data,
        address: {

          barangay: data.barangay,
          city: data.city,
          province: data.province,
        },
      });

      return res.data;
    },

    onSuccess: () => {
      toast.success("Farmer profile created successfully!");

      queryClient.invalidateQueries({
        queryKey: ["technician", "dashboard"],
      });

      onClose();

      setFormData({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        email: "",

        barangay: "",
        city: "Oton",
        province: "Iloilo",
      });
    },

    onError: (error) => {
      toast.error(error.response?.data?.message || "Registration failed.");
    },
  });

  if (!isOpen) return null;

  const handleNameChange = (e, field) => {
    // Only allow letters, spaces, and hyphens
    const value = e.target.value.replace(/[^a-zA-Z\sñÑ-]/g, "");
    if (value.length <= 50) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handlePhoneChange = (e) => {
    // Only allow numbers
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (value.length <= 11) {
      setFormData({ ...formData, phoneNumber: value });
    }
  };

  const handleSubmit = () => {
    if (!formData.firstName.trim()) {
      return toast.error("First name is required.");
    }

    if (!formData.lastName.trim()) {
      return toast.error("Last name is required.");
    }

    if (formData.phoneNumber.length < 11) {
      return toast.error("Phone number must be exactly 11 digits.");
    }

    if (!formData.phoneNumber.startsWith("09")) {
      return toast.error("Phone number must start with 09.");
    }

    if (!formData.barangay) {
      return toast.error("Barangay is required.");
    }

    if (!formData.city.trim()) {
      return toast.error("Municipality is required.");
    }

    mutation.mutate(formData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
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
            initial={{
              opacity: 0,
              scale: 0.97,
              y: 10,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: 10,
            }}
            transition={{
              duration: 0.15,
            }}
            className="relative w-full max-w-4xl overflow-hidden rounded-none border border-base-300 bg-base-100 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-base-200 bg-base-200/30 px-8 py-5">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-emerald-500/5 border border-emerald-500/10 rounded-none flex items-center justify-center text-emerald-600 shadow-sm">
                  <UserPlus size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-base-content">
                    Farmer Registry
                  </h3>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.3em] text-base-content/25">
                    Municipal Personnel Protocol
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-none bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content"
              >
                <X size={18} />
              </button>
            </div>

            {/* CONTENT */}
            <div className="overflow-y-auto flex-1 custom-scrollbar px-8 py-8 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
                {/* LEFT PANEL: ADVISORY */}
                <div className="space-y-6">
                  <div className="bg-[#074033] p-6 rounded-none text-white shadow-xl shadow-emerald-950/20">
                    <ShieldCheck size={32} className="text-emerald-400 mb-4" />
                    <h4 className="text-sm font-black uppercase tracking-widest">
                      Protocol Verified
                    </h4>
                    <p className="text-[11px] font-bold text-emerald-100/60 uppercase mt-2 leading-relaxed tracking-wider">
                      This registry entry creates a verified municipal profile
                      for field operations tracking.
                    </p>
                  </div>

                  <div className="bg-base-200/50 p-6 border border-base-200 rounded-none">
                    <Info size={16} className="text-emerald-600 mb-3" />
                    <h5 className="text-[10px] font-black text-base-content uppercase tracking-widest">
                      Ownership Link
                    </h5>
                    <p className="text-[9px] font-bold text-base-content/40 uppercase mt-2 leading-relaxed tracking-wider">
                      Profile information is securely linked with future
                      livestock operational records.
                    </p>
                  </div>
                </div>

                {/* RIGHT PANEL: FORM */}
                <div className="space-y-6">
                  <section className={sectionClass}>
                    <div className="flex items-center gap-2 mb-2">
                      <User size={14} className="text-emerald-500" />
                      <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                        Personnel Data
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelClass}>First Name</label>
                        <div className="relative">
                          <User
                            size={16}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                          />
                          <input
                            type="text"
                            placeholder="JUAN"
                            value={formData.firstName}
                            onChange={(e) => handleNameChange(e, "firstName")}
                            maxLength={50}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Last Name</label>
                        <div className="relative">
                          <User
                            size={16}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                          />
                          <input
                            type="text"
                            placeholder="DELA CRUZ"
                            value={formData.lastName}
                            onChange={(e) => handleNameChange(e, "lastName")}
                            maxLength={50}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={sectionClass}>
                    <div className="flex items-center gap-2 mb-2">
                      <Phone size={14} className="text-emerald-500" />
                      <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                        Communication Hub
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelClass}>Contact Number</label>
                        <div className="relative">
                          <Phone
                            size={16}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                          />
                          <input
                            type="tel"
                            placeholder="0912 345 6789"
                            value={formData.phoneNumber}
                            onChange={handlePhoneChange}
                            maxLength={11}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>
                          Email (Protocol Optional)
                        </label>
                        <div className="relative">
                          <Mail
                            size={16}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                          />
                          <input
                            type="email"
                            placeholder="juan@gmail.com"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                email: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={sectionClass}>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={14} className="text-emerald-500" />
                      <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em]">
                        Geographic Deployment
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">



















                      <div className="space-y-2">
                        <label className={labelClass}>Barangay Sector</label>
                        <div className="relative">
                          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 z-10" />
                          <input
                            type="text"
                            placeholder="SEARCH BARANGAY..."
                            value={formData.barangay}
                            onChange={(e) => {
                                setFormData({ ...formData, barangay: e.target.value.toUpperCase() });
                                setIsBarangayDropdownOpen(true);
                            }}
                            onFocus={() => setIsBarangayDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsBarangayDropdownOpen(false), 200)}
                            className={`${inputClass} px-11`}
                          />

                          <AnimatePresence>
                            {isBarangayDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto border border-base-200 bg-base-100 shadow-xl custom-scrollbar"
                              >
                                {OTON_BARANGAYS.filter((b) =>
                                  b.toLowerCase().includes(formData.barangay.toLowerCase())
                                ).length > 0 ? (
                                  OTON_BARANGAYS.filter((b) =>
                                    b.toLowerCase().includes(formData.barangay.toLowerCase())
                                  ).map((b) => (
                                    <button
                                      key={b}
                                      onClick={() => {
                                        setFormData({ ...formData, barangay: b });
                                        setIsBarangayDropdownOpen(false);
                                      }}
                                      type="button"
                                      className="w-full px-4 py-3 text-left transition-colors hover:bg-emerald-500/10 flex items-center border-b border-base-200/50 last:border-0"
                                    >
                                      <span className="text-xs font-bold text-base-content block uppercase">
                                        {b}
                                      </span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="py-6 text-center text-[10px] font-black text-base-content/20 uppercase tracking-widest">
                                    No matching barangay
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Municipality</label>
                        <div className="relative">
                          <MapPin
                            size={16}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
                          />
                          <input
                            type="text"
                            placeholder="OTON"
                            value={formData.city}
                            onChange={(e) => {
                              const value = e.target.value.replace(
                                /[^a-zA-Z\sñÑ-]/g,
                                "",
                              );
                              if (value.length <= 50) {
                                setFormData({ ...formData, city: value });
                              }
                            }}
                            maxLength={50}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-8 py-5 border-t border-base-200 bg-base-200/20 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="h-11 px-8 rounded-none bg-base-200 hover:bg-base-300 text-[9px] font-black uppercase tracking-widest transition-all text-base-content/40"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={mutation.isPending}
                className="h-11 px-10 rounded-none bg-[#074033] hover:bg-[#0a5242] text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-950/20 flex items-center gap-3 disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    <BadgeCheck size={14} />
                    Confirm Registration
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RegisterFarmerModal;
